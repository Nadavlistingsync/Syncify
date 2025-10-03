'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Shield, 
  Eye, 
  EyeOff, 
  X, 
  AlertTriangle,
  Info,
  CheckCircle
} from 'lucide-react'

interface PrivacyBannerProps {
  site: string
  isInjecting: boolean
  profileName?: string
  onDismiss?: () => void
  onToggleInject?: () => void
}

export function PrivacyBanner({ 
  site, 
  isInjecting, 
  profileName, 
  onDismiss, 
  onToggleInject 
}: PrivacyBannerProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [isMinimized, setIsMinimized] = useState(false)

  // Auto-hide after 10 seconds if not interacting
  useEffect(() => {
    if (isInjecting) {
      const timer = setTimeout(() => {
        setIsMinimized(true)
      }, 10000)
      
      return () => clearTimeout(timer)
    }
  }, [isInjecting])

  if (!isVisible) return null

  const handleDismiss = () => {
    setIsVisible(false)
    onDismiss?.()
  }

  const handleMinimize = () => {
    setIsMinimized(!isMinimized)
  }

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Card className="shadow-lg border-blue-200 bg-blue-50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">
                Syncify Active
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMinimize}
                className="h-6 w-6 p-0"
              >
                <Info className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <Card className="shadow-lg border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                <span className="font-semibold text-blue-800">Syncify Active</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMinimize}
                  className="h-6 w-6 p-0"
                >
                  <Info className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismiss}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2">
              {isInjecting ? (
                <>
                  <Eye className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-700">Context sharing enabled</span>
                  <Badge variant="outline" className="text-green-700 border-green-300">
                    Active
                  </Badge>
                </>
              ) : (
                <>
                  <EyeOff className="h-4 w-4 text-gray-600" />
                  <span className="text-sm text-gray-700">Context sharing disabled</span>
                  <Badge variant="outline" className="text-gray-700 border-gray-300">
                    Inactive
                  </Badge>
                </>
              )}
            </div>

            {/* Site and Profile Info */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Site:</span>
                <span className="font-medium">{site}</span>
              </div>
              
              {profileName && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">Profile:</span>
                  <span className="font-medium">{profileName}</span>
                </div>
              )}
            </div>

            {/* Privacy Notice */}
            <div className="bg-blue-100 border border-blue-200 rounded p-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="text-xs text-blue-800">
                  <p className="font-medium mb-1">Privacy Notice</p>
                  <p>
                    When enabled, your context profile will be automatically shared with this AI to provide personalized responses.
                  </p>
                </div>
              </div>
            </div>

            {/* Controls */}
            {onToggleInject && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onToggleInject}
                  className="flex-1"
                >
                  {isInjecting ? (
                    <>
                      <EyeOff className="h-3 w-3 mr-1" />
                      Disable
                    </>
                  ) : (
                    <>
                      <Eye className="h-3 w-3 mr-1" />
                      Enable
                    </>
                  )}
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open('/resources', '_blank')}
                  className="flex-1"
                >
                  Settings
                </Button>
              </div>
            )}

            {/* Learn More Link */}
            <div className="text-center">
              <button
                onClick={() => window.open('/resources#privacy', '_blank')}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Learn more about privacy
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
