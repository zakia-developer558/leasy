const bookingService = require('../services/bookingService');
const { successResponse, errorResponse } = require('../utils/response');


// bookingController.js

const createBooking = async (req, res) => {
  try {
    const result = await bookingService.createBooking(req.body, req.user.id);
    return res.status(201).json({
      success: true,
      data: result,
      message: 'Booking created successfully'
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
      ...(error.data && { data: error.data })
    });
  }
};

const confirmBooking = async (req, res) => {
  try {
    const result = await bookingService.confirmBooking(req.params.bookingId, req.user.id);
    return res.status(200).json({
      success: true,
      data: result,
      message: 'Booking confirmed successfully'
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
      ...(error.data && { data: error.data })
    });
    }
};

const rejectBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { rejectionReason } = req.body;
    const ownerId = req.user.id;
    
    const result = await bookingService.rejectBooking(bookingId, ownerId, rejectionReason);
    
    return successResponse(res, result, 'Booking rejected successfully');
  } catch (error) {
    return errorResponse(res, error);
  }
};

const cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;
    
    const result = await bookingService.cancelBooking(bookingId, userId, reason);
    
    return successResponse(res, result, 'Booking cancelled successfully');
  } catch (error) {
    return errorResponse(res, error);
  }
};

const getRenterBookings = async (req, res) => {
  try {
    const renterId = req.user._id;
    const { status, sortBy } = req.query;
    
    const bookings = await bookingService.getBookingsForRenter(renterId, { status, sortBy });
    
    res.status(200).json({
      success: true,
      count: bookings.length,
      bookings
    });
  } catch (error) {
    console.error('Error fetching renter bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings'
    });
  }
};

const getOwnerBookings = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { status, sortBy } = req.query;
    
    const bookings = await bookingService.getBookingsForOwner(ownerId, { status, sortBy });
    
    res.status(200).json({
      success: true,
      count: bookings.length,
      bookings
    });
  } catch (error) {
    console.error('Error fetching owner bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings'
    });
  }
};

const getBookingDetails = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;
    
    const result = await bookingService.getBookingDetails(bookingId, userId);
    
    return successResponse(res, result, 'Booking details retrieved successfully');
  } catch (error) {
    return errorResponse(res, error);
  }
};

const updateStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user._id;
    const { pickupStatus, returnStatus } = req.body;

    const booking = await bookingService.updateBookingStatus(bookingId, userId, {
      pickupStatus,
      returnStatus
    });

    res.json({
      success: true,
      booking,
      message: 'Booking status updated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  createBooking,
  confirmBooking,
  rejectBooking,
  cancelBooking,
  getRenterBookings,
  getOwnerBookings,
  getBookingDetails,
  updateStatus
};