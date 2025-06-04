/**
 * Standard success response format
 * @param {Object} res - Express response object
 * @param {Object} data - Response data
 * @param {String} message - Success message
 * @param {Number} statusCode - HTTP status code (default: 200)
 */
const successResponse = (res, data = null, message = 'Success', statusCode = 200) => {
  const response = {
    success: true,
    message,
    timestamp: new Date().toISOString()
  };

  // Add data if provided
  if (data !== null) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};

/**
 * Standard error response format
 * @param {Object} res - Express response object
 * @param {Error|Object} error - Error object or custom error
 * @param {String} customMessage - Custom error message (optional)
 */
const errorResponse = (res, error, customMessage = null) => {
  let statusCode = 500;
  let message = 'Internal server error';
  let errors = null;

  // Handle different error types
  if (error.statusCode) {
    // Custom error with status code
    statusCode = error.statusCode;
    message = error.message;
    if (error.errors) {
      errors = error.errors;
    }
  } else if (error.code === 11000) {
    // MongoDB duplicate key error
    statusCode = 400;
    message = 'Duplicate entry found';
    const field = Object.keys(error.keyPattern)[0];
    errors = [{ field, message: `${field} already exists` }];
  } else if (error.name === 'ValidationError') {
    // Mongoose validation error
    statusCode = 400;
    message = 'Validation failed';
    errors = Object.keys(error.errors).map(key => ({
      field: key,
      message: error.errors[key].message
    }));
  } else if (error.name === 'CastError') {
    // MongoDB ObjectId cast error
    statusCode = 400;
    message = 'Invalid ID format';
  } else if (error.name === 'JsonWebTokenError') {
    // JWT error
    statusCode = 401;
    message = 'Invalid token';
  } else if (error.name === 'TokenExpiredError') {
    // JWT expired error
    statusCode = 401;
    message = 'Token expired';
  } else if (error.message) {
    // Generic error with message
    message = error.message;
  }

  // Use custom message if provided
  if (customMessage) {
    message = customMessage;
  }

  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };

  // Add errors array if present
  if (errors) {
    response.errors = errors;
  }

  // Add error details in development mode
  if (process.env.NODE_ENV === 'development') {
    response.stack = error.stack;
  }

  return res.status(statusCode).json(response);
};

/**
 * Pagination response format
 * @param {Object} res - Express response object
 * @param {Object} data - Response data with pagination
 * @param {String} message - Success message
 * @param {Number} statusCode - HTTP status code
 */
const paginatedResponse = (res, data, message = 'Success', statusCode = 200) => {
  const response = {
    success: true,
    message,
    data: data.items || data.data,
    pagination: data.pagination,
    timestamp: new Date().toISOString()
  };

  return res.status(statusCode).json(response);
};

/**
 * No content response (for DELETE operations)
 * @param {Object} res - Express response object
 * @param {String} message - Success message
 */
const noContentResponse = (res, message = 'Deleted successfully') => {
  return res.status(204).json({
    success: true,
    message,
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse,
  noContentResponse
};