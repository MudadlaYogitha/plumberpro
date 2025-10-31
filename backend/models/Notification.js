const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['booking_accepted', 'quotation_sent', 'payment_completed', 'service_completed', 'booking_cancelled'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  smsId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SMS'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  sentAt: {
    type: Date,
    default: Date.now
  },
  deliveredAt: Date,
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'failed'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Index for efficient queries
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ bookingId: 1 });
notificationSchema.index({ phone: 1 });

module.exports = mongoose.model('Notification', notificationSchema);