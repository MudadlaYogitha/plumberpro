const express = require('express');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Notification = require('../models/Notification');
const axios = require('axios');
const auth = require('../middleware/auth');
const moment = require('moment');

const router = express.Router();

// Helper function to send booking notification
const sendBookingNotification = async (booking, status, userId = null) => {
  try {
    // Populate booking data if needed
    const populatedBooking = await Booking.findById(booking._id)
      .populate('customer', 'name phone email')
      .populate('provider', 'name phone email');

    if (!populatedBooking) return;

    const phone = populatedBooking.customer?.phone || populatedBooking.customerPhone;
    const providerName = populatedBooking.provider?.name || 'our certified plumber';
    
    if (!phone) return;

    // Send notification via webhook
    const notificationData = {
      bookingId: populatedBooking._id,
      status,
      phone,
      providerName
    };

    try {
      await axios.post(`${process.env.BACKEND_URL || 'http://localhost:5000'}/api/sms/booking-notification`, notificationData);
    } catch (webhookError) {
      console.error('Failed to send booking notification:', webhookError.message);
    }

    // Create notification record
    const notification = new Notification({
      bookingId: populatedBooking._id,
      userId: userId || populatedBooking.customer,
      type: `booking_${status}`,
      title: `Booking ${status.replace('_', ' ')}`,
      message: `Your ${populatedBooking.serviceType} service is now ${status.replace('_', ' ')}.`,
      phone,
      status: 'sent'
    });
    await notification.save();

  } catch (error) {
    console.error('Error sending booking notification:', error);
  }
};

// Create booking
router.post('/', auth, async (req, res) => {
  try {
    const { 
      customerName, 
      customerEmail, 
      customerPhone, 
      address, 
      serviceType, 
      description, 
      date, 
      timeSlot,
      files 
    } = req.body;

    const booking = new Booking({
      customer: req.user.userId,
      customerName,
      customerEmail,
      customerPhone,
      address,
      serviceType,
      description,
      date: new Date(date),
      timeSlot,
      files: files || [],
      timeline: [{
        status: 'pending',
        timestamp: new Date(),
        note: 'Booking created',
        updatedBy: req.user.userId
      }]
    });

    await booking.save();

    res.status(201).json({
      message: 'Booking created successfully',
      booking
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create booking from SMS (no auth required)
router.post('/sms-booking', async (req, res) => {
  try {
    const { 
      phone, 
      sessionId,
      customerName, 
      customerEmail, 
      customerPhone, 
      address, 
      serviceType, 
      description, 
      date, 
      timeSlot,
      files 
    } = req.body;

    if (!phone || !sessionId) {
      return res.status(400).json({ message: 'Phone and session ID are required' });
    }

    // Find or create user
    let user = await User.findOne({ phone: customerPhone || phone });
    if (!user) {
      user = new User({
        name: customerName || 'SMS User',
        email: customerEmail || `sms_${Date.now()}@plumbpro.com`,
        phone: customerPhone || phone,
        password: 'temp123', // They can set a proper password later
        role: 'customer',
        address: address
      });
      await user.save();
    }

    const booking = new Booking({
      customer: user._id,
      customerName: customerName || user.name,
      customerEmail: customerEmail || user.email,
      customerPhone: customerPhone || phone,
      address,
      serviceType,
      description,
      date: new Date(date),
      timeSlot,
      files: files || [],
      timeline: [{
        status: 'pending',
        timestamp: new Date(),
        note: 'Booking created via SMS',
        updatedBy: user._id
      }],
      notes: `Created via SMS session: ${sessionId}`
    });

    await booking.save();

    res.status(201).json({
      message: 'Booking created successfully',
      booking,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      },
      loginInfo: {
        message: 'You can login to track your booking at: ' + (process.env.FRONTEND_URL || 'http://localhost:5173') + '/login',
        credentials: 'Use your phone number as username'
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get bookings
router.get('/', auth, async (req, res) => {
  try {
    let filter = {};
    
    if (req.user.role === 'customer') {
      filter.customer = req.user.userId;
    } else if (req.user.role === 'provider') {
      filter.$or = [
        { provider: req.user.userId },
        { provider: null, status: 'pending' }
      ];
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

// Get booking by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('provider', 'name email phone')
      .populate('timeline.updatedBy', 'name');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Accept booking (Provider)
router.put('/:id/accept', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    booking.provider = req.user.userId;
    booking.status = 'accepted';
    
    await booking.save();

    // Send notification to customer
    await sendBookingNotification(booking, 'accepted', booking.customer);

    const populatedBooking = await Booking.findById(booking._id)
      .populate('customer', 'name email phone')
      .populate('provider', 'name email phone')
      .populate('timeline.updatedBy', 'name');

    res.json({
      message: 'Booking accepted successfully',
      booking: populatedBooking
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Generate quotation
router.put('/:id/quotation', auth, async (req, res) => {
  try {
    const { amount, description } = req.body;
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.provider.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    booking.quotation = {
      amount,
      description,
      generatedAt: new Date()
    };
    booking.status = 'quotation_sent';
    
    await booking.save();

    // Send notification to customer
    await sendBookingNotification(booking, 'quotation_sent', booking.customer);

    const populatedBooking = await Booking.findById(booking._id)
      .populate('customer', 'name email phone')
      .populate('provider', 'name email phone')
      .populate('timeline.updatedBy', 'name');

    res.json({
      message: 'Quotation sent successfully',
      booking: populatedBooking
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Accept quotation (Customer)
router.put('/:id/accept-quotation', auth, async (req, res) => {
  try {
    const { paymentMethod, transactionId } = req.body;
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.customer.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    booking.quotation.acceptedAt = new Date();
    booking.quotation.acceptedBy = req.user.userId;
    booking.payment = {
      amount: booking.quotation.amount,
      method: paymentMethod,
      transactionId: transactionId || `TXN_${Date.now()}`,
      paidAt: new Date(),
      status: 'completed'
    };
    booking.status = 'payment_completed';
    
    await booking.save();

    // Send notification to customer
    await sendBookingNotification(booking, 'payment_completed', booking.customer);

    const populatedBooking = await Booking.findById(booking._id)
      .populate('customer', 'name email phone')
      .populate('provider', 'name email phone')
      .populate('timeline.updatedBy', 'name');

    res.json({
      message: 'Quotation accepted and payment completed',
      booking: populatedBooking
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Mark as completed and generate invoice
router.put('/:id/complete', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.provider.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Generate invoice
    const invoiceNumber = `INV-${Date.now()}-${booking._id.toString().slice(-4)}`;
    const tax = booking.payment.amount * 0.1; // 10% tax
    const total = booking.payment.amount + tax;

    booking.status = 'completed';
    booking.completedAt = new Date();
    booking.invoice = {
      invoiceNumber,
      generatedAt: new Date(),
      amount: booking.payment.amount,
      items: [{
        description: `${booking.serviceType} - ${booking.description}`,
        amount: booking.payment.amount
      }],
      tax,
      total
    };
    
    await booking.save();

    // Send notification to customer
    await sendBookingNotification(booking, 'completed', booking.customer);

    const populatedBooking = await Booking.findById(booking._id)
      .populate('customer', 'name email phone')
      .populate('provider', 'name email phone')
      .populate('timeline.updatedBy', 'name');

    res.json({
      message: 'Service completed and invoice generated',
      booking: populatedBooking
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get customer orders
router.get('/customer/orders', auth, async (req, res) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const bookings = await Booking.find({ customer: req.user.userId })
      .populate('provider', 'name email phone')
      .populate('timeline.updatedBy', 'name')
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get provider calendar events
router.get('/provider/calendar', auth, async (req, res) => {
  try {
    if (req.user.role !== 'provider') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const bookings = await Booking.find({ 
      provider: req.user.userId,
      status: { $in: ['accepted', 'quotation_sent', 'quotation_accepted', 'payment_completed', 'in_progress', 'completed'] }
    }).populate('customer', 'name email phone');

    const events = bookings.map(booking => ({
      id: booking._id,
      title: `${booking.serviceType} - ${booking.customerName}`,
      start: new Date(`${booking.date.toISOString().split('T')[0]}T${booking.timeSlot.start}`),
      end: new Date(`${booking.date.toISOString().split('T')[0]}T${booking.timeSlot.end}`),
      color: booking.status === 'completed' ? '#10b981' : 
             booking.status === 'payment_completed' ? '#3b82f6' : '#f59e0b',
      booking
    }));

    res.json(events);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get customer calendar events
router.get('/customer/calendar', auth, async (req, res) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const bookings = await Booking.find({ customer: req.user.userId })
      .populate('provider', 'name email phone');

    const events = bookings.map(booking => ({
      id: booking._id,
      title: `${booking.serviceType} ${booking.provider ? `- ${booking.provider.name}` : ''}`,
      start: new Date(`${booking.date.toISOString().split('T')[0]}T${booking.timeSlot.start}`),
      end: new Date(`${booking.date.toISOString().split('T')[0]}T${booking.timeSlot.end}`),
      color: booking.status === 'pending' ? '#f59e0b' : 
             booking.status === 'accepted' || booking.status === 'quotation_sent' ? '#3b82f6' :
             booking.status === 'payment_completed' || booking.status === 'in_progress' ? '#8b5cf6' :
             booking.status === 'completed' ? '#10b981' : '#ef4444',
      booking
    }));

    res.json(events);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add review to completed booking
router.put('/:id/review', auth, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.customer.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (booking.status !== 'completed') {
      return res.status(400).json({ message: 'Can only review completed bookings' });
    }

    booking.review = {
      rating: parseInt(rating),
      comment,
      reviewedAt: new Date(),
      reviewedBy: req.user.userId
    };
    
    await booking.save();

    const populatedBooking = await Booking.findById(booking._id)
      .populate('customer', 'name email phone')
      .populate('provider', 'name email phone')
      .populate('timeline.updatedBy', 'name')
      .populate('review.reviewedBy', 'name');

    res.json({
      message: 'Review added successfully',
      booking: populatedBooking
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get provider reviews
router.get('/provider/:providerId/reviews', auth, async (req, res) => {
  try {
    const bookings = await Booking.find({ 
      provider: req.params.providerId,
      status: 'completed',
      'review.rating': { $exists: true }
    })
    .populate('customer', 'name')
    .populate('review.reviewedBy', 'name')
    .sort({ 'review.reviewedAt': -1 });

    const reviews = bookings.map(booking => ({
      id: booking._id,
      serviceType: booking.serviceType,
      rating: booking.review.rating,
      comment: booking.review.comment,
      reviewedAt: booking.review.reviewedAt,
      customerName: booking.customer.name,
      date: booking.date
    }));

    // Calculate average rating
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = reviews.length > 0 ? (totalRating / reviews.length).toFixed(1) : 0;

    res.json({
      reviews,
      averageRating: parseFloat(averageRating),
      totalReviews: reviews.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;