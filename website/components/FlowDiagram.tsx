import { FiShoppingCart, FiMessageCircle, FiCpu, FiTruck, FiFileText, FiCheckCircle } from 'react-icons/fi'

interface FlowStep {
  icon: React.ReactNode
  title: string
  description: string
}

export default function FlowDiagram() {
  const steps: FlowStep[] = [
    {
      icon: <FiShoppingCart className="h-8 w-8" />,
      title: 'Retailer',
      description: 'Places order via WhatsApp',
    },
    {
      icon: <FiMessageCircle className="h-8 w-8" />,
      title: 'WhatsApp',
      description: 'Message, photo, or voice note',
    },
    {
      icon: <FiCpu className="h-8 w-8" />,
      title: 'Khaacho Core',
      description: 'AI extracts items & finds best prices',
    },
    {
      icon: <FiCheckCircle className="h-8 w-8" />,
      title: 'Best Wholesaler',
      description: 'Selected based on price & availability',
    },
    {
      icon: <FiTruck className="h-8 w-8" />,
      title: 'Delivery',
      description: 'Coordinated fulfillment',
    },
    {
      icon: <FiFileText className="h-8 w-8" />,
      title: 'Records',
      description: 'Transaction & credit updated',
    },
  ]

  return (
    <div className="py-12">
      <div className="container-custom">
        <div className="relative">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 lg:gap-6">
            {steps.map((step, index) => (
              <div key={index} className="flex flex-col items-center relative">
                <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 mb-4 z-10 relative">
                  {step.icon}
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2 text-center">
                  {step.title}
                </h3>
                <p className="text-xs text-gray-600 text-center">{step.description}</p>
                {index < steps.length - 1 && (
                  <>
                    {/* Desktop connector line */}
                    <div className="hidden lg:block absolute top-8 left-[calc(100%+0.5rem)] w-full h-0.5 bg-primary-200 z-0" />
                    {/* Arrow head */}
                    <div className="hidden lg:block absolute top-[1.75rem] right-[-0.75rem] w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[8px] border-l-primary-300 z-0" />
                  </>
                )}
              </div>
            ))}
          </div>
          
          {/* Arrow indicators for mobile/tablet */}
          <div className="flex justify-center items-center space-x-2 mt-8 md:flex lg:hidden">
            {steps.slice(0, -1).map((_, index) => (
              <div key={index} className="flex items-center">
                <div className="w-8 h-0.5 bg-primary-300" />
                <div className="w-2 h-2 border-t-2 border-r-2 border-primary-300 transform rotate-45" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

