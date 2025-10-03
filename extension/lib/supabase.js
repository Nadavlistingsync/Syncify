// Supabase client for Chrome extension

class SupabaseClient {
  constructor(url, anonKey) {
    this.url = url
    this.anonKey = anonKey
    this.auth = new SupabaseAuth(url, anonKey)
  }

  from(table) {
    return new SupabaseQueryBuilder(this.url, this.anonKey, table)
  }
}

class SupabaseAuth {
  constructor(url, anonKey) {
    this.url = url
    this.anonKey = anonKey
    this.session = null
  }

  async getSession() {
    try {
      const sessionData = await chrome.storage.local.get(['supabase_session'])
      if (sessionData.supabase_session) {
        this.session = JSON.parse(sessionData.supabase_session)
        
        // Check if session is expired
        if (this.session.expires_at && Date.now() / 1000 > this.session.expires_at) {
          this.session = null
          await chrome.storage.local.remove(['supabase_session'])
        }
      }
      
      return { data: { session: this.session } }
    } catch (error) {
      console.error('Failed to get session:', error)
      return { data: { session: null } }
    }
  }

  async setSession(session) {
    try {
      this.session = session
      if (session) {
        await chrome.storage.local.set({ 
          supabase_session: JSON.stringify(session) 
        })
      } else {
        await chrome.storage.local.remove(['supabase_session'])
      }
    } catch (error) {
      console.error('Failed to set session:', error)
    }
  }

  async signOut() {
    this.session = null
    await chrome.storage.local.remove(['supabase_session'])
  }
}

class SupabaseQueryBuilder {
  constructor(url, anonKey, table) {
    this.url = url
    this.anonKey = anonKey
    this.table = table
    this.query = ''
    this.filters = []
    this.selectColumns = '*'
  }

  select(columns) {
    this.selectColumns = columns
    return this
  }

  eq(column, value) {
    this.filters.push(`eq.${column}.${value}`)
    return this
  }

  gte(column, value) {
    this.filters.push(`gte.${column}.${value}`)
    return this
  }

  lte(column, value) {
    this.filters.push(`lte.${column}.${value}`)
    return this
  }

  order(column, options = {}) {
    const ascending = options.ascending !== false ? 'asc' : 'desc'
    this.filters.push(`order=${column}.${ascending}`)
    return this
  }

  range(from, to) {
    this.filters.push(`range=${from}.${to}`)
    return this
  }

  limit(count) {
    this.filters.push(`limit=${count}`)
    return this
  }

  async execute() {
    try {
      const { data: { session } } = await this.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const filters = this.filters.join('&')
      const url = `${this.url}/rest/v1/${this.table}?select=${this.selectColumns}${filters ? '&' + filters : ''}`
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': this.anonKey,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Query execution failed:', error)
      throw error
    }
  }

  async insert(data) {
    try {
      const { data: { session } } = await this.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const url = `${this.url}/rest/v1/${this.table}?select=${this.selectColumns}`
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': this.anonKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Insert failed:', error)
      throw error
    }
  }

  async update(data) {
    try {
      const { data: { session } } = await this.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const filters = this.filters.join('&')
      const url = `${this.url}/rest/v1/${this.table}?select=${this.selectColumns}${filters ? '&' + filters : ''}`
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': this.anonKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Update failed:', error)
      throw error
    }
  }

  async delete() {
    try {
      const { data: { session } } = await this.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const filters = this.filters.join('&')
      const url = `${this.url}/rest/v1/${this.table}${filters ? '?' + filters : ''}`
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': this.anonKey
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return { success: true }
    } catch (error) {
      console.error('Delete failed:', error)
      throw error
    }
  }
}

// Create and export client
function createClient(url, anonKey) {
  const client = new SupabaseClient(url, anonKey)
  
  // Add auth reference to query builder
  SupabaseQueryBuilder.prototype.auth = client.auth
  
  return client
}

export { createClient }

