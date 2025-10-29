// models/Session.js
const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  phone: { type: String, required: true, index: true, unique: true },
  sessionId: { type: String, required: true, index: true },
  state: { 
    type: String, 
    enum: ['new', 'awaiting_phone','awaiting_service', 'link_sent', 'submitted', 'awaiting_other_desc', 'cancelled'],
    default: 'new'
  },
  service: { type: String, default: null },
  meta: { type: mongoose.Schema.Types.Mixed }, // hold any extra metadata
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);
