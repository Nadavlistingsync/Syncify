# Syncify Deployment Testing Guide

## Overview
This guide explains how to test the Syncify Chrome extension on the deployed website to capture LLM context interactions.

## Chrome Extension Testing

### 1. Install the Extension
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked" and select the `/extension` folder
4. The Syncify extension should appear in your extensions list

### 2. Test on Deployed Site
The extension is configured to work on:
- `syncify.vercel.app` (production)
- `syncify.*.vercel.app` (preview deployments)
- `localhost:3000-3006` (local development)

### 3. Context Capture Testing

#### What the Extension Captures
The extension captures context from **LLM interactions only**, specifically:
- Chat messages from AI providers (ChatGPT, Claude, Gemini, etc.)
- API calls to AI services
- DOM changes in AI chat interfaces

#### Testing Steps
1. **Install the extension** (see step 1)
2. **Navigate to the deployed Syncify site** (e.g., syncify.vercel.app)
3. **Check extension status**:
   - Extension icon should be visible in Chrome toolbar
   - Click extension icon to see popup
   - Check browser console for extension logs
4. **Test context capture**:
   - Go to AI sites (ChatGPT, Claude, etc.)
   - Have conversations with the AI
   - Extension should capture and sync context
5. **Verify context injection**:
   - Return to Syncify site
   - Use text inputs/forms
   - Context should be automatically injected

### 4. Browser Testing Commands

#### Local Testing
```bash
# Test the deployed site
cd web
npm run test:vercel

# Continuous testing
npm run test:vercel:continuous
```

#### Extension Testing
```bash
# Test extension functionality
npm run test:extension
```

### 5. Slow Typing Simulation
The tests include slow typing simulation to:
- Test real user behavior
- Trigger context injection
- Verify extension responsiveness
- Test form interactions

### 6. Monitoring and Debugging

#### Browser Console
Check for extension logs:
- `Syncify content script initializing...`
- `AI site detected`
- `Captured context`
- `Context injection failed`

#### Network Tab
Monitor for:
- API calls to `/api/conversations`
- API calls to `/api/context`
- API calls to `/api/memories`

#### Extension Popup
- Shows current status
- Displays captured context
- Allows manual context injection

### 7. Expected Behavior

#### On AI Sites
- Extension detects AI provider
- Captures conversation messages
- Sends context to Syncify backend
- Logs successful captures

#### On Syncify Site
- Extension detects Syncify deployment
- Monitors for context updates
- Injects context into forms
- Shows context in popup

#### Error Handling
- Graceful fallbacks for failed captures
- Error logging in console
- Retry mechanisms for network issues

### 8. Troubleshooting

#### Extension Not Loading
- Check Chrome extensions page
- Ensure developer mode is enabled
- Reload the extension
- Check for JavaScript errors

#### Context Not Capturing
- Verify AI site is supported
- Check browser console for errors
- Ensure network requests are not blocked
- Test with different AI providers

#### Context Not Injecting
- Check if user is authenticated
- Verify context profile exists
- Test with empty forms
- Check injection timing

### 9. Performance Testing
- Monitor extension memory usage
- Test with multiple AI sites open
- Verify no performance impact on browsing
- Check network request efficiency

### 10. Security Testing
- Verify no sensitive data leakage
- Test with private/incognito mode
- Check extension permissions
- Validate data encryption

## Deployment Status
- ✅ Chrome extension updated for Syncify testing
- ✅ Browser testing framework with slow typing
- ✅ Vercel deployment configuration
- ✅ Continuous testing loop
- ✅ Context capture and injection system
- ✅ Multi-provider AI support

## Next Steps
1. Deploy to Vercel
2. Install extension on test browsers
3. Test with real AI conversations
4. Monitor context capture and injection
5. Gather user feedback
6. Iterate based on testing results
