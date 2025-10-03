// Enhanced redaction utilities for privacy protection

export interface RedactionRule {
  type: 'email' | 'phone' | 'ssn' | 'credit_card' | 'name' | 'address' | 'custom'
  pattern: RegExp
  replacement: string
  enabled: boolean
}

export interface RedactionConfig {
  rules: RedactionRule[]
  enableAutomaticDetection: boolean
  customPatterns: string[]
}

// Default redaction rules
export const DEFAULT_REDACTION_RULES: RedactionRule[] = [
  {
    type: 'email',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '[EMAIL_REDACTED]',
    enabled: true
  },
  {
    type: 'phone',
    pattern: /(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
    replacement: '[PHONE_REDACTED]',
    enabled: true
  },
  {
    type: 'ssn',
    pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g,
    replacement: '[SSN_REDACTED]',
    enabled: true
  },
  {
    type: 'credit_card',
    pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    replacement: '[CARD_REDACTED]',
    enabled: true
  },
  {
    type: 'name',
    pattern: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g,
    replacement: '[NAME_REDACTED]',
    enabled: false // Disabled by default, user can enable
  },
  {
    type: 'address',
    pattern: /\b\d+\s+[A-Za-z0-9\s,.-]+\s+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd)\b/gi,
    replacement: '[ADDRESS_REDACTED]',
    enabled: false // Disabled by default, user can enable
  }
]

export class RedactionEngine {
  private config: RedactionConfig

  constructor(config?: Partial<RedactionConfig>) {
    this.config = {
      rules: config?.rules || DEFAULT_REDACTION_RULES,
      enableAutomaticDetection: config?.enableAutomaticDetection ?? true,
      customPatterns: config?.customPatterns || []
    }
  }

  /**
   * Redact sensitive information from text
   */
  redactText(text: string, customRules?: RedactionRule[]): string {
    if (!text || typeof text !== 'string') return text

    let redactedText = text
    const rulesToApply = customRules || this.config.rules

    // Apply each enabled rule
    rulesToApply.forEach(rule => {
      if (rule.enabled) {
        redactedText = redactedText.replace(rule.pattern, rule.replacement)
      }
    })

    // Apply custom patterns
    if (this.config.enableAutomaticDetection) {
      redactedText = this.applyAutomaticDetection(redactedText)
    }

    // Apply user-defined custom patterns
    this.config.customPatterns.forEach(pattern => {
      try {
        const regex = new RegExp(pattern, 'gi')
        redactedText = redactedText.replace(regex, '[CUSTOM_REDACTED]')
      } catch (error) {
        console.warn('Invalid custom redaction pattern:', pattern)
      }
    })

    return redactedText
  }

  /**
   * Apply automatic detection of sensitive information
   */
  private applyAutomaticDetection(text: string): string {
    let redactedText = text

    // Detect potential API keys
    redactedText = redactedText.replace(
      /\b[A-Za-z0-9]{20,}\b/g, 
      (match) => {
        // Check if it looks like an API key
        if (this.looksLikeApiKey(match)) {
          return '[API_KEY_REDACTED]'
        }
        return match
      }
    )

    // Detect potential passwords
    redactedText = redactedText.replace(
      /password[:\s=]+[^\s]+/gi,
      'password: [PASSWORD_REDACTED]'
    )

    // Detect potential tokens
    redactedText = redactedText.replace(
      /token[:\s=]+[^\s]+/gi,
      'token: [TOKEN_REDACTED]'
    )

    // Detect potential URLs with sensitive data
    redactedText = redactedText.replace(
      /https?:\/\/[^\s]+(?:key|token|password|secret)=[^\s&]+/gi,
      (match) => {
        return match.replace(/(?:key|token|password|secret)=[^\s&]+/gi, '$1=[REDACTED]')
      }
    )

    return redactedText
  }

  /**
   * Check if a string looks like an API key
   */
  private looksLikeApiKey(str: string): boolean {
    // Common API key patterns
    const apiKeyPatterns = [
      /^sk-[A-Za-z0-9]{48}$/, // OpenAI
      /^[A-Za-z0-9]{32}$/, // Generic 32-char
      /^[A-Za-z0-9]{40}$/, // Generic 40-char
      /^[A-Za-z0-9]{64}$/, // Generic 64-char
      /^[A-Za-z0-9]{20,}$/ // Long alphanumeric strings
    ]

    return apiKeyPatterns.some(pattern => pattern.test(str))
  }

  /**
   * Check if text contains sensitive information
   */
  containsSensitiveInfo(text: string): boolean {
    const redactedText = this.redactText(text)
    return redactedText !== text
  }

  /**
   * Get a summary of what would be redacted
   */
  getRedactionSummary(text: string): {
    hasEmail: boolean
    hasPhone: boolean
    hasSSN: boolean
    hasCreditCard: boolean
    hasApiKey: boolean
    hasPassword: boolean
    totalRedactions: number
  } {
    const originalText = text
    const redactedText = this.redactText(text)

    return {
      hasEmail: /\[EMAIL_REDACTED\]/.test(redactedText),
      hasPhone: /\[PHONE_REDACTED\]/.test(redactedText),
      hasSSN: /\[SSN_REDACTED\]/.test(redactedText),
      hasCreditCard: /\[CARD_REDACTED\]/.test(redactedText),
      hasApiKey: /\[API_KEY_REDACTED\]/.test(redactedText),
      hasPassword: /\[PASSWORD_REDACTED\]/.test(redactedText),
      totalRedactions: (originalText.match(/\[.*_REDACTED\]/g) || []).length
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<RedactionConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig
    }
  }

  /**
   * Add custom redaction rule
   */
  addCustomRule(rule: Omit<RedactionRule, 'type'> & { type: 'custom' }): void {
    this.config.rules.push({
      ...rule,
      type: 'custom'
    })
  }

  /**
   * Remove custom redaction rule
   */
  removeCustomRule(index: number): void {
    this.config.rules.splice(index, 1)
  }

  /**
   * Get current configuration
   */
  getConfig(): RedactionConfig {
    return { ...this.config }
  }
}

// Utility functions
export function createRedactionEngine(userRules?: Partial<RedactionConfig>): RedactionEngine {
  return new RedactionEngine(userRules)
}

export function redactMemoryContent(content: string, pii: boolean, customRules?: RedactionRule[]): string {
  if (!pii) return content
  
  const engine = createRedactionEngine()
  return engine.redactText(content, customRules)
}

export function shouldRedactForSite(site: string, profileRules: any): boolean {
  // Check if site-specific redaction rules exist
  if (profileRules?.site_specific_redaction) {
    const siteRules = profileRules.site_specific_redaction[site]
    if (siteRules !== undefined) {
      return siteRules
    }
  }
  
  // Default redaction behavior
  return profileRules?.default_redaction ?? true
}

// Export default instance
export const defaultRedactionEngine = createRedactionEngine()
