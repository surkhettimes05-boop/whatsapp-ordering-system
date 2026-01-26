import type { Metadata } from 'next'
import WhatsAppButton from '@/components/WhatsAppButton'
import { FiTarget, FiUsers, FiMapPin, FiTrendingUp } from 'react-icons/fi'

export const metadata: Metadata = {
  title: 'About New Bihani Group - Building Nepal\'s Trade Ecosystem',
  description: 'Learn about New Bihani Group, the company behind Khaacho, and our vision for Nepal\'s B2B commerce.',
}

export default function AboutPage() {
  const values = [
    {
      icon: <FiTarget className="h-6 w-6" />,
      title: 'Trust & Transparency',
      description: 'Building trust through transparent pricing, verified partners, and clear transaction records.',
    },
    {
      icon: <FiUsers className="h-6 w-6" />,
      title: 'Local Focus',
      description: 'Understanding the unique needs of Nepal\'s retail ecosystem and building solutions that work.',
    },
    {
      icon: <FiTrendingUp className="h-6 w-6" />,
      title: 'Sustainable Growth',
      description: 'Supporting long-term growth for retailers and wholesalers through technology and partnerships.',
    },
    {
      icon: <FiMapPin className="h-6 w-6" />,
      title: 'Community Impact',
      description: 'Contributing to the economic development of local communities through better commerce tools.',
    },
  ]

  return (
    <>
      {/* Header Section */}
      <section className="section-padding bg-gradient-to-b from-primary-50 to-white">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
              About New Bihani Group
            </h1>
            <p className="text-xl text-gray-700">
              Building Nepal's trade ecosystem through technology and trust.
            </p>
          </div>
        </div>
      </section>

      {/* Company Overview */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto">
            <div className="prose prose-lg max-w-none">
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Our Story</h2>
              <p className="text-gray-700 mb-4 text-lg">
                New Bihani Group is a business group focused on transforming Nepal's B2B commerce 
                landscape through innovative technology solutions. We understand the challenges 
                faced by retailers and wholesalers in Nepal's market ecosystem.
              </p>
              <p className="text-gray-700 mb-4 text-lg">
                Khaacho, our flagship platform, was born from the recognition that many retailers 
                spend significant time and effort visiting multiple markets to find the best prices. 
                We saw an opportunity to leverage WhatsApp, a platform already widely used in Nepal, 
                to create a seamless ordering experience.
              </p>
              <p className="text-gray-700 mb-4 text-lg">
                By connecting retailers with verified wholesalers through WhatsApp, we're making 
                it easier for businesses to operate efficiently while maintaining the trust and 
                personal relationships that are essential in Nepal's business culture.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Vision & Mission */}
      <section className="section-padding bg-gray-50">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white rounded-lg p-8 border border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Vision</h2>
                <p className="text-gray-700">
                  To become the leading B2B commerce platform in Nepal, connecting retailers and 
                  wholesalers through technology that respects local business practices and builds 
                  lasting trust.
                </p>
              </div>
              <div className="bg-white rounded-lg p-8 border border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Mission</h2>
                <p className="text-gray-700">
                  To empower retailers and wholesalers with tools that save time, reduce costs, 
                  and enable better business decisions through transparent pricing and transaction 
                  management.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center">Our Values</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {values.map((value, index) => (
                <div key={index} className="text-center">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 text-primary-600 mb-4 mx-auto">
                    {value.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{value.title}</h3>
                  <p className="text-gray-600 text-sm">{value.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Current Operations */}
      <section className="section-padding bg-primary-50">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg p-8 border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Current Operations</h2>
              <p className="text-gray-700 mb-4">
                Khaacho is currently operating in <strong>Surkhet, Nepal</strong> as a pilot program. 
                We're working closely with local retailers and wholesalers to refine our platform 
                and ensure it meets the real needs of the market.
              </p>
              <p className="text-gray-700">
                Our long-term vision includes expanding to other regions of Nepal, always maintaining 
                our focus on trust, transparency, and local business relationships.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Business Credibility */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
              Business Credibility
            </h2>
            <div className="space-y-6">
              <div className="flex items-start space-x-4 p-6 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center mt-1">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Verified Business</h3>
                  <p className="text-gray-600">
                    New Bihani Group is a registered business entity operating in Nepal with 
                    proper business registration and compliance.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-4 p-6 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center mt-1">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Verified Partners</h3>
                  <p className="text-gray-600">
                    All wholesalers on the Khaacho platform are verified businesses with 
                    established operations and good standing.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-4 p-6 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center mt-1">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Transparent Operations</h3>
                  <p className="text-gray-600">
                    We maintain transparent pricing, clear transaction records, and open 
                    communication with all partners.
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
          <h2 className="text-3xl font-bold mb-4">Partner With Us</h2>
          <p className="text-lg text-primary-100 mb-8 max-w-2xl mx-auto">
            Whether you're a retailer looking for better prices or a wholesaler seeking to 
            reach more customers, we'd love to hear from you.
          </p>
          <WhatsAppButton
            variant="secondary"
            className="bg-white text-primary-600 hover:bg-primary-50 border-0"
          >
            Contact Us on WhatsApp
          </WhatsAppButton>
        </div>
      </section>
    </>
  )
}

