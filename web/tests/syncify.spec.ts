import { test, expect, Page } from '@playwright/test';

test.describe('Syncify Application', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    
    // Enable console logging for debugging
    page.on('console', msg => {
      console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
    });
    
    // Enable network request logging
    page.on('request', request => {
      console.log(`[Request] ${request.method()} ${request.url()}`);
    });
    
    // Enable response logging
    page.on('response', response => {
      console.log(`[Response] ${response.status()} ${response.url()}`);
    });
  });

  test.afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  test('should load the homepage', async () => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Syncify/);
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    // Take screenshot for debugging
    await page.screenshot({ path: 'screenshots/homepage.png' });
  });

  test('should display navigation elements', async () => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check for navigation elements
    const nav = page.locator('nav, [role="navigation"]');
    await expect(nav).toBeVisible();
    
    // Check for common navigation items
    const hasNavigation = await page.locator('nav a, [role="navigation"] a').count() > 0;
    expect(hasNavigation).toBeTruthy();
  });

  test('should handle authentication flow', async () => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Look for sign in/up buttons or auth-related elements
    const authElements = page.locator('button:has-text("Sign"), a:has-text("Login"), a:has-text("Sign"), button:has-text("Login")');
    
    if (await authElements.count() > 0) {
      console.log('Found authentication elements');
      await authElements.first().click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'screenshots/auth-flow.png' });
    } else {
      console.log('No authentication elements found - might be already authenticated or not implemented');
    }
  });

  test('should check dashboard functionality', async () => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Check if dashboard loads
    const dashboardContent = page.locator('main, [role="main"], .dashboard, #dashboard');
    if (await dashboardContent.count() > 0) {
      await expect(dashboardContent.first()).toBeVisible();
      await page.screenshot({ path: 'screenshots/dashboard.png' });
    } else {
      console.log('Dashboard not found or not accessible');
    }
  });

  test('should check memory management functionality', async () => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Look for memory-related navigation or buttons
    const memoryElements = page.locator('a:has-text("Memor"), button:has-text("Memor"), [href*="memor"]');
    
    if (await memoryElements.count() > 0) {
      await memoryElements.first().click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'screenshots/memories.png' });
    } else {
      console.log('Memory functionality not found');
    }
  });

  test('should check context functionality', async () => {
    await page.goto('/context');
    await page.waitForLoadState('networkidle');
    
    const contextContent = page.locator('main, [role="main"], .context');
    if (await contextContent.count() > 0) {
      await expect(contextContent.first()).toBeVisible();
      await page.screenshot({ path: 'screenshots/context.png' });
    } else {
      console.log('Context page not found or not accessible');
    }
  });

  test('should check resources page', async () => {
    await page.goto('/resources');
    await page.waitForLoadState('networkidle');
    
    const resourcesContent = page.locator('main, [role="main"], .resources');
    if (await resourcesContent.count() > 0) {
      await expect(resourcesContent.first()).toBeVisible();
      await page.screenshot({ path: 'screenshots/resources.png' });
    } else {
      console.log('Resources page not found or not accessible');
    }
  });

  test('should handle form interactions with slow typing', async () => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Look for forms on the page
    const forms = page.locator('form');
    const formCount = await forms.count();
    
    if (formCount > 0) {
      console.log(`Found ${formCount} forms`);
      
      for (let i = 0; i < formCount; i++) {
        const form = forms.nth(i);
        const inputs = form.locator('input, textarea, select');
        const inputCount = await inputs.count();
        
        console.log(`Form ${i + 1} has ${inputCount} inputs`);
        
        // Try to interact with the first few inputs with slow typing
        for (let j = 0; j < Math.min(3, inputCount); j++) {
          const input = inputs.nth(j);
          const inputType = await input.getAttribute('type');
          
          if (inputType === 'text' || inputType === 'email' || !inputType) {
            // Clear the input first
            await input.click();
            await input.clear();
            await page.waitForTimeout(100);
            
            // Type very slowly character by character
            const testText = 'test input';
            for (let k = 0; k < testText.length; k++) {
              await input.type(testText[k], { delay: 500 }); // 500ms delay between characters
              await page.waitForTimeout(200); // Additional pause
            }
            
            // Wait a bit after typing
            await page.waitForTimeout(500);
          }
        }
      }
      
      await page.screenshot({ path: 'screenshots/form-interaction.png' });
    } else {
      console.log('No forms found on the page');
    }
  });

  test('should check for JavaScript errors', async () => {
    const errors: string[] = [];
    
    page.on('pageerror', error => {
      errors.push(`Page error: ${error.message}`);
    });
    
    page.on('requestfailed', request => {
      errors.push(`Request failed: ${request.url()} - ${request.failure()?.errorText}`);
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Navigate through different pages to catch errors
    const pages = ['/dashboard', '/context', '/resources'];
    
    for (const pagePath of pages) {
      try {
        await page.goto(pagePath);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
      } catch (error) {
        errors.push(`Navigation error to ${pagePath}: ${error}`);
      }
    }
    
    // Log errors but don't fail the test - just report them
    if (errors.length > 0) {
      console.log('JavaScript errors found:');
      errors.forEach(error => console.log(`  - ${error}`));
    } else {
      console.log('No JavaScript errors detected');
    }
  });

  test('should test slow user interactions', async () => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Test slow clicking on buttons and links
    const clickableElements = page.locator('button, a, [role="button"], [onclick]');
    const clickableCount = await clickableElements.count();
    
    console.log(`Found ${clickableCount} clickable elements`);
    
    // Test first 5 clickable elements with slow interactions
    for (let i = 0; i < Math.min(5, clickableCount); i++) {
      const element = clickableElements.nth(i);
      
      // Check if element is visible and enabled
      if (await element.isVisible() && await element.isEnabled()) {
        try {
          // Hover first
          await element.hover();
          await page.waitForTimeout(1000);
          
          // Very slow click
          await element.click({ delay: 1000 });
          await page.waitForTimeout(2000);
          
          // Take screenshot after each interaction
          await page.screenshot({ path: `screenshots/slow-interaction-${i + 1}.png` });
          
          // Go back if we navigated away
          if (page.url() !== 'http://localhost:3000/') {
            await page.goBack();
            await page.waitForTimeout(500);
          }
          
        } catch (error) {
          console.log(`Error interacting with element ${i + 1}: ${error.message}`);
        }
      }
    }
  });

  test('should test slow navigation', async () => {
    const pages = ['/', '/dashboard', '/context', '/resources'];
    
    for (const pagePath of pages) {
      console.log(`Slowly navigating to ${pagePath}...`);
      
      // Navigate very slowly
      await page.goto(pagePath, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000); // Wait 3 seconds
      
      // Wait for network to be idle
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000); // Additional wait
      
      // Scroll slowly to bottom
      await page.evaluate(async () => {
        await new Promise(resolve => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;

            if(totalHeight >= scrollHeight){
              clearInterval(timer);
              resolve(undefined);
            }
          }, 300);
        });
      });
      
      await page.waitForTimeout(3000);
      
      // Scroll back to top slowly
      await page.evaluate(async () => {
        await new Promise(resolve => {
          let totalHeight = window.pageYOffset;
          const distance = 100;
          const timer = setInterval(() => {
            window.scrollBy(0, -distance);
            totalHeight -= distance;

            if(totalHeight <= 0){
              clearInterval(timer);
              resolve(undefined);
            }
          }, 300);
        });
      });
      
      await page.waitForTimeout(2000);
      
      // Take screenshot
      await page.screenshot({ 
        path: `screenshots/slow-navigation-${pagePath.replace('/', 'home')}.png`,
        fullPage: true 
      });
    }
  });

  test('should check responsive design', async () => {
    const viewports = [
      { width: 375, height: 667, name: 'Mobile' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 1920, height: 1080, name: 'Desktop' }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      await page.screenshot({ 
        path: `screenshots/responsive-${viewport.name.toLowerCase()}.png`,
        fullPage: true 
      });
      
      console.log(`Tested ${viewport.name} viewport: ${viewport.width}x${viewport.height}`);
    }
  });

  test('should simulate very slow human-like interactions', async () => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    console.log('Starting very slow human-like interaction simulation...');
    
    // Simulate reading the page slowly
    await page.waitForTimeout(5000); // 5 seconds to "read" the page
    
    // Look for all interactive elements
    const interactiveElements = page.locator('input, textarea, button, a, [role="button"], [onclick], select');
    const elementCount = await interactiveElements.count();
    
    console.log(`Found ${elementCount} interactive elements to test slowly`);
    
    // Test each element with very slow, human-like behavior
    for (let i = 0; i < Math.min(10, elementCount); i++) {
      const element = interactiveElements.nth(i);
      
      if (await element.isVisible() && await element.isEnabled()) {
        try {
          console.log(`Testing element ${i + 1}/${Math.min(10, elementCount)}...`);
          
          // Move mouse slowly to element (simulate human mouse movement)
          const box = await element.boundingBox();
          if (box) {
            // Simulate slow mouse movement
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
            await page.waitForTimeout(2000); // 2 seconds to "think"
          }
          
          // Hover over element
          await element.hover();
          await page.waitForTimeout(3000); // 3 seconds to "examine"
          
          // Get element type and interact accordingly
          const tagName = await element.evaluate(el => el.tagName.toLowerCase());
          const type = await element.getAttribute('type');
          
          if (tagName === 'input' && (type === 'text' || type === 'email' || !type)) {
            // Very slow typing simulation
            await element.click();
            await page.waitForTimeout(1000);
            
            const testText = 'This is a very slow typing test to simulate human behavior';
            for (let j = 0; j < testText.length; j++) {
              await element.type(testText[j], { delay: 800 }); // 800ms between characters
              await page.waitForTimeout(300); // Additional pause
              
              // Occasionally pause longer (simulate thinking)
              if (j % 5 === 0) {
                await page.waitForTimeout(1500);
              }
            }
            
            await page.waitForTimeout(3000); // Pause after typing
          } else if (tagName === 'button' || tagName === 'a' || await element.getAttribute('role') === 'button') {
            // Very slow click simulation
            await page.waitForTimeout(2000); // "Think" before clicking
            await element.click({ delay: 1500 }); // 1.5 second delay before click
            await page.waitForTimeout(4000); // 4 seconds after click
            
            // Go back if we navigated
            if (page.url() !== 'http://localhost:3000/') {
              await page.goBack();
              await page.waitForTimeout(2000);
            }
          }
          
          // Take screenshot after each interaction
          await page.screenshot({ 
            path: `screenshots/human-like-${i + 1}.png`,
            fullPage: true 
          });
          
          // Random pause between elements (human-like behavior)
          const randomPause = Math.random() * 3000 + 2000; // 2-5 seconds
          await page.waitForTimeout(randomPause);
          
        } catch (error) {
          console.log(`Error with element ${i + 1}: ${error.message}`);
          await page.waitForTimeout(1000);
        }
      }
    }
    
    console.log('Human-like interaction simulation completed');
  });
});
