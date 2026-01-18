/**
 * Centralized Error Handler Middleware
 * 
 * Handles all errors in the application with:
 * - Consistent error response format
 * - Proper HTTP status codes
 * - Safe error logging (no sensitive data)
 * - User-friendly error messages
 * - Detailed server-side logging
 */

const logger = require('../config/logger');

/**
 * Custom error class for application-specific errors
 */
class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Main error handler middleware
 * Must be registered LAST in the app
 */
const errorHandler = (err, req, res, next) => {
  // Set defaults
  err.statusCode = err.statusCode || 500;
  err.message = err.message || 'Internal Server Error';

  // Handle specific error types
  if (err.name === 'PrismaClientValidationError') {
    err.statusCode = 400;
    err.message = 'Invalid data format';
  }

  if (err.name === 'PrismaClientRuntimeError') {
    err.statusCode = 500;
    err.message = 'Database operation failed';
  }

  if (err.name === 'JsonWebTokenError') {
    err.statusCode = 401;
    err.message = 'Invalid or expired token';
  }

  if (err.name === 'TokenExpiredError') {
    err.statusCode = 401;
    err.message = 'Token has expired';
  }

  // Log error (server-side - safe)
  const errorLog = {
    timestamp: err.timestamp || new Date().toISOString(),
    method: req.method,
    path: req.path,
    statusCode: err.statusCode,
    message: err.message,
    errorType: err.name,
    userId: req.user?.id || 'anonymous',
    // Only log safe details
    details: err.details,
  };

  if (err.statusCode >= 500) {
    logger.error('Server Error', errorLog);
    // Log full stack trace server-side only
    logger.debug('Stack Trace', { stack: err.stack });
  } else {
    logger.warn('Client Error', errorLog);
  }

  // Send response (no sensitive data)
  res.status(err.statusCode).json({
    success: false,
    error: err.message,
    statusCode: err.statusCode,
    timestamp: err.timestamp || new Date().toISOString(),
    // Only include request ID for tracing (no sensitive data)
    requestId: req.id,
    // Include details only if it's not a 500 error
    ...(err.statusCode < 500 && err.details && { details: err.details })
  });
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Validation error handler
 * Formats validation errors consistently
 */
const validationError = (message, fields = {}) => {
  const error = new AppError(message, 400, { validationErrors: fields });
  return error;
};

/**
 * Authorization error handler
 */
const authorizationError = (message = 'Unauthorized') => {
  return new AppError(message, 401);
};

/**
 * Not found error handler
 */
const notFoundError = (resource = 'Resource') => {
  return new AppError(`${resource} not found`, 404);
};

/**
 * Conflict error handler
 */
const conflictError = (message) => {
  return new AppError(message, 409);
};

/**
 * Rate limit error handler
 */
const rateLimitError = () => {
  return new AppError('Too many requests. Please try again later.', 429);
};

module.exports = {
  errorHandler,
  AppError,
  asyncHandler,
  validationError,
  authorizationError,
  notFoundError,
  conflictError,
  rateLimitError
};
