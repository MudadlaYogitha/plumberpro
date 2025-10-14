import React, { useState, useEffect } from 'react';
import ProviderLayout from '../components/ProviderLayout';
import BookingModal from '../components/BookingModal';
import api from '../utils/api';
import { toast } from 'react-hot-toast';
import moment from 'moment';
import { Bell, Calendar, MapPin, Eye, Clock, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ServiceRequests = () => {
  const { user } = useAuth();
  const [pendingRequests, setPendingRequests] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait for user from AuthContext before fetching to avoid "user is not defined"
    const run = async () => {
      // If no user (not logged in) just stop loading and show empty state
      if (!user) {
        setPendingRequests([]);
        setLoading(false);
        return;
      }
      await fetchServiceRequests();
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchServiceRequests = async () => {
    setLoading(true);
    try {
      const response = await api.get('/bookings');
      const bookings = response.data || [];

      // Filter pending requests (unassigned bookings)
      const pending = bookings.filter(b => b.status === 'pending' && !b.provider);
      setPendingRequests(pending);
    } catch (error) {
      console.error('Error fetching service requests:', error);
      toast.error('Failed to fetch service requests');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ProviderLayout title="Service Requests">
        <div className="flex items-center justify-center h-64">
          <div className="spinner w-8 h-8"></div>
        </div>
      </ProviderLayout>
    );
  }

  return (
    <ProviderLayout title="Service Requests">
      <div className="px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Service Requests</h2>
              <p className="text-gray-600 mt-1">New service requests waiting for your response</p>
            </div>
            <div className="bg-warning-100 text-warning-800 px-3 py-1 rounded-full text-sm font-medium">
              {pendingRequests.length} pending
            </div>
          </div>
        </div>

        {/* Service Requests */}
        <div className="space-y-6">
          {pendingRequests.length > 0 ? (
            pendingRequests.map((booking) => (
              <div key={booking._id} className="card border-l-4 border-warning-400 hover:shadow-lg transition-shadow">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex-1">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                          <Bell className="w-5 h-5 mr-2 text-warning-600" />
                          {booking.serviceType}
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
                      <span className="bg-warning-100 text-warning-800 px-2 py-1 rounded-full text-xs font-medium">
                        New Request
                      </span>
                    </div>

                    {/* Service Details */}
                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <div className="flex items-start mb-3">
                          <MapPin className="w-4 h-4 mr-2 text-gray-400 mt-0.5" />
                          <span className="text-sm text-gray-600">{booking.address || '—'}</span>
                        </div>
                        <div className="flex items-start">
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
                        {booking.files && booking.files.length > 0 && (
                          <div className="bg-blue-50 p-3 rounded-lg">
                            <p className="text-sm font-medium text-gray-900 mb-2">Attachments</p>
                            <div className="grid grid-cols-3 gap-2">
                              {booking.files.slice(0, 3).map((file, index) => (
                                <div key={index} className="relative">
                                  {file.type === 'image' ? (
                                    <img
                                      src={file.url}
                                      alt={file.originalName || `file-${index}`}
                                      className="w-full h-16 object-cover rounded cursor-pointer hover:opacity-80"
                                      onClick={() => window.open(file.url, '_blank')}
                                    />
                                  ) : (
                                    <div className="w-full h-16 bg-gray-200 rounded flex items-center justify-center">
                                      <FileText className="w-6 h-6 text-gray-500" />
                                    </div>
                                  )}
                                </div>
                              ))}
                              {booking.files.length > 3 && (
                                <div className="w-full h-16 bg-gray-100 rounded flex items-center justify-center">
                                  <span className="text-xs text-gray-500">+{booking.files.length - 3}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Request Info */}
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Request ID: #{booking._id.slice(-6)}</span>
                        <span className="text-gray-600">
                          Requested {booking.createdAt ? moment(booking.createdAt).fromNow() : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="lg:ml-6 mt-4 lg:mt-0">
                    <button
                      onClick={() => setSelectedBooking(booking)}
                      className="w-full lg:w-auto btn-primary flex items-center justify-center"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View & Accept
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <Bell className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Service Requests</h3>
              <p className="text-gray-600">
                There are no pending service requests at the moment. Check back later for new opportunities.
              </p>
            </div>
          )}
        </div>

        {/* Booking Details Modal */}
        {selectedBooking && (
          <BookingModal
            booking={selectedBooking}
            isOpen={!!selectedBooking}
            onClose={() => setSelectedBooking(null)}
            onUpdate={fetchServiceRequests}
            userRole="provider"
          />
        )}
      </div>
    </ProviderLayout>
  );
};

export default ServiceRequests;
