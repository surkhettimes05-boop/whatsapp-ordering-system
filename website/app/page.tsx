import type { Metadata } from 'next'
import WhatsAppButton from '@/components/WhatsAppButton'
import FlowDiagram from '@/components/FlowDiagram'
import TrustIndicator from '@/components/TrustIndicator'
import { FiArrowRight } from 'react-icons/fi'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Khaacho - Better Prices Without Going Out | WhatsApp B2B Commerce',
  description: 'Khaacho helps retailers find better prices without going out. Connect with verified wholesalers through WhatsApp in Nepal.',
}

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="section-padding bg-gradient-to-b from-primary-50 to-white">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
              WhatsApp-Based Wholesale Buying
              <span className="block text-primary-600 mt-2">for Nepal Retailers</span>
            </h1>
            <p className="text-xl text-gray-700 mb-8 max-w-2xl mx-auto">
              Khaacho helps retailers find better prices without going out.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <WhatsAppButton variant="primary" className="text-lg px-8 py-4">
                Contact Sales on WhatsApp
              </WhatsAppButton>
              <Link
                href="/how-it-works"
                className="inline-flex items-center space-x-2 text-primary-600 hover:text-primary-700 font-medium"
              >
                <span>Learn How It Works</span>
                <FiArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Flow Visualization */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">How Khaacho Works</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              A simple flow from order to delivery, all through WhatsApp
            </p>
          </div>
          <FlowDiagram />
        </div>
      </section>

      {/* Trust Indicators */}
      <TrustIndicator />

      {/* Value Proposition Section */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-6">
                  Why Retailers Choose Khaacho
                </h2>
                <ul className="space-y-4">
                  <li className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-primary-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Better Prices</h3>
                      <p className="text-gray-600 text-sm">Automatically find the best-priced wholesaler for your order</p>
                    </div>
                  </li>
                  <li className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-primary-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">No Market Visits</h3>
                      <p className="text-gray-600 text-sm">Order everything you need from your shop via WhatsApp</p>
                    </div>
                  </li>
                  <li className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-primary-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Credit Visibility</h3>
                      <p className="text-gray-600 text-sm">See your available credit and transaction history anytime</p>
                    </div>
                  </li>
                  <li className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-primary-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Daily Records</h3>
                      <p className="text-gray-600 text-sm">Complete purchase records maintained automatically</p>
                    </div>
                  </li>
                </ul>
              </div>
              <div className="bg-gray-50 rounded-lg p-8 border border-gray-200">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Ready to Get Started?</h3>
                <p className="text-gray-600 mb-6">
                  Join retailers in Surkhet who are already using Khaacho to save time and money.
                </p>
                <WhatsAppButton variant="primary" className="w-full justify-center">
                  Start Ordering on WhatsApp
                </WhatsAppButton>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-padding bg-primary-600 text-white">
        <div className="container-custom text-center">
          <h2 className="text-3xl font-bold mb-4">Start Using Khaacho Today</h2>
          <p className="text-lg text-primary-100 mb-8 max-w-2xl mx-auto">
            Connect with our sales team on WhatsApp to get started. We'll help you set up your account and show you how to place your first order.
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

