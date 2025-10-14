import React, { useState, useEffect } from 'react';
import ProviderLayout from '../components/ProviderLayout';
import api from '../utils/api';
import { toast } from 'react-hot-toast';
import moment from 'moment';
import { DollarSign, TrendingUp, Calendar, Receipt } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ProviderEarnings = () => {
  const { user } = useAuth();
  const [earnings, setEarnings] = useState({
    totalEarnings: 0,
    thisMonth: 0,
    lastMonth: 0,
    completedJobs: 0
  });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchEarnings();
  }, [user]);

  const fetchEarnings = async () => {
    setLoading(true);
    try {
      const response = await api.get('/bookings');
      const bookings = response.data || [];

      // Provider's completed bookings with payments
      const completedBookings = bookings.filter(b =>
        (b.provider && (typeof b.provider === 'string' ? b.provider === user.id : b.provider._id === user.id))
        && b.status === 'completed' && b.payment && b.payment.status === 'completed'
      );

      const totalEarnings = completedBookings.reduce((sum, booking) => sum + (booking.payment?.amount || 0), 0);

      const currentMonth = moment().month();
      const currentYear = moment().year();
      const lastMonth = moment().subtract(1, 'month').month();
      const lastMonthYear = moment().subtract(1, 'month').year();

      const thisMonthEarnings = completedBookings
        .filter(b => moment(b.completedAt).month() === currentMonth && moment(b.completedAt).year() === currentYear)
        .reduce((sum, booking) => sum + (booking.payment?.amount || 0), 0);

      const lastMonthEarnings = completedBookings
        .filter(b => moment(b.completedAt).month() === lastMonth && moment(b.completedAt).year() === lastMonthYear)
        .reduce((sum, booking) => sum + (booking.payment?.amount || 0), 0);

      setEarnings({
        totalEarnings,
        thisMonth: thisMonthEarnings,
        lastMonth: lastMonthEarnings,
        completedJobs: completedBookings.length
      });

      setTransactions(completedBookings.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)));
    } catch (error) {
      console.error('Error fetching earnings:', error);
      toast.error('Failed to fetch earnings data');
    } finally {
      setLoading(false);
    }
  };

  const getGrowthPercentage = () => {
    if (earnings.lastMonth === 0) return earnings.thisMonth > 0 ? 100 : 0;
    return Math.round(((earnings.thisMonth - earnings.lastMonth) / earnings.lastMonth) * 100);
  };

  if (loading) {
    return (
      <ProviderLayout title="Earnings">
        <div className="flex items-center justify-center h-64">
          <div className="spinner w-8 h-8"></div>
        </div>
      </ProviderLayout>
    );
  }

  return (
    <ProviderLayout title="Earnings">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Earnings Overview</h2>
          <p className="text-gray-600">Track your income and financial performance</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Earnings</p>
                <p className="text-2xl font-semibold text-gray-900">${earnings.totalEarnings}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">This Month</p>
                <p className="text-2xl font-semibold text-gray-900">${earnings.thisMonth}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Growth</p>
                <div className="flex items-center">
                  <p className="text-2xl font-semibold text-gray-900">{getGrowthPercentage()}%</p>
                  <span className={`ml-2 text-sm ${getGrowthPercentage() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    vs last month
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Receipt className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Completed Jobs</p>
                <p className="text-2xl font-semibold text-gray-900">{earnings.completedJobs}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Comparison</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700">This Month</p>
                  <p className="text-2xl font-bold text-blue-900">${earnings.thisMonth}</p>
                </div>
                <Calendar className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700">Last Month</p>
                  <p className="text-2xl font-bold text-gray-900">${earnings.lastMonth}</p>
                </div>
                <Calendar className="w-8 h-8 text-gray-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Transaction History</h3>
            <span className="text-sm text-gray-600">{transactions.length} completed jobs</span>
          </div>

          <div className="space-y-4">
            {transactions.length > 0 ? (
              transactions.map((transaction) => (
                <div key={transaction._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-4">
                      <DollarSign className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{transaction.serviceType}</h4>
                      <div className="flex items-center text-sm text-gray-600 space-x-4">
                        <span>Invoice: {transaction.invoice?.invoiceNumber}</span>
                        <span>•</span>
                        <span>{moment(transaction.completedAt).format('MMM DD, YYYY')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-green-600">
                      +${transaction.payment?.amount || 0}
                    </p>
                    <p className="text-sm text-gray-500 capitalize">
                      {transaction.payment?.method || '—'}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No transactions yet</p>
                <p className="text-sm text-gray-400">Complete services to start earning</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProviderLayout>
  );
};

export default ProviderEarnings;
