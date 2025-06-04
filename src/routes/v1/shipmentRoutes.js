const express = require('express');
const { authMiddleware } = require('../../middlewares/authMiddleware');
const { create, updateStatus } = require('../../controllers/shipmentController');

const shipRouter = express.Router();

// Create new shipment (outbound or inbound)
shipRouter.post(
  '/:bookingId/:type',  // Removed the regex from path definition
  authMiddleware,
  (req, res, next) => {
    // Add validation middleware instead
    if (!['outbound', 'inbound'].includes(req.params.type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid shipment type. Must be "outbound" or "inbound"'
      });
    }
    next();
  },
  create
);

// Update shipment status
shipRouter.patch(
  '/:shipmentId/status',
  authMiddleware,
  updateStatus
);

module.exports = shipRouter;