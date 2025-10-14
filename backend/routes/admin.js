const express = require('express');
const Booking = require('../models/Booking');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Middleware to check admin role
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Get dashboard stats
router.get('/dashboard', auth, adminOnly, async (req, res) => {
  try {
    const totalCustomers = await User.countDocuments({ role: 'customer' });
    const totalProviders = await User.countDocuments({ role: 'provider' });
    const totalBookings = await Booking.countDocuments();
    const pendingBookings = await Booking.countDocuments({ status: 'pending' });
    const completedBookings = await Booking.countDocuments({ status: 'completed' });
    
    // Revenue calculation
    const completedBookingsWithPayment = await Booking.find({ 
      status: 'completed',
      'payment.status': 'completed' 
    });
    
    const totalRevenue = completedBookingsWithPayment.reduce((sum, booking) => {
      return sum + (booking.payment.amount || 0);
    }, 0);

    // Recent bookings
    const recentBookings = await Booking.find()
      .populate('customer', 'name email phone')
      .populate('provider', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      stats: {
        totalCustomers,
        totalProviders,
        totalBookings,
        pendingBookings,
        completedBookings,
        totalRevenue
      },
      recentBookings
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all users
router.get('/users', auth, adminOnly, async (req, res) => {
  try {
    const { role } = req.query;
    let filter = {};
    
    if (role && role !== 'all') {
      filter.role = role;
    }

    const users = await User.find(filter).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all bookings
router.get('/bookings', auth, adminOnly, async (req, res) => {
  try {
    const { status } = req.query;
    let filter = {};
    
    if (status && status !== 'all') {
      filter.status = status;
    }

    const bookings = await Booking.find(filter)
      .populate('customer', 'name email phone')
      .populate('provider', 'name email phone')
      .populate('timeline.updatedBy', 'name')
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update user status
router.put('/users/:id/status', auth, adminOnly, async (req, res) => {
  try {
    const { isApproved } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isApproved },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: `User ${isApproved ? 'approved' : 'suspended'} successfully`,
      user
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete user
router.delete('/users/:id', auth, adminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Also delete all bookings related to this user
    await Booking.deleteMany({
      $or: [
        { customer: req.params.id },
        { provider: req.params.id }
      ]
    });

    res.json({ message: 'User and related bookings deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;