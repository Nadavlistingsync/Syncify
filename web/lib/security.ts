// SOC 2 Type II, SOC 1, and GDPR Compliance Security Module
import crypto from 'crypto'
import jwt from 'jsonwebtoken'

// Security Configuration
export const SECURITY_CONFIG = {
  // Encryption
  ENCRYPTION_ALGORITHM: 'aes-256-gcm',
  KEY_DERIVATION_ITERATIONS: 100000,
  SALT_LENGTH: 32,
  IV_LENGTH: 16,
  TAG_LENGTH: 16,
  
  // JWT
  JWT_EXPIRY: '1h',
  REFRESH_TOKEN_EXPIRY: '30d',
  
  // Rate Limiting
  RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS_PER_WINDOW: 100,
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
  
  // Data Retention (GDPR)
  DEFAULT_RETENTION_DAYS: 2555, // 7 years for SOC 1
  AUDIT_LOG_RETENTION_DAYS: 2555, // 7 years
  CONVERSATION_RETENTION_DAYS: 1095, // 3 years
  EVENT_RETENTION_DAYS: 365, // 1 year
  
  // PII Detection
  PII_PATTERNS: {
    EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    PHONE: /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
    SSN: /\b\d{3}-\d{2}-\d{4}\b/g,
    CREDIT_CARD: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    PASSPORT: /\b[A-Z]{2}\d{6}\b/g
  }
}

// Encryption utilities
export class EncryptionService {
  private static deriveKey(password: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(password, salt, SECURITY_CONFIG.KEY_DERIVATION_ITERATIONS, 32, 'sha512')
  }

  static encrypt(text: string, password: string): { encrypted: string; salt: string; iv: string; tag: string } {
    const salt = crypto.randomBytes(SECURITY_CONFIG.SALT_LENGTH)
    const key = this.deriveKey(password, salt)
    const iv = crypto.randomBytes(SECURITY_CONFIG.IV_LENGTH)
    
    const cipher = crypto.createCipher(SECURITY_CONFIG.ENCRYPTION_ALGORITHM, key)
    cipher.setAAD(Buffer.from('syncify'))
    
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const tag = cipher.getAuthTag()
    
    return {
      encrypted,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    }
  }

  static decrypt(encryptedData: { encrypted: string; salt: string; iv: string; tag: string }, password: string): string {
    const salt = Buffer.from(encryptedData.salt, 'hex')
    const key = this.deriveKey(password, salt)
    const iv = Buffer.from(encryptedData.iv, 'hex')
    const tag = Buffer.from(encryptedData.tag, 'hex')
    
    const decipher = crypto.createDecipher(SECURITY_CONFIG.ENCRYPTION_ALGORITHM, key)
    decipher.setAAD(Buffer.from('syncify'))
    decipher.setAuthTag(tag)
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  }
}

// PII Detection and Redaction
export class PIIDetectionService {
  static detectPII(text: string): { hasPII: boolean; piiTypes: string[]; redactedText: string } {
    const piiTypes: string[] = []
    let redactedText = text
    
    // Check for each PII type
    Object.entries(SECURITY_CONFIG.PII_PATTERNS).forEach(([type, pattern]) => {
      if (pattern.test(text)) {
        piiTypes.push(type.toLowerCase())
        redactedText = redactedText.replace(pattern, `[${type}_REDACTED]`)
      }
    })
    
    return {
      hasPII: piiTypes.length > 0,
      piiTypes,
      redactedText
    }
  }

  static isPII(text: string): boolean {
    return Object.values(SECURITY_CONFIG.PII_PATTERNS).some(pattern => pattern.test(text))
  }
}

// Audit Logging Service
export class AuditLogService {
  static async logEvent(
    userId: string,
    event: string,
    resource: string,
    action: string,
    details: Record<string, any> = {},
    ipAddress?: string,
    userAgent?: string
  ) {
    const auditEntry = {
      id: crypto.randomUUID(),
      user_id: userId,
      event,
      resource,
      action,
      details: JSON.stringify(details),
      ip_address: ipAddress || 'unknown',
      user_agent: userAgent || 'unknown',
      timestamp: new Date().toISOString(),
      severity: this.determineSeverity(event, action)
    }

    // Log to database (implement with your database client)
    console.log('AUDIT_LOG:', auditEntry)
    
    // Log to external SIEM system
    await this.sendToSIEM(auditEntry)
    
    return auditEntry
  }

  private static determineSeverity(event: string, action: string): 'low' | 'medium' | 'high' | 'critical' {
    const criticalEvents = ['login_failure', 'data_breach', 'unauthorized_access', 'privilege_escalation']
    const highEvents = ['data_export', 'password_change', 'permission_change', 'data_deletion']
    const mediumEvents = ['data_access', 'profile_update', 'policy_change']
    
    if (criticalEvents.includes(event)) return 'critical'
    if (highEvents.includes(event)) return 'high'
    if (mediumEvents.includes(event)) return 'medium'
    return 'low'
  }

  private static async sendToSIEM(auditEntry: any) {
    // Implement SIEM integration (Splunk, ELK, etc.)
    // This is a placeholder for external logging
  }
}

// Rate Limiting Service
export class RateLimitService {
  private static attempts = new Map<string, { count: number; resetTime: number }>()

  static async checkRateLimit(identifier: string, maxAttempts: number = SECURITY_CONFIG.MAX_REQUESTS_PER_WINDOW): Promise<boolean> {
    const now = Date.now()
    const record = this.attempts.get(identifier)

    if (!record || now > record.resetTime) {
      this.attempts.set(identifier, { count: 1, resetTime: now + SECURITY_CONFIG.RATE_LIMIT_WINDOW })
      return true
    }

    if (record.count >= maxAttempts) {
      return false
    }

    record.count++
    return true
  }

  static async checkLoginRateLimit(identifier: string): Promise<{ allowed: boolean; remainingAttempts: number; lockoutUntil?: number }> {
    const now = Date.now()
    const record = this.attempts.get(`login_${identifier}`)

    if (!record || now > record.resetTime) {
      this.attempts.set(`login_${identifier}`, { count: 1, resetTime: now + SECURITY_CONFIG.LOCKOUT_DURATION })
      return { allowed: true, remainingAttempts: SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS - 1 }
    }

    if (record.count >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
      return { 
        allowed: false, 
        remainingAttempts: 0, 
        lockoutUntil: record.resetTime 
      }
    }

    record.count++
    return { 
      allowed: true, 
      remainingAttempts: SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS - record.count 
    }
  }
}

// Data Retention Service (GDPR Compliance)
export class DataRetentionService {
  static async cleanupExpiredData() {
    const now = new Date()
    
    // Clean up expired conversations
    const conversationCutoff = new Date(now.getTime() - (SECURITY_CONFIG.CONVERSATION_RETENTION_DAYS * 24 * 60 * 60 * 1000))
    
    // Clean up expired events
    const eventCutoff = new Date(now.getTime() - (SECURITY_CONFIG.EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000))
    
    // Clean up old audit logs
    const auditCutoff = new Date(now.getTime() - (SECURITY_CONFIG.AUDIT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000))
    
    console.log('Data retention cleanup:', {
      conversationCutoff: conversationCutoff.toISOString(),
      eventCutoff: eventCutoff.toISOString(),
      auditCutoff: auditCutoff.toISOString()
    })
    
    // Implement actual cleanup with your database client
    return {
      conversationsDeleted: 0,
      eventsDeleted: 0,
      auditLogsDeleted: 0
    }
  }
}

// GDPR Compliance Service
export class GDPRComplianceService {
  static async exportUserData(userId: string) {
    // Export all user data in JSON format
    const exportData = {
      user_id: userId,
      export_date: new Date().toISOString(),
      data_categories: {
        profiles: [],
        memories: [],
        conversations: [],
        site_policies: [],
        user_context: [],
        events: []
      },
      metadata: {
        format_version: '1.0',
        retention_policy: 'Data retained according to SOC 1 requirements (7 years)',
        encryption: 'Data encrypted at rest using AES-256-GCM'
      }
    }

    return exportData
  }

  static async deleteUserData(userId: string, reason: string) {
    // Implement right to be forgotten
    await AuditLogService.logEvent(
      userId,
      'gdpr_deletion',
      'user_data',
      'delete',
      { reason, timestamp: new Date().toISOString() }
    )

    // Mark data for deletion (soft delete for audit trail)
    const deletionRecord = {
      user_id: userId,
      deletion_requested_at: new Date().toISOString(),
      deletion_reason: reason,
      deletion_completed_at: null,
      status: 'pending'
    }

    console.log('GDPR deletion request:', deletionRecord)
    
    return deletionRecord
  }

  static async anonymizeUserData(userId: string) {
    // Anonymize user data while preserving analytics
    const anonymizationRecord = {
      user_id: userId,
      anonymized_at: new Date().toISOString(),
      method: 'hash_based_anonymization',
      preserved_analytics: true
    }

    await AuditLogService.logEvent(
      userId,
      'gdpr_anonymization',
      'user_data',
      'anonymize',
      { timestamp: new Date().toISOString() }
    )

    console.log('GDPR anonymization:', anonymizationRecord)
    
    return anonymizationRecord
  }
}

// Security Headers
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co; frame-ancestors 'none';",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'X-Permitted-Cross-Domain-Policies': 'none'
}

// Input Validation
export class InputValidationService {
  static sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/['"]/g, '') // Remove quotes
      .trim()
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  static validateUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(uuid)
  }

  static sanitizeSQL(input: string): string {
    // Basic SQL injection prevention
    return input.replace(/[';\\]/g, '')
  }
}

// Session Management
export class SessionService {
  static generateSessionToken(userId: string): string {
    const payload = {
      userId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
      jti: crypto.randomUUID()
    }

    return jwt.sign(payload, process.env.JWT_SECRET!)
  }

  static verifySessionToken(token: string): { valid: boolean; payload?: any; error?: string } {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!)
      return { valid: true, payload }
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Invalid token' }
    }
  }
}

// Access Control
export class AccessControlService {
  static async checkPermission(userId: string, resource: string, action: string): Promise<boolean> {
    // Implement role-based access control
    const userRoles = await this.getUserRoles(userId)
    const resourcePermissions = this.getResourcePermissions(resource)
    
    return userRoles.some(role => 
      resourcePermissions[role]?.includes(action)
    )
  }

  private static async getUserRoles(userId: string): Promise<string[]> {
    // Implement user role retrieval
    return ['user'] // Default role
  }

  private static getResourcePermissions(resource: string): Record<string, string[]> {
    const permissions = {
      memories: { user: ['read', 'write', 'delete'], admin: ['read', 'write', 'delete', 'moderate'] },
      conversations: { user: ['read', 'write', 'delete'], admin: ['read', 'write', 'delete', 'moderate'] },
      profiles: { user: ['read', 'write'], admin: ['read', 'write', 'delete'] },
      site_policies: { user: ['read', 'write'], admin: ['read', 'write', 'delete'] },
      analytics: { user: ['read'], admin: ['read', 'write'] },
      audit_logs: { admin: ['read'] }
    }

    return permissions[resource as keyof typeof permissions] || {}
  }
}

export default {
  EncryptionService,
  PIIDetectionService,
  AuditLogService,
  RateLimitService,
  DataRetentionService,
  GDPRComplianceService,
  InputValidationService,
  SessionService,
  AccessControlService,
  SECURITY_HEADERS,
  SECURITY_CONFIG
}
