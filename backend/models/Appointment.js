// models/Booking.js
const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  bookingId: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  service: { type: String },
  description: { type: String },
  status: { type: String, enum: ['pending', 'submitted', 'accepted', 'cancelled'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Booking', BookingSchema);
