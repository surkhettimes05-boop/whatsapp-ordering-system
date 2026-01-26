import { FiShield, FiDollarSign, FiClock, FiUsers } from 'react-icons/fi'

interface TrustItem {
  icon: React.ReactNode
  title: string
  description: string
}

export default function TrustIndicator() {
  const items: TrustItem[] = [
    {
      icon: <FiShield className="h-6 w-6" />,
      title: 'Verified Wholesalers',
      description: 'All partners are verified and trusted',
    },
    {
      icon: <FiDollarSign className="h-6 w-6" />,
      title: 'Transparent Pricing',
      description: 'Best prices discovered automatically',
    },
    {
      icon: <FiClock className="h-6 w-6" />,
      title: 'Transaction History',
      description: 'Complete records of all purchases',
    },
    {
      icon: <FiUsers className="h-6 w-6" />,
      title: 'Credit Management',
      description: 'Credit limits based on transaction history',
    },
  ]

  return (
    <div className="bg-gray-50 py-12">
      <div className="container-custom">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {items.map((item, index) => (
            <div key={index} className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 text-primary-600 mb-4">
                {item.icon}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-sm text-gray-600">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

