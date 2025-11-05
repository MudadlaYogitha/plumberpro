// models/SMS.js
const mongoose = require('mongoose');

const smsSchema = new mongoose.Schema({
  from: { type: String, required: true, index: true },
  to: { type: String, default: 'system' },
  message: { type: String, required: true },
  type: { type: String, enum: ['received', 'sent'], default: 'received' },
  status: { type: String, default: 'received' },
  messageId: { type: String, unique: true, sparse: true },
  deviceId: { type: String },
  webhookData: { type: mongoose.Schema.Types.Mixed },
  // linking fields
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'SMS', default: null },
  replies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SMS' }],
  smsApiResult: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

module.exports = mongoose.model('SMS', smsSchema);
