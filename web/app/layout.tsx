import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { ErrorBoundary } from '@/components/error-boundary'
import { Navigation } from '@/components/navigation'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Syncify - AI Context Synchronization',
  description: 'Sync your AI context across all LLMs and websites',
  keywords: ['AI', 'context', 'synchronization', 'LLM', 'ChatGPT', 'Claude', 'Gemini'],
  authors: [{ name: 'Syncify Team' }],
  viewport: 'width=device-width, initial-scale=1',
  robots: 'index, follow',
  openGraph: {
    title: 'Syncify - AI Context Synchronization',
    description: 'Sync your AI context across all LLMs and websites',
    type: 'website',
    locale: 'en_US',
    siteName: 'Syncify',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Syncify - AI Context Synchronization',
    description: 'Sync your AI context across all LLMs and websites',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <ErrorBoundary>
            <div className="min-h-screen bg-background">
              <Navigation />
              <div className="container mx-auto px-4 py-8">
                {children}
              </div>
            </div>
          </ErrorBoundary>
        </Providers>
      </body>
    </html>
  )
}

