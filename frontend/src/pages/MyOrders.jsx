import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import BookingModal from '../components/BookingModal';
import ReviewModal from '../components/ReviewModal';
import api from '../utils/api';
import { toast } from 'react-hot-toast';
import moment from 'moment';
import {
  Search,
  Filter,
  Calendar,
  MapPin,
  Wrench,
  DollarSign,
  Eye,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  Star
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const MyOrders = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [reviewBooking, setReviewBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (!user) {
      setBookings([]);
      setFilteredBookings([]);
      setLoading(false);
      return;
    }
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    filterBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, searchTerm, statusFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await api.get('/bookings/customer/orders');
      setBookings(response.data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error(error.response?.data?.message || 'Failed to fetch orders');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const filterBookings = () => {
    let filtered = Array.isArray(bookings) ? [...bookings] : [];

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter((booking) => {
        const service = (booking.serviceType || '').toString().toLowerCase();
        const desc = (booking.description || '').toString().toLowerCase();
        const providerName = (booking.provider?.name || '').toString().toLowerCase();
        return service.includes(q) || desc.includes(q) || providerName.includes(q);
      });
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((booking) => booking.status === statusFilter);
    }

    setFilteredBookings(filtered);
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-warning-100 text-warning-800 border-warning-200',
      accepted: 'bg-blue-100 text-blue-800 border-blue-200',
      quotation_sent: 'bg-purple-100 text-purple-800 border-purple-200',
      quotation_accepted: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      payment_completed: 'bg-blue-100 text-blue-800 border-blue-200',
      completed: 'bg-success-100 text-success-800 border-success-200',
      cancelled: 'bg-error-100 text-error-800 border-error-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStatusText = (status) => {
    const texts = {
      pending: 'Pending',
      accepted: 'Accepted',
      quotation_sent: 'Quotation Received',
      quotation_accepted: 'Quotation Accepted',
      payment_completed: 'Payment Completed',
      completed: 'Completed',
      cancelled: 'Cancelled'
    };
    return texts[status] || status;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'cancelled':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const handleAcceptQuotation = async (bookingId, paymentMethod = 'cash') => {
    try {
      await api.put(`/bookings/${bookingId}/accept-quotation`, {
        paymentMethod
      });
      toast.success('Quotation accepted and payment completed!');
      fetchOrders();
    } catch (error) {
      console.error('Accept quotation error:', error);
      toast.error(error.response?.data?.message || 'Failed to accept quotation');
    }
  };

  const handleReviewSubmitted = () => {
    fetchOrders();
    setReviewBooking(null);
  };

  if (loading) {
    return (
      <Layout title="My Orders">
        <div className="flex items-center justify-center h-64">
          <div className="spinner w-8 h-8"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="My Orders">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by service type, description, or provider..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-11"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input-field min-w-[150px]"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="quotation_sent">Quotation Received</option>
                <option value="quotation_accepted">Quotation Accepted</option>
                <option value="payment_completed">Payment Completed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {filteredBookings.length > 0 ? (
            filteredBookings.map((booking) => (
              <div key={booking._id} className="card hover:shadow-lg transition-shadow">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                          <Wrench className="w-5 h-5 mr-2 text-primary-600" />
                          {booking.serviceType || 'Service'}
                        </h3>
                        <div className="flex items-center mt-2 space-x-4 text-sm text-gray-600">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            {booking.date ? moment(booking.date).format('MMM DD, YYYY') : '—'}
                          </div>
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            {booking.timeSlot?.start || '—'} - {booking.timeSlot?.end || '—'}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end space-y-2">
                        <span className={`status-badge ${getStatusColor(booking.status)} flex items-center`}>
                          {getStatusIcon(booking.status)}
                          <span className="ml-1">{getStatusText(booking.status)}</span>
                        </span>
                        <div className="text-xs text-gray-500">#{booking._id?.slice(-6) || '------'}</div>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-start">
                          <MapPin className="w-4 h-4 mr-2 text-gray-400 mt-0.5" />
                          <span className="text-sm text-gray-600">{booking.address || '—'}</span>
                        </div>
                        <div className="flex items-start mt-2">
                          <FileText className="w-4 h-4 mr-2 text-gray-400 mt-0.5" />
                          <span className="text-sm text-gray-600">
                            {booking.description
                              ? booking.description.length > 100
                                ? `${booking.description.substring(0, 100)}...`
                                : booking.description
                              : 'No description provided.'}
                          </span>
                        </div>
                      </div>

                      <div>
                        {booking.provider && (
                          <div className="bg-blue-50 p-3 rounded-lg">
                            <p className="text-sm font-medium text-gray-900">Service Provider</p>
                            <p className="text-sm text-blue-700">{booking.provider.name || '—'}</p>
                            
                          </div>
                        )}

                        {booking.quotation && (
                          <div className="bg-green-50 p-3 rounded-lg mt-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-900">Quotation</span>
                              <span className="text-lg font-bold text-green-700">${booking.quotation.amount}</span>
                            </div>
                            {booking.status === 'quotation_sent' && (
                              <button
                                onClick={() => handleAcceptQuotation(booking._id)}
                                className="mt-2 w-full btn-success text-sm"
                              >
                                Accept & Pay
                              </button>
                            )}
                          </div>
                        )}

                        {booking.invoice && (
                          <div className="bg-purple-50 p-3 rounded-lg mt-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-900">Invoice</span>
                              <span className="text-lg font-bold text-purple-700">${booking.invoice.total}</span>
                            </div>
                            <p className="text-xs text-purple-600">{booking.invoice.invoiceNumber}</p>
                          </div>
                        )}

                        {booking.status === 'completed' && !booking.review && (
                          <div className="bg-yellow-50 p-3 rounded-lg mt-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-900">Rate this service</span>
                              <button
                                onClick={() => setReviewBooking(booking)}
                                className="text-sm bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded-lg transition-colors"
                              >
                                <Star className="w-4 h-4 inline mr-1" />
                                Write Review
                              </button>
                            </div>
                          </div>
                        )}

                        {booking.review && (
                          <div className="bg-green-50 p-3 rounded-lg mt-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-sm font-medium text-gray-900">Your Review</span>
                                <div className="flex items-center mt-1">
                                  {[...Array(5)].map((_, index) => (
                                    <Star
                                      key={index}
                                      className={`w-4 h-4 ${
                                        index < (booking.review.rating || 0) ? 'text-yellow-400 fill-current' : 'text-gray-300'
                                      }`}
                                    />
                                  ))}
                                  <span className="ml-2 text-sm text-gray-600">
                                    {booking.review.reviewedAt ? moment(booking.review.reviewedAt).format('MMM DD, YYYY') : ''}
                                  </span>
                                </div>
                                {booking.review.comment && <p className="text-sm text-gray-700 mt-1">{booking.review.comment}</p>}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-3">Order Timeline</h4>
                      <div className="space-y-2">
                        {Array.isArray(booking.timeline) && booking.timeline.length > 0 ? (
                          booking.timeline.slice(-3).reverse().map((event, index) => (
                            <div key={index} className="flex items-center text-sm">
                              <div className="w-2 h-2 bg-primary-500 rounded-full mr-3" />
                              <div className="flex-1 flex justify-between">
                                <span className="capitalize font-medium">{(event.status || '').replace('_', ' ')}</span>
                                <span className="text-gray-500">{event.timestamp ? moment(event.timestamp).format('MMM DD, HH:mm') : ''}</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-gray-500">No timeline available</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="lg:ml-6 mt-4 lg:mt-0 flex lg:flex-col space-x-3 lg:space-x-0 lg:space-y-3">
                    <button
                      onClick={() => setSelectedBooking(booking)}
                      className="btn-primary flex items-center justify-center min-w-[120px]"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </button>

                    {booking.files && booking.files.length > 0 && (
                      <div className="text-center lg:mt-2">
                        <p className="text-xs text-gray-500">{booking.files.length} file(s) attached</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Orders Found</h3>
              <p className="text-gray-600 mb-6">
                {searchTerm || statusFilter !== 'all'
                  ? 'Try adjusting your search or filter criteria'
                  : "You haven't placed any service orders yet"}
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <button onClick={() => (window.location.href = '/book-service')} className="btn-primary">
                  Book Your First Service
                </button>
              )}
            </div>
          )}
        </div>

        {selectedBooking && (
          <BookingModal
            booking={selectedBooking}
            isOpen={!!selectedBooking}
            onClose={() => setSelectedBooking(null)}
            onUpdate={fetchOrders}
            userRole="customer"
          />
        )}

        {reviewBooking && (
          <ReviewModal
            booking={reviewBooking}
            isOpen={!!reviewBooking}
            onClose={() => setReviewBooking(null)}
            onReviewSubmitted={handleReviewSubmitted}
          />
        )}
      </div>
    </Layout>
  );
};

export default MyOrders;
