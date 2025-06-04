const mongoose = require('mongoose');

const shipmentSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  type: { type: String, enum: ['outbound', 'inbound'], required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { 
    type: String, 
    enum: ['preparing', 'sent', 'received', 'cancelled'],
    default: 'preparing'
  },
  courier: String,
  trackingNumber: String,
  notes: String,
  sentAt: Date,
  receivedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('Shipment', shipmentSchema);