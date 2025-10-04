// Popup script for Syncify Chrome extension

class PopupManager {
  constructor() {
    this.isAuthenticated = false
    this.currentUser = null
    this.settings = {}
    
    this.init()
  }

  async init() {
    console.log('Popup initializing...')
    
    // Set up event listeners
    this.setupEventListeners()
    
    // Load initial state
    await this.loadState()
    
    // Update UI
    this.updateUI()
  }

  setupEventListeners() {
    // Login button
    document.getElementById('login-btn').addEventListener('click', () => {
      this.handleLogin()
    })

    // Logout button
    document.getElementById('logout-btn').addEventListener('click', () => {
      this.handleLogout()
    })

    // Options button
    document.getElementById('options-btn').addEventListener('click', () => {
      chrome.runtime.openOptionsPage()
    })

    // Toggle switches
    document.getElementById('enable-switch').addEventListener('click', () => {
      this.toggleSetting('enabled')
    })

    document.getElementById('capture-switch').addEventListener('click', () => {
      this.toggleSetting('autoCapture')
    })

    document.getElementById('inject-switch').addEventListener('click', () => {
      this.toggleSetting('autoInject')
    })
  }

  async loadState() {
    try {
      // Check authentication
      const authResponse = await this.sendMessage({ type: 'AUTH_STATUS' })
      this.isAuthenticated = authResponse.authenticated
      this.currentUser = authResponse.user

      // Load settings
      const settingsResponse = await chrome.storage.sync.get([
        'enabled',
        'autoCapture', 
        'autoInject',
        'showNotifications'
      ])
      this.settings = settingsResponse

      // Get current tab info
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      this.currentTab = tab

      // Load stats if authenticated
      if (this.isAuthenticated) {
        await this.loadStats()
      }

    } catch (error) {
      console.error('Failed to load state:', error)
      this.showError('Failed to load extension state')
    }
  }

  async loadStats() {
    try {
      // This would typically fetch from your API
      // For now, we'll use placeholder data
      const stats = {
        memories: 0,
        sites: 0
      }

      document.getElementById('memories-count').textContent = stats.memories
      document.getElementById('sites-count').textContent = stats.sites

    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  updateUI() {
    const authSection = document.getElementById('auth-section')
    const mainSection = document.getElementById('main-section')

    if (this.isAuthenticated) {
      authSection.classList.add('hidden')
      mainSection.classList.remove('hidden')
      
      // Update user info
      if (this.currentUser) {
        document.getElementById('user-email').textContent = this.currentUser.email || 'Unknown'
      }

      // Update toggle states
      this.updateToggle('enable-switch', this.settings.enabled !== false)
      this.updateToggle('capture-switch', this.settings.autoCapture !== false)
      this.updateToggle('inject-switch', this.settings.autoInject !== false)

      // Update current site info
      this.updateCurrentSiteInfo()

    } else {
      authSection.classList.remove('hidden')
      mainSection.classList.add('hidden')
    }
  }

  updateToggle(id, isActive) {
    const toggle = document.getElementById(id)
    if (isActive) {
      toggle.classList.add('active')
    } else {
      toggle.classList.remove('active')
    }
  }

  async updateCurrentSiteInfo() {
    if (!this.currentTab) return

    try {
      const domain = this.getDomainFromUrl(this.currentTab.url)
      document.getElementById('current-site').textContent = domain

      // Check if this is an AI site
      const isAISite = this.isAISite(domain)
      if (isAISite) {
        document.getElementById('site-status').textContent = 'AI site detected - Syncify active'
        document.getElementById('site-status').style.color = '#10b981'
      } else {
        document.getElementById('site-status').textContent = 'Not an AI site'
        document.getElementById('site-status').style.color = '#6b7280'
      }

    } catch (error) {
      console.error('Failed to update site info:', error)
      document.getElementById('current-site').textContent = 'Unknown'
      document.getElementById('site-status').textContent = 'Error checking site'
    }
  }

  async handleLogin() {
    try {
      this.setLoading(true)
      
      const response = await this.sendMessage({ type: 'AUTH_LOGIN' })
      
      if (response.success) {
        this.isAuthenticated = true
        this.currentUser = response.data.user
        await this.loadStats()
        this.updateUI()
      } else {
        this.showError('Login failed: ' + response.error)
      }

    } catch (error) {
      console.error('Login error:', error)
      this.showError('Login failed: ' + error.message)
    } finally {
      this.setLoading(false)
    }
  }

  async handleLogout() {
    try {
      this.setLoading(true)
      
      // Clear local state
      this.isAuthenticated = false
      this.currentUser = null
      
      // Clear storage
      await chrome.storage.local.remove(['supabase_session'])
      
      this.updateUI()
      
    } catch (error) {
      console.error('Logout error:', error)
      this.showError('Logout failed: ' + error.message)
    } finally {
      this.setLoading(false)
    }
  }

  async toggleSetting(settingName) {
    try {
      const newValue = !this.settings[settingName]
      this.settings[settingName] = newValue
      
      await chrome.storage.sync.set({ [settingName]: newValue })
      
      // Update toggle UI
      this.updateToggle(`${settingName === 'enabled' ? 'enable' : settingName === 'autoCapture' ? 'capture' : 'inject'}-switch`, newValue)
      
      // Send setting update to background script
      await this.sendMessage({
        type: 'UPDATE_SETTING',
        data: { setting: settingName, value: newValue }
      })

    } catch (error) {
      console.error('Failed to toggle setting:', error)
      this.showError('Failed to update setting')
    }
  }

  setLoading(isLoading) {
    const body = document.body
    if (isLoading) {
      body.classList.add('loading')
    } else {
      body.classList.remove('loading')
    }
  }

  showError(message) {
    const errorEl = document.getElementById('error-message')
    errorEl.textContent = message
    errorEl.classList.remove('hidden')
    
    // Hide error after 5 seconds
    setTimeout(() => {
      errorEl.classList.add('hidden')
    }, 5000)
  }

  sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          resolve(response)
        }
      })
    })
  }

  getDomainFromUrl(url) {
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  }

  isAISite(domain) {
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
    
    return aiSites.some(site => domain.includes(site))
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager()
})

