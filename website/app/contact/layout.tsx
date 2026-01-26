import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact Us - Get Started with Khaacho',
  description: 'Get started with Khaacho today. Fill out our form or contact us directly on WhatsApp. Our team will help you onboard.',
}

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

