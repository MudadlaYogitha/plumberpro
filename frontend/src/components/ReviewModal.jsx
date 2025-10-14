import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import { X, Star } from 'lucide-react';
import api from '../utils/api'; // use central axios instance
import { toast } from 'react-hot-toast';

Modal.setAppElement('#root');

const ReviewModal = ({ booking, isOpen, onClose, onReviewSubmitted }) => {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  // Prefill when opening for editing an existing review
  useEffect(() => {
    if (isOpen && booking) {
      if (booking.review) {
        setRating(Number(booking.review.rating) || 0);
        setComment(booking.review.comment || '');
      } else {
        setRating(0);
        setComment('');
      }
    }
  }, [isOpen, booking]);

  const handleSubmitReview = async () => {
    if (!booking || !booking._id) {
      toast.error('Booking not found. Cannot submit review.');
      return;
    }
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    setLoading(true);
    try {
      const payload = { rating: Number(rating), comment: comment.trim() };
      // uses central api -> baseURL taken from .env (VITE_API_URL / VITE_BASE_URL)
      await api.put(`/bookings/${booking._id}/review`, payload);

      toast.success('Review submitted successfully!');
      if (typeof onReviewSubmitted === 'function') onReviewSubmitted();
      onClose();

      // reset local state only after success
      setRating(0);
      setComment('');
    } catch (error) {
      console.error('Review submit error:', error);
      const msg = error?.response?.data?.message || 'Failed to submit review';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = () => {
    return [1, 2, 3, 4, 5].map((starValue) => (
      <button
        key={starValue}
        type="button"
        onClick={() => setRating(starValue)}
        onMouseEnter={() => setHoveredRating(starValue)}
        onMouseLeave={() => setHoveredRating(0)}
        className="focus:outline-none"
        aria-label={`Rate ${starValue} star${starValue > 1 ? 's' : ''}`}
      >
        <Star
          className={`w-8 h-8 transition-colors ${
            starValue <= (hoveredRating || rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'
          }`}
        />
      </button>
    ));
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={() => {
        if (!loading) onClose();
      }}
      className="max-w-md mx-auto mt-20 bg-white rounded-xl shadow-xl"
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50"
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Rate Your Service</h2>
          <button
            onClick={() => !loading && onClose()}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close review modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Service Info */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-900">{booking?.serviceType || 'Service'}</h3>
          <p className="text-sm text-gray-600">
            {booking?.provider?.name || 'Provider'} •{' '}
            {booking?.date ? new Date(booking.date).toLocaleDateString() : '—'}
          </p>
        </div>

        {/* Rating */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            How would you rate this service?
          </label>
          <div className="flex items-center space-x-1">{renderStars()}</div>
          {rating > 0 && (
            <p className="text-sm text-gray-600 mt-2">
              {rating === 1 && 'Poor'}
              {rating === 2 && 'Fair'}
              {rating === 3 && 'Good'}
              {rating === 4 && 'Very Good'}
              {rating === 5 && 'Excellent'}
            </p>
          )}
        </div>

        {/* Comment */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Share your experience (optional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows="4"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Tell others about your experience..."
            disabled={loading}
          />
        </div>

        {/* Actions */}
        <div className="flex space-x-3">
          <button
            onClick={() => !loading && onClose()}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmitReview}
            disabled={loading || rating === 0}
            className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ReviewModal;
