#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('🚀 Syncify Supabase Setup Automation');
console.log('=====================================\n');

// Check if we're in the right directory
if (!fs.existsSync('web') || !fs.existsSync('supabase')) {
  console.error('❌ Please run this script from the Syncify root directory');
  process.exit(1);
}

// Generate JWT secret
const jwtSecret = crypto.randomBytes(64).toString('hex');

// Create .env.local file
const envContent = `# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# JWT Secret for additional security
JWT_SECRET=${jwtSecret}

# Environment
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: Provider API Keys (for server-side utilities)
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
GOOGLE_API_KEY=your_google_api_key
`;

const envPath = path.join('web', '.env.local');
fs.writeFileSync(envPath, envContent);
console.log('✅ Created web/.env.local with JWT secret');

// Create setup summary
const summaryContent = `# Supabase Setup Summary

## ✅ Completed
- Generated JWT secret: ${jwtSecret.substring(0, 20)}...
- Created .env.local template
- Prepared migration files

## 🔄 Manual Steps Required
1. Create Supabase account at https://supabase.com
   - Email: nadav.benedek@xeinst.com
   - Project name: syncify
   
2. Run SQL migrations in order:
   - supabase/migrations/001_initial_schema.sql
   - supabase/migrations/002_rls_policies.sql
   - supabase/migrations/003_seed_data.sql
   - supabase/migrations/004_telemetry_enhancements.sql
   - supabase/migrations/005_user_context_storage.sql

3. Get API keys from Settings → API:
   - Project URL
   - anon public key
   - service_role key

4. Update .env.local with actual values:
   - Replace "your_project_url_here"
   - Replace "your_anon_key_here" 
   - Replace "your_service_role_key_here"

## 🧪 Test Setup
Run: cd web && npm run dev

## 📁 Files Created
- web/.env.local (environment variables)
- setup-supabase.md (detailed setup guide)
- This summary file

## 🔗 Next Steps
After completing manual setup:
1. Test database connection
2. Start development server
3. Verify authentication works
`;

fs.writeFileSync('setup-summary.md', summaryContent);
console.log('✅ Created setup-summary.md');

console.log('\n🎯 Next Steps:');
console.log('1. Create Supabase account: https://supabase.com');
console.log('2. Create project named "syncify"');
console.log('3. Run SQL migrations from supabase/migrations/');
console.log('4. Update web/.env.local with your API keys');
console.log('5. Test with: cd web && npm run dev\n');

console.log('📖 See setup-supabase.md for detailed instructions');
console.log('📋 See setup-summary.md for quick reference\n');

console.log('✨ Setup automation complete!');
