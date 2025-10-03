'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  AlertTriangle, 
  Shield, 
  Eye, 
  EyeOff,
  Info,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { 
  RedactionEngine, 
  redactMemoryContent, 
  createRedactionEngine 
} from '@/lib/redaction'

interface MemoryFormProps {
  initialData?: {
    type: string
    content: string
    importance: number
    pii: boolean
  }
  onSubmit: (data: {
    type: string
    content: string
    importance: number
    pii: boolean
  }) => Promise<void>
  onCancel?: () => void
  isLoading?: boolean
}

export function MemoryForm({ 
  initialData, 
  onSubmit, 
  onCancel, 
  isLoading = false 
}: MemoryFormProps) {
  const [formData, setFormData] = useState({
    type: initialData?.type || 'note',
    content: initialData?.content || '',
    importance: initialData?.importance || 5,
    pii: initialData?.pii || false
  })
  
  const [redactionEngine] = useState(() => createRedactionEngine())
  const [redactionPreview, setRedactionPreview] = useState('')
  const [sensitivityAnalysis, setSensitivityAnalysis] = useState<any>(null)
  const [showPreview, setShowPreview] = useState(false)

  // Update preview when content changes
  useEffect(() => {
    if (formData.content) {
      const redacted = redactMemoryContent(formData.content, formData.pii)
      setRedactionPreview(redacted)
      
      const analysis = redactionEngine.getRedactionSummary(formData.content)
      setSensitivityAnalysis(analysis)
    } else {
      setRedactionPreview('')
      setSensitivityAnalysis(null)
    }
  }, [formData.content, formData.pii, redactionEngine])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.content.trim()) {
      return
    }

    await onSubmit(formData)
  }

  const handleContentChange = (value: string) => {
    setFormData(prev => ({ ...prev, content: value }))
  }

  const handlePiiToggle = () => {
    setFormData(prev => ({ ...prev, pii: !prev.pii }))
  }

  const getSensitivityLevel = () => {
    if (!sensitivityAnalysis) return 'none'
    
    const { totalRedactions } = sensitivityAnalysis
    if (totalRedactions === 0) return 'none'
    if (totalRedactions <= 2) return 'low'
    if (totalRedactions <= 5) return 'medium'
    return 'high'
  }

  const getSensitivityColor = (level: string) => {
    switch (level) {
      case 'none': return 'text-green-600'
      case 'low': return 'text-yellow-600'
      case 'medium': return 'text-orange-600'
      case 'high': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const sensitivityLevel = getSensitivityLevel()

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type and Importance */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Type</label>
            <Select 
              value={formData.type} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fact">Fact</SelectItem>
                <SelectItem value="preference">Preference</SelectItem>
                <SelectItem value="skill">Skill</SelectItem>
                <SelectItem value="project">Project</SelectItem>
                <SelectItem value="note">Note</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="text-sm font-medium mb-2 block">Importance</label>
            <Select 
              value={formData.importance.toString()} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, importance: parseInt(value) }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                  <SelectItem key={num} value={num.toString()}>
                    {num} - {Array.from({ length: num }, () => '★').join('')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Content */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            Content
            {formData.content && (
              <span className={`ml-2 text-xs ${getSensitivityColor(sensitivityLevel)}`}>
                ({sensitivityLevel} sensitivity)
              </span>
            )}
          </label>
          <Textarea
            value={formData.content}
            onChange={(e) => handleContentChange(e.target.value)}
            className="min-h-[120px]"
            placeholder="Enter what you want to remember..."
            required
          />
        </div>

        {/* Sensitivity Analysis */}
        {sensitivityAnalysis && sensitivityAnalysis.totalRedactions > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                Sensitive Information Detected
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {sensitivityAnalysis.hasEmail && (
                    <Badge variant="outline" className="text-orange-700 border-orange-300">
                      Email
                    </Badge>
                  )}
                  {sensitivityAnalysis.hasPhone && (
                    <Badge variant="outline" className="text-orange-700 border-orange-300">
                      Phone
                    </Badge>
                  )}
                  {sensitivityAnalysis.hasSSN && (
                    <Badge variant="outline" className="text-red-700 border-red-300">
                      SSN
                    </Badge>
                  )}
                  {sensitivityAnalysis.hasCreditCard && (
                    <Badge variant="outline" className="text-red-700 border-red-300">
                      Credit Card
                    </Badge>
                  )}
                  {sensitivityAnalysis.hasApiKey && (
                    <Badge variant="outline" className="text-red-700 border-red-300">
                      API Key
                    </Badge>
                  )}
                  {sensitivityAnalysis.hasPassword && (
                    <Badge variant="outline" className="text-red-700 border-red-300">
                      Password
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-orange-700">
                  We detected {sensitivityAnalysis.totalRedactions} sensitive items. 
                  Consider marking this as private information.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Privacy Toggle */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            {formData.pii ? (
              <EyeOff className="h-5 w-5 text-red-600" />
            ) : (
              <Eye className="h-5 w-5 text-green-600" />
            )}
            <div>
              <p className="font-medium">
                {formData.pii ? 'Private Information' : 'Public Information'}
              </p>
              <p className="text-sm text-muted-foreground">
                {formData.pii 
                  ? 'This memory contains private information and will be redacted when shared'
                  : 'This memory can be shared with AI assistants'
                }
              </p>
            </div>
          </div>
          
          <Button
            type="button"
            variant={formData.pii ? "destructive" : "outline"}
            onClick={handlePiiToggle}
            className="min-w-[100px]"
          >
            {formData.pii ? (
              <>
                <Shield className="h-4 w-4 mr-2" />
                Private
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Public
              </>
            )}
          </Button>
        </div>

        {/* Redaction Preview */}
        {showPreview && formData.content && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-600" />
                Redaction Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <div>
                  <p className="text-xs font-medium text-blue-700 mb-1">Original:</p>
                  <p className="text-sm bg-white p-2 rounded border">
                    {formData.content}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-blue-700 mb-1">Redacted:</p>
                  <p className="text-sm bg-white p-2 rounded border">
                    {redactionPreview}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
            >
              <Info className="h-4 w-4 mr-1" />
              {showPreview ? 'Hide' : 'Show'} Preview
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button 
              type="submit" 
              disabled={isLoading || !formData.content.trim()}
              className="min-w-[100px]"
            >
              {isLoading ? 'Saving...' : 'Save Memory'}
            </Button>
          </div>
        </div>
      </form>

      {/* Privacy Notice */}
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div className="text-sm text-green-800">
              <p className="font-medium mb-1">Privacy Protection</p>
              <ul className="space-y-1 text-green-700">
                <li>• Private memories are automatically redacted when shared</li>
                <li>• Sensitive information is detected and protected</li>
                <li>• You control what gets shared with each AI</li>
                <li>• All data is encrypted and securely stored</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
