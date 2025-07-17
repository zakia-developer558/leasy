const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // e.g., Basic, Standard, Premium
  price: { type: Number, required: true }, // price per cycle (e.g., per month)
  listingLimit: { type: Number, required: true }, // max number of listings allowed
  featuredAds: { type: Number, required: true }, // number of featured ads allowed
  commissionDiscount: { type: Number, default: 0 }, // percent discount on commission
  description: { type: String }, // optional description
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

subscriptionPlanSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema); 