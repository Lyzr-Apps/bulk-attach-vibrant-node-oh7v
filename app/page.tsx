'use client'

import React, { useState, useCallback, useRef } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import type { AIAgentResponse } from '@/lib/aiAgent'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { FiMail, FiCheck, FiX, FiPlus, FiTrash2, FiUpload, FiUsers, FiCheckCircle, FiXCircle, FiDownload, FiRefreshCw, FiArrowLeft, FiArrowRight, FiAlertCircle, FiFolder, FiFileText, FiSend, FiLoader } from 'react-icons/fi'

// ---- Constants ----
const VALIDATOR_AGENT_ID = '699c6ae43aff77bf1a4ebd5e'
const DISPATCH_AGENT_ID = '699c6b00a774fa5750cb75bc'

const STEPS = ['Compose & Map', 'Review', 'Delivery Status']

// ---- Types ----
interface MappingRow {
  id: string
  email: string
  attachments: string
}

interface ValidationResult {
  email: string
  attachments: string[]
  isValid: boolean
  errors: string[]
}

interface ValidationData {
  totalRecipients: number
  validCount: number
  invalidCount: number
  results: ValidationResult[]
}

interface DispatchResult {
  email: string
  attachmentsSent: string[]
  status: 'sent' | 'failed'
  errorDetail: string
}

interface DispatchData {
  totalSent: number
  totalFailed: number
  totalRecipients: number
  results: DispatchResult[]
}

// ---- Helpers ----
function generateId(): string {
  return Math.random().toString(36).substring(2, 11)
}

function parseAgentResult(result: AIAgentResponse): any {
  if (!result.success) return null
  const rawResult = result?.response?.result
  if (!rawResult) return null
  if (typeof rawResult === 'string') {
    try { return JSON.parse(rawResult) } catch { return null }
  }
  if (rawResult.text && typeof rawResult.text === 'string') {
    try { return JSON.parse(rawResult.text) } catch { return null }
  }
  if (rawResult.response && typeof rawResult.response === 'string') {
    try { return JSON.parse(rawResult.response) } catch { return null }
  }
  return rawResult
}

function parseCSV(text: string): MappingRow[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length === 0) return []
  const headerLine = lines[0].toLowerCase()
  let startIdx = 0
  if (headerLine.includes('email') || headerLine.includes('attachment')) {
    startIdx = 1
  }
  const rows: MappingRow[] = []
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i]
    // Parse CSV fields respecting quoted values
    const fields: string[] = []
    let current = ''
    let inQuotes = false
    for (let j = 0; j < line.length; j++) {
      const ch = line[j]
      if (ch === '"') {
        inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    fields.push(current.trim())
    if (fields.length >= 1 && fields[0]) {
      // First field is email, second field is the attachments string
      // If CSV has only 2 columns (email, "file1.pdf, file2.pdf"), use field[1] directly
      // If CSV has more columns and no quoting, join remaining fields as attachments
      const email = fields[0].replace(/^["']|["']$/g, '').trim()
      let attachments = ''
      if (fields.length === 2) {
        attachments = fields[1].replace(/^["']|["']$/g, '').trim()
      } else if (fields.length > 2) {
        // Multiple unquoted columns after email - treat them all as attachment filenames
        attachments = fields.slice(1).map(f => f.replace(/^["']|["']$/g, '').trim()).filter(f => f).join(', ')
      }
      if (email) {
        rows.push({
          id: generateId(),
          email,
          attachments,
        })
      }
    }
  }
  return rows
}

// ---- Sample Data ----
const SAMPLE_ROWS: MappingRow[] = [
  { id: 'sample1', email: 'alice.johnson@acme.com', attachments: '/shared/reports/Q4-report.pdf, /shared/reports/summary.xlsx' },
  { id: 'sample2', email: 'bob.smith@widgets.io', attachments: '/shared/invoices/invoice_2024.pdf' },
  { id: 'sample3', email: 'carol.davis@techcorp.com', attachments: '/shared/proposals/proposal.docx, /shared/timelines/timeline.pdf' },
  { id: 'sample4', email: 'david.lee@startup.co', attachments: '/shared/contracts/contract_v2.pdf' },
  { id: 'sample5', email: 'invalid-email-format', attachments: '/shared/docs/doc.pdf' },
]

const SAMPLE_VALIDATION: ValidationData = {
  totalRecipients: 5,
  validCount: 4,
  invalidCount: 1,
  results: [
    { email: 'alice.johnson@acme.com', attachments: ['/shared/reports/Q4-report.pdf', '/shared/reports/summary.xlsx'], isValid: true, errors: [] },
    { email: 'bob.smith@widgets.io', attachments: ['/shared/invoices/invoice_2024.pdf'], isValid: true, errors: [] },
    { email: 'carol.davis@techcorp.com', attachments: ['/shared/proposals/proposal.docx', '/shared/timelines/timeline.pdf'], isValid: true, errors: [] },
    { email: 'david.lee@startup.co', attachments: ['/shared/contracts/contract_v2.pdf'], isValid: true, errors: [] },
    { email: 'invalid-email-format', attachments: ['/shared/docs/doc.pdf'], isValid: false, errors: ['Invalid email format'] },
  ],
}

const SAMPLE_DISPATCH: DispatchData = {
  totalSent: 3,
  totalFailed: 1,
  totalRecipients: 4,
  results: [
    { email: 'alice.johnson@acme.com', attachmentsSent: ['/shared/reports/Q4-report.pdf', '/shared/reports/summary.xlsx'], status: 'sent', errorDetail: '' },
    { email: 'bob.smith@widgets.io', attachmentsSent: ['/shared/invoices/invoice_2024.pdf'], status: 'sent', errorDetail: '' },
    { email: 'carol.davis@techcorp.com', attachmentsSent: ['/shared/proposals/proposal.docx', '/shared/timelines/timeline.pdf'], status: 'sent', errorDetail: '' },
    { email: 'david.lee@startup.co', attachmentsSent: [], status: 'failed', errorDetail: 'File not found at /shared/contracts/contract_v2.pdf' },
  ],
}

// ---- ErrorBoundary ----
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button onClick={() => this.setState({ hasError: false, error: '' })} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ---- Stepper Component ----
function Stepper({ currentStep, completedSteps, onStepClick }: { currentStep: number; completedSteps: Set<number>; onStepClick: (step: number) => void }) {
  return (
    <div className="flex items-center justify-center w-full max-w-2xl mx-auto py-6 px-4">
      {STEPS.map((label, idx) => {
        const isActive = idx === currentStep
        const isCompleted = completedSteps.has(idx)
        const isClickable = isCompleted || idx === currentStep
        return (
          <React.Fragment key={label}>
            <button
              onClick={() => isClickable && onStepClick(idx)}
              disabled={!isClickable}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${isActive ? 'bg-primary text-primary-foreground shadow-md' : isCompleted ? 'bg-secondary text-secondary-foreground cursor-pointer hover:bg-accent' : 'bg-muted/50 text-muted-foreground cursor-not-allowed'}`}
            >
              <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ${isActive ? 'bg-primary-foreground text-primary' : isCompleted ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/20 text-muted-foreground'}`}>
                {isCompleted ? <FiCheck className="w-3.5 h-3.5" /> : idx + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </button>
            {idx < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 rounded-full transition-colors duration-300 ${completedSteps.has(idx) ? 'bg-primary' : 'bg-border'}`} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ---- Loading Overlay ----
function LoadingOverlay({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="backdrop-blur-md bg-white/80 border border-white/20 rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4 max-w-sm mx-4">
        <FiLoader className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm font-medium text-foreground tracking-tight">{message}</p>
        <p className="text-xs text-muted-foreground">This may take a moment...</p>
      </div>
    </div>
  )
}

// ---- Metric Card ----
function MetricCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number | string; accent?: string }) {
  return (
    <div className="backdrop-blur-md bg-white/75 border border-white/[0.18] rounded-xl p-5 shadow-md flex items-center gap-4 flex-1 min-w-[140px]">
      <div className={`flex items-center justify-center w-11 h-11 rounded-xl ${accent === 'green' ? 'bg-emerald-50 text-emerald-600' : accent === 'red' ? 'bg-red-50 text-red-500' : 'bg-secondary text-foreground'}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">{label}</p>
        <p className="text-2xl font-semibold text-foreground tracking-tight">{value}</p>
      </div>
    </div>
  )
}

// ---- Compose Screen ----
function ComposeScreen({
  folderPath, setFolderPath,
  subject, setSubject,
  body, setBody,
  mappingRows, setMappingRows,
  onValidate, isValidating, errorMessage
}: {
  folderPath: string; setFolderPath: (v: string) => void
  subject: string; setSubject: (v: string) => void
  body: string; setBody: (v: string) => void
  mappingRows: MappingRow[]; setMappingRows: React.Dispatch<React.SetStateAction<MappingRow[]>>
  onValidate: () => void; isValidating: boolean; errorMessage: string | null
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleAddRow = () => {
    setMappingRows(prev => [...prev, { id: generateId(), email: '', attachments: '' }])
  }

  const handleDeleteRow = (id: string) => {
    setMappingRows(prev => prev.filter(r => r.id !== id))
  }

  const handleUpdateRow = (id: string, field: 'email' | 'attachments', value: string) => {
    setMappingRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  const handleFileChange = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (text) {
        const parsed = parseCSV(text)
        if (parsed.length > 0) {
          setMappingRows(prev => [...prev, ...parsed])
        }
      }
    }
    reader.readAsText(file)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith('.csv')) {
      handleFileChange(file)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const canValidate = mappingRows.length > 0 && mappingRows.some(r => r.email.trim() !== '')

  return (
    <div className="space-y-6">
      {/* Email Compose Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="backdrop-blur-md bg-white/75 border border-white/[0.18] rounded-xl p-6 shadow-md space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <FiMail className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground tracking-tight">Email Details</h3>
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject" className="text-xs font-medium text-muted-foreground">Email Subject</Label>
            <Input id="subject" placeholder="Monthly Report - January 2025" value={subject} onChange={(e) => setSubject(e.target.value)} className="bg-white/60 border-border/60" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="folderPath" className="text-xs font-medium text-muted-foreground">Base Folder Path (optional)</Label>
            <Input id="folderPath" placeholder="/shared/attachments/" value={folderPath} onChange={(e) => setFolderPath(e.target.value)} className="bg-white/60 border-border/60" />
            <p className="text-xs text-muted-foreground/70">Common root path for attachments. You can also use full paths per recipient below.</p>
          </div>
        </div>
        <div className="backdrop-blur-md bg-white/75 border border-white/[0.18] rounded-xl p-6 shadow-md space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <FiFileText className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground tracking-tight">Email Body</h3>
          </div>
          <div className="space-y-2">
            <Label htmlFor="body" className="text-xs font-medium text-muted-foreground">Message Content</Label>
            <Textarea id="body" placeholder={'Dear Recipient,\n\nPlease find your personalized documents attached.\n\nBest regards'} value={body} onChange={(e) => setBody(e.target.value)} className="bg-white/60 border-border/60 min-h-[140px]" />
          </div>
        </div>
      </div>

      {/* CSV Upload Section */}
      <div className="backdrop-blur-md bg-white/75 border border-white/[0.18] rounded-xl p-6 shadow-md space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiUpload className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground tracking-tight">Recipient Mapping</h3>
          </div>
          <span className="text-xs text-muted-foreground">{mappingRows.length} recipient{mappingRows.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Dropzone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-secondary/30'}`}
        >
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileChange(file); e.target.value = '' }} />
          <FiUpload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Drop a CSV file here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">Expected columns: email, attachment locations (comma-separated file paths)</p>
        </div>

        {/* Mapping Table */}
        {mappingRows.length > 0 ? (
          <div className="border border-border/60 rounded-xl overflow-hidden">
            <ScrollArea className="max-h-[360px]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/40">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Recipient Email</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Attachment Location(s)</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider w-16 text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappingRows.map((row) => (
                    <TableRow key={row.id} className="group">
                      <TableCell className="py-2 px-4">
                        <Input value={row.email} onChange={(e) => handleUpdateRow(row.id, 'email', e.target.value)} placeholder="recipient@company.com" className="h-9 bg-white/60 border-border/40 text-sm" />
                      </TableCell>
                      <TableCell className="py-2 px-4">
                        <Input value={row.attachments} onChange={(e) => handleUpdateRow(row.id, 'attachments', e.target.value)} placeholder="/path/to/report.pdf, /path/to/data.xlsx" className="h-9 bg-white/60 border-border/40 text-sm" />
                      </TableCell>
                      <TableCell className="py-2 px-4 text-center">
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteRow(row.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <FiTrash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        ) : (
          <div className="border border-dashed border-border rounded-xl p-10 text-center">
            <FiUsers className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">No recipients added yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Add your first recipient or upload a CSV to get started</p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleAddRow} className="gap-2">
            <FiPlus className="w-4 h-4" />
            Add Row
          </Button>
        </div>
      </div>

      {/* Error */}
      {errorMessage && (
        <Alert variant="destructive" className="rounded-xl">
          <FiAlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* CTA */}
      <div className="flex justify-end">
        <Button onClick={onValidate} disabled={isValidating || !canValidate} className="gap-2 px-6 h-11 rounded-xl shadow-md">
          {isValidating ? <FiLoader className="w-4 h-4 animate-spin" /> : <FiCheck className="w-4 h-4" />}
          Validate Mapping
        </Button>
      </div>
    </div>
  )
}

// ---- Review Screen ----
function ReviewScreen({
  subject, body, folderPath,
  validationResults,
  onBack, onSend, isDispatching, errorMessage,
  showConfirmModal, setShowConfirmModal,
}: {
  subject: string; body: string; folderPath: string
  validationResults: ValidationData | null
  onBack: () => void; onSend: () => void; isDispatching: boolean; errorMessage: string | null
  showConfirmModal: boolean; setShowConfirmModal: (v: boolean) => void
}) {
  const results = Array.isArray(validationResults?.results) ? validationResults.results : []
  const validCount = validationResults?.validCount ?? 0
  const invalidCount = validationResults?.invalidCount ?? 0
  const totalRecipients = validationResults?.totalRecipients ?? results.length

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="backdrop-blur-md bg-white/75 border border-white/[0.18] rounded-xl p-6 shadow-md">
        <h3 className="text-sm font-semibold text-foreground tracking-tight mb-4 flex items-center gap-2">
          <FiFileText className="w-4 h-4 text-muted-foreground" />
          Email Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Subject</p>
            <p className="text-sm text-foreground font-medium">{subject || 'Not set'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Base Path</p>
            <p className="text-sm text-foreground font-medium break-all">{folderPath || 'Not specified'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Recipients</p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-foreground font-semibold">{totalRecipients}</span>
              <Badge variant="secondary" className="text-xs">{validCount} valid</Badge>
              {invalidCount > 0 && <Badge variant="destructive" className="text-xs">{invalidCount} invalid</Badge>}
            </div>
          </div>
        </div>
        {body && (
          <div className="mt-4 pt-4 border-t border-border/40">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Body Preview</p>
            <p className="text-sm text-foreground/80 line-clamp-3 whitespace-pre-wrap">{body}</p>
          </div>
        )}
      </div>

      {/* Validated Mapping Table */}
      <div className="backdrop-blur-md bg-white/75 border border-white/[0.18] rounded-xl p-6 shadow-md space-y-4">
        <h3 className="text-sm font-semibold text-foreground tracking-tight flex items-center gap-2">
          <FiUsers className="w-4 h-4 text-muted-foreground" />
          Validated Mapping
        </h3>
        {results.length > 0 ? (
          <div className="border border-border/60 rounded-xl overflow-hidden">
            <ScrollArea className="max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/40">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Recipient Email</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Attachment Location(s)</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider w-48">Validation Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, idx) => (
                    <TableRow key={`${r.email}-${idx}`} className={r.isValid ? '' : 'bg-red-50/50'}>
                      <TableCell className="py-3 text-sm font-medium">{r.email}</TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground">{Array.isArray(r.attachments) ? r.attachments.join(', ') : ''}</TableCell>
                      <TableCell className="py-3">
                        {r.isValid ? (
                          <div className="flex items-center gap-1.5">
                            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <FiCheck className="w-3 h-3" /> Valid
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200 w-fit">
                              <FiX className="w-3 h-3" /> Invalid
                            </span>
                            {Array.isArray(r.errors) && r.errors.map((err, eIdx) => (
                              <p key={eIdx} className="text-xs text-red-600 ml-1">{err}</p>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">No validation results available</p>
        )}
      </div>

      {/* Error */}
      {errorMessage && (
        <Alert variant="destructive" className="rounded-xl">
          <FiAlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* CTAs */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack} className="gap-2 rounded-xl">
          <FiArrowLeft className="w-4 h-4" />
          Back to Edit
        </Button>
        <Button onClick={() => setShowConfirmModal(true)} disabled={isDispatching || validCount === 0} className="gap-2 px-6 h-11 rounded-xl shadow-md">
          {isDispatching ? <FiLoader className="w-4 h-4 animate-spin" /> : <FiSend className="w-4 h-4" />}
          Send All Emails
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FiSend className="w-5 h-5 text-primary" />
              Confirm Email Dispatch
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to send emails to {validCount} valid recipient{validCount !== 1 ? 's' : ''}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowConfirmModal(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={() => { setShowConfirmModal(false); onSend() }} className="gap-2 rounded-xl">
              <FiSend className="w-4 h-4" />
              Confirm & Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---- Status Screen ----
function StatusScreen({
  dispatchResults,
  onRetryFailed,
  onExport,
  onNewBatch,
  isRetrying,
  errorMessage,
}: {
  dispatchResults: DispatchData | null
  onRetryFailed: () => void
  onExport: () => void
  onNewBatch: () => void
  isRetrying: boolean
  errorMessage: string | null
}) {
  const results = Array.isArray(dispatchResults?.results) ? dispatchResults.results : []
  const totalSent = dispatchResults?.totalSent ?? 0
  const totalFailed = dispatchResults?.totalFailed ?? 0
  const totalRecipients = dispatchResults?.totalRecipients ?? results.length

  const allSuccess = totalFailed === 0 && totalSent > 0

  return (
    <div className="space-y-6">
      {/* Success Banner */}
      {allSuccess && (
        <div className="backdrop-blur-md bg-emerald-50/80 border border-emerald-200/60 rounded-xl p-6 shadow-md text-center">
          <FiCheckCircle className="w-10 h-10 mx-auto mb-3 text-emerald-600" />
          <h3 className="text-lg font-semibold text-emerald-800 tracking-tight">All Emails Sent Successfully</h3>
          <p className="text-sm text-emerald-600 mt-1">{totalSent} email{totalSent !== 1 ? 's' : ''} delivered without errors</p>
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard icon={<FiUsers className="w-5 h-5" />} label="Total Recipients" value={totalRecipients} />
        <MetricCard icon={<FiCheckCircle className="w-5 h-5" />} label="Successfully Sent" value={totalSent} accent="green" />
        <MetricCard icon={<FiXCircle className="w-5 h-5" />} label="Failed" value={totalFailed} accent="red" />
      </div>

      {/* Status Table */}
      <div className="backdrop-blur-md bg-white/75 border border-white/[0.18] rounded-xl p-6 shadow-md space-y-4">
        <h3 className="text-sm font-semibold text-foreground tracking-tight flex items-center gap-2">
          <FiMail className="w-4 h-4 text-muted-foreground" />
          Delivery Details
        </h3>
        {results.length > 0 ? (
          <div className="border border-border/60 rounded-xl overflow-hidden">
            <ScrollArea className="max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/40">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Recipient Email</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Attachment Location(s)</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider w-28">Status</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Error Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, idx) => (
                    <TableRow key={`${r.email}-${idx}`} className={r.status === 'failed' ? 'bg-red-50/50' : ''}>
                      <TableCell className="py-3 text-sm font-medium">{r.email}</TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground">{Array.isArray(r.attachmentsSent) ? r.attachmentsSent.join(', ') : ''}</TableCell>
                      <TableCell className="py-3">
                        {r.status === 'sent' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <FiCheck className="w-3 h-3" /> Sent
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                            <FiX className="w-3 h-3" /> Failed
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-xs text-red-600">{r.status === 'failed' ? (r.errorDetail || 'Unknown error') : ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">No dispatch results available</p>
        )}
      </div>

      {/* Error */}
      {errorMessage && (
        <Alert variant="destructive" className="rounded-xl">
          <FiAlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* CTAs */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Button variant="outline" onClick={onNewBatch} className="gap-2 rounded-xl">
          <FiRefreshCw className="w-4 h-4" />
          New Batch
        </Button>
        <div className="flex items-center gap-3">
          {totalFailed > 0 && (
            <Button variant="outline" onClick={onRetryFailed} disabled={isRetrying} className="gap-2 rounded-xl border-destructive/40 text-destructive hover:bg-destructive/5">
              {isRetrying ? <FiLoader className="w-4 h-4 animate-spin" /> : <FiRefreshCw className="w-4 h-4" />}
              Retry Failed ({totalFailed})
            </Button>
          )}
          <Button variant="outline" onClick={onExport} className="gap-2 rounded-xl">
            <FiDownload className="w-4 h-4" />
            Export Report
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---- Agent Info Footer ----
function AgentInfoFooter({ activeAgentId }: { activeAgentId: string | null }) {
  const agents = [
    { id: VALIDATOR_AGENT_ID, name: 'Mapping Validator', purpose: 'Validates email addresses and attachment mappings' },
    { id: DISPATCH_AGENT_ID, name: 'Email Dispatch', purpose: 'Sends personalized emails with attachments' },
  ]

  return (
    <div className="backdrop-blur-md bg-white/60 border border-white/[0.18] rounded-xl p-4 shadow-sm mt-8">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Powered by AI Agents</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {agents.map((agent) => (
          <div key={agent.id} className="flex items-center gap-3 p-2 rounded-lg">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${activeAgentId === agent.id ? 'bg-emerald-500 animate-pulse' : 'bg-border'}`} />
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{agent.name}</p>
              <p className="text-xs text-muted-foreground truncate">{agent.purpose}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- Main Page ----
export default function Page() {
  // Core state
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
  const [folderPath, setFolderPath] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [mappingRows, setMappingRows] = useState<MappingRow[]>([])

  // Validation state
  const [isValidating, setIsValidating] = useState(false)
  const [validationResults, setValidationResults] = useState<ValidationData | null>(null)

  // Dispatch state
  const [isDispatching, setIsDispatching] = useState(false)
  const [dispatchResults, setDispatchResults] = useState<DispatchData | null>(null)

  // Confirmation modal
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  // Error state
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Active agent
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)

  // Sample data toggle
  const [showSampleData, setShowSampleData] = useState(false)

  // Retry state
  const [isRetrying, setIsRetrying] = useState(false)

  // ---- Sample data logic ----
  const handleSampleToggle = (checked: boolean) => {
    setShowSampleData(checked)
    if (checked) {
      setFolderPath('/shared/reports/')
      setSubject('Q4 2024 Report - Personalized Documents')
      setBody('Dear Recipient,\n\nPlease find your personalized quarterly documents attached to this email. The reports cover our Q4 2024 performance and projections.\n\nPlease review at your earliest convenience.\n\nBest regards,\nFinance Team')
      setMappingRows(SAMPLE_ROWS.map(r => ({ ...r, id: generateId() })))
      setValidationResults(SAMPLE_VALIDATION)
      setDispatchResults(SAMPLE_DISPATCH)
      setCompletedSteps(new Set([0, 1, 2]))
    } else {
      setFolderPath('')
      setSubject('')
      setBody('')
      setMappingRows([])
      setValidationResults(null)
      setDispatchResults(null)
      setCompletedSteps(new Set())
      setCurrentStep(0)
      setErrorMessage(null)
    }
  }

  // ---- Validate Mapping ----
  const handleValidate = async () => {
    setIsValidating(true)
    setErrorMessage(null)
    setActiveAgentId(VALIDATOR_AGENT_ID)
    try {
      const mappingEntries = mappingRows
        .filter(r => r.email.trim())
        .map(r => ({
          email: r.email.trim(),
          attachments: r.attachments
            .split(',')
            .map(a => a.trim())
            .filter(a => a.length > 0),
        }))
      const message = JSON.stringify({
        folderPath: folderPath || '/',
        mapping: mappingEntries,
        instructions: 'Validate each recipient entry. Check that emails have valid format (contain @ and a domain). For attachment locations, these are SERVER FILE PATHS (e.g., /shared/reports/Q4-report.pdf or report.pdf). Accept ANY value that looks like a file path or filename. Paths may contain forward slashes, hyphens, underscores, spaces, and numbers. A path is VALID if it is non-empty and ends with a file extension (like .pdf, .docx, .xlsx, .csv, .txt, .png, .jpg, .zip, etc.) OR if it is a reasonable directory/file reference. Only flag an attachment as invalid if it is completely empty. Do NOT be strict about path format - any non-empty string is acceptable as an attachment location.',
      })
      const result = await callAIAgent(message, VALIDATOR_AGENT_ID)
      const parsed = parseAgentResult(result)
      if (parsed && (parsed.results || parsed.totalRecipients !== undefined)) {
        const data: ValidationData = {
          totalRecipients: parsed.totalRecipients ?? 0,
          validCount: parsed.validCount ?? 0,
          invalidCount: parsed.invalidCount ?? 0,
          results: Array.isArray(parsed.results) ? parsed.results : [],
        }
        setValidationResults(data)
        setCompletedSteps(prev => new Set([...prev, 0]))
        setCurrentStep(1)
      } else {
        setErrorMessage(result?.error || result?.response?.message || 'Failed to validate mapping. Please check your inputs and try again.')
      }
    } catch (err) {
      setErrorMessage('An unexpected error occurred during validation.')
    } finally {
      setIsValidating(false)
      setActiveAgentId(null)
    }
  }

  // ---- Send Emails ----
  const handleSendEmails = async () => {
    if (!validationResults) return
    setIsDispatching(true)
    setErrorMessage(null)
    setActiveAgentId(DISPATCH_AGENT_ID)
    try {
      const validRecipients = Array.isArray(validationResults.results)
        ? validationResults.results.filter(r => r.isValid)
        : []
      const message = JSON.stringify({
        subject: subject,
        body: body,
        folderPath: folderPath,
        recipients: validRecipients.map(r => ({
          email: r.email,
          attachments: Array.isArray(r.attachments) ? r.attachments : [],
        })),
      })
      const result = await callAIAgent(message, DISPATCH_AGENT_ID)
      const parsed = parseAgentResult(result)
      if (parsed && (parsed.results || parsed.totalSent !== undefined)) {
        const data: DispatchData = {
          totalSent: parsed.totalSent ?? 0,
          totalFailed: parsed.totalFailed ?? 0,
          totalRecipients: parsed.totalRecipients ?? 0,
          results: Array.isArray(parsed.results) ? parsed.results : [],
        }
        setDispatchResults(data)
        setCompletedSteps(prev => new Set([...prev, 1]))
        setCurrentStep(2)
      } else {
        setErrorMessage(result?.error || result?.response?.message || 'Failed to dispatch emails. Please try again.')
      }
    } catch (err) {
      setErrorMessage('An unexpected error occurred during email dispatch.')
    } finally {
      setIsDispatching(false)
      setActiveAgentId(null)
    }
  }

  // ---- Retry Failed ----
  const handleRetryFailed = async () => {
    if (!dispatchResults) return
    const failedResults = Array.isArray(dispatchResults.results)
      ? dispatchResults.results.filter(r => r.status === 'failed')
      : []
    if (failedResults.length === 0) return

    setIsRetrying(true)
    setErrorMessage(null)
    setActiveAgentId(DISPATCH_AGENT_ID)
    try {
      const message = JSON.stringify({
        subject: subject,
        body: body,
        folderPath: folderPath,
        recipients: failedResults.map(r => ({
          email: r.email,
          attachments: Array.isArray(r.attachmentsSent) ? r.attachmentsSent : [],
        })),
      })
      const result = await callAIAgent(message, DISPATCH_AGENT_ID)
      const parsed = parseAgentResult(result)
      if (parsed && Array.isArray(parsed.results)) {
        const successfulOriginals = Array.isArray(dispatchResults.results)
          ? dispatchResults.results.filter(r => r.status === 'sent')
          : []
        const allResults = [...successfulOriginals, ...parsed.results]
        const newSent = allResults.filter((r: DispatchResult) => r.status === 'sent').length
        const newFailed = allResults.filter((r: DispatchResult) => r.status === 'failed').length
        setDispatchResults({
          totalSent: newSent,
          totalFailed: newFailed,
          totalRecipients: allResults.length,
          results: allResults,
        })
      } else {
        setErrorMessage(result?.error || result?.response?.message || 'Retry failed. Please try again.')
      }
    } catch (err) {
      setErrorMessage('An unexpected error occurred during retry.')
    } finally {
      setIsRetrying(false)
      setActiveAgentId(null)
    }
  }

  // ---- Export Report ----
  const handleExport = () => {
    if (!dispatchResults) return
    const results = Array.isArray(dispatchResults.results) ? dispatchResults.results : []
    const headers = 'Email,Attachment Locations,Status,Error\n'
    const rows = results.map(r =>
      `${r.email},"${Array.isArray(r.attachmentsSent) ? r.attachmentsSent.join(', ') : ''}",${r.status},"${r.errorDetail || ''}"`
    ).join('\n')
    const blob = new Blob([headers + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'batchmail-report.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ---- New Batch ----
  const handleNewBatch = () => {
    setCurrentStep(0)
    setCompletedSteps(new Set())
    setFolderPath('')
    setSubject('')
    setBody('')
    setMappingRows([])
    setValidationResults(null)
    setDispatchResults(null)
    setErrorMessage(null)
    setShowSampleData(false)
  }

  // ---- Step Click ----
  const handleStepClick = (step: number) => {
    if (step === currentStep) return
    if (completedSteps.has(step) || step === currentStep) {
      setCurrentStep(step)
      setErrorMessage(null)
    }
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen font-sans" style={{ background: 'linear-gradient(135deg, hsl(210, 20%, 97%) 0%, hsl(220, 25%, 95%) 35%, hsl(200, 20%, 96%) 70%, hsl(230, 15%, 97%) 100%)', letterSpacing: '-0.01em', lineHeight: '1.55' }}>
        {/* Loading Overlays */}
        {isValidating && <LoadingOverlay message="Validating email mappings..." />}
        {isDispatching && <LoadingOverlay message="Sending emails..." />}
        {isRetrying && <LoadingOverlay message="Retrying failed emails..." />}

        {/* Header */}
        <header className="backdrop-blur-md bg-white/70 border-b border-white/[0.18] sticky top-0 z-40">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-primary-foreground shadow-md">
                <FiMail className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground tracking-tight">BatchMail</h1>
                <p className="text-xs text-muted-foreground">Personalized Attachment Email Sender</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Label htmlFor="sample-toggle" className="text-xs text-muted-foreground cursor-pointer">Sample Data</Label>
              <Switch id="sample-toggle" checked={showSampleData} onCheckedChange={handleSampleToggle} />
            </div>
          </div>
        </header>

        {/* Stepper */}
        <Stepper currentStep={currentStep} completedSteps={completedSteps} onStepClick={handleStepClick} />

        {/* Main Content */}
        <main className="max-w-5xl mx-auto px-6 pb-12">
          {currentStep === 0 && (
            <ComposeScreen
              folderPath={folderPath} setFolderPath={setFolderPath}
              subject={subject} setSubject={setSubject}
              body={body} setBody={setBody}
              mappingRows={mappingRows} setMappingRows={setMappingRows}
              onValidate={handleValidate}
              isValidating={isValidating}
              errorMessage={errorMessage}
            />
          )}
          {currentStep === 1 && (
            <ReviewScreen
              subject={subject} body={body} folderPath={folderPath}
              validationResults={validationResults}
              onBack={() => { setCurrentStep(0); setErrorMessage(null) }}
              onSend={handleSendEmails}
              isDispatching={isDispatching}
              errorMessage={errorMessage}
              showConfirmModal={showConfirmModal}
              setShowConfirmModal={setShowConfirmModal}
            />
          )}
          {currentStep === 2 && (
            <StatusScreen
              dispatchResults={dispatchResults}
              onRetryFailed={handleRetryFailed}
              onExport={handleExport}
              onNewBatch={handleNewBatch}
              isRetrying={isRetrying}
              errorMessage={errorMessage}
            />
          )}

          {/* Agent Info */}
          <AgentInfoFooter activeAgentId={activeAgentId} />
        </main>
      </div>
    </ErrorBoundary>
  )
}
