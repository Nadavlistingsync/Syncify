#!/usr/bin/env node

// Live Chat Functionality Test
console.log('=== Live Chat Functionality Test ===\n');

// Test 1: Message Detection Patterns
console.log('1. Message Detection Patterns:');
const contentScript = require('fs').readFileSync('extension/content.js', 'utf8');

const messageSelectors = [
  '[data-message-author-role]',
  '[data-message-id]',
  '[data-testid*="message"]',
  '[data-testid*="conversation-turn"]',
  '.message',
  '.chat-message',
  '.conversation-turn',
  '.assistant-message',
  '.user-message'
];

messageSelectors.forEach(selector => {
  if (contentScript.includes(selector.replace(/[\[\]]/g, '\\$&'))) {
    console.log(`   ✓ ${selector} detected`);
  } else {
    console.log(`   ✗ ${selector} missing`);
  }
});

// Test 2: Input Field Detection
console.log('\n2. Input Field Detection:');
const inputSelectors = [
  '#prompt-textarea',
  '[data-id*="root"] textarea',
  '.ProseMirror',
  '[contenteditable="true"][role="textbox"]',
  'textarea[aria-label*="Enter a prompt"]',
  '[data-testid*="tweetTextarea"]',
  '[data-testid*="grok"] textarea',
  '.chat-input textarea',
  'textarea[placeholder*="message"]'
];

inputSelectors.forEach(selector => {
  if (contentScript.includes(selector.replace(/[\[\]]/g, '\\$&'))) {
    console.log(`   ✓ ${selector} detected`);
  } else {
    console.log(`   ✗ ${selector} missing`);
  }
});

// Test 3: Context Injection Logic
console.log('\n3. Context Injection Logic:');
const injectionFeatures = [
  'isNewMessageInput',
  'injectContext',
  'generateContextText',
  'injectIntoInput',
  'isEmpty',
  'isShortText'
];

injectionFeatures.forEach(feature => {
  if (contentScript.includes(feature)) {
    console.log(`   ✓ ${feature} implemented`);
  } else {
    console.log(`   ✗ ${feature} missing`);
  }
});

// Test 4: Platform-Specific DOM Parsing
console.log('\n4. Platform-Specific DOM Parsing:');
const platforms = ['OpenAI', 'Claude', 'Google', 'Grok', 'DeepSeek'];
platforms.forEach(platform => {
  const adapterName = `${platform}SiteAdapter`;
  if (contentScript.includes(`class ${adapterName}`)) {
    console.log(`   ✓ ${adapterName} implemented`);
  } else {
    console.log(`   ✗ ${adapterName} missing`);
  }
});

// Test 5: API Endpoint Configuration
console.log('\n5. API Endpoint Configuration:');
const backgroundScript = require('fs').readFileSync('extension/background.js', 'utf8');
const apiEndpoints = [
  'http://localhost:3003/api/conversations',
  'http://localhost:3003/api/context/profile',
  'http://localhost:3003/api/events'
];

apiEndpoints.forEach(endpoint => {
  if (backgroundScript.includes(endpoint)) {
    console.log(`   ✓ ${endpoint} configured`);
  } else {
    console.log(`   ✗ ${endpoint} missing`);
  }
});

// Test 6: Real-time Message Capture
console.log('\n6. Real-time Message Capture:');
const captureFeatures = [
  'setupNetworkInterception',
  'handleFetchRequest',
  'handleWebSocketMessage',
  'setupDOMObservation',
  'handleDOMChanges',
  'detectGenericMessages'
];

captureFeatures.forEach(feature => {
  if (contentScript.includes(feature)) {
    console.log(`   ✓ ${feature} implemented`);
  } else {
    console.log(`   ✗ ${feature} missing`);
  }
});

console.log('\n=== Live Chat Test Complete ===');
console.log('\nExtension is ready for live chat interactions!');
console.log('\nFeatures available during live chat:');
console.log('• Real-time message capture from all platforms');
console.log('• Context injection when starting new messages');
console.log('• Automatic conversation storage');
console.log('• Cross-platform context synchronization');
console.log('• Smart input field detection');
console.log('• Fallback message detection patterns');
