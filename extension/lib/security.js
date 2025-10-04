// Security validation and sanitization for Syncify extension

class SecurityValidator {
  constructor() {
    this.config = new Config()
    this.allowedDomains = this.config.get('security.allowedDomains', [])
    this.maxContentLength = this.config.get('security.maxContentLength', 50000)
  }

  // Validate origin domain
  validateOrigin(url) {
    try {
      const urlObj = new URL(url)
      const domain = urlObj.hostname.toLowerCase()
      
      // Check if domain is allowed
      const isAllowed = this.allowedDomains.some(allowedDomain => 
        domain.includes(allowedDomain.toLowerCase())
      )
      
      if (!isAllowed) {
        throw new Error(`Domain ${domain} is not allowed`)
      }
      
      return true
    } catch (error) {
      logger.error('Origin validation failed', error, { url })
      return false
    }
  }

  // Sanitize content to prevent XSS and other attacks
  sanitizeContent(content) {
    if (!content || typeof content !== 'string') {
      return ''
    }

    // Check content length
    if (content.length > this.maxContentLength) {
      logger.warn('Content too long, truncating', { length: content.length })
      content = content.substring(0, this.maxContentLength)
    }

    // Remove potentially dangerous HTML tags and attributes
    const sanitized = content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim()

    return sanitized
  }

  // Validate message structure
  validateMessage(message) {
    if (!message || typeof message !== 'object') {
      throw new Error('Invalid message structure')
    }

    const { role, content } = message

    // Validate role
    if (!role || !['user', 'assistant', 'system'].includes(role)) {
      throw new Error('Invalid message role')
    }

    // Validate content
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('Invalid message content')
    }

    // Sanitize content
    const sanitizedContent = this.sanitizeContent(content)

    return {
      ...message,
      content: sanitizedContent,
      timestamp: message.timestamp || new Date().toISOString()
    }
  }

  // Validate conversation data
  validateConversation(conversation) {
    if (!conversation || typeof conversation !== 'object') {
      throw new Error('Invalid conversation structure')
    }

    const { title, provider, site, messages } = conversation

    // Validate required fields
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      throw new Error('Invalid conversation title')
    }

    if (!provider || typeof provider !== 'string' || provider.trim().length === 0) {
      throw new Error('Invalid conversation provider')
    }

    if (!site || !this.validateOrigin(site)) {
      throw new Error('Invalid conversation site')
    }

    // Validate messages
    if (!Array.isArray(messages)) {
      throw new Error('Messages must be an array')
    }

    const validatedMessages = messages.map(msg => this.validateMessage(msg))

    return {
      ...conversation,
      title: this.sanitizeContent(title),
      provider: provider.trim(),
      site,
      messages: validatedMessages
    }
  }

  // Validate context profile
  validateContextProfile(profile) {
    if (!profile || typeof profile !== 'object') {
      throw new Error('Invalid context profile structure')
    }

    const { system_prompt, facts, conversation_history } = profile

    // Validate system prompt
    if (system_prompt && typeof system_prompt !== 'string') {
      throw new Error('System prompt must be a string')
    }

    // Validate facts
    if (facts && Array.isArray(facts)) {
      facts.forEach((fact, index) => {
        if (!fact.content || typeof fact.content !== 'string') {
          throw new Error(`Invalid fact at index ${index}`)
        }
        if (fact.importance && (typeof fact.importance !== 'number' || fact.importance < 1 || fact.importance > 10)) {
          throw new Error(`Invalid importance value at index ${index}`)
        }
      })
    }

    // Validate conversation history
    if (conversation_history && Array.isArray(conversation_history)) {
      conversation_history.forEach((history, index) => {
        if (!history.content || typeof history.content !== 'string') {
          throw new Error(`Invalid conversation history at index ${index}`)
        }
      })
    }

    return {
      ...profile,
      system_prompt: system_prompt ? this.sanitizeContent(system_prompt) : '',
      facts: facts ? facts.map(fact => ({
        ...fact,
        content: this.sanitizeContent(fact.content)
      })) : [],
      conversation_history: conversation_history ? conversation_history.map(history => ({
        ...history,
        content: this.sanitizeContent(history.content)
      })) : []
    }
  }

  // Validate API response
  validateApiResponse(response) {
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid API response')
    }

    // Check for error responses
    if (response.error) {
      throw new Error(`API Error: ${response.error}`)
    }

    return response
  }

  // Rate limiting
  createRateLimiter(maxRequests, timeWindow) {
    const requests = new Map()

    return (key) => {
      const now = Date.now()
      const windowStart = now - timeWindow
      
      // Clean old requests
      for (const [timestamp] of requests) {
        if (timestamp < windowStart) {
          requests.delete(timestamp)
        }
      }

      // Count requests for this key
      const keyRequests = Array.from(requests.values())
        .filter(req => req.key === key)

      if (keyRequests.length >= maxRequests) {
        throw new Error('Rate limit exceeded')
      }

      // Add new request
      requests.set(now, { key, timestamp: now })
      return true
    }
  }

  // Validate user input
  validateUserInput(input) {
    if (!input || typeof input !== 'string') {
      throw new Error('Invalid user input')
    }

    const sanitized = this.sanitizeContent(input)
    
    if (sanitized.length === 0) {
      throw new Error('Empty user input')
    }

    return sanitized
  }
}

// Create singleton instance
const securityValidator = new SecurityValidator()

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = securityValidator
} else {
  window.securityValidator = securityValidator
}
