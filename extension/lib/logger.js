// Production-ready logging system for Syncify extension

class Logger {
  constructor() {
    this.config = new Config()
    this.logLevel = this.config.isDevelopment() ? 'debug' : 'error'
    this.logBuffer = []
    this.maxBufferSize = 100
  }

  setLevel(level) {
    const validLevels = ['debug', 'info', 'warn', 'error']
    if (validLevels.includes(level)) {
      this.logLevel = level
    }
  }

  shouldLog(level) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 }
    return levels[level] >= levels[this.logLevel]
  }

  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString()
    const formatted = {
      timestamp,
      level,
      message,
      data: data ? this.sanitizeData(data) : null,
      url: window.location?.href,
      userAgent: navigator.userAgent,
      extensionVersion: chrome.runtime.getManifest()?.version
    }
    return formatted
  }

  sanitizeData(data) {
    try {
      // Remove sensitive information
      const sanitized = JSON.parse(JSON.stringify(data))
      this.removeSensitiveFields(sanitized)
      return sanitized
    } catch (error) {
      return { error: 'Failed to sanitize data' }
    }
  }

  removeSensitiveFields(obj) {
    if (typeof obj !== 'object' || obj === null) return

    const sensitiveFields = ['password', 'token', 'key', 'secret', 'auth', 'session']
    
    for (const key in obj) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        obj[key] = '[REDACTED]'
      } else if (typeof obj[key] === 'object') {
        this.removeSensitiveFields(obj[key])
      }
    }
  }

  addToBuffer(formattedMessage) {
    this.logBuffer.push(formattedMessage)
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift()
    }
  }

  async sendToServer(level, message, data = null) {
    if (!this.config.get('features.telemetry')) return

    try {
      const logData = this.formatMessage(level, message, data)
      
      const response = await fetch(`${this.config.get('apiBaseUrl')}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          kind: 'log',
          payload: logData
        })
      })

      if (!response.ok) {
        console.warn('Failed to send log to server:', response.status)
      }
    } catch (error) {
      // Don't log logging errors to avoid infinite loops
      console.warn('Failed to send log to server:', error.message)
    }
  }

  debug(message, data = null) {
    if (!this.shouldLog('debug')) return
    
    const formatted = this.formatMessage('debug', message, data)
    this.addToBuffer(formatted)
    
    if (this.config.isDevelopment()) {
      console.debug(`[Syncify] ${message}`, data)
    }
  }

  info(message, data = null) {
    if (!this.shouldLog('info')) return
    
    const formatted = this.formatMessage('info', message, data)
    this.addToBuffer(formatted)
    
    console.info(`[Syncify] ${message}`, data)
    this.sendToServer('info', message, data)
  }

  warn(message, data = null) {
    if (!this.shouldLog('warn')) return
    
    const formatted = this.formatMessage('warn', message, data)
    this.addToBuffer(formatted)
    
    console.warn(`[Syncify] ${message}`, data)
    this.sendToServer('warn', message, data)
  }

  error(message, error = null, data = null) {
    if (!this.shouldLog('error')) return
    
    const errorData = {
      message: error?.message || message,
      stack: error?.stack,
      ...data
    }
    
    const formatted = this.formatMessage('error', message, errorData)
    this.addToBuffer(formatted)
    
    console.error(`[Syncify] ${message}`, error, data)
    this.sendToServer('error', message, errorData)
  }

  // Get logs for debugging
  getLogs() {
    return this.logBuffer
  }

  // Clear logs
  clearLogs() {
    this.logBuffer = []
  }

  // Performance timing
  time(label) {
    if (!this.config.isDevelopment()) return
    console.time(`[Syncify] ${label}`)
  }

  timeEnd(label) {
    if (!this.config.isDevelopment()) return
    console.timeEnd(`[Syncify] ${label}`)
  }
}

// Create singleton instance
const logger = new Logger()

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = logger
} else {
  window.logger = logger
}
