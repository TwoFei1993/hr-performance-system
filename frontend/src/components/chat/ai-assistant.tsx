'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

function renderMarkdown(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
    }
    return <span key={i}>{part}</span>
  })
}

function stripThinking(text: string): string {
  return text
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^[\s\S]*?<\/think>/i, '')
    .trim()
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  intent?: string
  employeeId?: string
  employeeName?: string
  suggestedReason?: string
  confirmed?: boolean
}

const FALLBACK_QUESTIONS = ['本月绩效概况如何？', '晋升标准是什么？', 'PIP流程怎么走？']

async function loadQuickQuestions(): Promise<string[]> {
  try {
    const resp = await fetch('/api/employees?page=1&size=30')
    if (!resp.ok) return FALLBACK_QUESTIONS
    const data = await resp.json() as { items: { name: string; recommendation: string }[] }
    const items = data.items
    const normal = items.find(e => e.recommendation === 'normal' || e.recommendation === 'one_on_one')
    const promote = items.find(e => e.recommendation === 'promote')
    const pip = items.find(e => e.recommendation === 'pip')
    return [
      normal ? `为什么${normal.name}没有晋升？` : FALLBACK_QUESTIONS[0],
      promote ? `我认为${promote.name}应该晋升` : FALLBACK_QUESTIONS[1],
      pip ? `${pip.name}的绩效如何？` : FALLBACK_QUESTIONS[2],
    ]
  } catch {
    return FALLBACK_QUESTIONS
  }
}

interface ChatApiResponse {
  reply: string
  intent?: string
  employee_id?: string
  employee_name?: string
  suggested_reason?: string
}

async function sendChat(message: string): Promise<ChatApiResponse> {
  const resp = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  if (!resp.ok) throw new Error(`请求失败 ${resp.status}`)
  const data = await resp.json() as ChatApiResponse
  data.reply = stripThinking(data.reply)
  return data
}

async function confirmPromote(employeeId: string, confirmed: boolean, reason: string): Promise<string> {
  const resp = await fetch('/api/chat/confirm-promote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employee_id: employeeId, confirmed, reason }),
  })
  if (!resp.ok) throw new Error(`请求失败 ${resp.status}`)
  const data = await resp.json() as { message: string }
  return data.message
}

export function AiAssistant() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [quickQuestions, setQuickQuestions] = useState<string[]>(FALLBACK_QUESTIONS)
  const bottomRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (!open || !panelRef.current) return
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return
    gsap.fromTo(panelRef.current,
      { scaleY: 0, transformOrigin: 'bottom center', opacity: 0, y: 12 },
      { scaleY: 1, opacity: 1, y: 0, duration: 0.3, ease: 'back.out(1.6)' }
    )
  }, { scope: panelRef, dependencies: [open] })

  useEffect(() => {
    loadQuickQuestions().then(setQuickQuestions)
  }, [])

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [])

  const handleSend = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: trimmed }])
    setLoading(true)
    scrollToBottom()
    try {
      const data = await sendChat(trimmed)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply,
        intent: data.intent,
        employeeId: data.employee_id,
        employeeName: data.employee_name,
        suggestedReason: data.suggested_reason,
      }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '请求失败，请稍后重试。' }])
    } finally {
      setLoading(false)
      scrollToBottom()
    }
  }, [loading, scrollToBottom])

  const handleConfirmPromote = useCallback(async (msgIndex: number, confirmed: boolean) => {
    const msg = messages[msgIndex]
    if (!msg.employeeId) return
    setMessages(prev => prev.map((m, i) => i === msgIndex ? { ...m, confirmed: true } : m))
    setLoading(true)
    try {
      const reply = await confirmPromote(msg.employeeId, confirmed, msg.suggestedReason ?? '')
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '操作失败，请稍后重试。' }])
    } finally {
      setLoading(false)
      scrollToBottom()
    }
  }, [messages, scrollToBottom])

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div ref={panelRef} className="w-[320px] h-[440px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-indigo-600 text-white">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">AI 秘书</span>
              <span className="text-[10px] bg-indigo-500 px-1.5 py-0.5 rounded-full">智能绩效助理</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-indigo-200 hover:text-white transition-colors text-lg leading-none" aria-label="关闭">×</button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-400 text-center">快捷问题</p>
                {quickQuestions.map(q => (
                  <button key={q} onClick={() => void handleSend(q)}
                    className="w-full text-left text-xs px-3 py-2 rounded-lg bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 border border-slate-200 transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[88%] text-xs px-3 py-2 rounded-xl leading-relaxed',
                  msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-slate-100 text-slate-700 rounded-bl-sm',
                )}>
                  {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                  {/* 晋升确认按钮 */}
                  {msg.role === 'assistant' && msg.intent === 'confirm_promote' && !msg.confirmed && (
                    <div className="flex gap-2 mt-2 pt-2 border-t border-slate-200">
                      <button
                        onClick={() => void handleConfirmPromote(i, true)}
                        className="flex-1 text-xs py-1.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
                      >
                        同意晋升
                      </button>
                      <button
                        onClick={() => void handleConfirmPromote(i, false)}
                        className="flex-1 text-xs py-1.5 rounded-lg bg-slate-200 text-slate-600 font-medium hover:bg-slate-300 transition-colors"
                      >
                        驳回
                      </button>
                    </div>
                  )}
                  {msg.role === 'assistant' && msg.intent === 'confirm_promote' && msg.confirmed && (
                    <p className="text-[10px] text-slate-400 mt-1 pt-1 border-t border-slate-200">已处理</p>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 text-slate-400 text-xs px-3 py-2 rounded-xl rounded-bl-sm">
                  <span className="animate-pulse">思考中…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="px-3 py-2 border-t border-slate-100 flex gap-2">
            <input
              type="text" value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void handleSend(input) }}
              placeholder="输入问题…"
              className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
            />
            <button onClick={() => void handleSend(input)} disabled={loading || !input.trim()}
              className="px-3 py-2 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              发送
            </button>
          </div>
        </div>
      )}

      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-full shadow-lg transition-all active:scale-95"
        aria-label="AI 秘书">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span className="text-sm font-medium">AI 秘书</span>
      </button>
    </div>
  )
}
