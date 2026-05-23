import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');
      // backend returns token and sets cookie. store token for client-side checks
      localStorage.setItem('admin_token', data.token);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={submit} className="bg-white p-8 rounded shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">Admin Login</h2>
        {error && <div className="bg-red-100 text-red-800 p-2 mb-3 rounded">{error}</div>}
        <label className="block mb-2">Phone</label>
        <input value={phone} maxLength={10} onChange={e=>setPhone(e.target.value.replace(/\D/g, ''))} className="w-full p-2 border rounded mb-3" />
        <label className="block mb-2">Password</label>
        <div className="relative mb-4">
          <input type={showPassword ? 'text' : 'password'} value={password} onChange={e=>setPassword(e.target.value)} className="w-full p-2 pr-10 border rounded" />
          <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600" onClick={() => setShowPassword((prev) => !prev)}>
            {showPassword ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.95 10.95 0 0 1 12 20c-5 0-9.27-3.11-11-8 1-2.78 2.96-4.96 5.47-6.32M9.9 4.24A11.39 11.39 0 0 1 12 4c5 0 9.27 3.11 11 8a11.8 11.8 0 0 1-4.13 5.94M1 1l22 22" />
                <path d="M9.53 9.53a3 3 0 0 0 4.24 4.24" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
        <button className="w-full bg-blue-600 text-white py-2 rounded" disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button>
        <p className="text-sm text-gray-500 mt-3">Use admin user phone/password from database.</p>
      </form>
    </div>
  );
};

export default Login;
