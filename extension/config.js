// Production configuration for Syncify extension

class Config {
  constructor() {
    this.environment = this.detectEnvironment()
    this.config = this.getConfig()
  }

  detectEnvironment() {
    // Detect if we're in development or production
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
      const manifest = chrome.runtime.getManifest()
      return manifest.version.includes('dev') ? 'development' : 'production'
    }
    return 'development'
  }

  getConfig() {
    const baseConfig = {
      // API endpoints
      apiBaseUrl: this.getApiBaseUrl(),
      appUrl: this.getAppUrl(),
      
      // Feature flags
      features: {
        autoCapture: true,
        autoInject: true,
        showNotifications: true,
        debugMode: this.environment === 'development',
        telemetry: true
      },
      
      // Performance settings
      performance: {
        messageBatchSize: 10,
        maxRetries: 3,
        retryDelay: 1000,
        timeoutMs: 30000,
        debounceMs: 500
      },
      
      // Security settings
      security: {
        validateOrigins: true,
        sanitizeContent: true,
        maxContentLength: 50000,
        allowedDomains: [
          'chatgpt.com',
          'chat.openai.com',
          'claude.ai',
          'claude.com',
          'gemini.google.com',
          'gemini.com',
          'grok.com',
          'x.com',
          'deepseek.com'
        ]
      },
      
      // Rate limiting
      rateLimiting: {
        maxRequestsPerMinute: 60,
        maxInjectionPerMinute: 10,
        maxCapturePerMinute: 30
      }
    }

    return baseConfig
  }

  getApiBaseUrl() {
    if (this.environment === 'production') {
      return 'https://syncify-app.vercel.app'
    }
    return 'http://localhost:3003'
  }

  getAppUrl() {
    if (this.environment === 'production') {
      return 'https://syncify-app.vercel.app'
    }
    return 'http://localhost:3003'
  }

  get(key, defaultValue = null) {
    return this.config[key] || defaultValue
  }

  isProduction() {
    return this.environment === 'production'
  }

  isDevelopment() {
    return this.environment === 'development'
  }

  // Get Supabase configuration
  getSupabaseConfig() {
    if (this.environment === 'production') {
      return {
        url: 'https://rxcrqouvjzxwhtvubdso.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4Y3Jxb3V2anp4d2h0dnViZHNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1ODY3MDcsImV4cCI6MjA3NTE2MjcwN30.AZ-yzDVl3dBWMMQ2RGovLB6Q9tVUsLlWtSBmIzLFm24'
      }
    }
    return {
      url: 'https://rxcrqouvjzxwhtvubdso.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4Y3Jxb3V2anp4d2h0dnViZHNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1ODY3MDcsImV4cCI6MjA3NTE2MjcwN30.AZ-yzDVl3dBWMMQ2RGovLB6Q9tVUsLlWtSBmIzLFm24'
    }
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Config
} else {
  window.Config = Config
}
