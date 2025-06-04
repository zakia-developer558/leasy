const mongoose = require("mongoose");
const CATEGORIES = require("../enum/categories.enum");

const AdSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  price: Number,
  photos: [String], 
  createdBy: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
    validate: {
      validator: async function(value) {
        const category = await mongoose.model('Category').exists({ _id: value });
        return !!category;
      },
      message: "Invalid category ID"
    }
  },
  subcategory: {
    type: String, // Just store the subcategory ID as string
    required: false
  },
  pickupLocation: {
    address: String,
    coordinates: {
      type: [Number],
      index: '2dsphere'
    }
  },
  returnLocation: {
    address: String,
    coordinates: {
      type: [Number],
      index: '2dsphere'
    }
  },
  status: { 
    type: String, 
    enum: ['draft', 'published', 'boosted', 'expired'], 
    default: 'published' 
  },
  isHighlighted: { 
    type: Boolean, 
    default: false 
  },
  highlightExpiresAt: { 
    type: Date 
  },
  wasHighlighted: { 
    type: Boolean, 
    default: false 
  },
  deposit: { type: Number, min: 0 },
  availability: {
    months: [String],
    daysOfWeek: [String],
    pickupHours: String,
    returnHours: String
  },
  loanPeriod: { 
    type: String
  },
  paymentMethods: [{
    type: String
  }],

    bookedDates: [{
    type: Date,
    required: true
  }],
  confirmedBookings: [{
    type: Date,
    required: true
  }],

  contractTemplate: String, // file link
  loanCondition: String, // file link
  boost: {
    type: {
      boostType: {
        type: String,
        enum: ['none', 'featured', 'profile-rank'],
        default: 'none'
      },
      expiresAt: Date,
      paymentIntentId: String
    },
    default: { boostType: 'none' }
  },
  rankingData: {
    score: { type: Number, default: 0 },
    lastCalculated: Date,
    engagement: {
      viewCount: { type: Number, default: 0 },
      contactCount: { type: Number, default: 0 },
      saveCount: { type: Number, default: 0 }
    }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true } 
});

// NEW INDEXES FOR RANKING
AdSchema.index({ 'rankingData.score': -1 });
AdSchema.index({ category: 1, 'rankingData.score': -1 });
AdSchema.index({ createdBy: 1, 'rankingData.score': -1 });


AdSchema.methods = {
  // Check if dates are available
  areDatesAvailable: function(datesToCheck) {
    const formattedBooked = this.bookedDates.map(d => d.toISOString().split('T')[0]);
    const formattedConfirmed = this.confirmedBookings.map(d => d.toISOString().split('T')[0]);
    const allUnavailable = [...formattedBooked, ...formattedConfirmed];
    
    return datesToCheck.every(date => {
      const dateStr = new Date(date).toISOString().split('T')[0];
      return !allUnavailable.includes(dateStr);
    });
  },

  // Reserve dates (for pending bookings)
  reserveDates: async function(dates, session = null) {
    const options = session ? { session } : {};
    return this.model('Ad').findByIdAndUpdate(
      this._id,
      { $addToSet: { bookedDates: { $each: dates } } },
      { ...options, new: true }
    );
  },

  // Confirm booking (move from bookedDates to confirmedBookings)
  confirmDates: async function(dates, session = null) {
    const options = session ? { session } : {};
    await this.model('Ad').findByIdAndUpdate(
      this._id,
      { 
        $pull: { bookedDates: { $in: dates } },
        $addToSet: { confirmedBookings: { $each: dates } }
      },
      options
    );
  },

  // Release dates (when booking is rejected/cancelled)
  releaseDates: async function(dates, session = null) {
    const options = session ? { session } : {};
    await this.model('Ad').findByIdAndUpdate(
      this._id,
      { $pull: { bookedDates: { $in: dates } } },
      options
    );
  }
};

module.exports = mongoose.model('Ad', AdSchema);