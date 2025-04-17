/**
 * Middleware module for Knowledge Garden backend
 * Centralizes all middleware functions used across the application
 */

const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Error handling middleware
 * Processes all errors and sends appropriate responses
 */
const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error(err.message, { stack: err.stack, path: req.path });

  // Set status code
  const statusCode = err.statusCode || 500;

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Server Error',
    ...(config.server.env === 'development' && { stack: err.stack }),
  });
};

/**
 * Request logging middleware
 * Logs all incoming requests
 */
const requestLogger = (req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
};

/**
 * Authentication middleware
 * Verifies JWT tokens and adds user info to request
 */
const authenticate = (req, res, next) => {
  // Get token from header - check both x-auth-token and Authorization header
  let token = req.header('x-auth-token');
  
  // If no x-auth-token, check Authorization header (Bearer token)
  if (!token) {
    const authHeader = req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // Remove 'Bearer ' prefix
    }
  }

  // Check if no token
  if (!token) {
    const error = new Error('Access denied. No token provided.');
    error.statusCode = 401;
    return next(error);
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, config.auth.jwtSecret);
    
    // Add user to request
    req.user = decoded;
    next();
  } catch (err) {
    const error = new Error('Invalid token');
    error.statusCode = 401;
    next(error);
  }
};

/**
 * Role-based authorization middleware
 * Checks if user has required role(s)
 * @param {string[]} roles - Array of allowed roles
 */
const authorize = (roles) => {
  return (req, res, next) => {
    // Check if user exists and has role property
    if (!req.user || !req.user.role) {
      const error = new Error('Unauthorized');
      error.statusCode = 403;
      return next(error);
    }

    // Check if user's role is in the allowed roles
    if (!roles.includes(req.user.role)) {
      const error = new Error('Forbidden: Insufficient permissions');
      error.statusCode = 403;
      return next(error);
    }

    next();
  };
};

/**
 * Validation middleware
 * Validates request data against a Joi schema
 * @param {object} schema - Joi validation schema
 */
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      const validationError = new Error(errorMessage);
      validationError.statusCode = 400;
      return next(validationError);
    }
    
    next();
  };
};

/**
 * Rate limiting error handler
 * Custom response for rate-limited requests
 */
const rateLimitHandler = (req, res) => {
  logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
  return res.status(429).json({
    success: false,
    error: 'Too many requests. Please try again later.',
  });
};

module.exports = {
  errorHandler,
  requestLogger,
  authenticate,
  authorize,
  validate,
  rateLimitHandler,
};
