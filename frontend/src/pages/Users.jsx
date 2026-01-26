import { useEffect, useState } from 'react'
import api from '../services/api'
import { Search, UserCheck, UserX, CreditCard } from 'lucide-react'

const Retailers = () => {
  const [retailers, setRetailers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchRetailers()
  }, [])

  const fetchRetailers = async () => {
    try {
      const response = await api.get('/api/v1/admin/retailers')
      setRetailers(response.data.data.retailers || [])
      // Note: Backend response structure: { success: true, data: { retailers: [...] } }
    } catch (error) {
      console.error('Failed to fetch retailers:', error)
    } finally {
      setLoading(false)
    }
  }

  const filtered = retailers.filter(r =>
    (r.pasalName || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.ownerName || '').toLowerCase().includes(search.toLowerCase()) ||
    r.phoneNumber.includes(search)
  )

  if (loading) return <div className="text-center py-12">Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Retailers</h1>
          <p className="text-gray-600 mt-1">Manage wholesale shops and credit.</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by Pasal Name, Owner, or Phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-6 text-sm font-medium text-gray-700">Pasal Name</th>
                <th className="text-left py-3 px-6 text-sm font-medium text-gray-700">Owner</th>
                <th className="text-left py-3 px-6 text-sm font-medium text-gray-700">Phone (WhatsApp)</th>
                <th className="text-left py-3 px-6 text-sm font-medium text-gray-700">Status</th>
                <th className="text-left py-3 px-6 text-sm font-medium text-gray-700">Credit Limit</th>
                <th className="text-left py-3 px-6 text-sm font-medium text-gray-700">Credit Used</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((retailer) => (
                <tr key={retailer.id} className="hover:bg-gray-50">
                  <td className="py-4 px-6 font-bold text-gray-900">{retailer.pasalName || '-'}</td>
                  <td className="py-4 px-6 text-gray-600">{retailer.ownerName || '-'}</td>
                  <td className="py-4 px-6 text-blue-600 font-mono">{retailer.phoneNumber}</td>
                  <td className="py-4 px-6">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${retailer.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                      {retailer.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 font-medium">₹{(retailer.credit?.creditLimit || 0).toLocaleString()}</td>
                  <td className="py-4 px-6">
                    <span className={`font-bold ${(retailer.credit?.usedCredit || 0) > (retailer.credit?.creditLimit || 1000) * 0.9
                        ? 'text-red-600'
                        : 'text-gray-700'
                      }`}>
                      ₹{(retailer.credit?.usedCredit || 0).toLocaleString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Retailers
