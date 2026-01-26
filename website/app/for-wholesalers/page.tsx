import type { Metadata } from 'next'
import WhatsAppButton from '@/components/WhatsAppButton'
import { FiUsers, FiTrendingUp, FiRepeat, FiShield, FiDollarSign, FiBarChart } from 'react-icons/fi'

export const metadata: Metadata = {
  title: 'For Wholesalers - Access Active Retail Demand',
  description: 'Join Khaacho as a wholesaler to reach more retailers, reduce sales friction, and grow your business.',
}

export default function ForWholesalersPage() {
  const benefits = [
    {
      icon: <FiUsers className="h-6 w-6" />,
      title: 'Access to Active Retail Demand',
      description: 'Connect with retailers actively looking to purchase. No cold calling or market visits needed.',
    },
    {
      icon: <FiTrendingUp className="h-6 w-6" />,
      title: 'Reduced Sales Friction',
      description: 'Orders come to you through Khaacho. Focus on fulfillment instead of sales outreach.',
    },
    {
      icon: <FiRepeat className="h-6 w-6" />,
      title: 'Repeat Orders',
      description: 'Build relationships with retailers who order regularly through the platform.',
    },
    {
      icon: <FiShield className="h-6 w-6" />,
      title: 'Credit-Disciplined Retailers',
      description: 'Work with retailers who have established credit limits based on transaction history.',
    },
    {
      icon: <FiDollarSign className="h-6 w-6" />,
      title: 'Manual Price Control',
      description: 'You set your prices. Khaacho matches orders to the best-priced wholesaler.',
    },
    {
      icon: <FiBarChart className="h-6 w-6" />,
      title: 'Growth Opportunities',
      description: 'Scale your business by reaching more retailers without increasing sales overhead.',
    },
  ]

  const howItWorks = [
    {
      step: '1',
      title: 'Join as Verified Wholesaler',
      description: 'Complete verification and set up your product catalog with prices.',
    },
    {
      step: '2',
      title: 'Receive Order Requests',
      description: 'When retailers place orders, Khaacho matches them to wholesalers based on price and availability.',
    },
    {
      step: '3',
      title: 'Fulfill Orders',
      description: 'Confirm orders and coordinate delivery. You can deliver directly or through Khaacho.',
    },
    {
      step: '4',
      title: 'Get Paid',
      description: 'Receive payment based on your terms. Transaction records are maintained automatically.',
    },
  ]

  return (
    <>
      {/* Header Section */}
      <section className="section-padding bg-gradient-to-b from-primary-50 to-white">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
              For Wholesalers
            </h1>
            <p className="text-xl text-gray-700 mb-8">
              Access active retail demand, reduce sales friction, and grow your business.
            </p>
            <WhatsAppButton variant="primary" className="text-lg px-8 py-4">
              Join as Wholesaler
            </WhatsAppButton>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center">
              Why Wholesalers Partner with Khaacho
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

      {/* How It Works for Wholesalers */}
      <section className="section-padding bg-gray-50">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center">
              How It Works for Wholesalers
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {howItWorks.map((item, index) => (
                <div key={index} className="bg-white rounded-lg p-6 border border-gray-200">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold text-lg">
                      {item.step}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                      <p className="text-gray-600">{item.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
              Key Features for Wholesalers
            </h2>
            <div className="space-y-6">
              <div className="flex items-start space-x-4 p-6 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center mt-1">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Price Control</h3>
                  <p className="text-gray-600">
                    You maintain full control over your pricing. Update prices anytime to stay competitive.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-4 p-6 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center mt-1">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Verified Retailers</h3>
                  <p className="text-gray-600">
                    All retailers on Khaacho are verified. Credit limits are based on transaction history.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-4 p-6 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center mt-1">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Flexible Delivery</h3>
                  <p className="text-gray-600">
                    You can deliver directly to retailers or coordinate through Khaacho's delivery network.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-4 p-6 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center mt-1">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Transaction Records</h3>
                  <p className="text-gray-600">
                    All orders and transactions are automatically recorded for easy tracking and accounting.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-padding bg-primary-600 text-white">
        <div className="container-custom text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Grow Your Wholesale Business?</h2>
          <p className="text-lg text-primary-100 mb-8 max-w-2xl mx-auto">
            Join Khaacho as a verified wholesaler and start receiving orders from active retailers.
          </p>
          <WhatsAppButton
            variant="secondary"
            className="bg-white text-primary-600 hover:bg-primary-50 border-0"
            message="Hello, I am a wholesaler interested in joining Khaacho."
          >
            Contact Sales on WhatsApp
          </WhatsAppButton>
        </div>
      </section>
    </>
  )
}

