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

  // Check if dates are within availability settings
  isWithinAvailabilitySettings: function(dates) {
    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const validMonths = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

    // Filter out invalid days and months
    const validDaysOfWeek = this.availability.daysOfWeek.filter(day => validDays.includes(day.toLowerCase()));
    const validMonthsList = this.availability.months.filter(month => validMonths.includes(month.toLowerCase()));

    // If no valid days or months are specified, consider all days/months as available
    if (validDaysOfWeek.length === 0) validDaysOfWeek.push(...validDays);
    if (validMonthsList.length === 0) validMonthsList.push(...validMonths);

    return dates.every(date => {
      const month = date.toLocaleString('en-US', { month: 'long' }).toLowerCase();
      const dayOfWeek = date.toLocaleString('en-US', { weekday: 'long' }).toLowerCase();
      
      return validMonthsList.includes(month) && validDaysOfWeek.includes(dayOfWeek);
    });
  },

  // Check if time is within pickup/return hours
  isWithinOperatingHours: function(date, isPickup = true) {
    if (!this.availability) return true; // If no availability settings, assume always available

    const hours = isPickup ? this.availability.pickupHours : this.availability.returnHours;
    if (!hours) return true; // If no hours specified, assume always available

    // Parse hours (assuming format like "9:00 AM - 5:00 PM")
    const [startTime, endTime] = hours.split(' - ').map(time => {
      const [timeStr, period] = time.split(' ');
      let [hours, minutes] = timeStr.split(':').map(Number);
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      return hours * 60 + minutes; // Convert to minutes for easier comparison
    });

    const dateObj = new Date(date);
    const currentMinutes = dateObj.getHours() * 60 + dateObj.getMinutes();

    return currentMinutes >= startTime && currentMinutes <= endTime;
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