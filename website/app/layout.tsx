import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Khaacho - WhatsApp-Based B2B Commerce Platform in Nepal',
  description: 'Khaacho helps retailers find better prices without going out. Connect with verified wholesalers through WhatsApp.',
  keywords: 'B2B commerce, wholesale, retail, Nepal, WhatsApp ordering, supply chain',
  openGraph: {
    title: 'Khaacho - WhatsApp-Based B2B Commerce Platform',
    description: 'Connect retailers and wholesalers through WhatsApp in Nepal',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  )
}

