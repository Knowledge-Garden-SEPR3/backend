/**
 * User Controller
 * Handles administrative user operations like user management
 */

const User = require('../models/user.model');
const cache = require('../../../utils/cache');
const logger = require('../../../utils/logger');

/**
 * Get all users
 * @route GET /api/users
 * @access Private/Admin
 */
const getUsers = async (req, res, next) => {
  try {
    // Extract query parameters for pagination and filtering
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const role = req.query.role;
    const nameSearch = req.query.name;
    
    // Build query
    const query = {};
    
    // Filter by role if provided
    if (role && ['student', 'faculty', 'admin'].includes(role)) {
      query.role = role;
    }
    
    // Search by name if provided
    if (nameSearch) {
      query.name = { $regex: nameSearch, $options: 'i' }; // Case-insensitive search
    }
    
    // Calculate pagination values
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    
    // Get total count
    const total = await User.countDocuments(query);
    
    // Execute query with pagination
    const users = await User.find(query)
      .select('-__v')
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit);
    
    // Prepare pagination object
    const pagination = {};
    
    // Add next page if available
    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit
      };
    }
    
    // Add previous page if available
    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit
      };
    }
    
    // Transform users to public profiles
    const userProfiles = users.map(user => user.getProfile());
    
    res.status(200).json({
      success: true,
      count: users.length,
      pagination,
      total,
      data: userProfiles
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single user
 * @route GET /api/users/:id
 * @access Private/Admin
 */
const getUser = async (req, res, next) => {
  try {
    const userId = req.params.id;
    
    // Try to get from cache first
    const cacheKey = `admin:user:${userId}`;
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
      const error = new Error(`User not found with id of ${userId}`);
      error.statusCode = 404;
      return next(error);
    }
    
    // Get profile data
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
 * Create user (admin only)
 * @route POST /api/users
 * @access Private/Admin
 */
const createUser = async (req, res, next) => {
  try {
    // Admin can create users with any role
    const user = await User.create(req.body);
    
    res.status(201).json({
      success: true,
      data: user.getProfile()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user (admin only)
 * @route PUT /api/users/:id
 * @access Private/Admin
 */
const updateUser = async (req, res, next) => {
  try {
    const userId = req.params.id;
    
    // Prevent password update through this route
    if (req.body.password) {
      delete req.body.password;
    }
    
    const user = await User.findByIdAndUpdate(
      userId,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );
    
    if (!user) {
      const error = new Error(`User not found with id of ${userId}`);
      error.statusCode = 404;
      return next(error);
    }
    
    // Clear cached user data
    await cache.clearByPattern(`user:${userId}:*`);
    await cache.clearByPattern(`admin:user:${userId}`);
    
    res.status(200).json({
      success: true,
      data: user.getProfile()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete user (admin only)
 * @route DELETE /api/users/:id
 * @access Private/Admin
 */
const deleteUser = async (req, res, next) => {
  try {
    const userId = req.params.id;
    
    // Check if trying to delete self
    if (userId === req.user.id) {
      const error = new Error('Cannot delete your own account through this endpoint');
      error.statusCode = 400;
      return next(error);
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
      const error = new Error(`User not found with id of ${userId}`);
      error.statusCode = 404;
      return next(error);
    }
    
    // Instead of hard delete, you might want to set the user as inactive
    user.isActive = false;
    await user.save();
    
    // Clear cached user data
    await cache.clearByPattern(`user:${userId}:*`);
    await cache.clearByPattern(`admin:user:${userId}`);
    
    logger.info(`User ${userId} marked as inactive by admin ${req.user.id}`);
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change user role (admin only)
 * @route PUT /api/users/:id/role
 * @access Private/Admin
 */
const changeUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const userId = req.params.id;
    
    // Validate role
    if (!role || !['student', 'faculty', 'admin'].includes(role)) {
      const error = new Error('Valid role required');
      error.statusCode = 400;
      return next(error);
    }
    
    // Check if trying to modify self
    if (userId === req.user.id) {
      const error = new Error('Cannot change your own role');
      error.statusCode = 400;
      return next(error);
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
      const error = new Error(`User not found with id of ${userId}`);
      error.statusCode = 404;
      return next(error);
    }
    
    // Update role
    user.role = role;
    await user.save();
    
    // Clear cached user data
    await cache.clearByPattern(`user:${userId}:*`);
    await cache.clearByPattern(`admin:user:${userId}`);
    
    logger.info(`User ${userId} role changed to ${role} by admin ${req.user.id}`);
    
    res.status(200).json({
      success: true,
      data: user.getProfile()
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  changeUserRole
};
