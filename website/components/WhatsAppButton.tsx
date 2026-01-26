import Link from 'next/link'
import { FiMessageCircle } from 'react-icons/fi'

interface WhatsAppButtonProps {
  phoneNumber?: string
  message?: string
  className?: string
  variant?: 'primary' | 'secondary'
  children?: React.ReactNode
}

export default function WhatsAppButton({
  phoneNumber,
  message = 'Hello, I would like to learn more about Khaacho.',
  className = '',
  variant = 'primary',
  children,
}: WhatsAppButtonProps) {
  // Use environment variable or fallback to default
  const defaultPhone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '977XXXXXXXXX'
  const finalPhoneNumber = phoneNumber || defaultPhone
  const whatsappUrl = `https://wa.me/${finalPhoneNumber}?text=${encodeURIComponent(message)}`
  
  const baseClasses = 'inline-flex items-center justify-center space-x-2 font-medium rounded-lg transition-colors'
  const variantClasses = variant === 'primary'
    ? 'bg-green-600 text-white hover:bg-green-700 px-6 py-3'
    : 'bg-white text-green-600 border-2 border-green-600 hover:bg-green-50 px-6 py-3'

  return (
    <Link
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`${baseClasses} ${variantClasses} ${className}`}
    >
      <FiMessageCircle className="h-5 w-5" />
      <span>{children || 'Contact Sales on WhatsApp'}</span>
    </Link>
  )
}

