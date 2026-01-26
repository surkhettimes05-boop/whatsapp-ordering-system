import type { Metadata } from 'next'
import WhatsAppButton from '@/components/WhatsAppButton'
import { FiDollarSign, FiClock, FiShield, FiMessageCircle, FiTrendingDown, FiHome, FiFileText } from 'react-icons/fi'

export const metadata: Metadata = {
  title: 'For Retailers - Better Prices Without Going Out',
  description: 'Discover how Khaacho helps retailers save time and money by ordering through WhatsApp.',
}

export default function ForRetailersPage() {
  const benefits = [
    {
      icon: <FiTrendingDown className="h-6 w-6" />,
      title: 'Better Prices',
      description: 'Automatically find the best-priced wholesaler for every order. No need to call multiple suppliers or visit markets.',
    },
    {
      icon: <FiHome className="h-6 w-6" />,
      title: 'Order from Your Shop',
      description: 'Place orders without leaving your shop. Save time and focus on serving your customers.',
    },
    {
      icon: <FiDollarSign className="h-6 w-6" />,
      title: 'Credit Visibility',
      description: 'See your available credit limit and transaction history anytime through WhatsApp.',
    },
    {
      icon: <FiFileText className="h-6 w-6" />,
      title: 'Daily Purchase Records',
      description: 'Complete records of all your purchases maintained automatically. Easy to track and manage.',
    },
    {
      icon: <FiMessageCircle className="h-6 w-6" />,
      title: 'Simple WhatsApp Usage',
      description: 'No app to download. Use WhatsApp the way you already do - text, photo, or voice note.',
    },
    {
      icon: <FiShield className="h-6 w-6" />,
      title: 'Verified Wholesalers',
      description: 'All wholesalers on Khaacho are verified and trusted. Quality products at competitive prices.',
    },
  ]

  const painPoints = [
    {
      pain: 'Spending hours visiting multiple markets to find the best prices',
      solution: 'Khaacho automatically finds the best prices for you, all through WhatsApp',
    },
    {
      pain: 'Losing sales while you\'re out shopping for inventory',
      solution: 'Order from your shop and keep serving customers',
    },
    {
      pain: 'Difficulty tracking purchases and credit across multiple suppliers',
      solution: 'All transactions in one place with clear credit visibility',
    },
    {
      pain: 'Uncertainty about product availability and pricing',
      solution: 'Real-time price comparison and availability from verified wholesalers',
    },
  ]

  return (
    <>
      {/* Header Section */}
      <section className="section-padding bg-gradient-to-b from-primary-50 to-white">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
              For Retailers
            </h1>
            <p className="text-xl text-gray-700 mb-8">
              Better prices without going out. Order everything you need through WhatsApp.
            </p>
            <WhatsAppButton variant="primary" className="text-lg px-8 py-4">
              Get Started on WhatsApp
            </WhatsAppButton>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center">
              Why Retailers Choose Khaacho
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {benefits.map((benefit, index) => (
                <div key={index} className="bg-white rounded-lg p-6 border border-gray-200 hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 text-primary-600 mb-4">
                    {benefit.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">{benefit.title}</h3>
                  <p className="text-gray-600">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pain → Solution Section */}
      <section className="section-padding bg-gray-50">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center">
              Solving Real Retail Challenges in Nepal
            </h2>
            <div className="space-y-6">
              {painPoints.map((item, index) => (
                <div key={index} className="bg-white rounded-lg p-6 border border-gray-200">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <h3 className="font-semibold text-gray-900">The Challenge</h3>
                      </div>
                      <p className="text-gray-600">{item.pain}</p>
                    </div>
                    <div className="flex-shrink-0 w-px bg-gray-200 hidden md:block" />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <h3 className="font-semibold text-gray-900">Khaacho Solution</h3>
                      </div>
                      <p className="text-gray-600">{item.solution}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Example Interaction */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
              Example WhatsApp Order
            </h2>
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-semibold">
                    R
                  </div>
                  <div className="flex-1 bg-white rounded-lg p-4 border border-gray-200">
                    <p className="text-gray-900">I need 10 kg rice, 5 kg dal, 2 boxes of soap, and 1 kg salt</p>
                    <p className="text-xs text-gray-500 mt-2">10:30 AM</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 justify-end">
                  <div className="flex-1 bg-primary-600 text-white rounded-lg p-4 max-w-md">
                    <p>Order received! Finding best prices...</p>
                    <p className="text-xs text-primary-100 mt-2">10:31 AM</p>
                  </div>
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold">
                    K
                  </div>
                </div>
                <div className="flex items-start space-x-3 justify-end">
                  <div className="flex-1 bg-primary-600 text-white rounded-lg p-4 max-w-md">
                    <p><strong>Order Confirmed</strong></p>
                    <p className="mt-2">Rice (10 kg): Rs. 450</p>
                    <p>Dal (5 kg): Rs. 350</p>
                    <p>Soap (2 boxes): Rs. 240</p>
                    <p>Salt (1 kg): Rs. 25</p>
                    <p className="mt-2 border-t border-primary-400 pt-2"><strong>Total: Rs. 1,065</strong></p>
                    <p className="text-xs text-primary-100 mt-2">Delivery: Tomorrow 2 PM</p>
                    <p className="text-xs text-primary-100">10:35 AM</p>
                  </div>
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold">
                    K
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-padding bg-primary-600 text-white">
        <div className="container-custom text-center">
          <h2 className="text-3xl font-bold mb-4">Start Ordering Through WhatsApp</h2>
          <p className="text-lg text-primary-100 mb-8 max-w-2xl mx-auto">
            Join retailers in Surkhet who are already saving time and money with Khaacho.
          </p>
          <WhatsAppButton
            variant="secondary"
            className="bg-white text-primary-600 hover:bg-primary-50 border-0"
          >
            Contact Sales on WhatsApp
          </WhatsAppButton>
        </div>
      </section>
    </>
  )
}

