const mongoose = require("mongoose");

const BookingSchema = new mongoose.Schema({

  // References
  ad: {
    type: mongoose.Types.ObjectId,
    ref: 'Ad',
    required: true
  },
  renter: {
    type: mongoose.Types.ObjectId,
    ref: 'User',
    required: true
  },
  owner: {
    type: mongoose.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Booking dates
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  bookedDates: [{
    type: Date,
    required: true
  }],
  
  // Financial details
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  deposit: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'active', 'completed', 'cancelled', 'rejected','hold'],
    default: 'pending'
  },

  // Additional details
  specialRequests: String,
  rejectionReason: String,
  // Contact info
  renterContact: {
    phone: String,
    email: String
  },
  
  // Cancellation info
  cancellationReason: String,
  cancelledBy: {
    type: mongoose.Types.ObjectId,
    ref: 'User'
  },
  cancelledAt: Date,
  
  // Confirmation timestamps
  confirmedAt: Date,
  rejectedAt: Date,
  
  // Pickup/Return tracking
  pickupStatus: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'pending'
  },
  returnStatus: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'pending'
  },
  holdExpiresAt: {
    type: Date,
    index: { expires: 0 }
  },
  pickupConfirmedAt: Date,
  returnConfirmedAt: Date,

  // Unique Booking ID
  bookingId: {
    type: String,
    unique: true, // Ensure uniqueness
    required: true // Make sure bookingId is always present
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
BookingSchema.index({ ad: 1, status: 1 });
BookingSchema.index({ renter: 1, status: 1 });
BookingSchema.index({ owner: 1, status: 1 });
BookingSchema.index({ startDate: 1, endDate: 1 });

// Virtual for booking duration
BookingSchema.virtual('duration').get(function() {
  const diffTime = Math.abs(this.endDate - this.startDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Generate unique booking ID
BookingSchema.pre('validate', async function(next) {
  if (!this.bookingId) {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.bookingId = `BK${timestamp}${random}`;
  }
  next();
});

// Handle deletion of holds
BookingSchema.post('delete', async function(doc) {
  if (doc.status === 'hold') {
    await mongoose.model('Ad').findByIdAndUpdate(doc.ad, {
      $pull: { bookedDates: { $in: doc.bookedDates } }
    });
    console.log(`Released dates for expired hold (${doc._id})`);
  }
});

module.exports = mongoose.model('Booking', BookingSchema);
