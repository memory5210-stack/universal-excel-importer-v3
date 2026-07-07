import type { Metadata } from "next"
import { getSession, destroySession } from "@/lib/auth"
import "./globals.css"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { ToastProvider } from "@/components/common/Toast"

export const metadata: Metadata = {
  title: "运单异常品控管理系统 V3",
  description: "运单异常品控管理系统 - 异常工单处理与审批平台",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  const isLoggedIn = !!session

  return (
    <html lang="zh-CN" className="h-full">
      <body className="min-h-full">
        <ToastProvider>
          {isLoggedIn ? (
            <div className="flex h-screen overflow-hidden">
              <Sidebar user={session!} />
              <div className="flex-1 flex flex-col overflow-hidden">
                <Header user={session!} />
                <main className="flex-1 overflow-y-auto p-6">
                  {children}
                </main>
              </div>
            </div>
          ) : (
            <div className="min-h-screen">
              {children}
            </div>
          )}
        </ToastProvider>
      </body>
    </html>
  )
}
