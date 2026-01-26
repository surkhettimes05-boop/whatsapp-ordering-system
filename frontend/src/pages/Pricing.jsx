import { useEffect, useState } from 'react'
import api from '../services/api'
import { Plus, Edit, Trash2 } from 'lucide-react'

const Pricing = () => {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRules()
  }, [])

  const fetchRules = async () => {
    try {
      const response = await api.get('/api/v1/pricing', { params: { limit: 100 } })
      setRules(response.data.data.rules || [])
    } catch (error) {
      console.error('Failed to fetch pricing rules:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading pricing rules...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pricing Rules</h1>
          <p className="text-gray-600 mt-1">Manage dynamic pricing</p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2">
          <Plus size={20} />
          Add Rule
        </button>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-6 text-sm font-medium text-gray-700">Name</th>
                <th className="text-left py-3 px-6 text-sm font-medium text-gray-700">Type</th>
                <th className="text-left py-3 px-6 text-sm font-medium text-gray-700">Discount</th>
                <th className="text-left py-3 px-6 text-sm font-medium text-gray-700">Status</th>
                <th className="text-left py-3 px-6 text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-gray-50">
                  <td className="py-4 px-6 text-sm font-medium text-gray-900">{rule.name}</td>
                  <td className="py-4 px-6 text-sm text-gray-600">{rule.ruleType}</td>
                  <td className="py-4 px-6 text-sm text-gray-600">
                    {rule.discountType === 'PERCENTAGE' && `${rule.discountValue}%`}
                    {rule.discountType === 'FIXED' && `₹${rule.discountValue}`}
                    {rule.fixedPrice && `₹${rule.fixedPrice}`}
                  </td>
                  <td className="py-4 px-6">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      rule.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex gap-2">
                      <button className="text-blue-600 hover:text-blue-800">
                        <Edit size={16} />
                      </button>
                      <button className="text-red-600 hover:text-red-800">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rules.length === 0 && (
          <div className="text-center py-12 text-gray-500">No pricing rules found</div>
        )}
      </div>
    </div>
  )
}

export default Pricing

