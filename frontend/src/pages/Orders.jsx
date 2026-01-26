import { useEffect, useState } from 'react'
import api from '../services/api'
import { Search, Eye, X, Package, User, Calendar, Clock, CheckCircle, Truck, AlertCircle, ShoppingBag, Image as ImageIcon } from 'lucide-react'

const Orders = () => {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    fetchOrders()
  }, [statusFilter])

  const fetchOrders = async () => {
    try {
      const params = {}
      if (statusFilter) params.status = statusFilter
      const response = await api.get('/api/v1/admin/orders', { params })
      setOrders(response.data.data.orders || [])
    } catch (error) {
      console.error('Failed to fetch orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await api.put(`/api/v1/admin/orders/${orderId}/status`, { status: newStatus })
      fetchOrders()
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(prev => ({ ...prev, status: newStatus }))
      }
    } catch (error) {
      alert('Failed to update order status')
    }
  }

  const filteredOrders = orders.filter(order =>
    (order.retailer?.pasalName || '').toLowerCase().includes(search.toLowerCase()) ||
    (order.retailer?.ownerName || '').toLowerCase().includes(search.toLowerCase()) ||
    (order.retailer?.phoneNumber || '').includes(search)
  )

  const getStatusConfig = (status) => {
    const configs = {
      PENDING: { color: 'bg-yellow-50 text-yellow-700 border-yellow-100', icon: Clock },
      CONFIRMED: { color: 'bg-blue-50 text-blue-700 border-blue-100', icon: CheckCircle },
      PROCESSING: { color: 'bg-purple-50 text-purple-700 border-purple-100', icon: Package },
      DELIVERED: { color: 'bg-green-50 text-green-700 border-green-100', icon: CheckCircle },
      CANCELLED: { color: 'bg-red-50 text-red-700 border-red-100', icon: AlertCircle }
    }
    return configs[status] || { color: 'bg-gray-50 text-gray-700 border-gray-100', icon: Clock }
  }

  const handleViewDetails = (order) => {
    setSelectedOrder(order)
    setIsModalOpen(true)
  }

  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-600 mt-1">Track retailer orders from WhatsApp</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by pasal name, owner, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-6 py-3 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 font-semibold text-gray-700"
        >
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="PROCESSING">Processing</option>
          <option value="DELIVERED">Delivered</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="text-left py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Retailer</th>
                <th className="text-left py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Items</th>
                <th className="text-left py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="text-left py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Date</th>
                <th className="text-center py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredOrders.map((order) => {
                const status = getStatusConfig(order.status)
                const StatusIcon = status.icon
                return (
                  <tr key={order.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="py-5 px-6">
                      <div className="font-bold text-gray-900">{order.retailer?.pasalName || 'Unknown'}</div>
                      <div className="text-xs text-gray-500 mt-1">{order.retailer?.phoneNumber}</div>
                    </td>
                    <td className="py-5 px-6">
                      <div className="text-sm text-gray-600">{order.items?.length || 0} items</div>
                    </td>
                    <td className="py-5 px-6">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${status.color}`}>
                        <StatusIcon size={14} />
                        {order.status}
                      </div>
                    </td>
                    <td className="py-5 px-6">
                      <div className="text-sm text-gray-600">{new Date(order.createdAt).toLocaleDateString()}</div>
                      <div className="text-[10px] text-gray-400 uppercase font-bold">{new Date(order.createdAt).toLocaleTimeString()}</div>
                    </td>
                    <td className="py-5 px-6 text-center">
                      <button
                        onClick={() => handleViewDetails(order)}
                        className="p-2 bg-gray-50 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600 rounded-xl transition-all"
                      >
                        <Eye size={20} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filteredOrders.length === 0 && (
          <div className="text-center py-20">
            <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag size={32} className="text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">No orders found</h3>
            <p className="text-gray-500">Try changing your filters or search query.</p>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {isModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col">
            <div className="flex justify-between items-center p-8 border-b border-gray-100">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Order Details</h2>
                <p className="text-gray-500 font-medium">Placed on {new Date(selectedOrder.createdAt).toLocaleString()}</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-3 hover:bg-gray-100 rounded-2xl transition-colors"
              >
                <X size={24} className="text-gray-500" />
              </button>
            </div>

            <div className="p-8 overflow-y-auto flex-1 bg-gray-50/30">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Column 1: Items & Images */}
                <div className="md:col-span-2 space-y-6">
                  {/* Order Items Table */}
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                      <ShoppingBag size={20} className="text-blue-600" />
                      Order Items
                    </h3>
                    <div className="space-y-4">
                      {selectedOrder.items?.map((item) => (
                        <div key={item.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                          <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center border border-gray-100">
                            <Package size={24} className="text-gray-300" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-900">{item.product?.name}</h4>
                            <p className="text-sm text-gray-500">Qty: {item.quantity} × Rs. {parseFloat(item.priceAtOrder).toLocaleString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900">Rs. {(parseFloat(item.priceAtOrder) * item.quantity).toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Order Images Section */}
                  {selectedOrder.orderImages && selectedOrder.orderImages.length > 0 && (
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                      <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <ImageIcon size={20} className="text-blue-600" />
                        Original Saman List (Images)
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {selectedOrder.orderImages.map((img) => (
                          <div key={img.id} className="relative group cursor-zoom-in overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 aspect-[4/3]">
                            <img
                              src={img.imageUrl}
                              alt="Order List"
                              className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <a
                                href={img.imageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 bg-white rounded-xl text-xs font-bold text-gray-900 shadow-xl"
                              >
                                View Full Size
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Column 2: Customer & Status */}
                <div className="space-y-6">
                  {/* Status Card */}
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Clock size={20} className="text-blue-600" />
                      Order Status
                    </h3>
                    <select
                      value={selectedOrder.status}
                      onChange={(e) => updateOrderStatus(selectedOrder.id, e.target.value)}
                      className={`w-full p-4 rounded-2xl font-bold border-0 ring-1 ring-gray-100 focus:ring-2 focus:ring-blue-500 ${getStatusConfig(selectedOrder.status).color}`}
                    >
                      <option value="PENDING">Pending</option>
                      <option value="CONFIRMED">Confirmed</option>
                      <option value="PROCESSING">Processing</option>
                      <option value="DELIVERED">Delivered</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>

                  {/* Customer Card */}
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <User size={20} className="text-blue-600" />
                      Retailer Details
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-gray-400">Pasal Name</p>
                        <p className="font-semibold text-gray-800">{selectedOrder.retailer?.pasalName || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-gray-400">Owner</p>
                        <p className="font-semibold text-gray-800">{selectedOrder.retailer?.ownerName || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-gray-400">Phone (WhatsApp)</p>
                        <p className="font-semibold text-gray-800 font-mono">{selectedOrder.retailer?.phoneNumber}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Orders
