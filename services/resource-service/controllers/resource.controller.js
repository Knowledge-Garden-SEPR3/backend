/**
 * Resource Controller
 * Handles CRUD operations for academic resources
 */

const Resource = require('../models/resource.model');
const cache = require('../../../utils/cache');
const logger = require('../../../utils/logger');
const AWS = require('aws-sdk');
const config = require('../../../config');
const mongoose = require('mongoose');

// Configure AWS
const s3 = new AWS.S3({
  accessKeyId: config.aws.accessKeyId,
  secretAccessKey: config.aws.secretAccessKey,
  region: config.aws.region
});

/**
 * Get all resources with pagination and filtering
 * @route GET /api/resources
 * @access Public (with visibility restrictions)
 */
const getResources = async (req, res, next) => {
  try {
    // Extract query parameters
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const sort = req.query.sort || '-createdAt'; // Default sort by newest
    const resourceType = req.query.type;
    const category = req.query.category;
    const tag = req.query.tag;
    const verified = req.query.verified === 'true';
    const searchTerm = req.query.search;

    // Build query
    const query = { status: 'active' };

    // Non-authenticated users can only see public resources
    if (!req.user) {
      query.visibility = 'public';
    } else if (req.user.role !== 'admin') {
      // Regular users can see public resources and their own resources
      // and resources they have access to
      query.$or = [
        { visibility: 'public' },
        { owner: req.user.id },
        { visibility: 'restricted', accessList: req.user.id }
      ];
    }
    // Admins can see all resources

    // Apply filters
    if (resourceType) {
      query.resourceType = resourceType;
    }

    if (category) {
      query.categories = mongoose.Types.ObjectId(category);
    }

    if (tag) {
      query.tags = tag;
    }

    if (verified) {
      query.isVerified = true;
    }

    // Apply search
    if (searchTerm) {
      query.$text = { $search: searchTerm };
    }

    // Calculate pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Resource.countDocuments(query);

    // Prepare sorting
    const sortOptions = {};
    const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
    const sortOrder = sort.startsWith('-') ? -1 : 1;
    sortOptions[sortField] = sortOrder;

    // Execute query with pagination and sorting
    const resources = await Resource.find(query)
      .select('-versions')
      .populate('owner', 'name profileImage')
      .populate('verifiedBy', 'name')
      .populate('categories', 'name')
      .sort(sortOptions)
      .skip(startIndex)
      .limit(limit);

    // Build pagination info
    const pagination = {};

    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit
      };
    }

    res.status(200).json({
      success: true,
      count: resources.length,
      pagination,
      total,
      data: resources
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single resource
 * @route GET /api/resources/:id
 * @access Public (with visibility restrictions)
 */
const getResource = async (req, res, next) => {
  try {
    const resourceId = req.params.id;

    // Try to get from cache first
    const cacheKey = `resource:${resourceId}`;
    const cachedResource = await cache.get(cacheKey);

    let resource;
    if (cachedResource) {
      resource = cachedResource;
    } else {
      // If not in cache, get from database
      resource = await Resource.findById(resourceId)
        .populate('owner', 'name profileImage')
        .populate('verifiedBy', 'name')
        .populate('categories', 'name')
        .populate('collections', 'name');

      if (!resource) {
        const error = new Error(`Resource not found with id of ${resourceId}`);
        error.statusCode = 404;
        return next(error);
      }

      // Cache the result
      await cache.set(cacheKey, resource, 3600); // 1 hour cache
    }

    // Check visibility permissions
    if (resource.visibility !== 'public') {
      // Non-public resources require authentication
      if (!req.user) {
        const error = new Error('Not authorized to access this resource');
        error.statusCode = 401;
        return next(error);
      }

      // Check if user is owner or admin
      const isOwner = resource.owner._id.toString() === req.user.id;
      const isAdmin = req.user.role === 'admin';
      const isInAccessList = resource.accessList && resource.accessList.includes(req.user.id);

      if (!isOwner && !isAdmin && !isInAccessList) {
        const error = new Error('Not authorized to access this resource');
        error.statusCode = 403;
        return next(error);
      }
    }

    // Increment view count asynchronously
    if (!req.query.noStats) {
      Resource.findByIdAndUpdate(
        resourceId,
        { $inc: { viewCount: 1 } },
        { new: true }
      ).then(updatedResource => {
        // Update cache with new view count
        if (updatedResource) {
          cache.set(cacheKey, updatedResource, 3600);
        }
      }).catch(err => {
        logger.error(`Error updating view count: ${err.message}`);
      });
    }

    res.status(200).json({
      success: true,
      data: resource
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create new resource
 * @route POST /api/resources
 * @access Private
 */
const createResource = async (req, res, next) => {
  try {
    // Add owner to request body
    req.body.owner = req.user.id;

    // Create resource
    const resource = await Resource.create(req.body);

    res.status(201).json({
      success: true,
      data: resource
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update resource
 * @route PUT /api/resources/:id
 * @access Private
 */
const updateResource = async (req, res, next) => {
  try {
    const resourceId = req.params.id;

    let resource = await Resource.findById(resourceId);

    if (!resource) {
      const error = new Error(`Resource not found with id of ${resourceId}`);
      error.statusCode = 404;
      return next(error);
    }

    // Check if user is owner or admin
    const isOwner = resource.owner.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      const error = new Error('Not authorized to update this resource');
      error.statusCode = 403;
      return next(error);
    }

    // Fields that should not be updated directly
    const restrictedFields = ['owner', 'versions', 'currentVersion', 'viewCount', 
      'downloadCount', 'averageRating', 'ratingCount', 'isVerified', 'verifiedBy', 
      'verificationDate'];

    // Remove restricted fields from request body
    restrictedFields.forEach(field => {
      if (req.body[field]) {
        delete req.body[field];
      }
    });

    // Update resource
    resource = await Resource.findByIdAndUpdate(
      resourceId,
      req.body,
      {
        new: true,
        runValidators: true
      }
    ).populate('owner', 'name profileImage')
      .populate('verifiedBy', 'name')
      .populate('categories', 'name');

    // Clear cache
    await cache.del(`resource:${resourceId}`);

    res.status(200).json({
      success: true,
      data: resource
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete resource (soft delete)
 * @route DELETE /api/resources/:id
 * @access Private
 */
const deleteResource = async (req, res, next) => {
  try {
    const resourceId = req.params.id;

    const resource = await Resource.findById(resourceId);

    if (!resource) {
      const error = new Error(`Resource not found with id of ${resourceId}`);
      error.statusCode = 404;
      return next(error);
    }

    // Check if user is owner or admin
    const isOwner = resource.owner.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      const error = new Error('Not authorized to delete this resource');
      error.statusCode = 403;
      return next(error);
    }

    // Soft delete - mark as deleted
    resource.status = 'deleted';
    await resource.save();

    // Clear cache
    await cache.del(`resource:${resourceId}`);

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload resource file (new version)
 * @route POST /api/resources/:id/upload
 * @access Private
 */
const uploadResource = async (req, res, next) => {
  try {
    const resourceId = req.params.id;

    // Check if resource exists
    let resource = await Resource.findById(resourceId);

    if (!resource) {
      const error = new Error(`Resource not found with id of ${resourceId}`);
      error.statusCode = 404;
      return next(error);
    }

    // Check if user is owner or admin
    const isOwner = resource.owner.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      const error = new Error('Not authorized to update this resource');
      error.statusCode = 403;
      return next(error);
    }

    // Check if file was uploaded
    if (!req.file) {
      const error = new Error('Please upload a file');
      error.statusCode = 400;
      return next(error);
    }

    // Prepare the file for S3 upload
    const fileContent = req.file.buffer;
    const fileName = `${Date.now()}-${req.file.originalname.replace(/\s+/g, '-')}`;
    const filePath = `resources/${resourceId}/${fileName}`;
    
    // Set the parameters for S3 upload
    const params = {
      Bucket: config.aws.bucketName,
      Key: filePath,
      Body: fileContent,
      ContentType: req.file.mimetype
    };

    // Upload to S3
    const uploadResult = await s3.upload(params).promise();

    // Create new version object
    const versionData = {
      fileUrl: uploadResult.Location,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      createdBy: req.user.id,
      description: req.body.description || `Version ${resource.currentVersion + 1}`
    };

    // Add new version to resource
    const newVersion = resource.addVersion(versionData);
    await resource.save();

    // Clear cache
    await cache.del(`resource:${resourceId}`);

    res.status(200).json({
      success: true,
      data: {
        resource,
        version: newVersion
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Download resource
 * @route GET /api/resources/:id/download/:versionNumber?
 * @access Private (with visibility restrictions)
 */
const downloadResource = async (req, res, next) => {
  try {
    const resourceId = req.params.id;
    const versionNumber = parseInt(req.params.versionNumber, 10) || null;

    // Get resource
    const resource = await Resource.findById(resourceId);

    if (!resource) {
      const error = new Error(`Resource not found with id of ${resourceId}`);
      error.statusCode = 404;
      return next(error);
    }

    // Check visibility permissions
    if (resource.visibility !== 'public') {
      // Non-public resources require authentication
      if (!req.user) {
        const error = new Error('Not authorized to access this resource');
        error.statusCode = 401;
        return next(error);
      }

      // Check if user is owner or admin
      const isOwner = resource.owner.toString() === req.user.id;
      const isAdmin = req.user.role === 'admin';
      const isInAccessList = resource.accessList && resource.accessList.includes(req.user.id);

      if (!isOwner && !isAdmin && !isInAccessList) {
        const error = new Error('Not authorized to access this resource');
        error.statusCode = 403;
        return next(error);
      }
    }

    // Get version to download
    let version;
    if (versionNumber) {
      version = resource.versions.find(v => v.versionNumber === versionNumber);
      if (!version) {
        const error = new Error(`Version ${versionNumber} not found`);
        error.statusCode = 404;
        return next(error);
      }
    } else {
      // Use current version if none specified
      version = resource.getCurrentVersion();
    }

    // Extract S3 key from URL
    const url = new URL(version.fileUrl);
    const key = url.pathname.substring(1); // Remove leading slash

    // Get file from S3
    const params = {
      Bucket: config.aws.bucketName,
      Key: key
    };

    // Get signed URL for download
    const signedUrl = s3.getSignedUrl('getObject', {
      ...params,
      Expires: 60 // URL expires in 60 seconds
    });

    // Increment download count asynchronously
    Resource.findByIdAndUpdate(
      resourceId,
      { $inc: { downloadCount: 1 } },
      { new: true }
    ).then(updatedResource => {
      // Update cache with new download count
      if (updatedResource) {
        cache.set(`resource:${resourceId}`, updatedResource, 3600);
      }
    }).catch(err => {
      logger.error(`Error updating download count: ${err.message}`);
    });

    // Redirect to signed URL
    res.redirect(signedUrl);
  } catch (error) {
    next(error);
  }
};

/**
 * Verify resource (faculty/admin only)
 * @route PUT /api/resources/:id/verify
 * @access Private/Faculty
 */
const verifyResource = async (req, res, next) => {
  try {
    const resourceId = req.params.id;

    // Get resource
    const resource = await Resource.findById(resourceId);

    if (!resource) {
      const error = new Error(`Resource not found with id of ${resourceId}`);
      error.statusCode = 404;
      return next(error);
    }

    // Check if user is faculty or admin
    if (!['faculty', 'admin'].includes(req.user.role)) {
      const error = new Error('Not authorized to verify resources');
      error.statusCode = 403;
      return next(error);
    }

    // Verify the resource
    const success = resource.verify(req.user);

    if (!success) {
      const error = new Error('Failed to verify resource');
      error.statusCode = 400;
      return next(error);
    }

    await resource.save();

    // Clear cache
    await cache.del(`resource:${resourceId}`);

    res.status(200).json({
      success: true,
      data: resource
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get resource versions
 * @route GET /api/resources/:id/versions
 * @access Private (with visibility restrictions)
 */
const getResourceVersions = async (req, res, next) => {
  try {
    const resourceId = req.params.id;

    // Get resource
    const resource = await Resource.findById(resourceId)
      .populate({
        path: 'versions.createdBy',
        select: 'name profileImage'
      });

    if (!resource) {
      const error = new Error(`Resource not found with id of ${resourceId}`);
      error.statusCode = 404;
      return next(error);
    }

    // Check visibility permissions
    if (resource.visibility !== 'public') {
      // Non-public resources require authentication
      if (!req.user) {
        const error = new Error('Not authorized to access this resource');
        error.statusCode = 401;
        return next(error);
      }

      // Check if user is owner or admin
      const isOwner = resource.owner.toString() === req.user.id;
      const isAdmin = req.user.role === 'admin';
      const isInAccessList = resource.accessList && resource.accessList.includes(req.user.id);

      if (!isOwner && !isAdmin && !isInAccessList) {
        const error = new Error('Not authorized to access this resource');
        error.statusCode = 403;
        return next(error);
      }
    }

    res.status(200).json({
      success: true,
      currentVersion: resource.currentVersion,
      data: resource.versions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get popular resources
 * @route GET /api/resources/popular
 * @access Public
 */
const getPopularResources = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    // Get resources sorted by view count and rating
    const resources = await Resource.find({ visibility: 'public', status: 'active' })
      .sort({ viewCount: -1, averageRating: -1 })
      .limit(limit)
      .populate('owner', 'name profileImage')
      .populate('categories', 'name')
      .select('-versions');
    
    // Return the resources
    return res.status(200).json({
      success: true,
      count: resources.length,
      data: resources
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get resource statistics
 * @route GET /api/resources/stats
 * @access Public
 */
const getResourceStats = async (req, res, next) => {
  try {
    // Get total counts
    const totalResources = await Resource.countDocuments();
    const publicResources = await Resource.countDocuments({ visibility: 'public' });
    const verifiedResources = await Resource.countDocuments({ isVerified: true });
    
    // Get resource counts by type
    const typeStats = await Resource.aggregate([
      { $group: { _id: '$resourceType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Get resource counts by category
    const categoryStats = await Resource.aggregate([
      { $unwind: '$categories' },
      { $group: { _id: '$categories', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    // Return the stats
    return res.status(200).json({
      success: true,
      data: {
        totalResources,
        publicResources,
        verifiedResources,
        typeStats,
        categoryStats
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getResources,
  getResource,
  getPopularResources,
  getResourceStats,
  createResource,
  updateResource,
  deleteResource,
  uploadResource,
  downloadResource,
  verifyResource,
  getResourceVersions
};
