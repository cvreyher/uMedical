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
    default: 'uMedical — Your Medical Data Lens',
  },
  description: 'universal · unified · understanding — a free, open platform for EU medicines data. Explore active substances, authorisations, and marketing authorisation holders of centrally approved medicines, based on official EMA data.',
  keywords: ['medicines', 'pharmaceuticals', 'active substances', 'EMA', 'Europe', 'marketing authorisation', 'open source', 'search engine', 'pharmaceutical companies', 'uMedical'],
  authors: [{ name: 'uMedical' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'uMedical',
  },
}

const Layout = async ({ children }: { children: ReactNode }) => {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
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
