'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Terminal, X, Minimize2, Maximize2, Copy, Trash2, ChevronRight, Database, Loader2 } from 'lucide-react'

interface TerminalLine {
  id: number
  type: 'input' | 'output' | 'error' | 'success' | 'info' | 'table'
  content: string
  tableData?: Record<string, unknown>[]
  timestamp: Date
}

interface QuickCommand {
  label: string
  command: string
  description: string
}

const QUICK_COMMANDS: QuickCommand[] = [
  { label: 'show places', command: 'show places', description: 'عرض جميع الأماكن' },
  { label: 'show drinks', command: 'show drinks', description: 'عرض جميع المشروبات' },
  { label: 'count orders', command: 'count orders today', description: 'عدد طلبات اليوم' },
  { label: 'count users', command: 'count users', description: 'عدد المستخدمين' },
  { label: 'show sessions', command: 'show sessions active', description: 'الجلسات النشطة' },
  { label: 'db stats', command: 'db stats', description: 'إحصائيات قاعدة البيانات' },
]

export function DevTerminal() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [lines, setLines] = useState<TerminalLine[]>([
    { id: 0, type: 'info', content: 'مرحباً بك في SipFlow Developer Terminal v1.0', timestamp: new Date() },
    { id: 1, type: 'info', content: 'اكتب "help" لعرض الأوامر المتاحة', timestamp: new Date() },
  ])
  const [input, setInput] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const lineIdRef = useRef(2)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [lines])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const addLine = (type: TerminalLine['type'], content: string, tableData?: Record<string, unknown>[]) => {
    setLines(prev => [...prev, { id: lineIdRef.current++, type, content, tableData, timestamp: new Date() }])
  }

  const executeCommand = async (cmd: string) => {
    const trimmed = cmd.trim().toLowerCase()
    if (!trimmed) return

    addLine('input', `> ${cmd}`)
    setCommandHistory(prev => [cmd, ...prev.slice(0, 49)])
    setHistoryIndex(-1)
    setIsExecuting(true)

    try {
      // Help command
      if (trimmed === 'help') {
        addLine('info', `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  الأوامر المتاحة:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  show places          - عرض جميع الأماكن
  show drinks          - عرض جميع المشروبات
  show drinks [place_id] - مشروبات مكان معين
  show users           - عرض المستخدمين
  show sessions        - عرض الجلسات
  show sessions active - الجلسات النشطة فقط
  show orders          - آخر 20 طلب
  show orders [place_id] - طلبات مكان معين
  
  count orders today   - عدد طلبات اليوم
  count orders week    - عدد طلبات الأسبوع
  count users          - عدد المستخدمين
  count places         - عدد الأماكن
  count drinks         - عدد المشروبات
  
  db stats             - إحصائيات قاعدة البيانات
  db tables            - عرض الجداول
  
  sql [query]          - تنفيذ استعلام SQL
  
  clear                - مسح الشاشة
  history              - عرض سجل الأوامر
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `)
        setIsExecuting(false)
        return
      }

      // Clear command
      if (trimmed === 'clear') {
        setLines([{ id: lineIdRef.current++, type: 'info', content: 'تم مسح الشاشة', timestamp: new Date() }])
        setIsExecuting(false)
        return
      }

      // History command
      if (trimmed === 'history') {
        if (commandHistory.length === 0) {
          addLine('info', 'لا توجد أوامر سابقة')
        } else {
          addLine('info', 'سجل الأوامر:\n' + commandHistory.slice(0, 10).map((c, i) => `  ${i + 1}. ${c}`).join('\n'))
        }
        setIsExecuting(false)
        return
      }

      // Execute via API
      const res = await fetch('/api/dev-terminal', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-secret': process.env.NEXT_PUBLIC_ADMIN_SECRET || ''
        },
        body: JSON.stringify({ command: cmd })
      })

      const data = await res.json()

      if (!res.ok) {
        addLine('error', `خطأ: ${data.error || 'فشل تنفيذ الأمر'}`)
      } else if (data.type === 'table' && data.rows) {
        addLine('table', data.message || `تم العثور على ${data.rows.length} نتيجة`, data.rows)
      } else if (data.type === 'success') {
        addLine('success', data.message)
      } else if (data.type === 'error') {
        addLine('error', data.message)
      } else {
        addLine('output', data.message || JSON.stringify(data, null, 2))
      }
    } catch (err) {
      addLine('error', `خطأ في الاتصال: ${err instanceof Error ? err.message : 'غير معروف'}`)
    } finally {
      setIsExecuting(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isExecuting) {
      executeCommand(input)
      setInput('')
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (commandHistory.length > 0) {
        const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1)
        setHistoryIndex(newIndex)
        setInput(commandHistory[newIndex])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setInput(commandHistory[newIndex])
      } else if (historyIndex === 0) {
        setHistoryIndex(-1)
        setInput('')
      }
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const lineColor = (type: TerminalLine['type']) => {
    switch (type) {
      case 'input': return '#60a5fa'
      case 'output': return 'rgba(255,255,255,0.8)'
      case 'error': return '#f87171'
      case 'success': return '#34d399'
      case 'info': return '#a78bfa'
      case 'table': return '#fbbf24'
      default: return 'rgba(255,255,255,0.6)'
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-xl px-4 py-3 transition-all hover:scale-[1.02]"
        style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(34,197,94,0.05))',
          border: '1px solid rgba(16,185,129,0.2)',
        }}
      >
        <Terminal className="h-5 w-5" style={{ color: '#34d399' }} />
        <div className="text-right">
          <p className="text-sm font-bold" style={{ color: '#34d399' }}>Developer Terminal</p>
          <p className="text-[10px]" style={{ color: 'rgba(52,211,153,0.6)' }}>تنفيذ أوامر مباشرة</p>
        </div>
      </button>
    )
  }

  return (
    <div
      className={`rounded-2xl overflow-hidden transition-all ${isMaximized ? 'fixed inset-4 z-50' : ''}`}
      style={{
        background: 'linear-gradient(180deg, #0c0c0c 0%, #111111 100%)',
        border: '1px solid rgba(52,211,153,0.2)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ background: 'rgba(52,211,153,0.08)', borderBottom: '1px solid rgba(52,211,153,0.15)' }}
      >
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4" style={{ color: '#34d399' }} />
          <span className="text-xs font-bold" style={{ color: '#34d399' }}>SipFlow Terminal</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(52,211,153,0.15)', color: 'rgba(52,211,153,0.7)' }}>v1.0</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
          >
            {isMaximized ? <Minimize2 className="h-3.5 w-3.5" style={{ color: 'rgba(255,255,255,0.4)' }} /> : <Maximize2 className="h-3.5 w-3.5" style={{ color: 'rgba(255,255,255,0.4)' }} />}
          </button>
          <button
            onClick={() => setLines([{ id: lineIdRef.current++, type: 'info', content: 'تم مسح الشاشة', timestamp: new Date() }])}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
          >
            <Trash2 className="h-3.5 w-3.5" style={{ color: 'rgba(255,255,255,0.4)' }} />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg transition-colors hover:bg-red-500/20"
          >
            <X className="h-3.5 w-3.5" style={{ color: '#f87171' }} />
          </button>
        </div>
      </div>

      {/* Quick Commands */}
      <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {QUICK_COMMANDS.map((qc, i) => (
          <button
            key={i}
            onClick={() => { setInput(qc.command); inputRef.current?.focus() }}
            className="shrink-0 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors hover:bg-white/5"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
            title={qc.description}
          >
            {qc.label}
          </button>
        ))}
      </div>

      {/* Terminal Output */}
      <div
        ref={scrollRef}
        className="p-4 overflow-y-auto font-mono text-xs"
        style={{ height: isMaximized ? 'calc(100vh - 200px)' : '300px' }}
        onClick={() => inputRef.current?.focus()}
      >
        {lines.map(line => (
          <div key={line.id} className="mb-2 group">
            <div className="flex items-start gap-2">
              {line.type === 'input' && <ChevronRight className="h-3 w-3 mt-0.5 shrink-0" style={{ color: '#60a5fa' }} />}
              <pre
                className="flex-1 whitespace-pre-wrap break-all"
                style={{ color: lineColor(line.type) }}
              >
                {line.content}
              </pre>
              <button
                onClick={() => copyToClipboard(line.content)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity"
              >
                <Copy className="h-3 w-3" style={{ color: 'rgba(255,255,255,0.3)' }} />
              </button>
            </div>
            {/* Table Data */}
            {line.type === 'table' && line.tableData && line.tableData.length > 0 && (
              <div className="mt-2 overflow-x-auto rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <table className="w-full text-[10px]">
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                      {Object.keys(line.tableData[0]).map((key, i) => (
                        <th key={i} className="px-2 py-1.5 text-right font-bold" style={{ color: 'rgba(255,255,255,0.5)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {line.tableData.slice(0, 20).map((row, ri) => (
                      <tr key={ri} className="hover:bg-white/[0.02]">
                        {Object.values(row).map((val, vi) => (
                          <td key={vi} className="px-2 py-1.5" style={{ color: 'rgba(255,255,255,0.7)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            {typeof val === 'object' ? JSON.stringify(val) : String(val ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {line.tableData.length > 20 && (
                  <p className="px-2 py-1.5 text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    ...و {line.tableData.length - 20} صف إضافي
                  </p>
                )}
              </div>
            )}
          </div>
        ))}

        {isExecuting && (
          <div className="flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>جاري التنفيذ...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-4 py-3" style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <Database className="h-4 w-4 shrink-0" style={{ color: 'rgba(52,211,153,0.5)' }} />
        <span style={{ color: '#34d399' }}>{'>'}</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="اكتب أمراً..."
          disabled={isExecuting}
          className="flex-1 bg-transparent outline-none text-sm"
          style={{ color: 'rgba(255,255,255,0.9)' }}
          dir="ltr"
        />
      </div>
    </div>
  )
}
