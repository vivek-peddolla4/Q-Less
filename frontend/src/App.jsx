import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import QRScanner from './pages/QRScanner';
import TokenDisplay from './pages/TokenDisplay';

import { useContext } from 'react';
import { AuthContext } from './context/AuthContext';

const ProtectedRoute = ({ children, requireStaff = false, requiredRole = null }) => {
  const { user, token } = useContext(AuthContext); // token is accessToken

  if (!token) return <Navigate to="/login" />;
  if (token && !user) return null; // waiting for user hydrate

  if (requiredRole && user?.role !== requiredRole) {
    if (user?.role === 'admin') return <Navigate to="/admin" />;
    if (user?.role === 'service_provider') return <Navigate to="/doctor" />;
    return <Navigate to="/dashboard" />;
  }

  if (requireStaff && user?.role === 'user') return <Navigate to="/dashboard" />;

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={
        <ProtectedRoute requiredRole="user">
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/scan" element={
        <ProtectedRoute>
          <QRScanner />
        </ProtectedRoute>
      } />
      <Route path="/token/:id" element={
        <ProtectedRoute>
          <TokenDisplay />
        </ProtectedRoute>
      } />
      <Route path="/doctor" element={
        <ProtectedRoute requiredRole="service_provider">
          <DoctorDashboard />
        </ProtectedRoute>
      } />
      <Route path="/admin" element={
        <ProtectedRoute requiredRole="admin">
          <AdminDashboard />
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500 selection:text-white">
        <ToastContainer position="top-right" autoClose={5000} />
        <AppRoutes />
      </div>
    </AuthProvider>
  );
}

export default App;
