const {updateShipmentStatus, createShipment}= require('../services/shipmentService')
const Booking = require('../models/Booking');

// Update shipment status
const updateStatus = async (req, res) => {
  try {
    const { shipmentId } = req.params;
    const { newStatus } = req.body;
    const userId = req.user._id;

    const shipment = await updateShipmentStatus(shipmentId, userId, newStatus);

    res.json({
      success: true,
      shipment
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Create new shipment
const create = async (req, res) => {
  try {
    const { bookingId, type } = req.params;
    const { courier, trackingNumber, notes } = req.body;
    const userId = req.user._id;

    // Determine sender/receiver based on shipment type
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new Error('Booking not found');

    const sender = type === 'outbound' ? booking.owner : booking.renter;
    const receiver = type === 'outbound' ? booking.renter : booking.owner;

    // Verify the user is the sender
    if (!sender.equals(userId)) {
      throw new Error('Only the sender can create this shipment');
    }

    const shipment = await createShipment(
      bookingId,
      type,
      sender,
      receiver,
      { courier, trackingNumber, notes }
    );

    res.status(201).json({
      success: true,
      shipment
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  updateStatus,
  create
};