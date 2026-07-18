import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Guidelines from './pages/Guidelines';
import About from './pages/About';
import Contact from './pages/Contact';
import CopyrightPolicy from './pages/CopyrightPolicy';
import ModerationPolicy from './pages/ModerationPolicy';
import CookiePolicy from './pages/CookiePolicy';
import AccountDeletion from './pages/AccountDeletion';
import RefundPolicy from './pages/RefundPolicy';
import AdminLayout from './components/AdminLayout';
import DashboardHome from './pages/DashboardHome';
import Users from './pages/Users';
import Categories from './pages/Categories';
import Videos from './pages/Videos';
import Reports from './pages/Reports';
import Ads from './pages/Ads';
import './App.css';

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('admin_token');
  return token ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public marketing site */}
        <Route path="/" element={<Landing />} />

        {/* Public info & legal pages */}
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/guidelines" element={<Guidelines />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/copyright" element={<CopyrightPolicy />} />
        <Route path="/moderation" element={<ModerationPolicy />} />
        <Route path="/cookies" element={<CookiePolicy />} />
        <Route path="/account-deletion" element={<AccountDeletion />} />
        <Route path="/refunds" element={<RefundPolicy />} />

        {/* Admin login */}
        <Route path="/login" element={<Login />} />

        {/* Protected admin dashboard */}
        <Route path="/admin" element={<PrivateRoute><AdminLayout /></PrivateRoute>}>
          <Route index element={<DashboardHome />} />
          <Route path="users" element={<Users />} />
          <Route path="categories" element={<Categories />} />
          <Route path="videos" element={<Videos />} />
          <Route path="reports" element={<Reports />} />
          <Route path="ads" element={<Ads />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
