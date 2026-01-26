import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

  useEffect(() => {
    fetchDashboardStats();
    const interval = setInterval(fetchDashboardStats, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE}/admin-dashboard/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return <div>Loading dashboard...</div>;
  }

  const orderTrend = stats.orders?.trend === 'up' ? '📈' : '📉';

  return (
    <div className="dashboard">
      <h2>📊 Dashboard Overview</h2>

      <div className="dashboard-grid">
        <div className="stat-card">
          <h3>Orders Today</h3>
          <p className="stat-value">{stats.orders?.today || 0}</p>
          <p className="stat-subtitle">{orderTrend} vs yesterday: {stats.orders?.yesterday || 0}</p>
        </div>

        <div className="stat-card">
          <h3>This Month Orders</h3>
          <p className="stat-value">{stats.orders?.thisMonth || 0}</p>
          <p className="stat-subtitle">Total orders this month</p>
        </div>

        <div className="stat-card">
          <h3>Revenue Today</h3>
          <p className="stat-value">₹{(stats.revenue?.today || 0).toLocaleString('en-IN')}</p>
          <p className="stat-subtitle">Daily revenue</p>
        </div>

        <div className="stat-card">
          <h3>Monthly Revenue</h3>
          <p className="stat-value">₹{(stats.revenue?.thisMonth || 0).toLocaleString('en-IN')}</p>
          <p className="stat-subtitle">Revenue this month</p>
        </div>

        <div className="stat-card">
          <h3>Active Conversations</h3>
          <p className="stat-value">{stats.messages?.activeConversations || 0}</p>
          <p className="stat-subtitle">{stats.messages?.pendingMessages || 0} pending replies</p>
        </div>

        <div className="stat-card">
          <h3>Retailers</h3>
          <p className="stat-value">{stats.users?.totalRetailers || 0}</p>
          <p className="stat-subtitle">Active retailers</p>
        </div>

        <div className="stat-card">
          <h3>Wholesalers</h3>
          <p className="stat-value">{stats.users?.totalWholesalers || 0}</p>
          <p className="stat-subtitle">Active wholesalers</p>
        </div>

        <div className="stat-card">
          <h3>Team Members</h3>
          <p className="stat-value">{stats.users?.teamMembers || 0}</p>
          <p className="stat-subtitle">Support staff</p>
        </div>
      </div>

      <div style={{ marginTop: '2rem', background: '#f9f9f9', padding: '1.5rem', borderRadius: '8px' }}>
        <h3>✨ Quick Actions</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <a href="/#/admin?tab=products" style={{ padding: '1rem', background: 'white', borderRadius: '4px', textAlign: 'center', textDecoration: 'none', color: '#333', border: '1px solid #ddd' }}>
            📦 Manage Products
          </a>
          <a href="/#/admin?tab=inbox" style={{ padding: '1rem', background: 'white', borderRadius: '4px', textAlign: 'center', textDecoration: 'none', color: '#333', border: '1px solid #ddd' }}>
            💬 View Messages ({stats.messages?.pendingMessages || 0})
          </a>
          <a href="/#/admin?tab=team" style={{ padding: '1rem', background: 'white', borderRadius: '4px', textAlign: 'center', textDecoration: 'none', color: '#333', border: '1px solid #ddd' }}>
            👥 Manage Team
          </a>
          <a href="/#/analytics" style={{ padding: '1rem', background: 'white', borderRadius: '4px', textAlign: 'center', textDecoration: 'none', color: '#333', border: '1px solid #ddd' }}>
            📊 Analytics
          </a>
        </div>
      </div>

      <div style={{ marginTop: '2rem', background: '#fff3cd', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #ffc107' }}>
        <h4 style={{ margin: '0 0 0.5rem 0' }}>💡 Tips</h4>
        <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
          <li>Check shared inbox regularly to handle retailer inquiries</li>
          <li>Assign conversations to team members for faster response</li>
          <li>Update products weekly to keep inventory accurate</li>
          <li>Monitor team member performance through their stats</li>
        </ul>
      </div>
    </div>
  );
}
