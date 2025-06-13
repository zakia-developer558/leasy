const { body, param } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation');

const validateBookingCreation = [
  body('adId')
    .notEmpty()
    .withMessage('Ad ID is required')
    .isMongoId()
    .withMessage('Invalid Ad ID'),
    
  body('startDate')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Invalid start date format'),
    
  body('endDate')
    .notEmpty()
    .withMessage('End date is required')
    .isISO8601()
    .withMessage('Invalid end date format'),
    
  body('pickupTime')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Invalid pickup time format (HH:MM)'),
    
  body('returnTime')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Invalid return time format (HH:MM)'),
    
  body('renterContact.phone')
    .optional()
    .isMobilePhone()
    .withMessage('Invalid phone number'),
    
  body('renterContact.email')
    .optional()
    .isEmail()
    .withMessage('Invalid email address'),
    
  body('specialRequests')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Special requests must be less than 500 characters'),
    
  handleValidationErrors
];

const validateBookingAction = [
  param('bookingId')
    .isMongoId()
    .withMessage('Invalid booking ID'),
    
  body('reason')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Reason must be less than 200 characters'),
    
  handleValidationErrors
];

module.exports = {
  validateBookingCreation,
  validateBookingAction
};