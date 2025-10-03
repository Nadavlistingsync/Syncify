// Options page script for Syncify Chrome extension

class OptionsManager {
  constructor() {
    this.isAuthenticated = false
    this.currentUser = null
    this.settings = {}
    this.sites = []
    
    this.init()
  }

  async init() {
    console.log('Options page initializing...')
    
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

    document.getElementById('notifications-switch').addEventListener('click', () => {
      this.toggleSetting('showNotifications')
    })

    // Add site button
    document.getElementById('add-site-btn').addEventListener('click', () => {
      this.addSite()
    })

    // Enter key for add site input
    document.getElementById('new-site').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addSite()
      }
    })

    // Export button
    document.getElementById('export-btn').addEventListener('click', () => {
      this.exportData()
    })

    // Delete button
    document.getElementById('delete-btn').addEventListener('click', () => {
      this.deleteAllData()
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

      // Load sites if authenticated
      if (this.isAuthenticated) {
        await this.loadSites()
      }

    } catch (error) {
      console.error('Failed to load state:', error)
      this.showMessage('Failed to load extension state', 'error')
    }
  }

  async loadSites() {
    try {
      // This would typically fetch from your API
      // For now, we'll use placeholder data
      const sites = [
        { id: '1', origin: 'chat.openai.com', enabled: true, capture: true, inject: true },
        { id: '2', origin: 'claude.ai', enabled: true, capture: true, inject: true },
        { id: '3', origin: 'gemini.google.com', enabled: false, capture: false, inject: false }
      ]

      this.sites = sites
      this.updateSiteList()

    } catch (error) {
      console.error('Failed to load sites:', error)
      this.showMessage('Failed to load sites', 'error')
    }
  }

  updateUI() {
    const authSection = document.getElementById('auth-section')
    const mainSection = document.getElementById('main-section')

    if (this.isAuthenticated) {
      authSection.classList.add('hidden')
      mainSection.classList.remove('hidden')
      
      // Update toggle states
      this.updateToggle('enable-switch', this.settings.enabled !== false)
      this.updateToggle('capture-switch', this.settings.autoCapture !== false)
      this.updateToggle('inject-switch', this.settings.autoInject !== false)
      this.updateToggle('notifications-switch', this.settings.showNotifications !== false)

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

  updateSiteList() {
    const siteList = document.getElementById('site-list')
    
    if (this.sites.length === 0) {
      siteList.innerHTML = `
        <div style="padding: 24px; text-align: center; color: #6b7280;">
          <p>No sites configured yet.</p>
          <p style="font-size: 14px;">Add AI websites to start syncing your context.</p>
        </div>
      `
      return
    }

    siteList.innerHTML = this.sites.map(site => `
      <div class="site-item">
        <div class="site-info">
          <div class="site-domain">${site.origin}</div>
          <div class="site-status">
            ${site.enabled ? 'Active' : 'Disabled'} • 
            ${site.capture ? 'Capture' : 'No capture'} • 
            ${site.inject ? 'Inject' : 'No injection'}
          </div>
        </div>
        <div class="site-actions">
          <button class="button secondary small-button" onclick="optionsManager.toggleSite('${site.id}', 'enabled')">
            ${site.enabled ? 'Disable' : 'Enable'}
          </button>
          <button class="button danger small-button" onclick="optionsManager.removeSite('${site.id}')">
            Remove
          </button>
        </div>
      </div>
    `).join('')
  }

  async handleLogin() {
    try {
      this.setLoading(true)
      
      const response = await this.sendMessage({ type: 'AUTH_LOGIN' })
      
      if (response.success) {
        this.isAuthenticated = true
        this.currentUser = response.data.user
        await this.loadSites()
        this.updateUI()
        this.showMessage('Successfully connected to Syncify!', 'success')
      } else {
        this.showMessage('Login failed: ' + response.error, 'error')
      }

    } catch (error) {
      console.error('Login error:', error)
      this.showMessage('Login failed: ' + error.message, 'error')
    } finally {
      this.setLoading(false)
    }
  }

  async handleLogout() {
    if (!confirm('Are you sure you want to disconnect your account?')) {
      return
    }

    try {
      this.setLoading(true)
      
      // Clear local state
      this.isAuthenticated = false
      this.currentUser = null
      this.sites = []
      
      // Clear storage
      await chrome.storage.local.remove(['supabase_session'])
      
      this.updateUI()
      this.showMessage('Account disconnected successfully', 'success')
      
    } catch (error) {
      console.error('Logout error:', error)
      this.showMessage('Logout failed: ' + error.message, 'error')
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
      let toggleId = settingName
      if (settingName === 'enabled') toggleId = 'enable-switch'
      if (settingName === 'autoCapture') toggleId = 'capture-switch'
      if (settingName === 'autoInject') toggleId = 'inject-switch'
      if (settingName === 'showNotifications') toggleId = 'notifications-switch'
      
      this.updateToggle(toggleId, newValue)
      
      // Send setting update to background script
      await this.sendMessage({
        type: 'UPDATE_SETTING',
        data: { setting: settingName, value: newValue }
      })

      this.showMessage(`Setting updated: ${settingName}`, 'success')

    } catch (error) {
      console.error('Failed to toggle setting:', error)
      this.showMessage('Failed to update setting', 'error')
    }
  }

  async addSite() {
    const input = document.getElementById('new-site')
    const domain = input.value.trim()
    
    if (!domain) {
      this.showMessage('Please enter a domain', 'error')
      return
    }

    // Basic domain validation
    if (!this.isValidDomain(domain)) {
      this.showMessage('Please enter a valid domain (e.g., example.com)', 'error')
      return
    }

    try {
      this.setLoading(true)
      
      // Add site to list
      const newSite = {
        id: Date.now().toString(),
        origin: domain,
        enabled: true,
        capture: true,
        inject: true
      }
      
      this.sites.push(newSite)
      this.updateSiteList()
      
      // Clear input
      input.value = ''
      
      this.showMessage(`Added site: ${domain}`, 'success')
      
      // This would typically save to your API
      await this.saveSites()

    } catch (error) {
      console.error('Failed to add site:', error)
      this.showMessage('Failed to add site', 'error')
    } finally {
      this.setLoading(false)
    }
  }

  async toggleSite(siteId, property) {
    try {
      const site = this.sites.find(s => s.id === siteId)
      if (!site) return

      site[property] = !site[property]
      this.updateSiteList()
      
      // Save changes
      await this.saveSites()
      
      this.showMessage(`Updated site: ${site.origin}`, 'success')

    } catch (error) {
      console.error('Failed to toggle site:', error)
      this.showMessage('Failed to update site', 'error')
    }
  }

  async removeSite(siteId) {
    const site = this.sites.find(s => s.id === siteId)
    if (!site) return

    if (!confirm(`Remove ${site.origin} from your allowed sites?`)) {
      return
    }

    try {
      this.sites = this.sites.filter(s => s.id !== siteId)
      this.updateSiteList()
      
      // Save changes
      await this.saveSites()
      
      this.showMessage(`Removed site: ${site.origin}`, 'success')

    } catch (error) {
      console.error('Failed to remove site:', error)
      this.showMessage('Failed to remove site', 'error')
    }
  }

  async saveSites() {
    // This would typically save to your API
    // For now, we'll save to local storage
    await chrome.storage.sync.set({ sites: this.sites })
  }

  async exportData() {
    try {
      this.setLoading(true)
      
      // This would typically fetch from your API
      const exportData = {
        export_date: new Date().toISOString(),
        settings: this.settings,
        sites: this.sites,
        // Would include memories, conversations, etc.
        data: {
          memories: [],
          conversations: [],
          profiles: []
        }
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      })
      
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `syncify-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      this.showMessage('Data exported successfully', 'success')

    } catch (error) {
      console.error('Export failed:', error)
      this.showMessage('Export failed: ' + error.message, 'error')
    } finally {
      this.setLoading(false)
    }
  }

  async deleteAllData() {
    const confirmation = prompt(
      'This will permanently delete ALL your Syncify data.\n\n' +
      'Type "DELETE ALL" to confirm:'
    )
    
    if (confirmation !== 'DELETE ALL') {
      this.showMessage('Deletion cancelled', 'error')
      return
    }

    try {
      this.setLoading(true)
      
      // Clear all local data
      this.sites = []
      this.settings = {}
      
      await chrome.storage.sync.clear()
      await chrome.storage.local.clear()
      
      // This would typically call your API to delete data
      
      this.updateSiteList()
      this.updateUI()
      
      this.showMessage('All data deleted successfully', 'success')

    } catch (error) {
      console.error('Delete failed:', error)
      this.showMessage('Delete failed: ' + error.message, 'error')
    } finally {
      this.setLoading(false)
    }
  }

  isValidDomain(domain) {
    // Basic domain validation
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/
    return domainRegex.test(domain)
  }

  setLoading(isLoading) {
    const body = document.body
    if (isLoading) {
      body.classList.add('loading')
    } else {
      body.classList.remove('loading')
    }
  }

  showMessage(message, type = 'success') {
    const messageArea = document.getElementById('message-area')
    
    const messageEl = document.createElement('div')
    messageEl.className = type
    messageEl.textContent = message
    
    messageArea.appendChild(messageEl)
    
    // Remove message after 5 seconds
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.parentNode.removeChild(messageEl)
      }
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
}

// Initialize options manager
const optionsManager = new OptionsManager()

