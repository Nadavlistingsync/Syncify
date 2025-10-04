#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class ContinuousTester {
  constructor() {
    this.testCount = 0;
    this.failureCount = 0;
    this.successCount = 0;
    this.startTime = Date.now();
    this.isRunning = false;
    this.devServer = null;
    
    // Ensure screenshots directory exists
    if (!fs.existsSync('screenshots')) {
      fs.mkdirSync('screenshots');
    }
    
    // Ensure test-results directory exists
    if (!fs.existsSync('test-results')) {
      fs.mkdirSync('test-results');
    }
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

  async startDevServer() {
    return new Promise((resolve, reject) => {
      this.log('Starting development server...');
      
      this.devServer = spawn('npm', ['run', 'dev'], {
        cwd: process.cwd(),
        stdio: 'pipe'
      });

      this.devServer.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('ready') || output.includes('started server')) {
          this.log('Development server is ready!');
          resolve();
        }
      });

      this.devServer.stderr.on('data', (data) => {
        const error = data.toString();
        if (error.includes('EADDRINUSE')) {
          this.log('Port already in use, assuming server is running...', 'warning');
          resolve();
        } else if (error.includes('error')) {
          this.log(`Dev server error: ${error}`, 'error');
        }
      });

      this.devServer.on('error', (error) => {
        this.log(`Failed to start dev server: ${error.message}`, 'error');
        reject(error);
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        this.log('Dev server startup timeout, continuing...', 'warning');
        resolve();
      }, 30000);
    });
  }

  async runTests() {
    return new Promise((resolve) => {
      this.log(`Running test suite #${this.testCount + 1}...`);
      
      const testProcess = spawn('npx', ['playwright', 'test', '--reporter=json'], {
        cwd: process.cwd(),
        stdio: 'pipe'
      });

      let output = '';
      let errorOutput = '';

      testProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      testProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      testProcess.on('close', (code) => {
        this.testCount++;
        
        try {
          // Try to parse JSON output
          const lines = output.split('\n');
          const jsonLine = lines.find(line => line.startsWith('{'));
          
          if (jsonLine) {
            const results = JSON.parse(jsonLine);
            const passed = results.stats?.passed || 0;
            const failed = results.stats?.failed || 0;
            
            if (failed === 0) {
              this.successCount++;
              this.log(`Test run #${this.testCount} PASSED (${passed} tests)`, 'success');
            } else {
              this.failureCount++;
              this.log(`Test run #${this.testCount} FAILED (${passed} passed, ${failed} failed)`, 'error');
              
              // Log failed tests
              if (results.suites) {
                results.suites.forEach(suite => {
                  if (suite.specs) {
                    suite.specs.forEach(spec => {
                      if (spec.tests) {
                        spec.tests.forEach(test => {
                          if (test.results && test.results.some(r => r.status === 'failed')) {
                            this.log(`  Failed: ${spec.title} - ${test.title}`, 'error');
                          }
                        });
                      }
                    });
                  }
                });
              }
            }
          } else {
            // Fallback to exit code
            if (code === 0) {
              this.successCount++;
              this.log(`Test run #${this.testCount} PASSED`, 'success');
            } else {
              this.failureCount++;
              this.log(`Test run #${this.testCount} FAILED (exit code: ${code})`, 'error');
            }
          }
        } catch (error) {
          // If we can't parse results, use exit code
          if (code === 0) {
            this.successCount++;
            this.log(`Test run #${this.testCount} PASSED`, 'success');
          } else {
            this.failureCount++;
            this.log(`Test run #${this.testCount} FAILED (exit code: ${code})`, 'error');
          }
        }

        // Save test results
        this.saveTestResults(output, errorOutput, code);
        resolve();
      });
    });
  }

  saveTestResults(output, errorOutput, exitCode) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const results = {
      timestamp,
      testCount: this.testCount,
      exitCode,
      output,
      errorOutput,
      stats: {
        total: this.testCount,
        passed: this.successCount,
        failed: this.failureCount
      }
    };

    const filename = `test-results/test-run-${timestamp}.json`;
    fs.writeFileSync(filename, JSON.stringify(results, null, 2));
    
    // Also save a summary
    const summary = {
      lastUpdate: timestamp,
      totalRuns: this.testCount,
      successfulRuns: this.successCount,
      failedRuns: this.failureCount,
      successRate: this.testCount > 0 ? (this.successCount / this.testCount * 100).toFixed(2) + '%' : '0%',
      uptime: Math.round((Date.now() - this.startTime) / 1000) + 's'
    };

    fs.writeFileSync('test-results/summary.json', JSON.stringify(summary, null, 2));
  }

  async analyzeFailures() {
    this.log('Analyzing recent failures...');
    
    try {
      const files = fs.readdirSync('test-results')
        .filter(f => f.startsWith('test-run-') && f.endsWith('.json'))
        .sort()
        .slice(-5); // Last 5 test runs

      const recentFailures = [];
      
      for (const file of files) {
        const content = fs.readFileSync(path.join('test-results', file), 'utf8');
        const result = JSON.parse(content);
        
        if (result.exitCode !== 0) {
          recentFailures.push(result);
        }
      }

      if (recentFailures.length > 0) {
        this.log(`Found ${recentFailures.length} recent failures`, 'warning');
        
        // Look for common error patterns
        const errorPatterns = {};
        
        recentFailures.forEach(failure => {
          const errors = failure.errorOutput || '';
          const commonErrors = [
            'timeout',
            'element not found',
            'network error',
            'javascript error',
            'assertion failed'
          ];
          
          commonErrors.forEach(pattern => {
            if (errors.toLowerCase().includes(pattern)) {
              errorPatterns[pattern] = (errorPatterns[pattern] || 0) + 1;
            }
          });
        });

        if (Object.keys(errorPatterns).length > 0) {
          this.log('Common error patterns:', 'warning');
          Object.entries(errorPatterns).forEach(([pattern, count]) => {
            this.log(`  - ${pattern}: ${count} occurrences`, 'warning');
          });
        }
      } else {
        this.log('No recent failures found', 'success');
      }
    } catch (error) {
      this.log(`Error analyzing failures: ${error.message}`, 'error');
    }
  }

  async run() {
    this.log('Starting continuous testing loop...');
    
    try {
      // Start development server
      await this.startDevServer();
      
      // Wait a bit for server to be fully ready
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      this.isRunning = true;
      
      while (this.isRunning) {
        try {
          await this.runTests();
          
          // Analyze failures every 5 test runs
          if (this.testCount % 5 === 0) {
            await this.analyzeFailures();
          }
          
          // Wait 60 seconds before next test run (increased for slow typing tests)
          this.log('Waiting 60 seconds before next test run...');
          await new Promise(resolve => setTimeout(resolve, 60000));
          
        } catch (error) {
          this.log(`Error in test run: ${error.message}`, 'error');
          await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds before retry
        }
      }
      
    } catch (error) {
      this.log(`Fatal error: ${error.message}`, 'error');
    } finally {
      this.cleanup();
    }
  }

  cleanup() {
    this.log('Cleaning up...');
    this.isRunning = false;
    
    if (this.devServer) {
      this.devServer.kill();
    }
    
    const summary = {
      finalStats: {
        totalRuns: this.testCount,
        successfulRuns: this.successCount,
        failedRuns: this.failureCount,
        successRate: this.testCount > 0 ? (this.successCount / this.testCount * 100).toFixed(2) + '%' : '0%',
        totalUptime: Math.round((Date.now() - this.startTime) / 1000) + 's'
      }
    };
    
    fs.writeFileSync('test-results/final-summary.json', JSON.stringify(summary, null, 2));
    this.log('Continuous testing completed!');
  }

  stop() {
    this.log('Stopping continuous testing...');
    this.isRunning = false;
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  if (global.tester) {
    global.tester.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  if (global.tester) {
    global.tester.stop();
  }
  process.exit(0);
});

// Start the continuous tester
const tester = new ContinuousTester();
global.tester = tester;
tester.run().catch(console.error);
