import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Global fetch interceptor to handle 401 Unauthorized (Token Expiration)
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
  try {
    const response = await originalFetch(...args);
    if (response.status === 401 && !url.includes('/api/admin/login')) {
      localStorage.removeItem('admin_token');
      window.location.href = '/login';
    }
    return response;
  } catch (error) {
    throw error;
  }
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
