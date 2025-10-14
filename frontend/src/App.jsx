import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';

// Pages
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import CustomerDashboard from './pages/CustomerDashboard';
import ProviderDashboard from './pages/ProviderDashboard';
import AdminDashboard from './pages/AdminDashboard';
import BookService from './pages/BookService';
import MyOrders from './pages/MyOrders';
import ProviderCalendar from './pages/ProviderCalendar';
import ServiceRequests from './pages/ServiceRequests';
import ProviderReviews from './pages/ProviderReviews';
import ProviderEarnings from './pages/ProviderEarnings';
import PrivateRoute from './components/PrivateRoute';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Toaster position="top-right" />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            {/* Customer Routes */}
            <Route path="/customer" element={
              <PrivateRoute role="customer">
                <CustomerDashboard />
              </PrivateRoute>
            } />
            <Route path="/book-service" element={
              <PrivateRoute role="customer">
                <BookService />
              </PrivateRoute>
            } />
            <Route path="/my-orders" element={
              <PrivateRoute role="customer">
                <MyOrders />
              </PrivateRoute>
            } />
            
            {/* Provider Routes */}
            <Route path="/provider" element={
              <PrivateRoute role="provider">
                <ProviderDashboard />
              </PrivateRoute>
            } />
            <Route path="/provider/calendar" element={
              <PrivateRoute role="provider">
                <ProviderCalendar />
              </PrivateRoute>
            } />
            <Route path="/provider/requests" element={
              <PrivateRoute role="provider">
                <ServiceRequests />
              </PrivateRoute>
            } />
            <Route path="/provider/reviews" element={
              <PrivateRoute role="provider">
                <ProviderReviews />
              </PrivateRoute>
            } />
            <Route path="/provider/earnings" element={
              <PrivateRoute role="provider">
                <ProviderEarnings />
              </PrivateRoute>
            } />
            
            {/* Admin Routes */}
            <Route path="/admin" element={
              <PrivateRoute role="admin">
                <AdminDashboard />
              </PrivateRoute>
            } />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;