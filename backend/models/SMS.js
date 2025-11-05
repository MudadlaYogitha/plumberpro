// models/SMS.js
const mongoose = require('mongoose');

const smsSchema = new mongoose.Schema({
  from: { type: String, required: true, index: true },   // sender (user number for incoming; system number for outgoing)
  to: { type: String, required: true, index: true },     // recipient (system number for incoming; user number for outgoing)
  message: { type: String, required: true },
  type: { type: String, enum: ['received', 'sent'], default: 'received' },
  status: { type: String, default: 'received' }, // 'received', 'pending', 'sent', 'failed'
  messageId: { type: String, unique: true, sparse: true }, // gateway message id or auto id
  deviceId: { type: String }, // provider device id
  webhookData: { type: mongoose.Schema.Types.Mixed }, // raw payload from provider webhook (incoming) or metadata (outgoing)
  smsApiResult: { type: mongoose.Schema.Types.Mixed }, // provider send attempts & responses (outgoing)
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'SMS', default: null }, // points to incoming doc (for outgoing)
  replies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SMS' }], // outgoing ids referenced by incoming
}, { timestamps: true });

// compound index for quick conversation lookups
smsSchema.index({ from: 1, to: 1, createdAt: -1 });

module.exports = mongoose.model('SMS', smsSchema);
