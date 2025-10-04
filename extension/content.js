// Universal content script for capturing and injecting AI context

class UniversalAIContextManager {
  constructor() {
    this.isInitialized = false
    this.currentSite = null
    this.isAISite = false
    this.siteAdapter = null
    this.originalFetch = null
    this.originalWebSocket = null
    this.messageQueue = []
    this.observer = null
    this.debounceTimers = new Map()
    this.lastCaptureTime = 0
    
    // Initialize production systems
    this.config = new Config()
    this.logger = new Logger()
    this.security = new SecurityValidator()
    
    this.init()
  }

  async init() {
    this.logger.info('Syncify content script initializing...')
    
    try {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.initialize())
      } else {
        this.initialize()
      }
    } catch (error) {
      this.logger.error('Content script initialization failed', error)
    }
  }

  async initialize() {
    try {
      // Get current site info
      this.currentSite = {
        url: window.location.href,
        domain: window.location.hostname,
        pathname: window.location.pathname
      }

      // Check if this is an AI site
      this.isAISite = this.detectAISite()
      
      if (!this.isAISite) {
        this.logger.debug('Not an AI site, skipping initialization', { domain: this.currentSite.domain })
        return
      }

      this.logger.info('AI site detected', { domain: this.currentSite.domain })

      // Initialize site adapter
      this.siteAdapter = this.createSiteAdapter()
      
      // Set up network interception
      this.setupNetworkInterception()
      
      // Set up DOM observation as fallback
      this.setupDOMObservation()
      
      // Check authentication
      await this.checkAuth()
      
      // Set up context injection
      this.setupContextInjection()
      
      this.isInitialized = true
      console.log('Syncify content script initialized successfully')
      
    } catch (error) {
      console.error('Failed to initialize content script:', error)
    }
  }

  detectAISite() {
    const aiSitePatterns = [
      // OpenAI/ChatGPT
      /chat\.openai\.com/i,
      /chatgpt\.com/i,
      
      // Anthropic/Claude
      /claude\.ai/i,
      /claude\.com/i,
      
      // Google/Gemini
      /gemini\.google\.com/i,
      /gemini\.com/i,
      /bard\.google\.com/i,
      
      // X/Twitter Grok
      /grok\.com/i,
      /x\.com/i,
      
      // DeepSeek
      /deepseek\.com/i,
      
      // Others
      /poe\.com/i,
      /perplexity\.ai/i,
      /you\.com/i,
      /character\.ai/i,
      /huggingface\.co/i,
      /replicate\.com/i,
      
      // Syncify testing sites
      /localhost:3000/i,
      /localhost:3001/i,
      /localhost:3002/i,
      /localhost:3003/i,
      /localhost:3004/i,
      /localhost:3005/i,
      /localhost:3006/i,
      /syncify\.vercel\.app/i,
      /syncify.*\.vercel\.app/i,
      /syncify.*\.netlify\.app/i,
      /syncify\.io/i,
      /syncify\.ai/i
    ]
    
    return aiSitePatterns.some(pattern => pattern.test(this.currentSite.domain))
  }

  createSiteAdapter() {
    const domain = this.currentSite.domain.toLowerCase()
    
    if (domain.includes('openai.com') || domain.includes('chatgpt.com')) {
      return new OpenAISiteAdapter()
    } else if (domain.includes('claude.ai') || domain.includes('claude.com')) {
      return new ClaudeSiteAdapter()
    } else if (domain.includes('google.com') || domain.includes('gemini.com')) {
      return new GoogleSiteAdapter()
    } else if (domain.includes('grok.com') || domain.includes('x.com')) {
      return new GrokSiteAdapter()
    } else if (domain.includes('deepseek.com')) {
      return new DeepSeekSiteAdapter()
    } else if (domain.includes('localhost') || domain.includes('vercel.app') || domain.includes('syncify')) {
      return new SyncifySiteAdapter()
    } else {
      // Generic adapter for unknown sites
      return new GenericSiteAdapter()
    }
  }

  setupNetworkInterception() {
    // Intercept fetch requests
    this.originalFetch = window.fetch
    window.fetch = async (...args) => {
      const response = await this.originalFetch(...args)
      
      // Clone response for reading
      const clonedResponse = response.clone()
      
      try {
        await this.handleFetchRequest(args[0], args[1], clonedResponse)
      } catch (error) {
        console.error('Error handling fetch request:', error)
      }
      
      return response
    }

    // Intercept WebSocket connections
    this.originalWebSocket = window.WebSocket
    window.WebSocket = class extends this.originalWebSocket {
      constructor(...args) {
        super(...args)
        
        const originalSend = this.send
        this.send = function(data) {
          try {
            // Handle WebSocket messages
            if (self.universalAI) {
              self.universalAI.handleWebSocketMessage(data)
            }
          } catch (error) {
            console.error('Error handling WebSocket message:', error)
          }
          
          return originalSend.call(this, data)
        }
      }
    }
  }

  setupDOMObservation() {
    // Observe DOM changes to catch messages that might not go through network interception
    this.observer = new MutationObserver((mutations) => {
      try {
        this.handleDOMChanges(mutations)
      } catch (error) {
        console.error('Error handling DOM changes:', error)
      }
    })

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    })
  }

  async checkAuth() {
    try {
      const response = await this.sendMessage({
        type: 'AUTH_STATUS'
      })
      
      if (!response.authenticated) {
        console.log('User not authenticated, context sync disabled')
        return false
      }
      
      console.log('User authenticated:', response.user?.email)
      return true
    } catch (error) {
      console.error('Auth check failed:', error)
      return false
    }
  }

  setupContextInjection() {
    // Set up context injection for text inputs
    this.setupTextInputInjection()
    
    // Set up context injection for message areas
    this.setupMessageAreaInjection()
  }

  setupTextInputInjection() {
    // Find and monitor text inputs
    const textInputs = document.querySelectorAll('textarea, input[type="text"]')
    
    textInputs.forEach(input => {
      this.monitorTextInput(input)
    })

    // Monitor for dynamically added inputs
    const inputObserver = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const textInputs = node.querySelectorAll('textarea, input[type="text"]')
            textInputs.forEach(input => this.monitorTextInput(input))
          }
        })
      })
    })

    inputObserver.observe(document.body, {
      childList: true,
      subtree: true
    })
  }

  setupMessageAreaInjection() {
    // Look for common message area patterns
    const messageSelectors = [
      '[role="textbox"]',
      '[contenteditable="true"]',
      '.message-input',
      '.chat-input',
      '.prompt-input',
      '[data-testid*="input"]',
      '[aria-label*="message"]',
      '[aria-label*="prompt"]',
      // ChatGPT specific
      '#prompt-textarea',
      '[data-id*="root"] textarea',
      // Claude specific
      '.ProseMirror',
      '[contenteditable="true"][role="textbox"]',
      // Gemini specific
      'textarea[aria-label*="Enter a prompt"]',
      // Grok specific
      '[data-testid*="tweetTextarea"]',
      '[data-testid*="grok"] textarea',
      // DeepSeek specific
      '.chat-input textarea',
      'textarea[placeholder*="message"]'
    ]

    messageSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector)
      elements.forEach(element => this.monitorTextInput(element))
    })
  }

  monitorTextInput(input) {
    if (input.dataset.syncifyMonitored) return
    input.dataset.syncifyMonitored = 'true'

    let isInjecting = false

    const handleInput = async (event) => {
      if (isInjecting) return

      // Check if this looks like a new message/prompt
      if (this.isNewMessageInput(input, event)) {
        isInjecting = true
        
        try {
          await this.injectContext(input)
        } catch (error) {
          console.error('Context injection failed:', error)
        } finally {
          isInjecting = false
        }
      }
    }

    // Monitor various input events
    input.addEventListener('focus', handleInput)
    input.addEventListener('click', handleInput)
    input.addEventListener('keydown', (e) => {
      // Inject on Enter key
      if (e.key === 'Enter' && !e.shiftKey) {
        handleInput(e)
      }
    })
  }

  isNewMessageInput(input, event) {
    // Check if input is empty or contains only whitespace
    const value = input.value || input.textContent || ''
    
    // Allow injection even if there's some text (for mid-conversation context)
    const isEmpty = value.trim().length === 0
    const isShortText = value.trim().length < 50
    
    // Check if this is a primary input area
    const isPrimaryInput = input.matches('textarea, [role="textbox"], [contenteditable="true"]')
    if (!isPrimaryInput) return false

    // Check if input is visible
    const rect = input.getBoundingClientRect()
    const isVisible = rect.width > 0 && rect.height > 0
    
    // Check if input is focused or just became active
    const isFocused = document.activeElement === input
    const isJustActivated = event.type === 'focus' || event.type === 'click'

    // Inject context for new conversations or when user starts typing a new message
    return isVisible && (isFocused || isJustActivated) && (isEmpty || isShortText)
  }

  async injectContext(input) {
    try {
      console.log('Attempting context injection...')
      
      const response = await this.sendMessage({
        type: 'GET_CONTEXT_PROFILE',
        data: {
          site: this.currentSite.url,
          provider: this.siteAdapter.getProviderName(),
          injectionMethod: 'prepend'
        }
      })

      if (!response.success || !response.data) {
        console.log('No context profile available or injection disabled')
        return
      }

      const profile = response.data
      console.log('Got context profile:', profile)

      // Generate context text based on profile
      const contextText = this.generateContextText(profile)
      
      if (contextText) {
        // Inject context into input
        await this.injectIntoInput(input, contextText)
        
        // Log successful injection
        await this.sendMessage({
          type: 'LOG_EVENT',
          data: {
            kind: 'inject',
            payload: {
              site: this.currentSite.url,
              provider: this.siteAdapter.getProviderName(),
              method: 'prepend',
              success: true
            }
          }
        })
      }
      
    } catch (error) {
      console.error('Context injection failed:', error)
      
      // Log injection error
      await this.sendMessage({
        type: 'LOG_EVENT',
        data: {
          kind: 'error',
          payload: {
            site: this.currentSite.url,
            provider: this.siteAdapter.getProviderName(),
            error: error.message
          }
        }
      })
    }
  }

  generateContextText(profile) {
    if (!profile.system_prompt && (!profile.facts || profile.facts.length === 0)) {
      return null
    }

    let contextText = ''

    // Add system prompt if available
    if (profile.system_prompt) {
      contextText += `[Context: ${profile.system_prompt}]\n\n`
    }

    // Add key facts if available
    if (profile.facts && profile.facts.length > 0) {
      const keyFacts = profile.facts
        .filter(fact => fact.importance >= 7) // Only high importance facts
        .slice(0, 3) // Limit to 3 facts
        .map(fact => fact.content)
        .join('; ')
      
      if (keyFacts) {
        contextText += `[Key facts: ${keyFacts}]\n\n`
      }
    }

    return contextText.trim()
  }

  async injectIntoInput(input, contextText) {
    const isContentEditable = input.contentEditable === 'true'
    
    if (isContentEditable) {
      // Handle contenteditable elements
      input.focus()
      
      // Insert at the beginning
      const selection = window.getSelection()
      selection.removeAllRanges()
      
      const range = document.createRange()
      range.setStart(input, 0)
      range.setEnd(input, 0)
      selection.addRange(range)
      
      // Insert the context
      selection.deleteFromDocument()
      selection.insertNode(document.createTextNode(contextText + '\n'))
      
      // Trigger input event
      input.dispatchEvent(new Event('input', { bubbles: true }))
    } else {
      // Handle regular text inputs
      const currentValue = input.value || ''
      input.value = contextText + '\n' + currentValue
      
      // Trigger input event
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }

  async handleFetchRequest(url, options, response) {
    if (!this.siteAdapter) return

    try {
      // Check if this is a chat/message API call
      const isChatRequest = this.siteAdapter.isChatRequest(url, options)
      if (!isChatRequest) return

      // Try to extract messages from request
      const messages = await this.siteAdapter.extractMessagesFromRequest(url, options, response)
      if (!messages || messages.length === 0) return

      // Capture the context
      await this.captureContext(messages)
      
    } catch (error) {
      console.error('Error handling fetch request:', error)
    }
  }

  handleWebSocketMessage(data) {
    if (!this.siteAdapter) return

    try {
      // Check if this is a chat message
      const messages = this.siteAdapter.extractMessagesFromWebSocket(data)
      if (!messages || messages.length === 0) return

      // Capture the context
      this.captureContext(messages)
      
    } catch (error) {
      console.error('Error handling WebSocket message:', error)
    }
  }

  handleDOMChanges(mutations) {
    if (!this.siteAdapter) return

    try {
      // Look for new messages in DOM
      const newMessages = this.siteAdapter.extractMessagesFromDOM(mutations)
      if (!newMessages || newMessages.length === 0) {
        // Also try generic message detection as fallback
        this.detectGenericMessages(mutations)
        return
      }

      // Capture the context
      this.captureContext(newMessages)
      
    } catch (error) {
      console.error('Error handling DOM changes:', error)
    }
  }

  detectGenericMessages(mutations) {
    const messages = []
    
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Look for common message patterns
          const messageSelectors = [
            '[data-message-author-role]',
            '[role="listitem"]',
            '.message',
            '.chat-message',
            '.conversation-turn',
            '.assistant-message',
            '.user-message',
            // ChatGPT specific
            '[data-message-id]',
            // Claude specific
            '[data-testid*="message"]',
            // Gemini specific
            '[jsname*="message"]',
            // Grok specific
            '[data-testid*="tweet"]'
          ]

          messageSelectors.forEach(selector => {
            const messageElements = node.querySelectorAll(selector)
            messageElements.forEach(msgEl => {
              const text = msgEl.textContent?.trim()
              if (text && text.length > 10) { // Only capture substantial messages
                // Try to determine if it's user or assistant
                const isUser = msgEl.classList.contains('user') || 
                             msgEl.getAttribute('data-message-author-role') === 'user' ||
                             msgEl.closest('.user-message') ||
                             msgEl.querySelector('[data-testid*="user"]')
                
                messages.push({
                  role: isUser ? 'user' : 'assistant',
                  content: text,
                  timestamp: new Date().toISOString()
                })
              }
            })
          })
        }
      })
    })
    
    if (messages.length > 0) {
      console.log('Detected generic messages:', messages.length)
      this.captureContext(messages)
    }
  }

  async captureContext(messages) {
    try {
      // Validate and filter messages
      const validatedMessages = messages
        .map(msg => {
          try {
            return this.security.validateMessage(msg)
          } catch (error) {
            this.logger.warn('Invalid message filtered out', error, { message: msg })
            return null
          }
        })
        .filter(msg => msg && msg.role !== 'system' && msg.content.trim().length > 0)

      if (validatedMessages.length === 0) return

      // Debounce rapid captures
      const now = Date.now()
      const debounceMs = this.config.get('performance.debounceMs', 500)
      
      if (now - this.lastCaptureTime < debounceMs) {
        this.logger.debug('Capture debounced', { timeSinceLastCapture: now - this.lastCaptureTime })
        return
      }

      this.lastCaptureTime = now

      // Send to background script
      await this.sendMessage({
        type: 'CAPTURE_CONTEXT',
        data: {
          site: this.currentSite.url,
          provider: this.siteAdapter.getProviderName(),
          messages: validatedMessages,
          title: this.generateConversationTitle(validatedMessages)
        }
      })

      this.logger.info('Captured context', { messageCount: validatedMessages.length, provider: this.siteAdapter.getProviderName() })
      
    } catch (error) {
      this.logger.error('Context capture failed', error)
    }
  }

  generateConversationTitle(messages) {
    if (messages.length === 0) return 'Empty conversation'
    
    const firstUserMessage = messages.find(msg => msg.role === 'user')
    if (firstUserMessage) {
      const content = firstUserMessage.content
      return content.length > 50 ? content.substring(0, 47) + '...' : content
    }
    
    return `Conversation on ${this.currentSite.domain}`
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

// Site-specific adapters
class OpenAISiteAdapter {
  getProviderName() {
    return 'openai'
  }

  isChatRequest(url, options) {
    return url.includes('/chat/completions') || url.includes('/v1/chat/completions')
  }

  async extractMessagesFromRequest(url, options, response) {
    try {
      if (options && options.body) {
        const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body
        if (body.messages) {
          return body.messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: new Date().toISOString()
          }))
        }
      }
      return null
    } catch (error) {
      console.error('Error extracting OpenAI messages:', error)
      return null
    }
  }

  extractMessagesFromWebSocket(data) {
    // OpenAI WebSocket handling
    return null
  }

  extractMessagesFromDOM(mutations) {
    // OpenAI DOM parsing - look for ChatGPT message elements
    const messages = []
    
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Look for ChatGPT message containers
          const messageElements = node.querySelectorAll('[data-message-id], [data-testid*="conversation-turn"], .group\\/conversation-turn')
          messageElements.forEach(msgEl => {
            const text = msgEl.textContent?.trim()
            if (text && text.length > 0) {
              // Determine if it's user or assistant based on ChatGPT's structure
              const isUser = msgEl.querySelector('[data-message-author-role="user"]') || 
                           msgEl.classList.contains('group\\/conversation-turn-user') ||
                           msgEl.getAttribute('data-message-author-role') === 'user'
              
              messages.push({
                role: isUser ? 'user' : 'assistant',
                content: text,
                timestamp: new Date().toISOString()
              })
            }
          })
        }
      })
    })
    
    return messages.length > 0 ? messages : null
  }
}

class ClaudeSiteAdapter {
  getProviderName() {
    return 'claude'
  }

  isChatRequest(url, options) {
    return url.includes('/messages') || url.includes('/api/messages')
  }

  async extractMessagesFromRequest(url, options, response) {
    try {
      if (options && options.body) {
        const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body
        if (body.messages) {
          return body.messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: new Date().toISOString()
          }))
        }
      }
      return null
    } catch (error) {
      console.error('Error extracting Claude messages:', error)
      return null
    }
  }

  extractMessagesFromWebSocket(data) {
    // Claude WebSocket handling
    return null
  }

  extractMessagesFromDOM(mutations) {
    // Claude DOM parsing - look for Claude message elements
    const messages = []
    
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Look for Claude message containers
          const messageElements = node.querySelectorAll('[data-testid*="message"], .message, .claude-message')
          messageElements.forEach(msgEl => {
            const text = msgEl.textContent?.trim()
            if (text && text.length > 0) {
              // Determine if it's user or assistant based on Claude's structure
              const isUser = msgEl.classList.contains('user-message') || 
                           msgEl.querySelector('[data-testid*="user"]') ||
                           msgEl.closest('.user-message')
              
              messages.push({
                role: isUser ? 'user' : 'assistant',
                content: text,
                timestamp: new Date().toISOString()
              })
            }
          })
        }
      })
    })
    
    return messages.length > 0 ? messages : null
  }
}

class GoogleSiteAdapter {
  getProviderName() {
    return 'google'
  }

  isChatRequest(url, options) {
    return url.includes('/generate') || url.includes('/chat') || url.includes('/gemini')
  }

  async extractMessagesFromRequest(url, options, response) {
    try {
      if (options && options.body) {
        const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body
        if (body.messages) {
          return body.messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: new Date().toISOString()
          }))
        }
      }
      return null
    } catch (error) {
      console.error('Error extracting Google messages:', error)
      return null
    }
  }

  extractMessagesFromWebSocket(data) {
    // Google WebSocket handling
    return null
  }

  extractMessagesFromDOM(mutations) {
    // Google DOM parsing
    return null
  }
}

class GrokSiteAdapter {
  getProviderName() {
    return 'grok'
  }

  isChatRequest(url, options) {
    return url.includes('/api/grok') || url.includes('/chat') || url.includes('/generate')
  }

  async extractMessagesFromRequest(url, options, response) {
    try {
      if (options && options.body) {
        const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body
        if (body.messages) {
          return body.messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: new Date().toISOString()
          }))
        } else if (body.prompt) {
          return [{
            role: 'user',
            content: body.prompt,
            timestamp: new Date().toISOString()
          }]
        }
      }
      return null
    } catch (error) {
      console.error('Error extracting Grok messages:', error)
      return null
    }
  }

  extractMessagesFromWebSocket(data) {
    // Grok WebSocket handling
    return null
  }

  extractMessagesFromDOM(mutations) {
    // Grok DOM parsing - look for chat messages in X/Twitter interface
    const messages = []
    
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Look for Grok chat messages
          const grokMessages = node.querySelectorAll('[data-testid*="grok"], [data-testid*="chat"]')
          grokMessages.forEach(msgEl => {
            const text = msgEl.textContent?.trim()
            if (text && text.length > 0) {
              // Determine if it's user or assistant based on CSS classes or structure
              const isUser = msgEl.closest('[data-testid*="user"]') || msgEl.classList.contains('user-message')
              messages.push({
                role: isUser ? 'user' : 'assistant',
                content: text,
                timestamp: new Date().toISOString()
              })
            }
          })
        }
      })
    })
    
    return messages.length > 0 ? messages : null
  }
}

class DeepSeekSiteAdapter {
  getProviderName() {
    return 'deepseek'
  }

  isChatRequest(url, options) {
    return url.includes('/api/v1/chat') || url.includes('/chat/completions') || url.includes('/generate')
  }

  async extractMessagesFromRequest(url, options, response) {
    try {
      if (options && options.body) {
        const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body
        if (body.messages) {
          return body.messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: new Date().toISOString()
          }))
        } else if (body.prompt) {
          return [{
            role: 'user',
            content: body.prompt,
            timestamp: new Date().toISOString()
          }]
        }
      }
      return null
    } catch (error) {
      console.error('Error extracting DeepSeek messages:', error)
      return null
    }
  }

  extractMessagesFromWebSocket(data) {
    // DeepSeek WebSocket handling
    return null
  }

  extractMessagesFromDOM(mutations) {
    // DeepSeek DOM parsing
    const messages = []
    
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Look for DeepSeek chat messages
          const chatMessages = node.querySelectorAll('.message, [class*="message"], [class*="chat"]')
          chatMessages.forEach(msgEl => {
            const text = msgEl.textContent?.trim()
            if (text && text.length > 0) {
              // Determine if it's user or assistant
              const isUser = msgEl.classList.contains('user') || msgEl.closest('.user-message')
              messages.push({
                role: isUser ? 'user' : 'assistant',
                content: text,
                timestamp: new Date().toISOString()
              })
            }
          })
        }
      })
    })
    
    return messages.length > 0 ? messages : null
  }
}

class SyncifySiteAdapter {
  getProviderName() {
    return 'syncify'
  }

  isChatRequest(url, options) {
    // Syncify API patterns
    const syncifyPatterns = [
      '/api/conversations',
      '/api/memories',
      '/api/context',
      '/api/profiles',
      '/api/export',
      '/api/telemetry'
    ]
    
    return syncifyPatterns.some(pattern => url.includes(pattern))
  }

  async extractMessagesFromRequest(url, options, response) {
    try {
      if (options && options.body) {
        const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body
        
        // Extract messages from Syncify API calls
        if (url.includes('/api/conversations')) {
          if (body.messages && Array.isArray(body.messages)) {
            return body.messages.map(msg => ({
              role: msg.role || 'user',
              content: msg.content || msg.text,
              timestamp: msg.timestamp || new Date().toISOString()
            }))
          }
        }
        
        // Extract from context/profile requests
        if (url.includes('/api/context') || url.includes('/api/profiles')) {
          if (body.system_prompt || body.facts) {
            return [{
              role: 'system',
              content: `System: ${body.system_prompt || ''} Facts: ${JSON.stringify(body.facts || [])}`,
              timestamp: new Date().toISOString()
            }]
          }
        }
      }
      
      // Also try to extract from response
      if (response) {
        try {
          const responseData = await response.clone().json()
          if (responseData.messages && Array.isArray(responseData.messages)) {
            return responseData.messages.map(msg => ({
              role: msg.role || 'user',
              content: msg.content || msg.text,
              timestamp: msg.timestamp || new Date().toISOString()
            }))
          }
        } catch (e) {
          // Response might not be JSON
        }
      }
      
      return null
    } catch (error) {
      console.error('Error extracting Syncify messages:', error)
      return null
    }
  }

  extractMessagesFromWebSocket(data) {
    // Syncify WebSocket handling
    return null
  }

  extractMessagesFromDOM(mutations) {
    // Look for Syncify-specific UI elements
    const messages = []
    
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Look for Syncify dashboard elements
          const syncifyElements = node.querySelectorAll(
            '[data-syncify], .syncify-message, .memory-card, .context-card, .profile-card'
          )
          
          syncifyElements.forEach(el => {
            const text = el.textContent?.trim()
            if (text && text.length > 10) {
              // Determine element type
              const isMemory = el.classList.contains('memory-card') || el.querySelector('.memory-card')
              const isContext = el.classList.contains('context-card') || el.querySelector('.context-card')
              const isProfile = el.classList.contains('profile-card') || el.querySelector('.profile-card')
              
              let role = 'system'
              if (isMemory) role = 'memory'
              else if (isContext) role = 'context'
              else if (isProfile) role = 'profile'
              
              messages.push({
                role: role,
                content: text,
                timestamp: new Date().toISOString()
              })
            }
          })
        }
      })
    })
    
    return messages.length > 0 ? messages : null
  }
}

class GenericSiteAdapter {
  getProviderName() {
    return 'unknown'
  }

  isChatRequest(url, options) {
    // Generic patterns for AI chat APIs
    const chatPatterns = [
      '/chat',
      '/completions',
      '/messages',
      '/generate',
      '/ask',
      '/query'
    ]
    
    return chatPatterns.some(pattern => url.includes(pattern))
  }

  async extractMessagesFromRequest(url, options, response) {
    try {
      if (options && options.body) {
        const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body
        
        // Try common message field names
        const messageFields = ['messages', 'conversation', 'chat', 'prompts']
        for (const field of messageFields) {
          if (body[field] && Array.isArray(body[field])) {
            return body[field].map(msg => ({
              role: msg.role || 'user',
              content: msg.content || msg.text || msg.message,
              timestamp: new Date().toISOString()
            }))
          }
        }
      }
      return null
    } catch (error) {
      console.error('Error extracting generic messages:', error)
      return null
    }
  }

  extractMessagesFromWebSocket(data) {
    // Generic WebSocket handling
    return null
  }

  extractMessagesFromDOM(mutations) {
    // Generic DOM parsing
    return null
  }
}

// Initialize the universal AI context manager
if (!window.universalAI) {
  window.universalAI = new UniversalAIContextManager()
}

