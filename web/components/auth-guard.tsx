'use client'

import { useAuth } from '@/app/providers'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LogIn, User } from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface AuthGuardProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const { user, loading } = useAuth()
  const supabase = createClient()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) {
    if (fallback) {
      return <>{fallback}</>
    }

    return (
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <User className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>
              You need to sign in to access this page and manage your AI context.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              className="w-full" 
              onClick={() => supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                  redirectTo: `${window.location.origin}/auth/callback`
                }
              })}
            >
              <LogIn className="mr-2 h-4 w-4" />
              Sign in with Google
            </Button>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => supabase.auth.signInWithOAuth({
                provider: 'github',
                options: {
                  redirectTo: `${window.location.origin}/auth/callback`
                }
              })}
            >
              <LogIn className="mr-2 h-4 w-4" />
              Sign in with GitHub
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}
