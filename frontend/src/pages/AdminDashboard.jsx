import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import BookingModal from '../components/BookingModal';
import api from '../utils/api';
import { toast } from 'react-hot-toast';
import moment from 'moment';
import {
  Users,
  Wrench,
  Calendar,
  DollarSign,
  TrendingUp,
  Eye,
  UserCheck,
  UserX,
  Trash2,
  ListFilter as Filter,
  Search,
  Star as StarIcon
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const AdminDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalProviders: 0,
    totalBookings: 0,
    totalRevenue: 0
  });
  const [users, setUsers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [userFilter, setUserFilter] = useState('all');
  const [bookingFilter, setBookingFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // wait for auth to load; if no user, skip fetching
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    // ensure only admins fetch dashboard
    if (user.role && user.role !== 'admin') {
      setLoading(false);
      return;
    }
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsResponse, usersResponse, bookingsResponse] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/admin/users'),
        api.get('/admin/bookings')
      ]);

      const fetchedStats = statsResponse?.data?.stats || {};
      const fetchedUsers = usersResponse?.data?.users ?? usersResponse?.data ?? [];
      const fetchedBookings = bookingsResponse?.data ?? [];

      setStats({
        totalCustomers: fetchedStats.totalCustomers ?? 0,
        totalProviders: fetchedStats.totalProviders ?? 0,
        totalBookings: fetchedStats.totalBookings ?? (Array.isArray(fetchedBookings) ? fetchedBookings.length : 0),
        totalRevenue: fetchedStats.totalRevenue ?? 0
      });

      setUsers(Array.isArray(fetchedUsers) ? fetchedUsers : []);
      setBookings(Array.isArray(fetchedBookings) ? fetchedBookings : []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error(error?.response?.data?.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUserStatus = async (userId, isApproved) => {
    try {
      await api.put(`/admin/users/${userId}/status`, { isApproved });
      toast.success(`User ${isApproved ? 'approved' : 'suspended'} successfully`);
      await fetchDashboardData();
    } catch (error) {
      console.error('Update user status error:', error);
      toast.error(error?.response?.data?.message || 'Failed to update user status');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      toast.success('User deleted successfully');
      await fetchDashboardData();
    } catch (error) {
      console.error('Delete user error:', error);
      toast.error(error?.response?.data?.message || 'Failed to delete user');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-warning-100 text-warning-800',
      accepted: 'bg-blue-100 text-blue-800',
      quotation_sent: 'bg-purple-100 text-purple-800',
      quotation_accepted: 'bg-indigo-100 text-indigo-800',
      payment_completed: 'bg-blue-100 text-blue-800',
      completed: 'bg-success-100 text-success-800',
      cancelled: 'bg-error-100 text-error-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (status) => {
    const texts = {
      pending: 'Pending',
      accepted: 'Accepted',
      quotation_sent: 'Quotation Sent',
      quotation_accepted: 'Quotation Accepted',
      payment_completed: 'Payment Completed',
      completed: 'Completed',
      cancelled: 'Cancelled'
    };
    return texts[status] || status;
  };

  // Users filter/search
  const filteredUsers = users.filter(u => {
    const matchesFilter = userFilter === 'all' || u.role === userFilter;
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      q === '' ||
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.phone || '').includes(q);
    return matchesFilter && matchesSearch;
  });

  // Bookings filter/search
  const filteredBookings = bookings.filter(b => {
    const matchesFilter = bookingFilter === 'all' || b.status === bookingFilter;
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      q === '' ||
      (b.serviceType || '').toLowerCase().includes(q) ||
      (b.customerName || '').toLowerCase().includes(q) ||
      (b.provider?.name || '').toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  // Reviews derived from bookings that have a review
  const reviews = bookings
    .filter(b => b.review && (b.review.rating || b.review.comment))
    .map(b => ({
      id: b._id, // booking id
      rating: Number(b.review.rating) || 0,
      comment: b.review.comment || '',
      reviewedAt: b.review.reviewedAt || b.review?.reviewedAt || b.updatedAt || b.completedAt || b.createdAt,
      reviewerName: (b.customer && b.customer.name) || b.customerName || (b.review.reviewedBy && b.review.reviewedBy.name) || 'Customer',
      providerName: (b.provider && b.provider.name) || (b.review.reviewedProviderName) || 'Provider',
      serviceType: b.serviceType || 'Service',
      bookingRef: b._id
    }));

  // Reviews filtered by searchTerm (reuse search box)
  const filteredReviews = reviews.filter(r => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      (r.reviewerName || '').toLowerCase().includes(q) ||
      (r.providerName || '').toLowerCase().includes(q) ||
      (r.serviceType || '').toLowerCase().includes(q) ||
      (r.comment || '').toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <Layout title="Admin Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="spinner w-8 h-8"></div>
        </div>
      </Layout>
    );
  }

  // If user exists but is not admin, show access denied
  if (user && user.role && user.role !== 'admin') {
    return (
      <Layout title="Admin Dashboard">
        <div className="p-8">
          <h2 className="text-xl font-semibold">Access denied</h2>
          <p className="text-gray-600 mt-2">You do not have permission to view the admin dashboard.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Admin Dashboard">
      <div className="px-4 sm:px-6 lg:px-8">
        {/* Tab Navigation */}
        <div className="mb-8">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'users'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Users
            </button>
            <button
              onClick={() => setActiveTab('bookings')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'bookings'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Bookings
            </button>
            <button
              onClick={() => setActiveTab('reviews')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'reviews'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Reviews
            </button>
          </nav>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="card">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Users className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Total Customers</p>
                    <p className="text-2xl font-semibold text-gray-900">{stats.totalCustomers}</p>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Wrench className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Service Providers</p>
                    <p className="text-2xl font-semibold text-gray-900">{stats.totalProviders}</p>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Calendar className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Total Bookings</p>
                    <p className="text-2xl font-semibold text-gray-900">{stats.totalBookings}</p>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <DollarSign className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-semibold text-gray-900">${stats.totalRevenue}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="grid lg:grid-cols-2 gap-8">
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">Recent Bookings</h3>
                <div className="space-y-4">
                  {bookings.slice(0, 5).map((booking) => (
                    <div key={booking._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{booking.serviceType}</p>
                        <p className="text-sm text-gray-600">{booking.customerName}</p>
                        <p className="text-xs text-gray-500">
                          {moment(booking.createdAt).format('MMM DD, YYYY')}
                        </p>
                      </div>
                      <span className={`status-badge ${getStatusColor(booking.status)}`}>
                        {getStatusText(booking.status)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold mb-4">System Status</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div>
                      <p className="font-medium text-green-800">System Status</p>
                      <p className="text-sm text-green-600">All systems operational</p>
                    </div>
                    <div className="w-3 h-3 bg-green-500 rounded-full" />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div>
                      <p className="font-medium text-blue-800">Active Users</p>
                      <p className="text-sm text-blue-600">
                        {users.filter(u => u.isApproved).length} approved users
                      </p>
                    </div>
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users by name, email, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input-field pl-11"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Filter className="w-5 h-5 text-gray-400" />
                <select
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  className="input-field min-w-[150px]"
                >
                  <option value="all">All Users</option>
                  <option value="customer">Customers</option>
                  <option value="provider">Providers</option>
                </select>
              </div>
            </div>

            {/* Users Table */}
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUsers.map((u) => (
                      <tr key={u._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{u.name}</div>
                            <div className="text-sm text-gray-500">{u.email}</div>
                            <div className="text-sm text-gray-500">{u.phone}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`status-badge ${u.role === 'provider' ? 'bg-blue-100 text-blue-800' : u.role === 'customer' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`status-badge ${u.isApproved ? 'bg-success-100 text-success-800' : 'bg-error-100 text-error-800'}`}>
                            {u.isApproved ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {u.createdAt ? moment(u.createdAt).format('MMM DD, YYYY') : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <button
                            onClick={() => handleUpdateUserStatus(u._id, !u.isApproved)}
                            className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${u.isApproved ? 'bg-error-100 text-error-700 hover:bg-error-200' : 'bg-success-100 text-success-700 hover:bg-success-200'}`}
                          >
                            {u.isApproved ? (
                              <>
                                <UserX className="w-3 h-3 mr-1" />
                                Suspend
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-3 h-3 mr-1" />
                                Approve
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u._id)}
                            className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-error-100 text-error-700 hover:bg-error-200"
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'bookings' && (
          <div className="space-y-6">
            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search bookings..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input-field pl-11"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Filter className="w-5 h-5 text-gray-400" />
                <select
                  value={bookingFilter}
                  onChange={(e) => setBookingFilter(e.target.value)}
                  className="input-field min-w-[150px]"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="accepted">Accepted</option>
                  <option value="quotation_sent">Quotation Sent</option>
                  <option value="payment_completed">Payment Completed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Bookings Table */}
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Booking Details</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredBookings.map((booking) => (
                      <tr key={booking._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{booking.serviceType}</div>
                            <div className="text-sm text-gray-500">{booking.date ? moment(booking.date).format('MMM DD, YYYY') : '-' } at {booking.timeSlot?.start || '-'}</div>
                            <div className="text-xs text-gray-400">#{booking._id?.slice(-6) || '-'}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{booking.customerName || '-'}</div>
                          <div className="text-sm text-gray-500">{booking.customerPhone || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {booking.provider ? (
                            <div>
                              <div className="text-sm text-gray-900">{booking.provider.name}</div>
                              <div className="text-sm text-gray-500">{booking.provider.phone}</div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">Unassigned</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`status-badge ${getStatusColor(booking.status)}`}>
                            {getStatusText(booking.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {booking.payment?.amount ? (
                            <div className="text-sm font-medium text-green-600">${booking.payment.amount}</div>
                          ) : booking.quotation?.amount ? (
                            <div className="text-sm text-gray-600">${booking.quotation.amount} (quoted)</div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => setSelectedBooking(booking)}
                            className="text-primary-600 hover:text-primary-900 inline-flex items-center"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Customer Reviews</h3>
              <div className="text-sm text-gray-500">{filteredReviews.length} review(s)</div>
            </div>

            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reviewer</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comment</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredReviews.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{r.reviewerName}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{r.providerName}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-700">{r.serviceType}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            {[1,2,3,4,5].map(i => (
                              <StarIcon key={i} className={`w-4 h-4 ${i <= r.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
                            ))}
                            <span className="ml-2 text-sm text-gray-500">{r.rating}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-700">{r.comment || '-'}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {r.reviewedAt ? moment(r.reviewedAt).format('MMM DD, YYYY') : '-'}
                        </td>
                      </tr>
                    ))}
                    {filteredReviews.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                          No reviews yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Booking Details Modal */}
        {selectedBooking && (
          <BookingModal
            booking={selectedBooking}
            isOpen={!!selectedBooking}
            onClose={() => setSelectedBooking(null)}
            onUpdate={fetchDashboardData}
            userRole="admin"
          />
        )}
      </div>
    </Layout>
  );
};

export default AdminDashboard;
