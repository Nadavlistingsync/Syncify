#!/usr/bin/env node

const { chromium } = require('playwright');

class VercelTester {
  constructor(vercelUrl) {
    this.vercelUrl = vercelUrl || 'https://syncify.vercel.app';
    this.testCount = 0;
    this.failureCount = 0;
    this.successCount = 0;
    this.startTime = Date.now();
    this.isRunning = false;
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

  async testVercelDeployment() {
    let browser;
    let page;
    
    try {
      this.log(`Testing Vercel deployment at ${this.vercelUrl}`);
      
      browser = await chromium.launch({ 
        headless: false, // Show browser for visual feedback
        slowMo: 1000 // Slow down all actions by 1 second
      });
      
      page = await browser.newPage();
      
      // Set viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      // Enable console logging
      page.on('console', msg => {
        console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
      });
      
      // Enable network request logging
      page.on('request', request => {
        console.log(`[Request] ${request.method()} ${request.url()}`);
      });
      
      // Enable response logging
      page.on('response', response => {
        if (response.status() >= 400) {
          console.log(`[Error Response] ${response.status()} ${response.url()}`);
        }
      });

      // Test basic page load
      this.log('Testing basic page load...');
      await page.goto(this.vercelUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000);
      
      // Take screenshot
      await page.screenshot({ path: 'vercel-test-screenshot.png', fullPage: true });
      
      // Test page title
      const title = await page.title();
      this.log(`Page title: ${title}`);
      
      // Test navigation
      await this.testNavigation(page);
      
      // Test forms with slow typing
      await this.testForms(page);
      
      // Test interactive elements
      await this.testInteractions(page);
      
      this.successCount++;
      this.log('Vercel deployment test PASSED', 'success');
      
    } catch (error) {
      this.failureCount++;
      this.log(`Vercel deployment test FAILED: ${error.message}`, 'error');
      
      // Take error screenshot
      if (page) {
        try {
          await page.screenshot({ path: 'vercel-test-error.png', fullPage: true });
        } catch (screenshotError) {
          console.log('Could not take error screenshot:', screenshotError.message);
        }
      }
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async testNavigation(page) {
    this.log('Testing navigation...');
    
    const pages = ['/', '/dashboard', '/context', '/resources'];
    
    for (const pagePath of pages) {
      try {
        this.log(`Testing navigation to ${pagePath}`);
        await page.goto(`${this.vercelUrl}${pagePath}`, { 
          waitUntil: 'networkidle', 
          timeout: 15000 
        });
        await page.waitForTimeout(2000);
        
        // Check if page loaded successfully
        const currentUrl = page.url();
        this.log(`Successfully navigated to: ${currentUrl}`);
        
        // Take screenshot
        await page.screenshot({ 
          path: `vercel-${pagePath.replace('/', 'home')}.png`, 
          fullPage: true 
        });
        
      } catch (error) {
        this.log(`Navigation to ${pagePath} failed: ${error.message}`, 'warning');
      }
    }
  }

  async testForms(page) {
    this.log('Testing forms with slow typing...');
    
    // Go back to home page
    await page.goto(this.vercelUrl);
    await page.waitForTimeout(2000);
    
    const forms = page.locator('form');
    const formCount = await forms.count();
    
    if (formCount > 0) {
      this.log(`Found ${formCount} forms`);
      
      for (let i = 0; i < Math.min(3, formCount); i++) {
        const form = forms.nth(i);
        const inputs = form.locator('input, textarea, select');
        const inputCount = await inputs.count();
        
        this.log(`Testing form ${i + 1} with ${inputCount} inputs`);
        
        for (let j = 0; j < Math.min(3, inputCount); j++) {
          const input = inputs.nth(j);
          const inputType = await input.getAttribute('type');
          
          if (inputType === 'text' || inputType === 'email' || !inputType) {
            try {
              // Click and clear
              await input.click();
              await input.clear();
              await page.waitForTimeout(1000);
              
              // Type very slowly
              const testText = 'Testing Vercel deployment with slow typing';
              for (let k = 0; k < testText.length; k++) {
                await input.type(testText[k], { delay: 300 });
                await page.waitForTimeout(100);
              }
              
              await page.waitForTimeout(2000);
              this.log(`Successfully typed in input ${j + 1}`);
              
            } catch (error) {
              this.log(`Error typing in input ${j + 1}: ${error.message}`, 'warning');
            }
          }
        }
      }
    } else {
      this.log('No forms found on the page');
    }
  }

  async testInteractions(page) {
    this.log('Testing interactive elements...');
    
    // Go back to home page
    await page.goto(this.vercelUrl);
    await page.waitForTimeout(2000);
    
    const clickableElements = page.locator('button, a, [role="button"]');
    const elementCount = await clickableElements.count();
    
    this.log(`Found ${elementCount} clickable elements`);
    
    // Test first 5 clickable elements
    for (let i = 0; i < Math.min(5, elementCount); i++) {
      const element = clickableElements.nth(i);
      
      if (await element.isVisible() && await element.isEnabled()) {
        try {
          this.log(`Testing clickable element ${i + 1}`);
          
          // Hover slowly
          await element.hover();
          await page.waitForTimeout(1000);
          
          // Click slowly
          await element.click({ delay: 500 });
          await page.waitForTimeout(2000);
          
          // Go back if we navigated
          if (!page.url().includes('vercel.app')) {
            await page.goBack();
            await page.waitForTimeout(1000);
          }
          
          this.log(`Successfully tested element ${i + 1}`);
          
        } catch (error) {
          this.log(`Error testing element ${i + 1}: ${error.message}`, 'warning');
        }
      }
    }
  }

  async runContinuousTest() {
    this.log('Starting continuous Vercel testing...');
    this.isRunning = true;
    
    while (this.isRunning) {
      try {
        this.testCount++;
        await this.testVercelDeployment();
        
        // Wait 5 minutes before next test
        this.log('Waiting 5 minutes before next test...');
        await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
        
      } catch (error) {
        this.log(`Error in continuous test: ${error.message}`, 'error');
        await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 1 minute before retry
      }
    }
  }

  stop() {
    this.log('Stopping Vercel testing...');
    this.isRunning = false;
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  if (global.vercelTester) {
    global.vercelTester.stop();
  }
  process.exit(0);
});

// Get Vercel URL from command line or use default
const vercelUrl = process.argv[2] || 'https://syncify.vercel.app';

// Start the Vercel tester
const vercelTester = new VercelTester(vercelUrl);
global.vercelTester = vercelTester;

// Run single test or continuous test based on argument
if (process.argv.includes('--continuous')) {
  vercelTester.runContinuousTest().catch(console.error);
} else {
  vercelTester.testVercelDeployment().catch(console.error);
}
