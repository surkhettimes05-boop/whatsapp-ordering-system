import type { Metadata } from 'next'
import WhatsAppButton from '@/components/WhatsAppButton'
import { FiMessageCircle, FiImage, FiMic, FiCpu, FiSearch, FiCheckCircle, FiTruck, FiFileText } from 'react-icons/fi'

export const metadata: Metadata = {
  title: 'How Khaacho Works - Step-by-Step Guide',
  description: 'Learn how Khaacho processes your WhatsApp orders, finds the best prices, and coordinates delivery.',
}

interface Step {
  number: number
  icon: React.ReactNode
  title: string
  description: string
  details: string[]
}

export default function HowItWorksPage() {
  const steps: Step[] = [
    {
      number: 1,
      icon: <FiMessageCircle className="h-8 w-8" />,
      title: 'Place Your Order',
      description: 'Send your order via WhatsApp in any format',
      details: [
        'Text message: "I need 10 kg rice, 5 kg dal, 2 boxes of soap"',
        'Photo: Take a picture of your shopping list or products',
        'Voice note: Speak your order in Nepali or English',
      ],
    },
    {
      number: 2,
      icon: <FiCpu className="h-8 w-8" />,
      title: 'AI Extracts Items',
      description: 'Our system automatically identifies products from your message',
      details: [
        'Natural language processing understands your order',
        'Product names are matched to our catalog',
        'Quantities and specifications are extracted',
      ],
    },
    {
      number: 3,
      icon: <FiSearch className="h-8 w-8" />,
      title: 'Find Best Price',
      description: 'Khaacho searches all verified wholesalers for the best prices',
      details: [
        'Compares prices across multiple wholesalers',
        'Considers availability and delivery options',
        'Selects the best-priced option for you',
      ],
    },
    {
      number: 4,
      icon: <FiCheckCircle className="h-8 w-8" />,
      title: 'Order Confirmation',
      description: 'You receive a confirmation with order details',
      details: [
        'Total price breakdown',
        'Selected wholesaler information',
        'Expected delivery timeline',
      ],
    },
    {
      number: 5,
      icon: <FiTruck className="h-8 w-8" />,
      title: 'Delivery Coordination',
      description: 'Delivery is arranged by the wholesaler or Khaacho',
      details: [
        'Delivery address confirmed',
        'Tracking information provided',
        'Delivery completed to your location',
      ],
    },
    {
      number: 6,
      icon: <FiFileText className="h-8 w-8" />,
      title: 'Record & Credit Update',
      description: 'Transaction is recorded and credit limit updated',
      details: [
        'Purchase added to your transaction history',
        'Credit limit adjusted based on payment',
        'Daily records maintained automatically',
      ],
    },
  ]

  return (
    <>
      {/* Header Section */}
      <section className="section-padding bg-gradient-to-b from-primary-50 to-white">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
              How Khaacho Works
            </h1>
            <p className="text-xl text-gray-700">
              A simple, six-step process from order to delivery, all through WhatsApp
            </p>
          </div>
        </div>
      </section>

      {/* Steps Section */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto space-y-16">
            {steps.map((step, index) => (
              <div
                key={step.number}
                className={`flex flex-col md:flex-row gap-8 items-start ${
                  index % 2 === 1 ? 'md:flex-row-reverse' : ''
                }`}
              >
                <div className="flex-shrink-0 w-full md:w-1/3">
                  <div className="bg-primary-100 rounded-lg p-8 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-600 text-white mb-4">
                      {step.icon}
                    </div>
                    <div className="text-4xl font-bold text-primary-600 mb-2">
                      {step.number}
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">{step.title}</h2>
                    <p className="text-gray-600">{step.description}</p>
                  </div>
                </div>
                <div className="flex-1">
                  <ul className="space-y-3">
                    {step.details.map((detail, detailIndex) => (
                      <li key={detailIndex} className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center mt-0.5">
                          <div className="w-2 h-2 rounded-full bg-primary-600" />
                        </div>
                        <span className="text-gray-700">{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Order Format Examples */}
      <section className="section-padding bg-gray-50">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
              Order Formats We Accept
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg p-6 border border-gray-200">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 mb-4 mx-auto">
                  <FiMessageCircle className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-3 text-center">Text Message</h3>
                <div className="bg-gray-50 rounded p-4 text-sm text-gray-700 font-mono">
                  "I need 10 kg rice, 5 kg dal, 2 boxes of soap"
                </div>
              </div>
              <div className="bg-white rounded-lg p-6 border border-gray-200">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-4 mx-auto">
                  <FiImage className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-3 text-center">Photo</h3>
                <div className="bg-gray-50 rounded p-4 text-sm text-gray-700 text-center">
                  Take a picture of your shopping list or products
                </div>
              </div>
              <div className="bg-white rounded-lg p-6 border border-gray-200">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 text-purple-600 mb-4 mx-auto">
                  <FiMic className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-3 text-center">Voice Note</h3>
                <div className="bg-gray-50 rounded p-4 text-sm text-gray-700 text-center">
                  Speak your order in Nepali or English
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-padding bg-white">
        <div className="container-custom text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to Try It?</h2>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Start placing orders through WhatsApp today. Our team will guide you through the process.
          </p>
          <WhatsAppButton variant="primary" className="text-lg px-8 py-4">
            Contact Sales on WhatsApp
          </WhatsAppButton>
        </div>
      </section>
    </>
  )
}

