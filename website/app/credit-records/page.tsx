import type { Metadata } from 'next'
import WhatsAppButton from '@/components/WhatsAppButton'
import { FiShield, FiEye, FiFileText, FiTrendingUp, FiCheckCircle } from 'react-icons/fi'

export const metadata: Metadata = {
  title: 'Credit & Records System - Transparent Transaction Management',
  description: 'Learn how Khaacho manages credit limits and maintains transaction records for retailers.',
}

export default function CreditRecordsPage() {
  const features = [
    {
      icon: <FiTrendingUp className="h-6 w-6" />,
      title: 'Transaction-Based Credit Limits',
      description: 'Credit limits are determined based on your payment history and transaction patterns. As you build trust through consistent payments, your credit limit increases.',
    },
    {
      icon: <FiEye className="h-6 w-6" />,
      title: 'Transparent Credit Visibility',
      description: 'See your available credit limit and current usage anytime through WhatsApp. No hidden terms or surprises.',
    },
    {
      icon: <FiFileText className="h-6 w-6" />,
      title: 'Complete Transaction History',
      description: 'Every purchase is automatically recorded with date, items, prices, and payment status. Access your history anytime.',
    },
    {
      icon: <FiShield className="h-6 w-6" />,
      title: 'Trust-Based System',
      description: 'Credit limits are based on demonstrated payment behavior, not complex financial assessments. Simple and fair.',
    },
  ]

  const howItWorks = [
    {
      step: '1',
      title: 'Start with Initial Credit',
      description: 'New retailers start with a credit limit based on initial verification and business information.',
    },
    {
      step: '2',
      title: 'Build Payment History',
      description: 'As you make purchases and payments, your transaction history is automatically recorded.',
    },
    {
      step: '3',
      title: 'Credit Limit Adjusts',
      description: 'Your credit limit is reviewed and adjusted based on your payment behavior and transaction volume.',
    },
    {
      step: '4',
      title: 'Maintain Records',
      description: 'All transactions are maintained in your account. View your purchase history and credit status anytime.',
    },
  ]

  return (
    <>
      {/* Header Section */}
      <section className="section-padding bg-gradient-to-b from-primary-50 to-white">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
              Credit & Records System
            </h1>
            <p className="text-xl text-gray-700">
              Transparent credit management and complete transaction records for all retailers.
            </p>
          </div>
        </div>
      </section>

      {/* Important Notice */}
      <section className="section-padding bg-yellow-50 border-y border-yellow-200">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg p-6 border border-yellow-200">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <FiShield className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Important Notice</h2>
                  <p className="text-gray-700 mb-2">
                    Khaacho's credit system is a transaction-based credit management tool for business operations. 
                    It is not a banking service, financial institution, or regulated credit provider.
                  </p>
                  <p className="text-gray-700">
                    Credit limits are determined based on transaction history and payment behavior to facilitate 
                    B2B commerce. This system emphasizes discipline and trust within the retail ecosystem.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center">
              How Credit & Records Work
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              {features.map((feature, index) => (
                <div key={index} className="bg-white rounded-lg p-6 border border-gray-200">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 text-primary-600 mb-4">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="section-padding bg-gray-50">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center">
              Credit Limit Process
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

      {/* Benefits Section */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
              Benefits of Our Credit & Records System
            </h2>
            <div className="space-y-6">
              <div className="flex items-start space-x-4 p-6 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0">
                  <FiCheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Transparency</h3>
                  <p className="text-gray-600">
                    See your credit limit and usage clearly. No hidden fees or complex terms.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-4 p-6 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0">
                  <FiCheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Automatic Records</h3>
                  <p className="text-gray-600">
                    All transactions are recorded automatically. No need to maintain separate records.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-4 p-6 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0">
                  <FiCheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Growth Opportunity</h3>
                  <p className="text-gray-600">
                    Build your credit limit over time through consistent payment behavior.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-4 p-6 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0">
                  <FiCheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Easy Access</h3>
                  <p className="text-gray-600">
                    Check your credit status and transaction history anytime through WhatsApp.
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
          <h2 className="text-3xl font-bold mb-4">Questions About Credit & Records?</h2>
          <p className="text-lg text-primary-100 mb-8 max-w-2xl mx-auto">
            Our team can explain the credit system and help you understand how it works for your business.
          </p>
          <WhatsAppButton
            variant="secondary"
            className="bg-white text-primary-600 hover:bg-primary-50 border-0"
            message="Hello, I have questions about the credit and records system."
          >
            Contact Sales on WhatsApp
          </WhatsAppButton>
        </div>
      </section>
    </>
  )
}

