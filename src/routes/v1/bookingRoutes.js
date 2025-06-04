const express = require('express');
const bookingController = require('../../controllers/bookingController')
const { authMiddleware } = require('../../middlewares/authMiddleware');

const bookRouter = express.Router();
// Create a new booking
bookRouter.post('/create-booking', authMiddleware, bookingController.createBooking);

// Get user's bookings (as renter or owner)
bookRouter.get('/renter', authMiddleware, bookingController.getRenterBookings);

bookRouter.get('/owner', authMiddleware, bookingController.getOwnerBookings);

// Get specific booking details
bookRouter.get('/:bookingId', authMiddleware, bookingController.getBookingDetails);

// Confirm booking (owner only)
bookRouter.patch('/confirm/:bookingId', authMiddleware, bookingController.confirmBooking);

// Reject booking (owner only)
bookRouter.patch('/reject/:bookingId', authMiddleware, bookingController.rejectBooking);

// Cancel booking (renter or owner)
bookRouter.patch('/cancel/:bookingId', authMiddleware, bookingController.cancelBooking);
//update booking status
bookRouter.patch('/update/:bookingId', authMiddleware, bookingController.updateStatus);

module.exports = bookRouter;