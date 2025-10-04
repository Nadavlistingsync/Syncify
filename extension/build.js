#!/usr/bin/env node

// Production build script for Syncify extension

const fs = require('fs')
const path = require('path')

class ExtensionBuilder {
  constructor() {
    this.sourceDir = path.join(__dirname)
    this.buildDir = path.join(__dirname, '..', 'dist')
    this.version = this.getVersion()
  }

  getVersion() {
    const manifest = JSON.parse(fs.readFileSync(path.join(this.sourceDir, 'manifest.json'), 'utf8'))
    return manifest.version
  }

  async build() {
    console.log('🚀 Building Syncify extension for production...')
    console.log(`📦 Version: ${this.version}`)

    try {
      // Create build directory
      await this.createBuildDir()
      
      // Copy extension files
      await this.copyExtensionFiles()
      
      // Update manifest for production
      await this.updateManifest()
      
      // Create production config
      await this.createProductionConfig()
      
      // Validate build
      await this.validateBuild()
      
      console.log('✅ Production build complete!')
      console.log(`📁 Build location: ${this.buildDir}`)
      console.log('🔧 Ready for Chrome Web Store submission')
      
    } catch (error) {
      console.error('❌ Build failed:', error)
      process.exit(1)
    }
  }

  async createBuildDir() {
    if (fs.existsSync(this.buildDir)) {
      fs.rmSync(this.buildDir, { recursive: true, force: true })
    }
    fs.mkdirSync(this.buildDir, { recursive: true })
    console.log('📁 Created build directory')
  }

  async copyExtensionFiles() {
    const filesToCopy = [
      'manifest.json',
      'background.js',
      'content.js',
      'popup.js',
      'popup.html',
      'options.html',
      'options.js',
      'lib/',
      'icons/'
    ]

    for (const file of filesToCopy) {
      const sourcePath = path.join(this.sourceDir, file)
      const destPath = path.join(this.buildDir, file)

      if (fs.statSync(sourcePath).isDirectory()) {
        this.copyDir(sourcePath, destPath)
      } else {
        fs.copyFileSync(sourcePath, destPath)
      }
    }
    console.log('📄 Copied extension files')
  }

  copyDir(source, dest) {
    fs.mkdirSync(dest, { recursive: true })
    const entries = fs.readdirSync(source, { withFileTypes: true })

    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name)
      const destPath = path.join(dest, entry.name)

      if (entry.isDirectory()) {
        this.copyDir(sourcePath, destPath)
      } else {
        fs.copyFileSync(sourcePath, destPath)
      }
    }
  }

  async updateManifest() {
    const manifestPath = path.join(this.buildDir, 'manifest.json')
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

    // Update for production
    manifest.name = 'Syncify - AI Context Sync'
    manifest.description = 'Sync your AI context across all LLMs and websites. Production-ready extension for seamless AI conversations.'
    
    // Update externally connectable for production
    manifest.externally_connectable = {
      matches: [
        "https://syncify-app.vercel.app/*",
        "https://*.vercel.app/*"
      ]
    }

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
    console.log('📝 Updated manifest for production')
  }

  async createProductionConfig() {
    const configPath = path.join(this.buildDir, 'config.js')
    
    if (fs.existsSync(configPath)) {
      let configContent = fs.readFileSync(configPath, 'utf8')

      // Update config to force production mode
      configContent = configContent.replace(
        /detectEnvironment\(\)\s*{[\s\S]*?}/,
        `detectEnvironment() {
    return 'production'
  }`
      )

      fs.writeFileSync(configPath, configContent)
      console.log('⚙️ Updated config for production')
    } else {
      console.log('⚠️ Config file not found, skipping config update')
    }
  }

  async validateBuild() {
    const requiredFiles = [
      'manifest.json',
      'background.js',
      'content.js',
      'popup.js',
      'popup.html',
      'lib/supabase.js',
      'lib/logger.js',
      'lib/security.js'
    ]

    const missingFiles = requiredFiles.filter(file => 
      !fs.existsSync(path.join(this.buildDir, file))
    )

    if (missingFiles.length > 0) {
      throw new Error(`Missing required files: ${missingFiles.join(', ')}`)
    }

    // Validate manifest
    const manifest = JSON.parse(fs.readFileSync(path.join(this.buildDir, 'manifest.json'), 'utf8'))
    if (!manifest.name || !manifest.version || !manifest.permissions) {
      throw new Error('Invalid manifest.json')
    }

    console.log('✅ Build validation passed')
  }
}

// Run build if called directly
if (require.main === module) {
  const builder = new ExtensionBuilder()
  builder.build()
}

module.exports = ExtensionBuilder
