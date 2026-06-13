import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/ui/sidebar'
import { AiAssistant } from '@/components/chat/ai-assistant'

export const metadata: Metadata = {
  title: '绩效管理中心 - 通威集团',
  description: '通威集团绩效管理 Agent 系统',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN">
      <body className="flex min-h-screen bg-slate-50">
        {/* pendingCount 由 Sidebar 内部自行获取，layout 不传 */}
        <Sidebar />
        <main className="flex-1 overflow-y-auto min-w-0">
          {children}
        </main>
        <AiAssistant />
      </body>
    </html>
  )
}
