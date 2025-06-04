const mongoose = require('mongoose');
const { badRequest, notFound } = require("../errors/httpError");
const Add = require("../models/Add");
const Booking = require("../models/Booking");
const crypto = require('crypto');
const axios = require('axios');
const FormData = require('form-data');
const { ObjectId } = require('mongoose').Types;
const checkDateAvailability = async (adId, dates, bookingIdToExclude = null, session = null) => {
  const options = session ? { session } : {};
  const ad = await Add.findById(adId, null, options).lean();

  if (!ad) {
    throw notFound('Ad not found', 404);
  }

  // Initialize arrays if they don't exist
  ad.bookedDates = ad.bookedDates || [];
  ad.confirmedBookings = ad.confirmedBookings || [];

  // Convert all dates to comparable format (YYYY-MM-DD)
  const formatDate = (date) => new Date(date).toISOString().split('T')[0];

  const targetDates = dates.map(formatDate);
  const unavailableDates = [];

  // Combine all booked dates
  const allBookedDates = [
    ...ad.bookedDates.map(formatDate),
    ...ad.confirmedBookings.map(formatDate)
  ];

  // Check for conflicts
  targetDates.forEach(date => {
    if (allBookedDates.includes(date)) {
      unavailableDates.push(new Date(date));
    }
  });

  return unavailableDates;
};


const generateDateRange = (startDate, endDate) => {
  const dates = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
};

const createBooking = async (bookingData, renterId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { adId, startDate, endDate, specialRequests, renterContact } = bookingData;
    
    // Validate input
    if (!adId || !startDate || !endDate) {
      throw badRequest('Missing required booking fields', 400);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (start < today) throw badRequest('Start date cannot be in the past', 400);
    if (end <= start) throw badRequest('End date must be after start date', 400);

    // Get ad with session
    const ad = await Add.findById(adId)
      .populate('createdBy')
      .session(session);
    
    if (!ad) throw notFound('Ad not found', 404);
    if (ad.status !== 'published') throw badRequest('Ad is not available for booking', 400);
    if (ad.createdBy._id.equals(renterId)) throw badRequest('You cannot book your own listing', 400);

    // Generate dates and check availability
    const bookedDates = generateDateRange(start, end);
    if (!ad.areDatesAvailable(bookedDates)) {
      throw badRequest('Selected dates are not available', 400);
    }

    // Calculate pricing
    const duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const totalAmount = ad.price * duration;

    // Create booking
    const booking = new Booking({
      ad: adId,
      renter: renterId,
      owner: ad.createdBy._id,
      startDate: start,
      endDate: end,
      bookedDates,
      totalAmount,
      deposit: ad.deposit || 0,
      specialRequests,
      renterContact,
      status: 'hold', // New status for temporary holds
      paymentStatus: 'pending',
      holdExpiresAt: new Date(Date.now() + 1* 60 * 1000) // 24 hours from now
    });

    // Reserve dates and save booking in transaction
    await ad.reserveDates(bookedDates, session);
    await booking.save({ session });
    await session.commitTransaction();

    // Generate payment link with T-Pay
    const paymentLink = await generateTPayPaymentLink({
      bookingId: booking._id,
      amount: totalAmount,
      customerEmail: renterContact.email,
      customerPhone: renterContact.phone,
      description: `Booking for ${ad.title}`
    });

    await Booking.findByIdAndUpdate(
  booking._id,
  { 
    paymentUrl: paymentLink,
    paymentMethod: 'tpay',
    paymentExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h expiry example
  },
  { new: true }
);

    // Return populated booking with payment link
    const populatedBooking = await Booking.findById(booking._id)
      .populate('ad', 'title photos price')
      .populate('renter', 'first_name last_name')
      .populate('owner', 'first_name last_name');

    return {
      ...populatedBooking.toObject(),
      paymentLink
    };

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

async function generateTPayPaymentLink(bookingDetails) {
  // Validate input
  if (!bookingDetails?.amount || !bookingDetails?.description) {
    throw new Error('Amount and description are required');
  }

  // Load configuration
  const config = {
    baseUrl: process.env.TPAY_BASE_URL || 'https://openapi.sandbox.tpay.com',
    clientId: process.env.TPAY_CLIENT_ID,
    secret: process.env.TPAY_SECRET,
    merchantId: process.env.TPAY_MERCHANT_ID,
    defaultReturnUrl: process.env.TPAY_DEFAULT_RETURN_URL,
    defaultErrorUrl: process.env.TPAY_DEFAULT_ERROR_URL
  };

  try {
    // Step 1: Get OAuth2 access token
    const tokenPayload = new URLSearchParams();
    tokenPayload.append('client_id', config.clientId);
    tokenPayload.append('client_secret', config.secret);
    tokenPayload.append('grant_type', 'client_credentials');

    console.log('OAuth Request:', {
      url: `${config.baseUrl}/oauth/auth`,
      payload: {
        client_id: config.clientId,
        client_secret: '***' 
      }
    });

    const authResponse = await axios.post(
      `${config.baseUrl}/oauth/auth`,
      tokenPayload,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      }
    );

    console.log('OAuth Response:', {
      status: authResponse.status,
      data: {
        ...authResponse.data,
        access_token: '***' // masked for security
      }
    });

    const accessToken = authResponse.data.access_token;
    if (!accessToken) {
      throw new Error('Failed to obtain access token');
    }

    // Step 2: Create payment transaction
    const paymentPayload = {
      currency: "PLN",
      description: bookingDetails.description.substring(0, 128),
      hiddenDescription: bookingDetails.bookingId.toString(),
      languageCode: "PL",
      preSelectedChannelId: "64",
      
         pos: { id: '01G6WAS5MNGQ2X728AW53D8JPR' },
      
      billingAddress: {
        email: bookingDetails.customerEmail,
        name: "Customer Name",
        phone: bookingDetails.customerPhone,
        street: "string",
        postalCode: "string",
        city: "string",
        country: "PL",
        houseNo: "string",
        flatNo: "string"
      },
      childTransactions: [
        {
          amount: Number(bookingDetails.amount.toFixed(2)),
          description: bookingDetails.description,
          merchant: {
            id: "01G6WAPZFNNX4CXBPKQH5MYD4R"
          },
          products: [
            {
              name: bookingDetails.description,
              externalId: bookingDetails.bookingId.toString(),
              quantity: 1,
              unitPrice: Number(bookingDetails.amount.toFixed(2))
            }
          ]
        }
      ],
      transactionCallbacks: [
        {
          type: 1,
          value: process.env.TPAY_WEBHOOK_URL || `${config.defaultReturnUrl}/api/payments/webhook`
        }
      ]
    };

    console.log('Payment Request:', {
      url: `${config.baseUrl}/marketplace/v1/transaction`,
      headers: {
        'Authorization': `Bearer ${accessToken.substring(0, 10)}...`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      payload: paymentPayload
    });

    const paymentResponse = await axios.post(
      `${config.baseUrl}/marketplace/v1/transaction`,
      paymentPayload,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 15000
      }
    );

    // Log successful response
    console.log('TPay Response:', {
      status: paymentResponse.status,
      data: paymentResponse.data
    });

    // Validate and return payment URL
    if (!paymentResponse.data?.paymentUrl) {
      throw new Error('TPay did not return a payment URL');
    }

    return paymentResponse.data.paymentUrl;

  } catch (error) {
    // Enhanced error logging
    const errorContext = {
      timestamp: new Date().toISOString(),
      config,
      bookingDetails,
      error: {
        message: error.message,
        stack: error.stack,
        response: error.response?.data
      }
    };

    console.error('TPay Payment Error:', JSON.stringify(errorContext, null, 2));

    // User-friendly error messages
    let userMessage = 'Payment processing failed';
    if (error.response) {
      if (error.response.status === 401) {
        userMessage = 'Authentication failed - please check your API credentials';
      } else if (error.response.status === 400) {
        userMessage = error.response.data?.message || 'Invalid payment request';
      }
    }

    throw new Error(userMessage);
  }
}


const confirmBooking = async (bookingId, ownerId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Validate input
    if (!bookingId) throw badRequest('Booking ID is required', 400);

    // Get and verify booking
    const booking = await Booking.findById(bookingId)
      .populate('owner')
      .session(session);
    
    if (!booking) throw notFound('Booking not found', 404);
    if (!booking.owner._id.equals(ownerId)) {
      throw unauthorized('You are not authorized to confirm this booking', 403);
    }
    if (booking.status !== 'pending') {
      throw badRequest(`Booking is already ${booking.status}`, 400);
    }

    // Update booking status (dates were already reserved when booking was created)
    booking.status = 'confirmed';
    booking.confirmedAt = new Date();

    // Save changes
    await booking.save({ session });
    await session.commitTransaction();

    // Return populated booking
    return await Booking.findById(booking._id)
      .populate('ad', 'title photos price')
      .populate('renter', 'first_name last_name')
      .populate('owner', 'first_name last_name');

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};



const rejectBooking = async (bookingId, ownerId, rejectionReason) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Basic validation
    if (!bookingId) throw badRequest('Booking ID is required', 400);
    if (!rejectionReason) throw badRequest('Rejection reason is required', 400);

    // Get booking and verify ownership
    const booking = await Booking.findById(bookingId)
      .populate('owner')
      .session(session);
    
    if (!booking) throw notFound('Booking not found', 404);
    if (!booking.owner._id.equals(ownerId)) {
      throw unauthorized('You are not authorized to reject this booking', 403);
    }
    if (booking.status !== 'pending') {
      throw badRequest(`Booking is already ${booking.status}`, 400);
    }

    // Update booking status
    booking.status = 'rejected';
    booking.rejectedAt = new Date();
    booking.rejectionReason = rejectionReason;

    // Save changes
    await booking.save({ session});
    await session.commitTransaction();

    // Return updated booking
    return await Booking.findById(booking._id)
      .populate('ad', 'title photos price')
      .populate('renter', 'first_name last_name')
      .populate('owner', 'first_name last_name');

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const cancelBooking = async (bookingId, userId, reason) => {
  try {
    const booking = await Booking.findById(bookingId).populate('ad');
    
    if (!booking) {
      throw notFound('Booking not found', 404);
    }
    
    // Check if user can cancel (renter or owner)
    if (booking.renter.toString() !== userId.toString() && 
        booking.owner.toString() !== userId.toString()) {
      throw forbidden('You can only cancel your own bookings', 403);
    }
    
    if (!['pending', 'confirmed'].includes(booking.status)) {
      throw badRequest('Booking cannot be cancelled', 400);
    }
    
    // Release dates
    if (booking.status === 'confirmed') {
      await booking.ad.updateOne({
        $pull: { bookedDates: { $in: booking.bookedDates } }
      });
    } else {
      await booking.ad.releaseDates(booking.bookedDates);
    }
    
    booking.status = 'cancelled';
    booking.cancelledBy = userId;
    booking.cancelledAt = new Date();
    booking.cancellationReason = reason;
    await booking.save();
    
    return {
      success: true,
      message: 'Booking cancelled successfully'
    };
    
  } catch (error) {
    console.error('Cancel booking error:', error);
    throw error;
  }
};

const getBookingsForRenter = async (renterId, queryParams = {}) => {
  try {
    const { status, sortBy } = queryParams;
    
    const filter = { renter: renterId };
    if (status) filter.status = status;
    
    const sortOptions = {};
    if (sortBy === 'newest') sortOptions.createdAt = -1;
    if (sortBy === 'oldest') sortOptions.createdAt = 1;
    
    const bookings = await Booking.find(filter)
      .sort(sortOptions)
      .populate('ad', 'title photos price location')
      .populate('owner', 'first_name last_name avatar');
      
    return bookings;
  } catch (error) {
    throw error;
  }
};

const getBookingsForOwner = async (ownerId, queryParams = {}) => {
  try {
    const { status, sortBy } = queryParams;
    
    const filter = { owner: ownerId };
    if (status) filter.status = status;
    
    const sortOptions = {};
    if (sortBy === 'newest') sortOptions.createdAt = -1;
    if (sortBy === 'oldest') sortOptions.createdAt = 1;
    
    const bookings = await Booking.find(filter)
      .sort(sortOptions)
      .populate('ad', 'title photos price location')
      .populate('renter', 'first_name last_name avatar rating');
      
    return bookings;
  } catch (error) {
    throw error;
  }
};

const getBookingDetails = async (bookingId, userId) => {
  try {
    const booking = await Booking.findById(bookingId)
      .populate('ad')
      .populate('renter', 'first_name last_name phoneNumber email')
      .populate('owner', 'first_name last_name phoneNumber email');
    
    if (!booking) {
      throw notFound('Booking not found', 404);
    }
    
    // Check if user has access to this booking
    if (booking.renter._id.toString() !== userId.toString() && 
        booking.owner._id.toString() !== userId.toString()) {
      throw forbidden('Access denied', 403);
    }
    
    return {
      success: true,
      booking
    };
    
  } catch (error) {
    console.error('Get booking details error:', error);
    throw error;
  }
};

const validStatuses = {
  pickup: ['pending', 'in-progress', 'completed', 'cancelled'],
  return: ['pending', 'in-progress', 'completed', 'cancelled']
};

const updateBookingStatus = async (bookingId, userId, updateData) => {
  const { pickupStatus, returnStatus } = updateData;

  // Validate at least one status is provided
  if (!pickupStatus && !returnStatus) {
    throw new Error('Must provide either pickupStatus or returnStatus');
  }

  // Find booking and verify user is either owner or renter
  const booking = await Booking.findOne({
    _id: new ObjectId(bookingId),
    $or: [{ renter: new ObjectId(userId) }, { owner: new ObjectId(userId) }]
  });

  if (!booking) {
    throw new Error('Booking not found or unauthorized access');
  }

  // Validate status transitions
  if (pickupStatus) {
    if (!validStatuses.pickup.includes(pickupStatus)) {
      throw new Error(`Invalid pickupStatus: ${pickupStatus}`);
    }
    if (pickupStatus === 'completed' && booking.pickupStatus !== 'in-progress') {
      throw new Error('Cannot complete pickup that is not in-progress');
    }
  }

  if (returnStatus) {
    if (!validStatuses.return.includes(returnStatus)) {
      throw new Error(`Invalid returnStatus: ${returnStatus}`);
    }
    if (returnStatus === 'completed' && booking.returnStatus !== 'in-progress') {
      throw new Error('Cannot complete return that is not in-progress');
    }
  }

  // Prepare update object
  const updateObj = {};
  if (pickupStatus) {
    updateObj.pickupStatus = pickupStatus;
    if (pickupStatus === 'completed') updateObj.pickupCompletedAt = new Date();
  }
  if (returnStatus) {
    updateObj.returnStatus = returnStatus;
    if (returnStatus === 'completed') updateObj.returnCompletedAt = new Date();
  }

  // Update booking
  const updatedBooking = await Booking.findByIdAndUpdate(
    bookingId,
    updateObj,
    { new: true }
  );

  return updatedBooking;
};

const handleTPayCallback = async (req, res) => {
  const { id, tr_id, tr_date, tr_crc, tr_amount, tr_paid, tr_desc, tr_status, tr_error, md5sum } = req.body;

  try {
    // Verify the MD5 checksum
    const expectedMd5 = crypto.createHash('md5')
      .update(`${id}${tr_id}${tr_amount}${tr_crc}${process.env.TPAY_API_KEY}`)
      .digest('hex');

    if (md5sum !== expectedMd5) {
      return res.status(400).send('Invalid checksum');
    }

    // Find the booking
    const booking = await Booking.findById(tr_crc);
    if (!booking) {
      return res.status(404).send('Booking not found');
    }

    // Check if amount matches
    if (tr_amount !== booking.totalAmount) {
      return res.status(400).send('Amount mismatch');
    }

    // Update booking based on payment status
    if (tr_status === 'TRUE' && tr_paid === '1') {
      booking.paymentStatus = 'completed';
      booking.paymentId = tr_id;
      booking.status = 'confirmed';
      booking.confirmedAt = new Date(tr_date);
      await booking.save();
      
      // Notify owner and renter
      await sendBookingConfirmation(booking);
    } else {
      booking.paymentStatus = 'failed';
      booking.paymentAttempts += 1;
      await booking.save();
      
      // Notify renter about failed payment
      await sendPaymentFailureNotification(booking, tr_error);
    }

    return res.send('OK');
  } catch (error) {
    console.error('Payment callback error:', error);
    return res.status(500).send('Internal server error');
  }
};

const checkPaymentStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    const booking = await Booking.findById(bookingId)
      .populate('ad', 'title')
      .populate('renter', 'first_name last_name email');
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // If payment is already completed
    if (booking.paymentStatus === 'completed') {
      return res.json({
        status: 'completed',
        booking
      });
    }

    // If using T-Pay, you might want to verify payment status with their API
    if (booking.paymentMethod === 'tpay' && booking.paymentId) {
      const paymentStatus = await verifyTPayPayment(booking.paymentId);
      
      if (paymentStatus.paid) {
        // Update booking status
        booking.paymentStatus = 'completed';
        booking.status = 'confirmed';
        booking.confirmedAt = new Date();
        await booking.save();
        
        return res.json({
          status: 'completed',
          booking
        });
      }
    }

    // Return current status
    return res.json({
      status: booking.paymentStatus,
      paymentUrl: booking.paymentUrl,
      expiresAt: booking.paymentExpiry
    });
  } catch (error) {
    console.error('Payment status check error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const verifyTPayPayment = async (transactionId) => {
  const tpayConfig = {
    merchantId: process.env.TPAY_MERCHANT_ID,
    apiKey: process.env.TPAY_API_KEY,
    baseUrl: process.env.TPAY_BASE_URL || 'https://secure.tpay.com'
  };

  const response = await axios.post(`${tpayConfig.baseUrl}/api/gw/${tpayConfig.merchantId}/transaction/verify`, {
    id: tpayConfig.merchantId,
    tr_id: transactionId,
    api_password: tpayConfig.apiKey
  });

  return {
    paid: response.data.status === 'paid',
    amount: response.data.amount,
    date: response.data.transaction_date
  };
};

module.exports = {
  createBooking,
  confirmBooking,
  rejectBooking,
  cancelBooking,
  getBookingsForRenter,
  getBookingsForOwner,
  getBookingDetails,
  updateBookingStatus,
  handleTPayCallback,
  checkPaymentStatus

};