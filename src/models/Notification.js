const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: [
      'new_message',
      'new_order',
      'booking_confirmation',
      'payment_success',
      'payment_failure',
      'review_received'
    ],
    required: true
  },
  data: { type: Object, default: {} }, // Flexible object for notification details
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', notificationSchema); 