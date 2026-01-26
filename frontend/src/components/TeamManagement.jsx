import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function TeamManagement() {
  const [teamMembers, setTeamMembers] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState(null);
  const [formData, setFormData] = useState({
    phoneNumber: '',
    name: '',
    email: '',
    role: 'STAFF'
  });

  const API_BASE = process.env.REACT_APP_API_URL || 'https://whatsapp-ordering-system.onrender.com/api/v1';

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const fetchTeamMembers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE}/admin-dashboard/team`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTeamMembers(response.data);

      // Fetch stats for each member
      for (const member of response.data) {
        try {
          const statsResponse = await axios.get(`${API_BASE}/admin-dashboard/team/${member.id}/stats`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setStats(prev => ({
            ...prev,
            [member.id]: statsResponse.data
          }));
        } catch (error) {
          console.error(`Failed to fetch stats for ${member.id}`);
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch team members:', error);
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token');

      if (!formData.phoneNumber || !formData.name) {
        setMessage({ type: 'error', text: 'Please fill in all required fields' });
        return;
      }

      await axios.post(`${API_BASE}/admin-dashboard/team`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMessage({ type: 'success', text: '✅ Team member added successfully!' });
      setFormData({
        phoneNumber: '',
        name: '',
        email: '',
        role: 'STAFF'
      });
      setShowForm(false);
      fetchTeamMembers();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to add team member' });
    }
  };

  if (loading) return <div>Loading team members...</div>;

  return (
    <div className="team-management">
      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>👥 Team Management</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '❌ Cancel' : '➕ Add Team Member'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#f9f9f9', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
          <h3>Add New Team Member</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  required
                />
              </div>

              <div className="form-group">
                <label>Phone Number *</label>
                <input
                  type="tel"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  placeholder="+977-9812345678"
                  required
                />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="john@example.com"
                />
              </div>

              <div className="form-group">
                <label>Role</label>
                <select name="role" value={formData.role} onChange={handleChange}>
                  <option value="STAFF">Staff</option>
                  <option value="SUPPORT">Support</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                ✅ Add Member
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="team-grid">
        {teamMembers.map(member => {
          const memberStats = stats[member.id] || {};
          return (
            <div key={member.id} className="team-card">
              <h3>{member.name}</h3>
              <p>📱 {member.phoneNumber}</p>
              {member.email && <p>📧 {member.email}</p>}
              <p>
                <span className="badge" style={{ background: '#667eea', color: 'white' }}>
                  {member.role}
                </span>
              </p>

              <div className="team-stats">
                <div className="team-stat">
                  <div className="team-stat-value">{memberStats.totalConversations || 0}</div>
                  <div className="team-stat-label">Conversations</div>
                </div>
                <div className="team-stat">
                  <div className="team-stat-value">{memberStats.unreadCount || 0}</div>
                  <div className="team-stat-label">Unread</div>
                </div>
                <div className="team-stat">
                  <div className="team-stat-value">{memberStats.activeConversations || 0}</div>
                  <div className="team-stat-label">Active</div>
                </div>
                <div className="team-stat">
                  <div className="team-stat-value">{memberStats.responseTime || 0}m</div>
                  <div className="team-stat-label">Avg Response</div>
                </div>
              </div>

              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-sm btn-secondary" style={{ flex: 1 }}>Edit</button>
                <button className="btn btn-sm btn-danger" style={{ flex: 1 }}>Remove</button>
              </div>
            </div>
          );
        })}
      </div>

      {teamMembers.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
          No team members yet. Click "Add Team Member" to get started.
        </div>
      )}
    </div>
  );
}
