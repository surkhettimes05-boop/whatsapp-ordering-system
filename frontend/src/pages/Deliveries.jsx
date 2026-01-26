import { useEffect, useState } from 'react'
import api from '../services/api'
import { Search, Truck, MapPin } from 'lucide-react'

const Deliveries = () => {
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchDeliveries()
  }, [])

  const fetchDeliveries = async () => {
    try {
      const response = await api.get('/api/v1/delivery', { params: { limit: 100 } })
      setDeliveries(response.data.data.deliveries || [])
    } catch (error) {
      console.error('Failed to fetch deliveries:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      ASSIGNED: 'bg-blue-100 text-blue-800',
      IN_TRANSIT: 'bg-purple-100 text-purple-800',
      OUT_FOR_DELIVERY: 'bg-indigo-100 text-indigo-800',
      DELIVERED: 'bg-green-100 text-green-800',
      FAILED: 'bg-red-100 text-red-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return <div className="text-center py-12">Loading deliveries...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Deliveries</h1>
        <p className="text-gray-600 mt-1">Track and manage deliveries</p>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by tracking number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {deliveries.map((delivery) => (
          <div key={delivery.id} className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Truck className="text-blue-600" size={20} />
                  <span className="font-semibold text-gray-900">{delivery.trackingNumber}</span>
                </div>
                <div className="text-sm text-gray-600">
                  Order: {delivery.order?.orderNumber || 'N/A'}
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(delivery.status)}`}>
                {delivery.status.replace('_', ' ')}
              </span>
            </div>
            {delivery.agentName && (
              <div className="text-sm text-gray-600 mb-2">
                Agent: {delivery.agentName} ({delivery.agentPhone})
              </div>
            )}
            {delivery.currentLocation && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin size={16} />
                {delivery.currentLocation}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default Deliveries

