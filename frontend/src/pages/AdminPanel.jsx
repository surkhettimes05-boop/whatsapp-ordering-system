import React, { useState, useEffect } from 'react';
import './AdminPanel.css';
import AddProductForm from '../components/AddProductForm';
import SharedInbox from '../components/SharedInbox';
import TeamManagement from '../components/TeamManagement';
import AdminDashboard from '../components/AdminDashboard';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check if user is logged in and is admin
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    
    if (!token || role !== 'ADMIN') {
      window.location.href = '/login';
      return;
    }

    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <div className="header-content">
          <h1>🎛️ Admin Control Panel</h1>
          <div className="user-info">
            <span>{user?.name || 'Admin'}</span>
            <button onClick={() => {
              localStorage.clear();
              window.location.href = '/login';
            }}>Logout</button>
          </div>
        </div>
      </div>

      <div className="admin-container">
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 Dashboard
          </button>
          <button 
            className={`tab ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveTab('products')}
          >
            📦 Products
          </button>
          <button 
            className={`tab ${activeTab === 'inbox' ? 'active' : ''}`}
            onClick={() => setActiveTab('inbox')}
          >
            💬 Shared Inbox
          </button>
          <button 
            className={`tab ${activeTab === 'team' ? 'active' : ''}`}
            onClick={() => setActiveTab('team')}
          >
            👥 Team
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'dashboard' && <AdminDashboard />}
          {activeTab === 'products' && <AddProductForm />}
          {activeTab === 'inbox' && <SharedInbox />}
          {activeTab === 'team' && <TeamManagement />}
        </div>
      </div>
    </div>
  );
}
