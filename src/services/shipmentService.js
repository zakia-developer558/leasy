const Shipment = require('../models/Shipment')
const { ObjectId } = require('mongoose').Types;
const { notFound, unauthorized } = require('../errors/httpError');

const updateShipmentStatus = async (shipmentId, userId, newStatus) => {
  const shipment = await Shipment.findById(shipmentId).populate('booking');
  
  if (!shipment) {
    throw new Error('Shipment not found');
  }

  // Validate newStatus value
  if (!['sent', 'received'].includes(newStatus)) {
    throw new Error('Invalid status: must be "sent" or "received"');
  }

  // Authorization check for both outbound and inbound shipments
  const isAuthorized = (
    (newStatus === 'sent' && shipment.sender.equals(userId)) ||
    (newStatus === 'received' && shipment.receiver.equals(userId))
  );

  if (!isAuthorized) {
    throw new Error('Not authorized to update this shipment status');
  }

  // Validate status transitions
  if (shipment.status === 'preparing' && newStatus !== 'sent') {
    throw new Error('Must mark as "sent" before "received"');
  }

  if (shipment.status === 'sent' && newStatus !== 'received') {
    throw new Error('Can only mark as "received" after "sent"');
  }

  if (shipment.status === 'received') {
    throw new Error('Cannot modify a completed shipment');
  }

  // Update status with timestamps
  shipment.status = newStatus;
  if (newStatus === 'sent') {
    shipment.sentAt = new Date();
  } else if (newStatus === 'received') {
    shipment.receivedAt = new Date();
  }

  return await shipment.save();
};

const createShipment = async (bookingId, type, senderId, receiverId, shipmentData) => {
  const shipment = new Shipment({
    booking: bookingId,
    type,
    sender: senderId,
    receiver: receiverId,
    status: 'preparing',
    ...shipmentData
  });

  return await shipment.save();
};

const getShipmentDetails = async (shipmentId, userId) => {
  const shipment = await Shipment.findById(shipmentId)
    .populate('booking', 'startDate endDate totalAmount status')
    .populate('sender', 'first_name last_name email phoneNumber')
    .populate('receiver', 'first_name last_name email phoneNumber')
    .populate({
      path: 'booking',
      populate: {
        path: 'ad',
        select: 'title photos price'
      }
    });

  if (!shipment) {
    throw notFound('Shipment not found', 404);
  }

  // Check if user is authorized to view this shipment
  if (!shipment.sender._id.equals(userId) && !shipment.receiver._id.equals(userId)) {
    throw unauthorized('You are not authorized to view this shipment', 403);
  }

  return shipment;
};

const getShipmentsByBookingId = async (bookingId, userId) => {
  const shipments = await Shipment.find({ booking: bookingId })
    .populate('booking', 'startDate endDate totalAmount status')
    .populate('sender', 'first_name last_name email phoneNumber')
    .populate('receiver', 'first_name last_name email phoneNumber')
    .populate({
      path: 'booking',
      populate: {
        path: 'ad',
        select: 'title photos price'
      }
    });

  if (!shipments.length) {
    throw notFound('No shipments found for this booking', 404);
  }

  // Check if user is authorized to view these shipments
  const isAuthorized = shipments.some(
    shipment => shipment.sender._id.equals(userId) || shipment.receiver._id.equals(userId)
  );

  if (!isAuthorized) {
    throw unauthorized('You are not authorized to view these shipments', 403);
  }

  return shipments;
};

module.exports = {
  updateShipmentStatus,
  createShipment,
  getShipmentDetails,
  getShipmentsByBookingId
};