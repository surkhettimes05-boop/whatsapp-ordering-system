import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function SharedInbox() {
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const API_BASE = process.env.REACT_APP_API_URL || 'https://whatsapp-ordering-system.onrender.com/api/v1';

  useEffect(() => {
    fetchConversations();
    fetchTeamMembers();
  }, []);

  const fetchConversations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE}/admin-dashboard/inbox`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConversations(response.data.conversations);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      setLoading(false);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE}/admin-dashboard/team`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTeamMembers(response.data);
    } catch (error) {
      console.error('Failed to fetch team members:', error);
    }
  };

  const assignConversation = async (convId, userId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE}/admin-dashboard/inbox/${convId}/assign`, 
        { userId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage({ type: 'success', text: '✅ Conversation assigned!' });
      fetchConversations();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to assign conversation' });
    }
  };

  const resolveConversation = async (convId) => {
    try {
      const token = localStorage.getItem('token');
      const notes = window.prompt('Add resolution notes:');
      if (notes === null) return;

      await axios.post(`${API_BASE}/admin-dashboard/inbox/${convId}/resolve`,
        { notes },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage({ type: 'success', text: '✅ Conversation resolved!' });
      setSelectedConv(null);
      fetchConversations();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to resolve conversation' });
    }
  };

  if (loading) return <div>Loading inbox...</div>;

  return (
    <div className="inbox-container">
      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <div className="conversation-list">
        <div style={{ padding: '1rem', borderBottom: '2px solid #ddd', background: '#667eea', color: 'white', fontWeight: 'bold' }}>
          💬 Conversations ({conversations.length})
        </div>
        {conversations.length === 0 ? (
          <div style={{ padding: '1rem', textAlign: 'center', color: '#999' }}>
            No conversations yet
          </div>
        ) : (
          conversations.map(conv => (
            <div
              key={conv.id}
              className={`conversation-item ${selectedConv?.id === conv.id ? 'active' : ''}`}
              onClick={() => setSelectedConv(conv)}
            >
              <div className="conversation-name">
                {conv.retailer?.pasalName || 'Unknown'}
              </div>
              <div className="conversation-preview">
                {conv.messages[0]?.body || 'No messages yet'}
              </div>
              <div className="conversation-time">
                {new Date(conv.updatedAt).toLocaleTimeString()}
              </div>
              {conv.unreadCount > 0 && (
                <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'white', background: '#f5365c', padding: '0.25rem 0.5rem', borderRadius: '3px', display: 'inline-block' }}>
                  {conv.unreadCount} unread
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {selectedConv ? (
        <div className="conversation-detail">
          <div className="conversation-header">
            <h3>{selectedConv.retailer?.pasalName || 'Unknown'}</h3>
            <div className="conversation-meta">
              📱 {selectedConv.retailer?.phoneNumber || 'N/A'} | Status: 
              <span className={`badge badge-${selectedConv.status.toLowerCase()}`} style={{ marginLeft: '0.5rem' }}>
                {selectedConv.status}
              </span>
            </div>
            {selectedConv.assignedToUser && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                👤 Assigned to: {selectedConv.assignedToUser.name}
              </div>
            )}
          </div>

          <div className="messages-list">
            {selectedConv.messages && selectedConv.messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.isFromRetailer ? 'from-retailer' : 'from-admin'}`}>
                <div className="message-content">
                  {msg.body}
                  <div className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="conversation-footer">
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Assign to Team Member:
              </label>
              <select 
                onChange={(e) => assignConversation(selectedConv.id, e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                <option value="">Select team member...</option>
                {teamMembers.map(member => (
                  <option key={member.id} value={member.id}>
                    {member.name} ({member.role})
                  </option>
                ))}
              </select>
            </div>

            {selectedConv.status === 'OPEN' && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  className="btn btn-primary" 
                  style={{ flex: 1 }}
                  onClick={() => resolveConversation(selectedConv.id)}
                >
                  ✅ Mark as Resolved
                </button>
              </div>
            )}

            {selectedConv.status === 'CLOSED' && selectedConv.resolvedNotes && (
              <div style={{ background: '#f0f0f0', padding: '0.75rem', borderRadius: '4px', fontSize: '0.9rem' }}>
                <strong>Resolution Notes:</strong> {selectedConv.resolvedNotes}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ background: '#f9f9f9', padding: '2rem', textAlign: 'center', color: '#999', borderRadius: '8px' }}>
          Select a conversation to view details
        </div>
      )}
    </div>
  );
}
