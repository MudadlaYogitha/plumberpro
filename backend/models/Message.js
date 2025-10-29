import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  // Basic message information
  messageId: {
    type: String,
    unique: true,
    sparse: true
  },
  from: {
    type: String,
    required: true,
    trim: true
  },
  to: {
    type: String,
    required: true,
    trim: true
  },
  body: {
    type: String,
    required: true
  },
  
  // Message metadata
  direction: {
    type: String,
    enum: ['inbound', 'outbound'],
    default: 'inbound'
  },
  status: {
    type: String,
    enum: ['received', 'delivered', 'failed', 'pending'],
    default: 'received'
  },
  
  // Provider specific data
  provider: {
    type: String,
    default: 'sensorequation'
  },
  providerId: String,
  
  // Timestamps
  receivedAt: {
    type: Date,
    default: Date.now
  },
  sentAt: Date,
  
  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Location data if available
  location: {
    latitude: Number,
    longitude: Number,
    accuracy: Number
  },
  
  // Message type and format
  messageType: {
    type: String,
    enum: ['text', 'media', 'location'],
    default: 'text'
  },
  
  // Media attachments
  attachments: [{
    type: String,
    url: String,
    filename: String,
    mimeType: String,
    size: Number
  }],
  
  // Read status
  isRead: {
    type: Boolean,
    default: false
  },
  
  // Archive status
  isArchived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
messageSchema.index({ from: 1, receivedAt: -1 });
messageSchema.index({ to: 1, receivedAt: -1 });
messageSchema.index({ providerId: 1 });
messageSchema.index({ receivedAt: -1 });
messageSchema.index({ isRead: 1 });

// Virtual for formatted phone numbers
messageSchema.virtual('formattedFrom').get(function() {
  return this.from.replace(/^\+?1?/, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
});

messageSchema.virtual('formattedTo').get(function() {
  return this.to.replace(/^\+?1?/, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
});

// Static methods
messageSchema.statics.getRecentMessages = function(limit = 50) {
  return this.find({ isArchived: false })
    .sort({ receivedAt: -1 })
    .limit(limit);
};

messageSchema.statics.getConversation = function(phoneNumber, limit = 100) {
  return this.find({
    $or: [
      { from: phoneNumber },
      { to: phoneNumber }
    ],
    isArchived: false
  })
  .sort({ receivedAt: -1 })
  .limit(limit);
};

// Instance methods
messageSchema.methods.markAsRead = function() {
  this.isRead = true;
  return this.save();
};

messageSchema.methods.archive = function() {
  this.isArchived = true;
  return this.save();
};

const Message = mongoose.model('Message', messageSchema);

export default Message;