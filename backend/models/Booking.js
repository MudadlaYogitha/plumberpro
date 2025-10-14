const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  customerName: {
    type: String,
    required: true
  },
  customerEmail: {
    type: String,
    required: true
  },
  customerPhone: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  serviceType: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  timeSlot: {
    start: {
      type: String,
      required: true
    },
    end: {
      type: String,
      required: true
    }
  },
  files: [{
    filename: String,
    originalName: String,
    path: String,
    url: String,
    type: {
      type: String,
      enum: ['image', 'video']
    }
  }],
  status: {
    type: String,
    enum: ['pending', 'accepted', 'quotation_sent', 'quotation_accepted', 'payment_completed', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  quotation: {
    amount: Number,
    description: String,
    generatedAt: Date,
    acceptedAt: Date,
    acceptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  payment: {
    amount: Number,
    method: String,
    transactionId: String,
    paidAt: Date,
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending'
    }
  },
  invoice: {
    invoiceNumber: String,
    generatedAt: Date,
    amount: Number,
    items: [{
      description: String,
      amount: Number
    }],
    tax: Number,
    total: Number
  },
  alternativeSlots: [{
    date: Date,
    timeSlot: {
      start: String,
      end: String
    }
  }],
  suggestedSlot: {
    date: Date,
    timeSlot: {
      start: String,
      end: String
    }
  },
  notes: {
    type: String
  },
  completedAt: Date,
  review: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    reviewedAt: Date,
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  timeline: [{
    status: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }]
}, {
  timestamps: true
});

// Add to timeline on status change
bookingSchema.pre('save', function(next) {
  if (this.isModified('status') && !this.isNew) {
    this.timeline.push({
      status: this.status,
      timestamp: new Date(),
      note: `Status changed to ${this.status}`
    });
  }
  next();
});

module.exports = mongoose.model('Booking', bookingSchema);