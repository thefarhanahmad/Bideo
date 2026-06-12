import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

const AdminLayout = () => {
  const navigate = useNavigate();
  const logout = () => {
    localStorage.removeItem('admin_token');
    // also try to clear cookie by hitting backend logout (not implemented) and navigate
    navigate('/login');
  };

  const linkClass = ({ isActive }) => isActive ? 'block p-3 rounded bg-blue-50 text-blue-700 font-medium' : 'block p-3 rounded hover:bg-gray-100';

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-64 bg-white border-r">
        <div className="p-4 font-bold text-xl border-b">Bideo Admin</div>
        <nav className="p-4 space-y-1">
          <NavLink to="/" end className={linkClass}>Dashboard</NavLink>
          <NavLink to="/users" className={linkClass}>Users</NavLink>
          <NavLink to="/categories" className={linkClass}>Categories</NavLink>
          <NavLink to="/videos" className={linkClass}>Videos</NavLink>
          <NavLink to="/reports" className={linkClass}>Reports</NavLink>
        </nav>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="flex justify-between items-center p-4 bg-white border-b">
          <div className="text-lg font-semibold">Dashboard</div>
          <div>
            <button onClick={logout} className="px-3 py-1 bg-red-500 text-white rounded">Logout</button>
          </div>
        </header>
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
