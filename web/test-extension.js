#!/usr/bin/env node

const { chromium } = require('playwright');
const path = require('path');

class ExtensionTester {
  constructor() {
    this.extensionPath = path.join(__dirname, '../extension');
    this.testUrl = 'http://localhost:3000';
    this.browser = null;
    this.page = null;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '🔵',
      success: '✅',
      error: '❌',
      warning: '⚠️'
    }[type] || '🔵';
    
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async setup() {
    this.log('Setting up browser with extension...');
    
    this.browser = await chromium.launch({
      headless: false,
      args: [
        `--disable-extensions-except=${this.extensionPath}`,
        `--load-extension=${this.extensionPath}`,
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    this.page = await this.browser.newPage();
    
    // Enable console logging
    this.page.on('console', msg => {
      console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
    });
    
    // Enable network request logging
    this.page.on('request', request => {
      console.log(`[Request] ${request.method()} ${request.url()}`);
    });
    
    // Enable response logging
    this.page.on('response', response => {
      if (response.status() >= 400) {
        console.log(`[Error Response] ${response.status()} ${response.url()}`);
      }
    });

    this.log('Browser setup complete', 'success');
  }

  async testExtensionOnSyncify() {
    this.log('Testing extension on Syncify site...');
    
    try {
      // Navigate to Syncify
      await this.page.goto(this.testUrl, { waitUntil: 'networkidle' });
      await this.page.waitForTimeout(3000);
      
      // Check if extension is loaded
      const extensionLoaded = await this.page.evaluate(() => {
        return !!window.universalAI;
      });
      
      if (extensionLoaded) {
        this.log('Extension loaded successfully', 'success');
      } else {
        this.log('Extension not detected', 'warning');
      }
      
      // Test context capture on different pages
      await this.testContextCapture();
      
      // Test slow typing to trigger context injection
      await this.testSlowTyping();
      
      // Test API interactions
      await this.testAPIInteractions();
      
    } catch (error) {
      this.log(`Extension test failed: ${error.message}`, 'error');
    }
  }

  async testContextCapture() {
    this.log('Testing context capture...');
    
    const pages = ['/', '/dashboard', '/context', '/resources'];
    
    for (const pagePath of pages) {
      try {
        this.log(`Testing context capture on ${pagePath}`);
        await this.page.goto(`${this.testUrl}${pagePath}`, { waitUntil: 'networkidle' });
        await this.page.waitForTimeout(2000);
        
        // Check for Syncify elements that should trigger context capture
        const syncifyElements = await this.page.locator(
          '.memory-card, .context-card, .profile-card, [data-syncify]'
        ).count();
        
        if (syncifyElements > 0) {
          this.log(`Found ${syncifyElements} Syncify elements on ${pagePath}`, 'success');
          
          // Simulate user interaction with these elements
          for (let i = 0; i < Math.min(3, syncifyElements); i++) {
            const element = this.page.locator(
              '.memory-card, .context-card, .profile-card, [data-syncify]'
            ).nth(i);
            
            if (await element.isVisible()) {
              await element.hover();
              await this.page.waitForTimeout(1000);
              
              await element.click();
              await this.page.waitForTimeout(1000);
            }
          }
        } else {
          this.log(`No Syncify elements found on ${pagePath}`, 'warning');
        }
        
        // Take screenshot
        await this.page.screenshot({ 
          path: `extension-test-${pagePath.replace('/', 'home')}.png`,
          fullPage: true 
        });
        
      } catch (error) {
        this.log(`Error testing ${pagePath}: ${error.message}`, 'error');
      }
    }
  }

  async testSlowTyping() {
    this.log('Testing slow typing to trigger context injection...');
    
    // Go back to home page
    await this.page.goto(this.testUrl);
    await this.page.waitForTimeout(2000);
    
    // Look for text inputs
    const textInputs = await this.page.locator('input, textarea, [contenteditable="true"]').count();
    
    if (textInputs > 0) {
      this.log(`Found ${textInputs} text inputs`);
      
      // Test first few inputs
      for (let i = 0; i < Math.min(3, textInputs); i++) {
        const input = this.page.locator('input, textarea, [contenteditable="true"]').nth(i);
        
        if (await input.isVisible()) {
          try {
            this.log(`Testing input ${i + 1}`);
            
            // Focus on input
            await input.click();
            await this.page.waitForTimeout(1000);
            
            // Type very slowly to trigger context injection
            const testText = 'Testing context injection with slow typing';
            for (let j = 0; j < testText.length; j++) {
              await input.type(testText[j], { delay: 300 });
              await this.page.waitForTimeout(100);
            }
            
            await this.page.waitForTimeout(2000);
            
            // Clear input
            await input.fill('');
            await this.page.waitForTimeout(500);
            
          } catch (error) {
            this.log(`Error testing input ${i + 1}: ${error.message}`, 'error');
          }
        }
      }
    } else {
      this.log('No text inputs found for testing', 'warning');
    }
  }

  async testAPIInteractions() {
    this.log('Testing API interactions...');
    
    // Monitor network requests to see if extension captures them
    const apiRequests = [];
    
    this.page.on('request', request => {
      if (request.url().includes('/api/')) {
        apiRequests.push({
          url: request.url(),
          method: request.method(),
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Navigate through pages that make API calls
    const apiPages = ['/dashboard', '/context', '/resources'];
    
    for (const pagePath of apiPages) {
      try {
        await this.page.goto(`${this.testUrl}${pagePath}`, { waitUntil: 'networkidle' });
        await this.page.waitForTimeout(3000);
        
        // Wait for potential API calls
        await this.page.waitForTimeout(2000);
        
      } catch (error) {
        this.log(`Error testing API on ${pagePath}: ${error.message}`, 'error');
      }
    }
    
    // Log captured API requests
    if (apiRequests.length > 0) {
      this.log(`Captured ${apiRequests.length} API requests:`, 'success');
      apiRequests.forEach(req => {
        console.log(`  - ${req.method} ${req.url}`);
      });
    } else {
      this.log('No API requests captured', 'warning');
    }
  }

  async testExtensionPopup() {
    this.log('Testing extension popup...');
    
    try {
      // Look for extension icon in browser
      const extensionIcon = await this.page.locator('[data-testid="extension-icon"], .extension-icon').first();
      
      if (await extensionIcon.isVisible()) {
        await extensionIcon.click();
        await this.page.waitForTimeout(1000);
        
        // Check if popup opened
        const popup = this.page.locator('.extension-popup, [role="dialog"]').first();
        if (await popup.isVisible()) {
          this.log('Extension popup opened successfully', 'success');
          
          // Take screenshot of popup
          await popup.screenshot({ path: 'extension-popup.png' });
          
          // Test popup functionality
          await this.testPopupFunctionality(popup);
          
        } else {
          this.log('Extension popup not found', 'warning');
        }
      } else {
        this.log('Extension icon not found', 'warning');
      }
      
    } catch (error) {
      this.log(`Extension popup test failed: ${error.message}`, 'error');
    }
  }

  async testPopupFunctionality(popup) {
    this.log('Testing popup functionality...');
    
    try {
      // Look for buttons or interactive elements in popup
      const buttons = await popup.locator('button, [role="button"]').count();
      
      if (buttons > 0) {
        this.log(`Found ${buttons} buttons in popup`);
        
        // Test first few buttons
        for (let i = 0; i < Math.min(3, buttons); i++) {
          const button = popup.locator('button, [role="button"]').nth(i);
          
          if (await button.isVisible()) {
            const buttonText = await button.textContent();
            this.log(`Testing button: ${buttonText}`);
            
            await button.click();
            await this.page.waitForTimeout(1000);
          }
        }
      }
      
      // Look for input fields in popup
      const inputs = await popup.locator('input, textarea').count();
      
      if (inputs > 0) {
        this.log(`Found ${inputs} input fields in popup`);
        
        // Test first input
        const input = popup.locator('input, textarea').first();
        if (await input.isVisible()) {
          await input.click();
          await input.type('Test input from extension popup');
          await this.page.waitForTimeout(1000);
        }
      }
      
    } catch (error) {
      this.log(`Popup functionality test failed: ${error.message}`, 'error');
    }
  }

  async run() {
    try {
      await this.setup();
      await this.testExtensionOnSyncify();
      await this.testExtensionPopup();
      
      this.log('Extension testing completed', 'success');
      
    } catch (error) {
      this.log(`Extension testing failed: ${error.message}`, 'error');
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

// Run the extension tester
const tester = new ExtensionTester();
tester.run().catch(console.error);
