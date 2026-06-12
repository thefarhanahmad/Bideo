import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_URL } from '../config';
import Logo from '../components/Logo';

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
      const res = await fetch(API_URL + '/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');
      // backend returns token and sets cookie. store token for client-side checks
      localStorage.setItem('admin_token', data.token);
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface px-4">
      {/* background accents */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-brand/15 blur-3xl" />
        <div className="absolute -bottom-24 -right-10 h-80 w-80 rounded-full bg-brand-light/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Link to="/"><Logo /></Link>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-line bg-white p-8 shadow-card">
          <h2 className="font-display text-2xl font-extrabold text-ink">Admin Login</h2>
          <p className="mt-1 text-sm text-muted">Sign in to manage the Bideo platform.</p>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <label className="mt-5 block text-sm font-medium text-ink">Phone</label>
          <input
            value={phone}
            maxLength={10}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            placeholder="10-digit phone number"
            className="mt-1.5 w-full rounded-lg border border-line p-2.5 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
          />

          <label className="mt-4 block text-sm font-medium text-ink">Password</label>
          <div className="relative mt-1.5">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full rounded-lg border border-line p-2.5 pr-10 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
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

          <button
            className="mt-6 w-full rounded-full bg-brand py-2.5 font-semibold text-white shadow-brand transition-all hover:-translate-y-0.5 hover:bg-brand-dark disabled:translate-y-0 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>

          <p className="mt-3 text-center text-sm text-muted">
            Use the admin phone/password from your database.
          </p>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          <Link to="/" className="font-medium text-brand hover:underline">← Back to website</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
