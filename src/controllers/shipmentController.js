const {updateShipmentStatus, createShipment, getShipmentDetails} = require('../services/shipmentService')
const Booking = require('../models/Booking');
const Shipment = require('../models/Shipment');
const { sendShipmentCreationEmails, sendShipmentStatusUpdateEmails } = require('../utils/sendMail');

// Update shipment status
const updateStatus = async (req, res) => {
  try {
    const { shipmentId } = req.params;
    const { newStatus } = req.body;
    const userId = req.user._id;

    const shipment = await updateShipmentStatus(shipmentId, userId, newStatus);

    // Send email notifications
    await sendShipmentStatusUpdateEmails(shipment, newStatus);

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
    const booking = await Booking.findById(bookingId).populate('ad');
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

    // Populate shipment with necessary data for email
    const populatedShipment = await Shipment.findById(shipment._id)
      .populate('booking', 'startDate endDate')
      .populate('sender', 'first_name last_name email phoneNumber')
      .populate('receiver', 'first_name last_name email phoneNumber')
      .populate({
        path: 'booking',
        populate: {
          path: 'ad',
          select: 'title'
        }
      });

    // Send email notifications
    await sendShipmentCreationEmails(populatedShipment);

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

// Get shipment details
const getDetails = async (req, res) => {
  try {
    const { shipmentId } = req.params;
    const userId = req.user._id;

    const shipment = await getShipmentDetails(shipmentId, userId);

    res.json({
      success: true,
      data: shipment
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  updateStatus,
  create,
  getDetails
};