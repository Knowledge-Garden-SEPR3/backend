/**
 * Authentication Controller
 * Handles user authentication operations like login, registration, password reset
 */

const User = require('../models/user.model');
const crypto = require('crypto');
const logger = require('../../../utils/logger');
const cache = require('../../../utils/cache');

/**
 * Register a new user
 * @route POST /api/users/register
 * @access Public
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      const error = new Error('User with this email already exists');
      error.statusCode = 400;
      return next(error);
    }

    // Create new user (restrict role creation to prevent privilege escalation)
    // Only admins can create faculty accounts, handled by authorization middleware
    const user = await User.create({
      name,
      email,
      password,
      role: role === 'admin' ? 'student' : role, // Prevent direct admin account creation
    });

    // Create and send token
    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};

/**
 * Login user
 * @route POST /api/users/login
 * @access Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      const error = new Error('Please provide email and password');
      error.statusCode = 400;
      return next(error);
    }

    // Check for user and include password in the result
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      const error = new Error('Invalid credentials');
      error.statusCode = 401;
      return next(error);
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      const error = new Error('Invalid credentials');
      error.statusCode = 401;
      return next(error);
    }

    // Check if account is active
    if (!user.isActive) {
      const error = new Error('This account has been deactivated');
      error.statusCode = 403;
      return next(error);
    }

    // Create and send token
    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

/**
 * Log user out / clear cookie
 * @route GET /api/users/logout
 * @access Private
 */
const logout = async (req, res, next) => {
  try {
    // Clear any user-related cache
    await cache.clearByPattern(`user:${req.user.id}:*`);
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current logged in user
 * @route GET /api/users/me
 * @access Private
 */
const getMe = async (req, res, next) => {
  try {
    // User is already available in req due to the auth middleware
    const userId = req.user.id;
    
    // Try to get from cache first
    const cacheKey = `user:${userId}:profile`;
    const cachedUser = await cache.get(cacheKey);
    
    if (cachedUser) {
      return res.status(200).json({
        success: true,
        data: cachedUser
      });
    }
    
    // If not in cache, get from database
    const user = await User.findById(userId);
    
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      return next(error);
    }
    
    // Get safe profile data
    const userProfile = user.getProfile();
    
    // Cache the result
    await cache.set(cacheKey, userProfile, 3600); // 1 hour cache
    
    res.status(200).json({
      success: true,
      data: userProfile
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Forgot password
 * @route POST /api/users/forgotpassword
 * @access Public
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    
    if (!user) {
      // Still return success for security reasons
      // Don't reveal if email exists in system
      return res.status(200).json({ 
        success: true, 
        message: 'Password reset email sent if account exists' 
      });
    }
    
    // Get reset token
    const resetToken = user.generatePasswordResetToken();
    
    await user.save({ validateBeforeSave: false });
    
    // Create reset URL
    const resetUrl = `${req.protocol}://${req.get('host')}/api/users/resetpassword/${resetToken}`;
    
    // TODO: Send email with reset URL
    // This would typically use a notification service or email service
    
    logger.info(`Password reset requested for: ${email}, token generated`);
    
    res.status(200).json({
      success: true,
      message: 'Password reset email sent',
      data: {
        resetUrl // Only included for development/testing
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password
 * @route PUT /api/users/resetpassword/:resettoken
 * @access Public
 */
const resetPassword = async (req, res, next) => {
  try {
    // Get hashed token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.resettoken)
      .digest('hex');
    
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });
    
    if (!user) {
      const error = new Error('Invalid or expired token');
      error.statusCode = 400;
      return next(error);
    }
    
    // Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    
    await user.save();
    
    // Clear cached user data
    await cache.clearByPattern(`user:${user.id}:*`);
    
    // Create and send token
    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

/**
 * Update user details
 * @route PUT /api/users/updatedetails
 * @access Private
 */
const updateDetails = async (req, res, next) => {
  try {
    // Fields to update (only allow certain fields to be updated)
    const fieldsToUpdate = {
      name: req.body.name,
      bio: req.body.bio,
      institution: req.body.institution,
      department: req.body.department
    };
    
    // Remove undefined fields
    Object.keys(fieldsToUpdate).forEach(
      key => fieldsToUpdate[key] === undefined && delete fieldsToUpdate[key]
    );
    
    // Update user
    const user = await User.findByIdAndUpdate(
      req.user.id,
      fieldsToUpdate,
      {
        new: true,
        runValidators: true
      }
    );
    
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      return next(error);
    }
    
    // Clear cached user data
    await cache.clearByPattern(`user:${user.id}:*`);
    
    res.status(200).json({
      success: true,
      data: user.getProfile()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update password
 * @route PUT /api/users/updatepassword
 * @access Private
 */
const updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Get user with password
    const user = await User.findById(req.user.id).select('+password');
    
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      return next(error);
    }
    
    // Check current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      const error = new Error('Current password is incorrect');
      error.statusCode = 401;
      return next(error);
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    // Clear cached user data
    await cache.clearByPattern(`user:${user.id}:*`);
    
    // Create and send token
    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

/**
 * Helper function to create token and send response
 * @param {Object} user - User document
 * @param {number} statusCode - HTTP status code
 * @param {Object} res - Express response object
 */
const sendTokenResponse = (user, statusCode, res) => {
  // Create token
  const token = user.generateAuthToken();
  
  // Remove password from output
  user.password = undefined;
  
  res.status(statusCode).json({
    success: true,
    token,
    data: user.getProfile()
  });
};

module.exports = {
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  updateDetails,
  updatePassword
};
