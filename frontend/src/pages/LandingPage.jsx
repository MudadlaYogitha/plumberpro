import React from 'react';
import { Link } from 'react-router-dom';
import { Wrench, Users, Shield, Clock, Star, ArrowRight } from 'lucide-react';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <div className="flex items-center justify-center mb-6">
              <Wrench className="w-16 h-16 text-primary-600" />
            </div>
            <h1 className="text-4xl sm:text-6xl font-bold text-gray-900 mb-6">
              Professional <span className="text-primary-600">Plumbing</span> Services
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Connect with certified plumbing professionals for all your needs. 
              Book services, track progress, and manage payments seamlessly.
            </p>
            
            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {/* Customer Portal */}
              <div className="bg-white p-8 rounded-2xl shadow-soft hover:shadow-lg transition-shadow">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold mb-4">For Customers</h3>
                <p className="text-gray-600 mb-6">
                  Book plumbing services, track your orders, and manage payments with ease.
                </p>
                <div className="space-y-3">
                  <Link
                    to="/register?role=customer"
                    className="block w-full btn-primary text-center"
                  >
                    Get Started
                    <ArrowRight className="w-4 h-4 ml-2 inline" />
                  </Link>
                  <Link
                    to="/login"
                    className="block w-full text-center text-green-600 hover:text-green-700 font-medium"
                  >
                    Already have an account? Sign in
                  </Link>
                </div>
              </div>

              {/* Service Provider Portal */}
              <div className="bg-white p-8 rounded-2xl shadow-soft hover:shadow-lg transition-shadow">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Wrench className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-4">For Providers</h3>
                <p className="text-gray-600 mb-6">
                  Join our network of professionals and grow your plumbing business.
                </p>
                <div className="space-y-3">
                  <Link
                    to="/register?role=provider"
                    className="block w-full btn-primary text-center"
                  >
                    Join Network
                    <ArrowRight className="w-4 h-4 ml-2 inline" />
                  </Link>
                  <Link
                    to="/login"
                    className="block w-full text-center text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Provider login
                  </Link>
                </div>
              </div>

              {/* Admin Portal */}
              <div className="bg-white p-8 rounded-2xl shadow-soft hover:shadow-lg transition-shadow">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-xl font-semibold mb-4">Admin Portal</h3>
                <p className="text-gray-600 mb-6">
                  Manage the platform, users, and oversee all system operations.
                </p>
                <div className="space-y-3">
                  <Link
                    to="/login"
                    className="block w-full btn-primary text-center"
                  >
                    Admin Access
                    <ArrowRight className="w-4 h-4 ml-2 inline" />
                  </Link>
                  <div className="text-center text-sm text-gray-500">
                    Admin credentials required
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Why Choose PlumbPro?</h2>
            <p className="text-xl text-gray-600">Professional service management made simple</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">24/7 Booking</h3>
              <p className="text-gray-600">Book services anytime with our easy-to-use platform</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Certified Professionals</h3>
              <p className="text-gray-600">All our service providers are verified and experienced</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Secure Payments</h3>
              <p className="text-gray-600">Safe and secure payment processing with detailed invoicing</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Customer Support</h3>
              <p className="text-gray-600">Dedicated support team to help you every step of the way</p>
            </div>
          </div>
        
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <Wrench className="w-8 h-8 text-primary-400 mr-2" />
            <span className="text-2xl font-bold">PlumbPro</span>
          </div>
          <p className="text-gray-400 mb-8">
            Professional plumbing services at your fingertips
          </p>
          <div className="text-sm text-gray-500">
            © 2025 PlumbPro. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
    </div>
  );
};

export default LandingPage;