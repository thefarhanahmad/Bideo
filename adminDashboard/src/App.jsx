import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import AdminLayout from './components/AdminLayout';
import DashboardHome from './pages/DashboardHome';
import Users from './pages/Users';
import Categories from './pages/Categories';
import Videos from './pages/Videos';
import './App.css';

const PrivateRoute = ({ children }) => {
  const isAuth = !!localStorage.getItem('admin_token');
  return isAuth ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!!localStorage.getItem('admin_token') ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/" element={<PrivateRoute><AdminLayout /></PrivateRoute>}>
          <Route index element={<DashboardHome />} />
          <Route path="users" element={<Users />} />
          <Route path="categories" element={<Categories />} />
          <Route path="videos" element={<Videos />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
