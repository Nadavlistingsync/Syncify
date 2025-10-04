# Syncify Security Compliance Testing Guide

## 🧪 **Testing Environment Setup**

### **1. Start the Application**
```bash
# In the Syncify directory
cd web
npm run dev
```

The app will be available at: `http://localhost:3002`

### **2. Load the Chrome Extension**
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/` folder from your Syncify directory
5. The Syncify extension should appear in your extensions

### **3. Create Test User Account**
1. Go to `http://localhost:3002`
2. Click "Get Started" or navigate to `/context`
3. Sign up with a test email (e.g., `test@example.com`)
4. Verify the account via the email link

---

## 🔐 **SOC 2 Type II Testing**

### **Test 1: Authentication & Access Controls**
```bash
# Test 1: Unauthorized access (should fail)
curl -X GET http://localhost:3002/api/memories

# Expected: 401 Unauthorized

# Test 2: Valid authentication
curl -X GET http://localhost:3002/api/memories \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: 200 OK with memories array
```

### **Test 2: Role-Based Access Control**
```bash
# Test admin-only endpoints
curl -X GET http://localhost:3002/api/compliance/audit \
  -H "Authorization: Bearer USER_TOKEN"

# Expected: 403 Forbidden (unless user has admin role)

# Test with admin token
curl -X GET http://localhost:3002/api/compliance/audit \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Expected: 200 OK with audit logs
```

### **Test 3: Rate Limiting**
```bash
# Test rate limiting by making multiple requests
for i in {1..110}; do
  curl -X GET http://localhost:3002/api/memories \
    -H "Authorization: Bearer YOUR_TOKEN"
done

# Expected: After 100 requests, should get 429 Rate Limit Exceeded
```

---

## 💰 **SOC 1 Type I Testing**

### **Test 4: Financial Data Protection**
```bash
# Test PII detection in memories
curl -X POST http://localhost:3002/api/memories \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "My SSN is 123-45-6789 and credit card is 4111-1111-1111-1111",
    "type": "fact"
  }'

# Expected: 400 Bad Request with PII detection error

# Test with PII flag
curl -X POST http://localhost:3002/api/memories \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "My SSN is 123-45-6789",
    "type": "fact",
    "pii": true
  }'

# Expected: 200 OK with redacted content
```

### **Test 5: Data Retention**
```bash
# Test data retention cleanup
curl -X POST http://localhost:3002/api/compliance/retention \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "cleanup"}'

# Expected: 200 OK with cleanup results

# Test retention report
curl -X GET http://localhost:3002/api/compliance/retention \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Expected: 200 OK with retention policies and data counts
```

---

## 🇪🇺 **GDPR Testing**

### **Test 6: Data Portability (Right to Access)**
```bash
# Test data export
curl -X GET "http://localhost:3002/api/compliance/gdpr?action=export" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: 200 OK with complete user data export

# Test data status
curl -X GET "http://localhost:3002/api/compliance/gdpr?action=status" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: 200 OK with data processing status
```

### **Test 7: Right to be Forgotten**
```bash
# Test data deletion request
curl -X POST http://localhost:3002/api/compliance/gdpr \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "delete",
    "reason": "User requested data deletion"
  }'

# Expected: 200 OK with deletion request confirmation

# Test data anonymization
curl -X POST http://localhost:3002/api/compliance/gdpr \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "anonymize"
  }'

# Expected: 200 OK with anonymization confirmation
```

### **Test 8: Consent Management**
```bash
# Test consent update
curl -X POST http://localhost:3002/api/compliance/gdpr \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "update_consent",
    "consent_type": "analytics",
    "granted": false
  }'

# Expected: 200 OK with consent update confirmation
```

---

## 🔒 **Security Testing**

### **Test 9: Security Monitoring**
```bash
# Test security dashboard
curl -X GET "http://localhost:3002/api/compliance/security?action=dashboard" \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Expected: 200 OK with security metrics

# Test security events
curl -X GET "http://localhost:3002/api/compliance/security?action=events" \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Expected: 200 OK with security events list

# Test threat detection
curl -X GET "http://localhost:3002/api/compliance/security?action=threats" \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Expected: 200 OK with active threats
```

### **Test 10: Input Validation & SQL Injection Prevention**
```bash
# Test SQL injection attempt
curl -X POST http://localhost:3002/api/memories \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Test memory\"; DROP TABLE memories; --",
    "type": "note"
  }'

# Expected: 400 Bad Request with input validation error

# Test XSS prevention
curl -X POST http://localhost:3002/api/memories \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "<script>alert(\"XSS\")</script>",
    "type": "note"
  }'

# Expected: Content should be sanitized
```

---

## 🧪 **Automated Testing Scripts**

### **Create Test Script: `test-compliance.js`**
```javascript
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3002';
let authToken = '';

async function testCompliance() {
  console.log('🧪 Starting Syncify Compliance Tests...\n');

  // Test 1: Authentication
  await testAuthentication();
  
  // Test 2: PII Detection
  await testPIIDetection();
  
  // Test 3: GDPR Compliance
  await testGDPRCompliance();
  
  // Test 4: Security Monitoring
  await testSecurityMonitoring();
  
  console.log('✅ All compliance tests completed!');
}

async function testAuthentication() {
  console.log('🔐 Testing Authentication...');
  
  try {
    // Test unauthorized access
    const response = await fetch(`${BASE_URL}/api/memories`);
    if (response.status === 401) {
      console.log('✅ Unauthorized access properly blocked');
    } else {
      console.log('❌ Authentication test failed');
    }
  } catch (error) {
    console.log('❌ Authentication test error:', error.message);
  }
}

async function testPIIDetection() {
  console.log('🛡️ Testing PII Detection...');
  
  if (!authToken) {
    console.log('⚠️ Skipping PII test - no auth token');
    return;
  }
  
  try {
    const response = await fetch(`${BASE_URL}/api/memories`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: 'My SSN is 123-45-6789',
        type: 'fact'
      })
    });
    
    if (response.status === 400) {
      console.log('✅ PII detection working correctly');
    } else {
      console.log('❌ PII detection test failed');
    }
  } catch (error) {
    console.log('❌ PII test error:', error.message);
  }
}

async function testGDPRCompliance() {
  console.log('🇪🇺 Testing GDPR Compliance...');
  
  if (!authToken) {
    console.log('⚠️ Skipping GDPR test - no auth token');
    return;
  }
  
  try {
    // Test data export
    const response = await fetch(`${BASE_URL}/api/compliance/gdpr?action=export`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (response.status === 200) {
      console.log('✅ GDPR data export working');
    } else {
      console.log('❌ GDPR export test failed');
    }
  } catch (error) {
    console.log('❌ GDPR test error:', error.message);
  }
}

async function testSecurityMonitoring() {
  console.log('🔍 Testing Security Monitoring...');
  
  if (!authToken) {
    console.log('⚠️ Skipping security test - no auth token');
    return;
  }
  
  try {
    const response = await fetch(`${BASE_URL}/api/compliance/security?action=dashboard`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (response.status === 200 || response.status === 403) {
      console.log('✅ Security monitoring endpoint accessible');
    } else {
      console.log('❌ Security monitoring test failed');
    }
  } catch (error) {
    console.log('❌ Security test error:', error.message);
  }
}

// Run tests
testCompliance().catch(console.error);
```

---

## 🌐 **Browser-Based Testing**

### **Test 11: Chrome Extension Testing**
1. **Install Extension:**
   - Go to `chrome://extensions/`
   - Enable Developer mode
   - Load unpacked extension from `extension/` folder

2. **Test Context Capture:**
   - Go to ChatGPT, Claude, or Gemini
   - Have a conversation
   - Check if extension captures the conversation
   - Verify data appears in Syncify dashboard

3. **Test Context Injection:**
   - Start a new conversation on an AI site
   - Check if relevant context is automatically injected
   - Verify the context is relevant and helpful

### **Test 12: Web Interface Testing**
1. **Dashboard Access:**
   - Go to `http://localhost:3002/dashboard`
   - Verify analytics and usage data
   - Check security metrics

2. **Context Management:**
   - Go to `http://localhost:3002/context`
   - Create, edit, and delete memories
   - Test PII detection in the UI

3. **Compliance Features:**
   - Test data export functionality
   - Test consent management
   - Verify audit log access (admin only)

---

## 📊 **Database Testing**

### **Test 13: Database Compliance**
```sql
-- Test audit log creation
SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 10;

-- Test PII detection logs
SELECT * FROM pii_detection_log ORDER BY created_at DESC LIMIT 10;

-- Test security events
SELECT * FROM security_events ORDER BY created_at DESC LIMIT 10;

-- Test user consent
SELECT * FROM user_consent WHERE user_id = 'YOUR_USER_ID';

-- Test retention policies
SELECT * FROM retention_policies;
```

---

## 🚨 **Security Testing Checklist**

### **✅ SOC 2 Type II Tests:**
- [ ] Authentication and authorization
- [ ] Access controls and permissions
- [ ] Audit logging functionality
- [ ] Data encryption verification
- [ ] System monitoring and alerting
- [ ] Incident response procedures

### **✅ SOC 1 Type I Tests:**
- [ ] Financial data protection
- [ ] 7-year audit trail retention
- [ ] PII detection and blocking
- [ ] Data retention policies
- [ ] Compliance reporting

### **✅ GDPR Tests:**
- [ ] Data portability (export)
- [ ] Right to be forgotten (deletion)
- [ ] Consent management
- [ ] Data protection by design
- [ ] Breach notification procedures

### **✅ Security Tests:**
- [ ] Input validation and sanitization
- [ ] SQL injection prevention
- [ ] XSS protection
- [ ] Rate limiting
- [ ] Security headers
- [ ] PII detection and redaction

---

## 🔧 **Troubleshooting**

### **Common Issues:**

1. **Authentication Errors:**
   - Ensure JWT token is valid
   - Check if user has proper permissions
   - Verify Supabase connection

2. **PII Detection Not Working:**
   - Check if PII patterns are configured correctly
   - Verify content is being processed
   - Check audit logs for PII detection events

3. **GDPR APIs Not Working:**
   - Ensure user is authenticated
   - Check if compliance tables exist
   - Verify database functions are created

4. **Security Monitoring Issues:**
   - Check if security events are being logged
   - Verify admin permissions
   - Check database connectivity

### **Debug Commands:**
```bash
# Check application logs
cd web
npm run dev

# Check database connection
# Go to Supabase dashboard and verify tables exist

# Check extension logs
# Open Chrome DevTools and check console logs
```

---

## 📈 **Performance Testing**

### **Test 14: Load Testing**
```bash
# Install artillery for load testing
npm install -g artillery

# Create load test config: load-test.yml
cat > load-test.yml << EOF
config:
  target: 'http://localhost:3002'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: "API Load Test"
    requests:
      - get:
          url: "/api/memories"
          headers:
            Authorization: "Bearer YOUR_TOKEN"
EOF

# Run load test
artillery run load-test.yml
```

---

## 🎯 **Success Criteria**

### **All Tests Should Pass:**
1. ✅ Authentication and authorization working
2. ✅ PII detection and redaction functional
3. ✅ GDPR compliance features operational
4. ✅ Audit logging comprehensive
5. ✅ Security monitoring active
6. ✅ Data retention policies enforced
7. ✅ Rate limiting effective
8. ✅ Input validation preventing attacks

### **Performance Benchmarks:**
- API response time < 200ms
- PII detection < 50ms
- Audit logging < 10ms
- Security monitoring real-time
- Data export < 5 seconds

---

**Ready to test!** 🚀

Start with the basic authentication tests, then proceed through each compliance area systematically.
