import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_key'

// Client-side Supabase client
export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey)

// Client component client
export const createClient = () => createClientComponentClient()

// Service role client for server-side operations
export const createServiceClient = () => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createSupabaseClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Database types
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          user_id: string
          name: string
          scope: 'personal' | 'work' | 'custom'
          redaction_rules: any
          token_budget: number
          default_for_sites: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          scope?: 'personal' | 'work' | 'custom'
          redaction_rules?: any
          token_budget?: number
          default_for_sites?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          scope?: 'personal' | 'work' | 'custom'
          redaction_rules?: any
          token_budget?: number
          default_for_sites?: string[]
          created_at?: string
          updated_at?: string
        }
      }
      memories: {
        Row: {
          id: string
          user_id: string
          type: 'fact' | 'preference' | 'skill' | 'project' | 'note'
          content: string
          importance: number
          pii: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type?: 'fact' | 'preference' | 'skill' | 'project' | 'note'
          content: string
          importance?: number
          pii?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: 'fact' | 'preference' | 'skill' | 'project' | 'note'
          content?: string
          importance?: number
          pii?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      conversations: {
        Row: {
          id: string
          user_id: string
          title: string
          provider: string
          site: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          provider: string
          site: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          provider?: string
          site?: string
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          ts: string
          provider: string
        }
        Insert: {
          id?: string
          conversation_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          ts?: string
          provider: string
        }
        Update: {
          id?: string
          conversation_id?: string
          role?: 'user' | 'assistant' | 'system'
          content?: string
          ts?: string
          provider?: string
        }
      }
      site_policies: {
        Row: {
          id: string
          user_id: string
          origin: string
          enabled: boolean
          profile_id: string
          capture: boolean
          inject: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          origin: string
          enabled?: boolean
          profile_id: string
          capture?: boolean
          inject?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          origin?: string
          enabled?: boolean
          profile_id?: string
          capture?: boolean
          inject?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      events: {
        Row: {
          id: string
          user_id: string
          kind: 'capture' | 'inject' | 'error'
          payload: any
          ts: string
        }
        Insert: {
          id?: string
          user_id: string
          kind: 'capture' | 'inject' | 'error'
          payload: any
          ts?: string
        }
        Update: {
          id?: string
          user_id?: string
          kind?: 'capture' | 'inject' | 'error'
          payload?: any
          ts?: string
        }
      }
      user_context: {
        Row: {
          id: string
          user_id: string
          conversation_id: string | null
          site: string
          provider: string
          context_type: 'conversation' | 'preference' | 'fact' | 'skill' | 'note'
          title: string
          content: string
          importance: number
          pii: boolean
          metadata: any
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          conversation_id?: string | null
          site: string
          provider: string
          context_type?: 'conversation' | 'preference' | 'fact' | 'skill' | 'note'
          title: string
          content: string
          importance?: number
          pii?: boolean
          metadata?: any
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          conversation_id?: string | null
          site?: string
          provider?: string
          context_type?: 'conversation' | 'preference' | 'fact' | 'skill' | 'note'
          title?: string
          content?: string
          importance?: number
          pii?: boolean
          metadata?: any
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Memory = Database['public']['Tables']['memories']['Row']
export type UserContext = Database['public']['Tables']['user_context']['Row']
export type Conversation = Database['public']['Tables']['conversations']['Row']
export type Message = Database['public']['Tables']['messages']['Row']
export type SitePolicy = Database['public']['Tables']['site_policies']['Row']
export type Event = Database['public']['Tables']['events']['Row']

