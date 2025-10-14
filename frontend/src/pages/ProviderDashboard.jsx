import React, { useState, useEffect } from 'react';
import ProviderLayout from '../components/ProviderLayout';
import api from '../utils/api';
import { toast } from 'react-hot-toast';
import { Bell, CheckCircle, DollarSign, Calendar as CalendarIcon, TrendingUp, Star, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext'; // adjust path if needed

const ProviderDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalBookings: 0,
    newRequests: 0,
    completedJobs: 0,
    totalEarnings: 0,
    averageRating: 0,
    totalReviews: 0
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [bookingsResponse, reviewsResponse] = await Promise.all([
        api.get('/bookings'), // backend filters based on auth/role
        api.get(`/bookings/provider/${user.id}/reviews`)
      ]);

      const bookings = bookingsResponse.data || [];
      const reviewsData = reviewsResponse.data || { averageRating: 0, totalReviews: 0 };

      // my bookings: ensure provider match whether populated object or id
      const myBookings = bookings.filter(b =>
        b.provider &&
        (typeof b.provider === 'string' ? b.provider === user.id : b.provider._id === user.id)
      );

      const totalBookings = myBookings.length;
      const newRequests = bookings.filter(b => b.status === 'pending' && !b.provider).length;
      const completedJobs = myBookings.filter(b => b.status === 'completed').length;
      const totalEarnings = myBookings
        .filter(b => b.status === 'completed' && b.payment)
        .reduce((sum, b) => sum + (b.payment?.amount || 0), 0);

      setStats({
        totalBookings,
        newRequests,
        completedJobs,
        totalEarnings,
        averageRating: reviewsData.averageRating || 0,
        totalReviews: reviewsData.totalReviews || 0
      });

      const recent = myBookings
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);
      setRecentBookings(recent);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ProviderLayout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="spinner w-8 h-8"></div>
        </div>
      </ProviderLayout>
    );
  }

  return (
    <ProviderLayout title="Dashboard">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome back!</h2>
          <p className="text-gray-600">Here's what's happening with your services today.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CalendarIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Jobs</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.totalBookings}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-2 bg-warning-100 rounded-lg">
                <Bell className="w-6 h-6 text-warning-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">New Requests</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.newRequests}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-2 bg-success-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-success-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.completedJobs}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Earnings</p>
                <p className="text-2xl font-semibold text-gray-900">${stats.totalEarnings}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Star className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Rating</p>
                <div className="flex items-center">
                  <p className="text-2xl font-semibold text-gray-900">{stats.averageRating}</p>
                  <Star className="w-4 h-4 text-yellow-400 fill-current ml-1" />
                </div>
                <p className="text-xs text-gray-500">({stats.totalReviews} reviews)</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Link to="/provider/requests" className="card hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Service Requests</h3>
                <p className="text-sm text-gray-600">View new requests</p>
                {stats.newRequests > 0 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-warning-100 text-warning-800 mt-2">
                    {stats.newRequests} new
                  </span>
                )}
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400" />
            </div>
          </Link>

          <Link to="/provider/calendar" className="card hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Calendar</h3>
                <p className="text-sm text-gray-600">Manage schedule</p>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400" />
            </div>
          </Link>

          <Link to="/provider/reviews" className="card hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Reviews</h3>
                <p className="text-sm text-gray-600">Customer feedback</p>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400" />
            </div>
          </Link>

          <Link to="/provider/earnings" className="card hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Earnings</h3>
                <p className="text-sm text-gray-600">Financial overview</p>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400" />
            </div>
          </Link>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Performance Overview</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div>
                  <p className="font-medium text-blue-900">Completion Rate</p>
                  <p className="text-sm text-blue-700">
                    {stats.totalBookings > 0 ? Math.round((stats.completedJobs / stats.totalBookings) * 100) : 0}%
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-600" />
              </div>

              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div>
                  <p className="font-medium text-green-900">Average Rating</p>
                  <div className="flex items-center">
                    <span className="text-sm text-green-700">{stats.averageRating}</span>
                    <Star className="w-4 h-4 text-yellow-400 fill-current ml-1" />
                  </div>
                </div>
                <Star className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Recent Activity</h3>
              <Link to="/provider/requests" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                View all
              </Link>
            </div>
            <div className="space-y-3">
              {recentBookings.slice(0, 5).map((booking) => (
                <div key={booking._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{booking.serviceType}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(booking.date).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    booking.status === 'completed' ? 'bg-green-100 text-green-800' :
                    booking.status === 'payment_completed' ? 'bg-blue-100 text-blue-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {booking.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
              {recentBookings.length === 0 && (
                <p className="text-gray-500 text-center py-4">No recent activity</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </ProviderLayout>
  );
};

export default ProviderDashboard;
