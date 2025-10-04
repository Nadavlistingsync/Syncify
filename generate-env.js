#!/usr/bin/env node

const crypto = require('crypto');

// Generate a random JWT secret
const jwtSecret = crypto.randomBytes(64).toString('hex');

console.log('='.repeat(60));
console.log('SYNCIFY SUPABASE ENVIRONMENT SETUP');
console.log('='.repeat(60));
console.log('');

console.log('Generated JWT Secret:');
console.log(jwtSecret);
console.log('');

console.log('Environment Variables Template:');
console.log('Copy these to your .env.local file in the web directory:');
console.log('');

console.log('# Supabase Configuration');
console.log('NEXT_PUBLIC_SUPABASE_URL=your_project_url_here');
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here');
console.log('SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here');
console.log('');
console.log('# JWT Secret for additional security');
console.log(`JWT_SECRET=${jwtSecret}`);
console.log('');
console.log('# Environment');
console.log('NODE_ENV=development');
console.log('NEXT_PUBLIC_APP_URL=http://localhost:3000');
console.log('');
console.log('='.repeat(60));
console.log('Next Steps:');
console.log('1. Create Supabase account: https://supabase.com');
console.log('2. Create project named "syncify"');
console.log('3. Run the SQL migrations from setup-supabase.md');
console.log('4. Get API keys from Settings → API');
console.log('5. Replace the placeholder values above with your actual keys');
console.log('6. Save as .env.local in the web directory');
console.log('='.repeat(60));
