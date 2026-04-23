import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeApplier } from '@/components/theme-applier'
import { ServiceWorkerRegister } from '@/components/sw-register'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'SîpFlõw - إدارة المطاعم',
  description: 'نظام إدارة الطلبات والمشاريب للمطاعم والكافيهات',
  generator: 'v0.app',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SîpFlõw',
    startupImage: '/api/logo?size=512',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/api/logo?size=192', sizes: '192x192', type: 'image/png' },
      { url: '/api/logo?size=512', sizes: '512x512', type: 'image/png' },
      { url: '/api/logo?size=32', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/api/logo?size=180', sizes: '180x180', type: 'image/png' },
      { url: '/api/logo?size=192', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/api/logo?size=192',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0a0a0a',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="SîpFlõw" />
        <meta name="application-name" content="SîpFlõw" />
        <meta name="msapplication-TileColor" content="#0a0a0a" />
        <meta name="msapplication-TileImage" content="/api/logo?size=192" />
        <link rel="apple-touch-icon" href="/api/logo?size=180" />
        <link rel="apple-touch-icon" sizes="192x192" href="/api/logo?size=192" />
        <link rel="apple-touch-icon" sizes="512x512" href="/api/logo?size=512" />
      </head>
      <body className="font-sans antialiased">
        <ThemeApplier />
        <ServiceWorkerRegister />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
