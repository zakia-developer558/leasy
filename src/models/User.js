const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  // 1. BASIC INFORMATION (existing fields remain unchanged)
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  first_name: { type: String, required: true },
  last_name: { type: String, required: true },
  address: { type: String },
  phoneNumber: { type: String, trim: true },
  status: {
    type: String,
    enum: ['email_unverified', 'onfido_pending', 'active', 'suspended'],
    default: 'email_unverified',
  },

  // 2. VERIFICATION FIELDS (existing fields remain unchanged)
  emailVerified: { type: Boolean, default: false },
  emailVerificationToken: String,
  emailVerificationExpire: Date,
  emailVerificationExpires: Date,  
  onfidoApplicantId: String,  
  onFidoVerificationRequired: { 
    type: Boolean, 
    default: true
  },
  onFidoVerificationStatus: { 
    type: String, 
    enum: ['not_started', 'pending', 'approved', 'rejected', 'expired'],
    default: 'not_started' 
  },
  onfidoCheckId: String,
  onFidoReportId: String,
  onFidoDocumentIds: [String],
  onFidoLivePhotoId: String,
  lastVerificationAttempt: Date,
  verificationAttempts: { type: Number, default: 0 },
  passwordResetToken:String,
  passwordResetExpires: Date,

  // 3. SECURITY FIELDS (existing fields remain unchanged)
  loginAttempts: { type: Number, default: 0 },
  accountLockedUntil: Date,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  mfaEnabled: { type: Boolean, default: false },
  mfaSecret: String,

  // 4. SYSTEM FIELDS (existing fields remain unchanged)
  role: { type: String, enum: ['buyer', 'admin', 'seller'], default: 'buyer' },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastLogin: Date,

  // 5. ONFIDO (existing fields remain unchanged)
  onfido: {
    applicantId: String,
    checkId: String,
    status: {
      type: String,
      enum: ['not_started', 'pending', 'approved', 'declined'],
      default: 'not_started'
    },
    lastVerifiedAt: Date
  },

  // NEW FIELDS FOR PROFILE BOOST
  profileBoost: {
    isActive: { type: Boolean, default: false },
    expiresAt: Date,
    boostMultiplier: { type: Number, default: 1.3, min: 1.0, max: 2.0 },
    lastPaymentIntentId: String,
    history: [{
      activatedAt: Date,
      expiredAt: Date,
      paymentIntentId: String,
      durationDays: Number
    }]
  },
  // NEW FIELD FOR SELLER RATING
  sellerRating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 }
  },
  // NEW FIELD: NOTIFICATION PREFERENCES
  notificationPreferences: {
    new_message: { type: Boolean, default: true },
    new_order: { type: Boolean, default: true },
    booking_confirmation: { type: Boolean, default: true },
    payment_success: { type: Boolean, default: true }, // MANDATORY
    payment_failure: { type: Boolean, default: true }, // MANDATORY
    review_received: { type: Boolean, default: true }
  }
});

// Auto-update timestamp (existing hook remains unchanged)
UserSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// NEW VIRTUAL FOR PROFILE BOOST STATUS
UserSchema.virtual('hasActiveProfileBoost').get(function() {
  return this.profileBoost?.isActive && 
         this.profileBoost.expiresAt > new Date();
});

// NEW INDEX FOR PROFILE BOOST
UserSchema.index({ 'profileBoost.expiresAt': 1 });

module.exports = mongoose.model('User', UserSchema);