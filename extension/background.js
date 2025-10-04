// Background service worker for Syncify Chrome Extension

import { createClient } from './lib/supabase.js'

// Initialize production systems
const config = new Config()
const logger = new Logger()
const security = new SecurityValidator()

// Initialize Supabase client with production config
const supabaseConfig = config.getSupabaseConfig()
const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey)

// Rate limiters
const apiRateLimiter = security.createRateLimiter(
  config.get('rateLimiting.maxRequestsPerMinute', 60),
  60 * 1000 // 1 minute
)

const injectionRateLimiter = security.createRateLimiter(
  config.get('rateLimiting.maxInjectionPerMinute', 10),
  60 * 1000 // 1 minute
)

// Extension state
let isAuthenticated = false
let currentUser = null
let authToken = null

// Utility function for retryable API calls
async function fetchWithRetry(url, options = {}, retries = 3) {
  const maxRetries = config.get('performance.maxRetries', 3)
  const retryDelay = config.get('performance.retryDelay', 1000)
  const timeoutMs = config.get('performance.timeoutMs', 30000)

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      return response
    } catch (error) {
      logger.warn(`API call attempt ${attempt} failed`, error, { url, attempt })

      if (attempt === maxRetries) {
        throw error
      }

      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, retryDelay * attempt))
    }
  }
}

// Initialize extension
chrome.runtime.onInstalled.addListener(async (details) => {
  logger.info('Syncify extension installed/updated', { reason: details.reason })
  
  try {
    // Set default settings
    await chrome.storage.sync.set({
      enabled: true,
      autoCapture: true,
      autoInject: true,
      showNotifications: true,
      activeProfile: null,
      version: config.get('version', '1.0.0')
    })
    
    // Check existing auth
    await checkAuth()
    
    logger.info('Extension initialization complete')
  } catch (error) {
    logger.error('Extension initialization failed', error)
  }
})

// Check authentication status
async function checkAuth() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      isAuthenticated = true
      currentUser = session.user
      authToken = session.access_token
      console.log('User authenticated:', currentUser.email)
    } else {
      isAuthenticated = false
      currentUser = null
      authToken = null
    }
  } catch (error) {
    console.error('Auth check failed:', error)
    isAuthenticated = false
  }
}

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.type, request)
  
  switch (request.type) {
    case 'AUTH_STATUS':
      sendResponse({ 
        authenticated: isAuthenticated, 
        user: currentUser,
        token: authToken 
      })
      break
      
    case 'CAPTURE_CONTEXT':
      handleContextCapture(request.data, sender.tab)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }))
      return true // Keep message channel open for async response
      
    case 'GET_CONTEXT_PROFILE':
      handleGetContextProfile(request.data, sender.tab)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }))
      return true // Keep message channel open for async response
      
    case 'INJECT_CONTEXT':
      handleContextInjection(request.data, sender.tab)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }))
      return true // Keep message channel open for async response
      
    case 'LOG_EVENT':
      handleLogEvent(request.data)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }))
      return true // Keep message channel open for async response
      
    case 'AUTH_LOGIN':
      handleAuthLogin()
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }))
      return true
      
    default:
      console.warn('Unknown message type:', request.type)
      sendResponse({ success: false, error: 'Unknown message type' })
  }
})

// Handle context capture
async function handleContextCapture(data, tab) {
  if (!isAuthenticated) {
    throw new Error('Not authenticated')
  }
  
  try {
    // Validate input data
    const validatedData = security.validateConversation({
      title: data.title || `Conversation on ${getDomainFromUrl(data.site)}`,
      provider: data.provider,
      site: data.site,
      messages: data.messages || []
    })

    // Check rate limits
    apiRateLimiter('capture')

    // Log the capture event
    await logEvent({
      kind: 'capture',
      payload: {
        site: validatedData.site,
        provider: validatedData.provider,
        conversation_id: data.conversationId,
        message_count: validatedData.messages.length
      }
    })
    
    // Store conversation and messages
    if (validatedData.messages.length > 0) {
      const response = await fetchWithRetry(`${config.get('apiBaseUrl')}/api/conversations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(validatedData)
      })
      
      if (response.ok) {
        const result = await response.json()
        logger.info('Successfully stored conversation', { id: result.id, messageCount: validatedData.messages.length })
        return { success: true, conversationId: result.id }
      } else {
        throw new Error(`Failed to store conversation: ${response.statusText}`)
      }
    }
    
    return { success: true }
  } catch (error) {
    logger.error('Context capture failed', error, { site: data.site, provider: data.provider })
    throw error
  }
}

// Handle getting context profile for injection
async function handleGetContextProfile(data, tab) {
  if (!isAuthenticated) {
    throw new Error('Not authenticated')
  }
  
  try {
    // Check if site is allowed
    const settings = await chrome.storage.sync.get(['enabled', 'activeProfile'])
    if (!settings.enabled) {
      throw new Error('Extension disabled')
    }
    
    // Get site policy
    const sitePolicy = await getSitePolicy(data.site)
    if (!sitePolicy || !sitePolicy.inject) {
      throw new Error('Site not configured for injection')
    }
    
    // Validate input
    if (!security.validateOrigin(data.site)) {
      throw new Error('Invalid site origin')
    }

    // Check rate limits
    injectionRateLimiter('profile')

    // Fetch context profile from API
    const response = await fetchWithRetry(`${config.get('apiBaseUrl')}/api/context/profile?site=${encodeURIComponent(data.site)}&provider=${encodeURIComponent(data.provider)}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Failed to get context profile: ${response.statusText}`)
    }
    
    const rawProfile = await response.json()
    const profile = security.validateContextProfile(rawProfile)
    
    // Log the injection attempt
    await logEvent({
      kind: 'inject',
      payload: {
        site: data.site,
        provider: data.provider,
        profile_used: profile.profile_name,
        estimated_tokens: profile.estimated_tokens
      }
    })
    
    logger.info('Context profile retrieved successfully', { 
      site: data.site, 
      provider: data.provider,
      profileName: profile.profile_name,
      estimatedTokens: profile.estimated_tokens
    })
    
    return profile
  } catch (error) {
    console.error('Get context profile failed:', error)
    
    // Log the error
    await logEvent({
      kind: 'error',
      payload: {
        site: data.site,
        provider: data.provider,
        error: error.message
      }
    })
    
    throw error
  }
}

// Handle context injection
async function handleContextInjection(data, tab) {
  if (!isAuthenticated) {
    throw new Error('Not authenticated')
  }
  
  try {
    // Get context profile
    const profile = await handleGetContextProfile(data, tab)
    
    // Return injection data for content script to use
    return {
      profile,
      injection_method: data.injectionMethod || 'prepend',
      success: true
    }
  } catch (error) {
    console.error('Context injection failed:', error)
    throw error
  }
}

// Handle logging events
async function handleLogEvent(data) {
  if (!isAuthenticated) {
    return { success: false, error: 'Not authenticated' }
  }
  
  try {
    return await logEvent(data)
  } catch (error) {
    console.error('Log event failed:', error)
    return { success: false, error: error.message }
  }
}

// Log event to API
async function logEvent(eventData) {
  try {
    // Validate event data
    const validatedData = {
      kind: eventData.kind || 'unknown',
      payload: security.sanitizeContent(JSON.stringify(eventData.payload || {}))
    }

    const response = await fetchWithRetry(`${config.get('apiBaseUrl')}/api/events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(validatedData)
    })
    
    if (!response.ok) {
      throw new Error(`Failed to log event: ${response.statusText}`)
    }
    
    return await response.json()
  } catch (error) {
    logger.warn('Failed to log event to server', error, { eventKind: eventData.kind })
    // Don't throw - logging failures shouldn't break the extension
    return { success: false, error: error.message }
  }
}

// Get site policy
async function getSitePolicy(site) {
  try {
    const response = await fetchWithRetry(`${config.get('apiBaseUrl')}/api/site-policies?origin=${encodeURIComponent(site)}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    return data.length > 0 ? data[0] : null
  } catch (error) {
    console.error('Failed to get site policy:', error)
    return null
  }
}

// Handle authentication login
async function handleAuthLogin() {
  try {
    // Open auth page
    const authUrl = `${config.get('appUrl')}/auth/login?extension=true`
    const tab = await chrome.tabs.create({ url: authUrl })
    
    // Listen for auth completion
    return new Promise((resolve, reject) => {
      const listener = (tabId, changeInfo, updatedTab) => {
        if (tabId === tab.id && changeInfo.url && changeInfo.url.includes('auth/callback')) {
          chrome.tabs.onUpdated.removeListener(listener)
          chrome.tabs.remove(tabId)
          
          // Check auth status
          checkAuth().then(() => {
            resolve({ success: true, user: currentUser })
          }).catch(reject)
        }
      }
      
      chrome.tabs.onUpdated.addListener(listener)
      
      // Timeout after 5 minutes
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener)
        chrome.tabs.remove(tab.id)
        reject(new Error('Authentication timeout'))
      }, 5 * 60 * 1000)
    })
  } catch (error) {
    console.error('Auth login failed:', error)
    throw error
  }
}

// Utility functions
function getDomainFromUrl(url) {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

// Handle tab updates for site detection
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      // Check if this is an AI site and user is authenticated
      if (isAuthenticated && isAISite(tab.url)) {
        const domain = getDomainFromUrl(tab.url)
        const policy = await getSitePolicy(domain)
        
        if (policy && policy.enabled) {
          // Show notification if enabled
          const settings = await chrome.storage.sync.get(['showNotifications'])
          if (settings.showNotifications) {
            chrome.action.setBadgeText({ text: '✓', tabId })
            chrome.action.setBadgeBackgroundColor({ color: '#10b981', tabId })
            
            // Clear badge after 3 seconds
            setTimeout(() => {
              chrome.action.setBadgeText({ text: '', tabId })
            }, 3000)
          }
        }
      }
    } catch (error) {
      console.error('Tab update handler failed:', error)
    }
  }
})

// Check if URL is an AI site
function isAISite(url) {
  const aiSites = [
    'chat.openai.com',
    'chatgpt.com',
    'claude.ai',
    'claude.com',
    'gemini.google.com',
    'gemini.com',
    'grok.com',
    'x.com',
    'deepseek.com',
    'poe.com',
    'perplexity.ai',
    'you.com',
    'character.ai'
  ]
  
  const domain = getDomainFromUrl(url)
  return aiSites.some(site => domain.includes(site))
}

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  if (!isAuthenticated) {
    await handleAuthLogin()
  } else {
    // Open popup (handled by manifest action)
    console.log('Extension clicked, popup should open')
  }
})

// Periodic auth check
setInterval(checkAuth, 5 * 60 * 1000) // Check every 5 minutes

console.log('Syncify background script loaded')

