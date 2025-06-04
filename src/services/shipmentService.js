const Shipment = require('../models/Shipment')
const { ObjectId } = require('mongoose').Types;

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

module.exports = {
  updateShipmentStatus,
  createShipment
};