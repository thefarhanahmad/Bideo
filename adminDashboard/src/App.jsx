import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import AdminLayout from './components/AdminLayout';
import DashboardHome from './pages/DashboardHome';
import Users from './pages/Users';
import Categories from './pages/Categories';
import Videos from './pages/Videos';
import Reports from './pages/Reports';
import './App.css';

const isAuthed = () => !!localStorage.getItem('admin_token');

const PrivateRoute = ({ children }) => {
  return isAuthed() ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public marketing site */}
        <Route path="/" element={<Landing />} />

        {/* Admin login */}
        <Route
          path="/login"
          element={isAuthed() ? <Navigate to="/admin" replace /> : <Login />}
        />

        {/* Protected admin dashboard */}
        <Route path="/admin" element={<PrivateRoute><AdminLayout /></PrivateRoute>}>
          <Route index element={<DashboardHome />} />
          <Route path="users" element={<Users />} />
          <Route path="categories" element={<Categories />} />
          <Route path="videos" element={<Videos />} />
          <Route path="reports" element={<Reports />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
