import React, { useState } from 'react';
import Modal from 'react-modal';
import { X, Calendar, MapPin, User, Phone, Mail, FileText, Clock, DollarSign } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import moment from 'moment';

Modal.setAppElement('#root');

const BookingModal = ({ booking, isOpen, onClose, onUpdate, userRole }) => {
  const [quotationAmount, setQuotationAmount] = useState('');
  const [quotationDescription, setQuotationDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(false);

  const getStatusColor = (status) => {
    const colors = {
      pending: 'status-pending',
      accepted: 'status-accepted',
      quotation_sent: 'status-quotation-sent',
      quotation_accepted: 'status-quotation-accepted',
      payment_completed: 'status-payment-completed',
      completed: 'status-completed',
      cancelled: 'status-cancelled'
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

  const handleAcceptBooking = async () => {
    setLoading(true);
    try {
      await axios.put(`${import.meta.env.VITE_API_URL}/bookings/${booking._id}/accept`);
      toast.success('Booking accepted successfully!');
      onUpdate();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to accept booking');
    } finally {
      setLoading(false);
    }
  };

  const handleSendQuotation = async () => {
    if (!quotationAmount || !quotationDescription) {
      toast.error('Please fill in all quotation details');
      return;
    }

    setLoading(true);
    try {
      await axios.put(`${import.meta.env.VITE_API_URL}/bookings/${booking._id}/quotation`, {
        amount: parseFloat(quotationAmount),
        description: quotationDescription
      });
      toast.success('Quotation sent successfully!');
      setQuotationAmount('');
      setQuotationDescription('');
      onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send quotation');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptQuotation = async () => {
    setLoading(true);
    try {
      await axios.put(`${import.meta.env.VITE_API_URL}/bookings/${booking._id}/accept-quotation`, {
        paymentMethod,
        transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      });
      toast.success('Quotation accepted and payment completed!');
      onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to accept quotation');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteService = async () => {
    setLoading(true);
    try {
      await axios.put(`${import.meta.env.VITE_API_URL}/bookings/${booking._id}/complete`);
      toast.success('Service completed and invoice generated!');
      onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to complete service');
    } finally {
      setLoading(false);
    }
  };

  const canAcceptBooking = userRole === 'provider' && booking.status === 'pending';
  const canSendQuotation = userRole === 'provider' && booking.status === 'accepted';
  const canAcceptQuotation = userRole === 'customer' && booking.status === 'quotation_sent';
  const canCompleteService = userRole === 'provider' && booking.status === 'payment_completed';

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      className="max-w-4xl mx-auto mt-8 bg-white rounded-xl shadow-xl"
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-y-auto"
    >
      <div className="relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Booking Details</h2>
            <span className={`status-badge ${getStatusColor(booking.status)} mt-2`}>
              {getStatusText(booking.status)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Customer Information */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Customer Information</h3>
              <div className="space-y-3">
                
                <div className="flex items-start">
                  <MapPin className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
                  <span>{booking.address}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Service Details</h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <FileText className="w-5 h-5 text-gray-400 mr-3" />
                  <span className="font-medium">{booking.serviceType}</span>
                </div>
                <div className="flex items-start">
                  <Calendar className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
                  <div>
                    <div>{moment(booking.date).format('MMMM DD, YYYY')}</div>
                    <div className="text-sm text-gray-500">
                      {booking.timeSlot.start} - {booking.timeSlot.end}
                    </div>
                  </div>
                </div>
                <div className="flex items-start">
                  <FileText className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
                  <span>{booking.description}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Service Provider Info */}
          {booking.provider && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">Service Provider</h4>
              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <User className="w-4 h-4 text-gray-500 mr-2" />
                  <span>{booking.provider.name}</span>
                </div>
                
              </div>
            </div>
          )}

          {/* Photos and Videos */}
          {booking.files && booking.files.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Uploaded Files</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {booking.files.map((file, index) => (
                  <div key={index} className="border rounded-lg overflow-hidden">
                    {file.type === 'image' ? (
                      <img
                        src={file.url}
                        alt={file.originalName}
                        className="w-full h-32 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => window.open(file.url, '_blank')}
                      />
                    ) : (
                      <video
                        src={file.url}
                        controls
                        className="w-full h-32 object-cover"
                      />
                    )}
                    <div className="p-2 text-xs text-gray-500 truncate">
                      {file.originalName}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quotation Section */}
          {booking.quotation && (
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                <DollarSign className="w-5 h-5 mr-2" />
                Quotation
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Amount:</span>
                  <span className="font-semibold">${booking.quotation.amount}</span>
                </div>
                <div>
                  <span className="font-medium">Description:</span>
                  <p className="text-sm text-gray-600 mt-1">{booking.quotation.description}</p>
                </div>
                <div className="text-xs text-gray-500">
                  Generated on {moment(booking.quotation.generatedAt).format('MMM DD, YYYY HH:mm')}
                </div>
                {booking.quotation.acceptedAt && (
                  <div className="text-xs text-green-600">
                    Accepted on {moment(booking.quotation.acceptedAt).format('MMM DD, YYYY HH:mm')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payment Information */}
          {booking.payment && booking.payment.status === 'completed' && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-3">Payment Information</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Amount Paid:</span>
                  <span className="font-semibold">${booking.payment.amount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment Method:</span>
                  <span className="capitalize">{booking.payment.method}</span>
                </div>
                <div className="flex justify-between">
                  <span>Transaction ID:</span>
                  <span className="font-mono text-xs">{booking.payment.transactionId}</span>
                </div>
                <div className="flex justify-between">
                  <span>Paid At:</span>
                  <span>{moment(booking.payment.paidAt).format('MMM DD, YYYY HH:mm')}</span>
                </div>
              </div>
            </div>
          )}

          {/* Invoice */}
          {booking.invoice && (
            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-3">Invoice</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Invoice Number:</span>
                  <span className="font-mono">{booking.invoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Service Amount:</span>
                  <span>${booking.invoice.amount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax (10%):</span>
                  <span>${booking.invoice.tax}</span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-2">
                  <span>Total:</span>
                  <span>${booking.invoice.total}</span>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Generated on {moment(booking.invoice.generatedAt).format('MMM DD, YYYY HH:mm')}
                </div>
              </div>
            </div>
          )}

          {/* Timeline */}
          {booking.timeline && booking.timeline.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Timeline</h3>
              <div className="space-y-3">
                {booking.timeline.map((event, index) => (
                  <div key={index} className="timeline-item">
                    <div className="flex items-center justify-between">
                      <span className="font-medium capitalize">{event.status.replace('_', ' ')}</span>
                      <span className="text-sm text-gray-500">
                        {moment(event.timestamp).format('MMM DD, HH:mm')}
                      </span>
                    </div>
                    {event.note && (
                      <p className="text-sm text-gray-600 mt-1">{event.note}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="border-t pt-6">
            {canAcceptBooking && (
              <button
                onClick={handleAcceptBooking}
                disabled={loading}
                className="btn-success mr-3"
              >
                {loading ? <span className="spinner mr-2"></span> : null}
                Accept Booking
              </button>
            )}

            {canSendQuotation && (
              <div className="space-y-4 bg-purple-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900">Generate Quotation</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Amount ($)
                    </label>
                    <input
                      type="number"
                      value={quotationAmount}
                      onChange={(e) => setQuotationAmount(e.target.value)}
                      className="input-field"
                      placeholder="Enter amount"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={quotationDescription}
                      onChange={(e) => setQuotationDescription(e.target.value)}
                      className="input-field"
                      rows="3"
                      placeholder="Describe the work and charges"
                    />
                  </div>
                </div>
                <button
                  onClick={handleSendQuotation}
                  disabled={loading}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  {loading ? <span className="spinner mr-2"></span> : null}
                  Send Quotation
                </button>
              </div>
            )}

            {canAcceptQuotation && (
              <div className="space-y-4 bg-green-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900">Accept Quotation & Make Payment</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="input-field"
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Credit/Debit Card</option>
                    <option value="online">Online Transfer</option>
                    <option value="check">Check</option>
                  </select>
                </div>
                <div className="flex items-center justify-between p-3 bg-white rounded border">
                  <span className="font-medium">Total Amount:</span>
                  <span className="text-xl font-bold text-green-600">
                    ${booking.quotation.amount}
                  </span>
                </div>
                <button
                  onClick={handleAcceptQuotation}
                  disabled={loading}
                  className="btn-success"
                >
                  {loading ? <span className="spinner mr-2"></span> : null}
                  Accept & Pay ${booking.quotation.amount}
                </button>
              </div>
            )}

            {canCompleteService && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-3">Complete Service</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Mark this service as completed and generate the final invoice.
                </p>
                <button
                  onClick={handleCompleteService}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  {loading ? <span className="spinner mr-2"></span> : null}
                  Complete Service & Generate Invoice
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default BookingModal;