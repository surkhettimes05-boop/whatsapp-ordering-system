import { useEffect, useState } from 'react'
import api from '../services/api'
import {
  Users,
  ShoppingCart,
  Package,
  AlertCircle,
  Calendar
} from 'lucide-react'

const Dashboard = () => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const response = await api.get('/api/v1/admin/dashboard')
      setData(response.data.data)
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const { stats, recentOrders } = data || {}

  const statCards = [
    {
      title: 'Total Retailers',
      value: stats?.totalRetailers || 0,
      icon: Users,
      color: 'bg-emerald-600',
      lightColor: 'bg-emerald-50',
      textColor: 'text-emerald-600'
    },
    {
      title: 'Total Orders',
      value: stats?.totalOrders || 0,
      icon: ShoppingCart,
      color: 'bg-indigo-600',
      lightColor: 'bg-indigo-50',
      textColor: 'text-indigo-600'
    },
    {
      title: 'Total Products',
      value: stats?.totalProducts || 0,
      icon: Package,
      color: 'bg-blue-600',
      lightColor: 'bg-blue-50',
      textColor: 'text-blue-600'
    },
    {
      title: 'Pending Orders',
      value: stats?.pendingOrders || 0,
      icon: AlertCircle,
      color: 'bg-orange-500',
      lightColor: 'bg-orange-50',
      textColor: 'text-orange-600'
    }
  ]

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">Dashboard Overview</h1>
          <p className="text-gray-500 font-medium mt-1">Real-time wholesale insights.</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
          <Calendar className="text-gray-400 ml-2" size={20} />
          <span className="font-bold text-gray-700 pr-4">{new Date().toDateString()}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div
              key={index}
              className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm hover:shadow-xl hover:translate-y-[-4px] transition-all duration-300 group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`${stat.lightColor} p-4 rounded-2xl group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className={stat.textColor} size={28} />
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">{stat.title}</p>
                <p className="text-3xl font-black text-gray-900 tracking-tight">{stat.value}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Recent Orders List */}
      <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Recent Orders</h2>
        </div>
        <div className="space-y-4">
          {recentOrders?.map((order) => (
            <div key={order.id} className="flex items-center gap-4 p-4 rounded-3xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
              <div className={`p-3 rounded-2xl ${order.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-600' :
                  order.status === 'PENDING' ? 'bg-orange-50 text-orange-600' :
                    'bg-blue-50 text-blue-600'
                }`}>
                <ShoppingCart size={20} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-gray-900">
                    {order.retailer?.pasalName || order.retailer?.phoneNumber}
                  </p>
                  <span className={`text-xs font-black uppercase px-2 py-1 rounded ${order.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-700' :
                      order.status === 'PENDING' ? 'bg-orange-100 text-orange-700' :
                        'bg-blue-100 text-blue-700'
                    }`}>
                    {order.status}
                  </span>
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {new Date(order.createdAt).toLocaleString()} • {order.items?.length || 0} items
                </div>
              </div>
            </div>
          ))}
          {(!recentOrders || recentOrders.length === 0) && (
            <div className="text-center py-12 text-gray-400">
              <p>No recent orders found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
