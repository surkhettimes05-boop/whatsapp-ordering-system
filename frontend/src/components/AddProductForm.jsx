import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function AddProductForm() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null); // To hold product being edited

  // Define initial state for the form to reset easily
  const initialFormState = {
    name: '',
    description: '',
    categoryId: '',
    basePrice: '',
    unit: 'piece',
    minOrderQuantity: '1',
    image: ''
  };

  const [formData, setFormData] = useState(initialFormState);

  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE}/admin-dashboard/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProducts(response.data);
    } catch (error) {
      console.error('Failed to fetch products:', error);
      setMessage({ type: 'error', text: 'Failed to fetch products' });
    }
    setLoading(false);
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
    
    if (!formData.name || !formData.categoryId || !formData.basePrice) {
      setMessage({ type: 'error', text: 'Please fill in all required fields' });
      return;
    }

    const token = localStorage.getItem('token');
    const requestMethod = editingProduct ? 'put' : 'post';
    const requestUrl = editingProduct
      ? `${API_BASE}/admin-dashboard/products/${editingProduct.id}`
      : `${API_BASE}/admin-dashboard/products`;

    try {
      await axios[requestMethod](requestUrl, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMessage({ type: 'success', text: `✅ Product ${editingProduct ? 'updated' : 'added'} successfully!` });
      setShowForm(false);
      setEditingProduct(null);
      setFormData(initialFormState);
      fetchProducts(); // Refresh list
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || `Failed to ${editingProduct ? 'update' : 'add'} product` });
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      categoryId: product.category?.id || product.categoryId, // Handle nested category object
      basePrice: product.basePrice,
      unit: product.unit,
      minOrderQuantity: product.minOrderQuantity || '1',
      image: product.image || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE}/admin-dashboard/products/${productId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage({ type: 'success', text: '✅ Product deleted!' });
      fetchProducts();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete product' });
    }
  };

  const handleShowAddForm = () => {
    setEditingProduct(null);
    setFormData(initialFormState);
    setShowForm(true);
  };
  
  const handleCancel = () => {
    setShowForm(false);
    setEditingProduct(null);
    setFormData(initialFormState);
  };

  if (loading) return <div className="loading">Loading products...</div>;

  return (
    <div className="products-section">
      {message && (
        <div className={`alert alert-${message.type}`} onClick={() => setMessage(null)}>
          {message.text}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>📦 Product Management</h2>
        {!showForm && (
            <button className="btn btn-primary" onClick={handleShowAddForm}>
            ➕ Add New Product
            </button>
        )}
      </div>

      {showForm && (
        <div style={{ background: '#f9f9f9', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
          <h3>{editingProduct ? '✏️ Edit Product' : '➕ Add New Product'}</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              <div className="form-group">
                <label>Product Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g., Tomato, Onion, etc."
                  required
                />
              </div>

              <div className="form-group">
                <label>Category *</label>
                <select name="categoryId" value={formData.categoryId} onChange={handleChange} required>
                  <option value="">Select category</option>
                  <option value="vegetables">Vegetables</option>
                  <option value="fruits">Fruits</option>
                  <option value="spices">Spices</option>
                  <option value="dairy">Dairy</option>
                  <option value="grains">Grains</option>
                </select>
              </div>

              <div className="form-group">
                <label>Base Price (₹) *</label>
                <input
                  type="number"
                  name="basePrice"
                  value={formData.basePrice}
                  onChange={handleChange}
                  placeholder="0"
                  step="0.01"
                  required
                />
              </div>

              <div className="form-group">
                <label>Unit</label>
                <select name="unit" value={formData.unit} onChange={handleChange}>
                  <option value="piece">Piece</option>
                  <option value="kg">KG</option>
                  <option value="liter">Liter</option>
                  <option value="dozen">Dozen</option>
                </select>
              </div>

              <div className="form-group">
                <label>Min Order Quantity</label>
                <input
                  type="number"
                  name="minOrderQuantity"
                  value={formData.minOrderQuantity}
                  onChange={handleChange}
                  placeholder="1"
                />
              </div>

              <div className="form-group">
                <label>Image URL</label>
                <input
                  type="url"
                  name="image"
                  value={formData.image}
                  onChange={handleChange}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Product description..."
              />
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                {editingProduct ? '✅ Save Changes' : '✅ Add Product'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ marginTop: '2rem' }}>
        <h3>Existing Products ({products.length})</h3>
        <table className="products-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Unit</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map(product => (
              <tr key={product.id}>
                <td>
                  {product.image && <img src={product.image} alt={product.name} className="product-image" style={{ marginRight: '0.5rem' }} />}
                  {product.name}
                </td>
                <td>{product.category?.name || 'N/A'}</td>
                <td>₹{parseFloat(product.basePrice).toFixed(2)}</td>
                <td>{product.unit}</td>
                <td>
                  <div className="action-buttons">
                    <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(product)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(product.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
