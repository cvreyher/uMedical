import { Geist, Geist_Mono } from 'next/font/google'

import { AppProvider } from '@/app/provide'

import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import '@workspace/ui/globals.css'
import { Toaster } from '@workspace/ui/components/ui/sonner'

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

export const viewport: Viewport = {
  initialScale: 1,
  width: 'device-width',
}

export const metadata: Metadata = {
  title: {
    template: '%s | uMedical',
    default: 'uMedical - Die universelle, offene Sicht auf EU-Medikamentendaten',
  },
  description: 'Kostenlose, transparente Medikamentensuche mit Daten der EMA. Finden Sie Informationen zu Wirkstoffen, Zulassungen und Herstellern europaweit zugelassener Arzneimittel.',
  keywords: ['Medikamente', 'Arzneimittel', 'Wirkstoffe', 'EMA', 'Europa', 'Zulassung', 'Open Source', 'Suchmaschine', 'Pharmaunternehmen'],
  authors: [{ name: 'uMedical' }],
  openGraph: {
    type: 'website',
    locale: 'de_DE',
    siteName: 'uMedical',
  },
}

const Layout = async ({ children }: { children: ReactNode }) => {
  return (
    <html lang="de" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        <AppProvider>
          {children}
          <Toaster />
        </AppProvider>
      </body>
    </html>
  )
}

export default Layout
