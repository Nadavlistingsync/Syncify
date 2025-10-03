import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { force = false } = body

    // Run compactor job
    const result = await runCompactorJob(supabase, user.id, force)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Compactor API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function runCompactorJob(supabase: any, userId: string, force: boolean = false) {
  const results = {
    processed_conversations: 0,
    created_summaries: 0,
    updated_memories: 0,
    decayed_memories: 0,
    errors: []
  }

  try {
    // Get conversations that need compaction
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select(`
        *,
        messages (
          id,
          role,
          content,
          ts
        )
      `)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(force ? 100 : 10) // Limit for performance

    if (convError) throw convError

    for (const conversation of conversations || []) {
      try {
        results.processed_conversations++
        
        // Check if conversation needs compaction
        if (!shouldCompactConversation(conversation, force)) {
          continue
        }

        // Summarize long conversations
        if (conversation.messages && conversation.messages.length > 20) {
          const summary = await createConversationSummary(conversation)
          if (summary) {
            // Store summary as a memory
            const { error: memoryError } = await supabase
              .from('memories')
              .insert({
                user_id: userId,
                type: 'note',
                content: `Conversation summary: ${summary}`,
                importance: 6,
                pii: false
              })

            if (!memoryError) {
              results.created_summaries++
            }
          }
        }

        // Extract key insights from conversations
        const insights = await extractConversationInsights(conversation)
        for (const insight of insights) {
          const { error: insightError } = await supabase
            .from('memories')
            .insert({
              user_id: userId,
              type: insight.type,
              content: insight.content,
              importance: insight.importance,
              pii: insight.pii || false
            })

          if (!insightError) {
            results.updated_memories++
          }
        }

      } catch (error) {
        console.error('Error processing conversation:', error)
        results.errors.push({
          conversation_id: conversation.id,
          error: error.message
        })
      }
    }

    // Decay old, low-importance memories
    const decayResult = await decayOldMemories(supabase, userId)
    results.decayed_memories = decayResult.decayed_count

    // Clean up old events (keep last 1000 per user)
    await cleanupOldEvents(supabase, userId)

    return results

  } catch (error) {
    console.error('Compactor job failed:', error)
    results.errors.push({
      general: error.message
    })
    return results
  }
}

function shouldCompactConversation(conversation: any, force: boolean): boolean {
  if (force) return true
  
  // Compact if conversation is older than 7 days and has many messages
  const conversationAge = Date.now() - new Date(conversation.created_at).getTime()
  const ageInDays = conversationAge / (1000 * 60 * 60 * 24)
  
  return ageInDays > 7 && conversation.messages && conversation.messages.length > 10
}

async function createConversationSummary(conversation: any): Promise<string | null> {
  try {
    // Simple extraction of key topics and outcomes
    const messages = conversation.messages || []
    const userMessages = messages.filter((m: any) => m.role === 'user')
    const assistantMessages = messages.filter((m: any) => m.role === 'assistant')
    
    if (userMessages.length === 0) return null

    // Extract main topics from user messages
    const topics = extractTopics(userMessages.map((m: any) => m.content))
    
    // Extract key outcomes from assistant messages
    const outcomes = extractOutcomes(assistantMessages.map((m: any) => m.content))
    
    const summary = `Topics discussed: ${topics.join(', ')}. Key outcomes: ${outcomes.join(', ')}.`
    
    return summary.length > 500 ? summary.substring(0, 497) + '...' : summary
    
  } catch (error) {
    console.error('Error creating conversation summary:', error)
    return null
  }
}

async function extractConversationInsights(conversation: any): Promise<any[]> {
  const insights = []
  const messages = conversation.messages || []
  
  try {
    // Look for preferences mentioned
    const preferences = extractPreferences(messages)
    preferences.forEach(pref => {
      insights.push({
        type: 'preference',
        content: pref,
        importance: 7,
        pii: false
      })
    })

    // Look for facts learned
    const facts = extractFacts(messages)
    facts.forEach(fact => {
      insights.push({
        type: 'fact',
        content: fact,
        importance: 6,
        pii: false
      })
    })

    // Look for skills mentioned
    const skills = extractSkills(messages)
    skills.forEach(skill => {
      insights.push({
        type: 'skill',
        content: skill,
        importance: 8,
        pii: false
      })
    })

  } catch (error) {
    console.error('Error extracting insights:', error)
  }

  return insights
}

function extractTopics(messages: string[]): string[] {
  const topics = new Set<string>()
  
  // Simple keyword extraction
  const commonTopics = [
    'coding', 'programming', 'development', 'software',
    'design', 'ui', 'ux', 'frontend', 'backend',
    'database', 'api', 'authentication', 'security',
    'machine learning', 'ai', 'data science',
    'business', 'marketing', 'strategy', 'finance',
    'writing', 'content', 'blog', 'documentation'
  ]
  
  messages.forEach(message => {
    const lowerMessage = message.toLowerCase()
    commonTopics.forEach(topic => {
      if (lowerMessage.includes(topic)) {
        topics.add(topic)
      }
    })
  })
  
  return Array.from(topics).slice(0, 5) // Limit to 5 topics
}

function extractOutcomes(messages: string[]): string[] {
  const outcomes = []
  
  // Look for solutions, answers, or conclusions
  const outcomeIndicators = [
    'solution:', 'answer:', 'conclusion:', 'result:',
    'here\'s how', 'the way to', 'you should',
    'recommend', 'suggest', 'best practice'
  ]
  
  messages.forEach(message => {
    const lowerMessage = message.toLowerCase()
    outcomeIndicators.forEach(indicator => {
      if (lowerMessage.includes(indicator)) {
        // Extract the sentence containing the indicator
        const sentences = message.split(/[.!?]+/)
        sentences.forEach(sentence => {
          if (sentence.toLowerCase().includes(indicator)) {
            outcomes.push(sentence.trim())
          }
        })
      }
    })
  })
  
  return outcomes.slice(0, 3) // Limit to 3 outcomes
}

function extractPreferences(messages: any[]): string[] {
  const preferences = []
  
  // Look for preference indicators
  const preferenceIndicators = [
    'i prefer', 'i like', 'i want', 'i need',
    'favorite', 'best', 'ideal', 'perfect'
  ]
  
  messages.forEach(message => {
    const lowerMessage = message.content?.toLowerCase() || ''
    preferenceIndicators.forEach(indicator => {
      if (lowerMessage.includes(indicator)) {
        preferences.push(message.content.substring(0, 200))
      }
    })
  })
  
  return preferences.slice(0, 5)
}

function extractFacts(messages: any[]): string[] {
  const facts = []
  
  // Look for factual statements
  const factIndicators = [
    'is', 'are', 'was', 'were', 'has', 'have',
    'fact', 'truth', 'reality', 'actually'
  ]
  
  messages.forEach(message => {
    const content = message.content || ''
    factIndicators.forEach(indicator => {
      if (content.toLowerCase().includes(indicator)) {
        // Extract sentences that look like facts
        const sentences = content.split(/[.!?]+/)
        sentences.forEach(sentence => {
          if (sentence.length > 20 && sentence.length < 200) {
            facts.push(sentence.trim())
          }
        })
      }
    })
  })
  
  return facts.slice(0, 5)
}

function extractSkills(messages: any[]): string[] {
  const skills = []
  
  // Look for skill mentions
  const skillIndicators = [
    'know', 'can', 'able to', 'skill', 'expertise',
    'experience', 'proficient', 'familiar'
  ]
  
  messages.forEach(message => {
    const content = message.content || ''
    skillIndicators.forEach(indicator => {
      if (content.toLowerCase().includes(indicator)) {
        skills.push(content.substring(0, 150))
      }
    })
  })
  
  return skills.slice(0, 5)
}

async function decayOldMemories(supabase: any, userId: string) {
  try {
    // Get old, low-importance memories
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 30) // 30 days ago
    
    const { data: oldMemories, error } = await supabase
      .from('memories')
      .select('*')
      .eq('user_id', userId)
      .eq('importance', 3) // Only decay low-importance memories
      .lt('created_at', cutoffDate.toISOString())
      .limit(20)

    if (error) throw error

    let decayedCount = 0
    
    for (const memory of oldMemories || []) {
      // Randomly decay some memories (20% chance)
      if (Math.random() < 0.2) {
        const { error: deleteError } = await supabase
          .from('memories')
          .delete()
          .eq('id', memory.id)
        
        if (!deleteError) {
          decayedCount++
        }
      }
    }

    return { decayed_count: decayedCount }
    
  } catch (error) {
    console.error('Error decaying memories:', error)
    return { decayed_count: 0 }
  }
}

async function cleanupOldEvents(supabase: any, userId: string) {
  try {
    // Keep only the last 1000 events per user
    const { error } = await supabase.rpc('cleanup_old_events', {
      p_user_id: userId,
      p_keep_count: 1000
    })

    if (error) {
      console.error('Error cleaning up events:', error)
    }
    
  } catch (error) {
    console.error('Error in event cleanup:', error)
  }
}
