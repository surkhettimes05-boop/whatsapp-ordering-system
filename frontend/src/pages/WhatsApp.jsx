import { useEffect, useState } from 'react'
import api from '../services/api'
import { Send, MessageSquare, Phone } from 'lucide-react'
import { format } from 'date-fns'

const WhatsApp = () => {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchMessages()
  }, [])

  const fetchMessages = async () => {
    try {
      const response = await api.get('/api/v1/whatsapp/messages', { params: { limit: 50 } })
      setMessages(response.data.data.messages || [])
    } catch (error) {
      console.error('Failed to fetch messages:', error)
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!phoneNumber || !message) return

    try {
      await api.post('/api/v1/whatsapp/send', { phoneNumber, message })
      setMessage('')
      fetchMessages()
      alert('Message sent successfully!')
    } catch (error) {
      alert('Failed to send message: ' + (error.response?.data?.error || error.message))
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading messages...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">WhatsApp Messages</h1>
        <p className="text-gray-600 mt-1">Send and manage WhatsApp messages</p>
      </div>

      {/* Send Message Form */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Send Message</h2>
        <form onSubmit={sendMessage} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1234567890"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <button
            type="submit"
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Send size={18} />
            Send Message
          </button>
        </form>
      </div>

      {/* Messages List */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Message History</h2>
        <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-4 rounded-lg ${
                msg.direction === 'INCOMING' ? 'bg-blue-50' : 'bg-green-50'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  {msg.direction === 'INCOMING' ? (
                    <Phone className="text-blue-600" size={18} />
                  ) : (
                    <Send className="text-green-600" size={18} />
                  )}
                  <span className="font-medium">{msg.from}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {format(new Date(msg.timestamp), 'MMM dd, HH:mm')}
                </span>
              </div>
              <p className="text-gray-700">{msg.text || msg.caption || 'Media message'}</p>
              {msg.user && (
                <div className="text-xs text-gray-500 mt-2">User: {msg.user.name}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default WhatsApp

