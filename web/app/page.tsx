import Link from 'next/link'
import { ArrowRight, Brain, Globe, Shield } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function HomePage() {
  return (
    <div className="max-w-4xl mx-auto text-center">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-5xl font-bold text-foreground mb-6">
          Syncify
        </h1>
        <p className="text-2xl text-muted-foreground max-w-3xl mx-auto mb-8">
          <strong>Never repeat yourself to AI again.</strong>
        </p>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Tell ChatGPT, Claude, and Gemini once. They'll remember everywhere.
        </p>
      </div>

      {/* Features */}
      <div className="grid md:grid-cols-3 gap-8 mb-12">
        <div className="p-6 rounded-lg border bg-card">
          <Brain className="h-12 w-12 text-primary mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Works Everywhere</h3>
          <p className="text-muted-foreground">
            ChatGPT, Claude, Gemini - all your AI tools in one place.
          </p>
        </div>

        <div className="p-6 rounded-lg border bg-card">
          <Globe className="h-12 w-12 text-primary mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Auto-Sync</h3>
          <p className="text-muted-foreground">
            Chrome extension remembers everything automatically.
          </p>
        </div>

        <div className="p-6 rounded-lg border bg-card">
          <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Your Data, Your Control</h3>
          <p className="text-muted-foreground">
            Encrypted and private. You decide what to share.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="space-y-4">
        <Link 
          href="/context"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          Get Started
          <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="text-sm text-muted-foreground">
          Free to use • No credit card required
        </p>
      </div>

      {/* Navigation */}
      <nav className="mt-16 flex justify-center gap-8">
        <Link 
          href="/context" 
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Your Context
        </Link>
        <Link 
          href="/dashboard" 
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Dashboard
        </Link>
        <Link 
          href="/resources" 
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Resources
        </Link>
      </nav>
    </div>
  )
}

