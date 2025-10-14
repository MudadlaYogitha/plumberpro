import React, { useState, useEffect } from 'react';
import ProviderLayout from '../components/ProviderLayout';
import api from '../utils/api';
import { toast } from 'react-hot-toast';
import moment from 'moment';
import { Star, MessageCircle, Calendar, Wrench, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ProviderReviews = () => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({
    averageRating: 0,
    totalReviews: 0,
    ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchReviews();
  }, [user]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/bookings/provider/${user.id}/reviews`);
      const data = response.data || { reviews: [], averageRating: 0, totalReviews: 0 };
      setReviews(data.reviews || []);

      const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      (data.reviews || []).forEach(review => {
        distribution[review.rating] = (distribution[review.rating] || 0) + 1;
      });

      setStats({
        averageRating: data.averageRating || 0,
        totalReviews: data.totalReviews || 0,
        ratingDistribution: distribution
      });
    } catch (error) {
      console.error('Error fetching reviews:', error);
      toast.error('Failed to fetch reviews');
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating) => {
    return [...Array(5)].map((_, index) => (
      <Star
        key={index}
        className={`w-4 h-4 ${
          index < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
        }`}
      />
    ));
  };

  const getRatingPercentage = (rating) => {
    return stats.totalReviews > 0 ? (stats.ratingDistribution[rating] / stats.totalReviews) * 100 : 0;
  };

  if (loading) {
    return (
      <ProviderLayout title="Reviews">
        <div className="flex items-center justify-center h-64">
          <div className="spinner w-8 h-8"></div>
        </div>
      </ProviderLayout>
    );
  }

  return (
    <ProviderLayout title="Reviews">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Customer Reviews</h2>
          <p className="text-gray-600">See what customers are saying about your services</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <div className="card">
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-900 mb-2">{stats.averageRating}</div>
              <div className="flex items-center justify-center mb-2">
                {renderStars(Math.round(stats.averageRating))}
              </div>
              <p className="text-gray-600">{stats.totalReviews} total reviews</p>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Rating Distribution</h3>
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((rating) => (
                <div key={rating} className="flex items-center">
                  <span className="text-sm text-gray-600 w-8">{rating}</span>
                  <Star className="w-4 h-4 text-yellow-400 fill-current mr-2" />
                  <div className="flex-1 bg-gray-200 rounded-full h-2 mr-3">
                    <div
                      className="bg-yellow-400 h-2 rounded-full"
                      style={{ width: `${getRatingPercentage(rating)}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 w-8">
                    {stats.ratingDistribution[rating]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {reviews.length > 0 ? (
            reviews.map((review) => (
              <div key={review.id} className="card">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center mr-3">
                      <span className="text-primary-600 font-medium">
                        {review.customerName?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{review.customerName}</h4>
                      <div className="flex items-center mt-1">
                        {renderStars(review.rating)}
                        <span className="ml-2 text-sm text-gray-600">
                          {moment(review.reviewedAt).format('MMM DD, YYYY')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center text-sm text-gray-600">
                      <Wrench className="w-4 h-4 mr-1" />
                      {review.serviceType}
                    </div>
                    <div className="flex items-center text-sm text-gray-500 mt-1">
                      <Calendar className="w-4 h-4 mr-1" />
                      {moment(review.date).format('MMM DD, YYYY')}
                    </div>
                  </div>
                </div>

                {review.comment && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-start">
                      <MessageCircle className="w-4 h-4 text-gray-400 mr-2 mt-0.5" />
                      <p className="text-gray-700">{review.comment}</p>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <Star className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Reviews Yet</h3>
              <p className="text-gray-600">
                Complete more services to start receiving customer reviews and feedback.
              </p>
            </div>
          )}
        </div>
      </div>
    </ProviderLayout>
  );
};

export default ProviderReviews;
