// models/SMS.js
const mongoose = require('mongoose');

const smsSchema = new mongoose.Schema({
  from: { type: String, required: true, index: true },      // sender phone (user or system sender)
  to: { type: String, required: true, index: true },        // recipient phone (system or user)
  message: { type: String, required: true },
  type: { type: String, enum: ['received', 'sent'], default: 'received' },
  status: { type: String, default: 'received' },           // received, pending, sent, failed
  messageId: { type: String, unique: true, sparse: true }, // gateway message id or auto id
  deviceId: { type: String },                              // provider device id (if any)
  webhookData: { type: mongoose.Schema.Types.Mixed },      // raw provider webhook payload
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'SMS', default: null }, // links sent->received
  replies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SMS' }], // incoming -> [outgoing,...]
  smsApiResult: { type: mongoose.Schema.Types.Mixed },     // gateway response/attempts stored here
  // helpful metadata (optional, stored inside smsApiResult usually)
  // gatewayRequest: { type: mongoose.Schema.Types.Mixed }, // Not required: included inside smsApiResult.attempts
}, { timestamps: true });

// index to quickly find conversation by phone
smsSchema.index({ from: 1, to: 1, createdAt: -1 });

module.exports = mongoose.model('SMS', smsSchema);
