const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }], // [renter, owner]
  initiator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // renter
  adRefs: [{
    adId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ad', required: true },
    status: { type: String }, // e.g., 'active', 'returned', etc.
  }],
  isOpen: { type: Boolean, default: true },
}, {
  timestamps: true
});

// Only one chat per renter-owner pair
chatSchema.index({ 'participants': 1 }, { unique: true });

module.exports = mongoose.model('Chat', chatSchema); 