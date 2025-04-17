/**
 * Tag Controller
 * Handles operations related to tags
 */

const Tag = require('../models/tag.model');
const logger = require('../../../utils/logger');
const elasticSearch = require('../../../utils/elasticsearch');

/**
 * Get all tags
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getTags = async (req, res) => {
  try {
    const { query = '', limit = 20, page = 1, sort = 'usageCount', order = 'desc' } = req.query;
    
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { [sort]: order === 'desc' ? -1 : 1 }
    };
    
    // If search query is provided, use it
    let tags;
    if (query) {
      // Use Elasticsearch for search if available
      try {
        const searchFields = ['name', 'description'];
        const esResults = await elasticSearch.fullTextSearch(
          elasticSearch.client.indices.tags, 
          query,
          searchFields,
          {},
          { size: options.limit, from: (options.page - 1) * options.limit }
        );
        
        return res.status(200).json({
          success: true,
          count: esResults.total,
          data: esResults.hits
        });
      } catch (esError) {
        logger.warn(`Elasticsearch search failed, falling back to MongoDB: ${esError.message}`);
        // Fall back to MongoDB search
        const searchQuery = { $text: { $search: query } };
        tags = await Tag.find(searchQuery)
          .sort(options.sort)
          .skip((options.page - 1) * options.limit)
          .limit(options.limit);
        
        const count = await Tag.countDocuments(searchQuery);
        
        return res.status(200).json({
          success: true,
          count,
          data: tags
        });
      }
    } else {
      // No search query, return paginated tags
      tags = await Tag.find()
        .sort(options.sort)
        .skip((options.page - 1) * options.limit)
        .limit(options.limit);
      
      const count = await Tag.countDocuments();
      
      return res.status(200).json({
        success: true,
        count,
        data: tags
      });
    }
  } catch (error) {
    logger.error(`Error fetching tags: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching tags',
      error: error.message
    });
  }
};

/**
 * Get popular tags
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getPopularTags = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const popularTags = await Tag.find()
      .sort({ usageCount: -1 })
      .limit(parseInt(limit, 10));
    
    return res.status(200).json({
      success: true,
      count: popularTags.length,
      data: popularTags
    });
  } catch (error) {
    logger.error(`Error fetching popular tags: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching popular tags',
      error: error.message
    });
  }
};

/**
 * Get a single tag by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getTag = async (req, res) => {
  try {
    const tag = await Tag.findById(req.params.id);
    
    if (!tag) {
      return res.status(404).json({
        success: false,
        message: 'Tag not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: tag
    });
  } catch (error) {
    logger.error(`Error fetching tag: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching tag',
      error: error.message
    });
  }
};

/**
 * Create a new tag
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createTag = async (req, res) => {
  try {
    // Check if tag already exists
    const existingTag = await Tag.findOne({ name: req.body.name.toLowerCase().trim() });
    
    if (existingTag) {
      return res.status(400).json({
        success: false,
        message: 'Tag already exists'
      });
    }
    
    // Create tag with lowercase name
    const tagData = {
      ...req.body,
      name: req.body.name.toLowerCase().trim(),
      createdBy: req.user.id
    };
    
    const tag = await Tag.create(tagData);
    
    // Index in Elasticsearch
    try {
      await elasticSearch.indexDocument(
        elasticSearch.client.indices.tags,
        tag.id,
        {
          id: tag.id,
          name: tag.name,
          description: tag.description,
          usageCount: tag.usageCount,
          createdAt: tag.createdAt
        }
      );
    } catch (esError) {
      logger.warn(`Failed to index tag in Elasticsearch: ${esError.message}`);
      // Continue even if Elasticsearch indexing fails
    }
    
    return res.status(201).json({
      success: true,
      data: tag
    });
  } catch (error) {
    logger.error(`Error creating tag: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating tag',
      error: error.message
    });
  }
};

/**
 * Update a tag
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateTag = async (req, res) => {
  try {
    let tag = await Tag.findById(req.params.id);
    
    if (!tag) {
      return res.status(404).json({
        success: false,
        message: 'Tag not found'
      });
    }
    
    // If user is not admin or the creator, deny access
    if (req.user.role !== 'admin' && tag.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this tag'
      });
    }
    
    // If trying to update name, check for duplicates
    if (req.body.name && req.body.name.toLowerCase().trim() !== tag.name) {
      const existingTag = await Tag.findOne({ name: req.body.name.toLowerCase().trim() });
      
      if (existingTag) {
        return res.status(400).json({
          success: false,
          message: 'Tag name already exists'
        });
      }
      
      // Update with lowercase name
      req.body.name = req.body.name.toLowerCase().trim();
    }
    
    // Update tag
    tag = await Tag.findByIdAndUpdate(
      req.params.id, 
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );
    
    // Update in Elasticsearch
    try {
      await elasticSearch.updateDocument(
        elasticSearch.client.indices.tags,
        tag.id,
        {
          name: tag.name,
          description: tag.description,
          usageCount: tag.usageCount,
          updatedAt: tag.updatedAt
        }
      );
    } catch (esError) {
      logger.warn(`Failed to update tag in Elasticsearch: ${esError.message}`);
      // Continue even if Elasticsearch update fails
    }
    
    return res.status(200).json({
      success: true,
      data: tag
    });
  } catch (error) {
    logger.error(`Error updating tag: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating tag',
      error: error.message
    });
  }
};

/**
 * Delete a tag
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.deleteTag = async (req, res) => {
  try {
    const tag = await Tag.findById(req.params.id);
    
    if (!tag) {
      return res.status(404).json({
        success: false,
        message: 'Tag not found'
      });
    }
    
    // Only admin or tag creator can delete
    if (req.user.role !== 'admin' && tag.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this tag'
      });
    }
    
    // Check if tag is a system tag
    if (tag.isSystemTag && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'System tags can only be deleted by administrators'
      });
    }
    
    // Delete from MongoDB
    await tag.remove();
    
    // Delete from Elasticsearch
    try {
      await elasticSearch.deleteDocument(
        elasticSearch.client.indices.tags,
        tag.id
      );
    } catch (esError) {
      logger.warn(`Failed to delete tag from Elasticsearch: ${esError.message}`);
      // Continue even if Elasticsearch deletion fails
    }
    
    return res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    logger.error(`Error deleting tag: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting tag',
      error: error.message
    });
  }
};

/**
 * Get tag suggestions based on prefix
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getTagSuggestions = async (req, res) => {
  try {
    const { prefix, limit = 5 } = req.query;
    
    if (!prefix) {
      return res.status(400).json({
        success: false,
        message: 'Prefix parameter is required'
      });
    }
    
    // Try Elasticsearch first for better suggestion performance
    try {
      const suggestions = await elasticSearch.getSuggestions(
        elasticSearch.client.indices.tags,
        prefix,
        ['name'],
        parseInt(limit, 10)
      );
      
      return res.status(200).json({
        success: true,
        count: suggestions.length,
        data: suggestions
      });
    } catch (esError) {
      logger.warn(`Elasticsearch suggestions failed, falling back to MongoDB: ${esError.message}`);
      
      // Fall back to MongoDB
      const regex = new RegExp(`^${prefix}`, 'i');
      const tags = await Tag.find({ name: regex })
        .limit(parseInt(limit, 10))
        .select('name');
      
      return res.status(200).json({
        success: true,
        count: tags.length,
        data: tags.map(tag => tag.name)
      });
    }
  } catch (error) {
    logger.error(`Error getting tag suggestions: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Server error while getting tag suggestions',
      error: error.message
    });
  }
};

/**
 * Increment tag usage count
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.incrementUsage = async (req, res) => {
  try {
    const tag = await Tag.findById(req.params.id);
    
    if (!tag) {
      return res.status(404).json({
        success: false,
        message: 'Tag not found'
      });
    }
    
    // Increment usage count
    tag.usageCount += 1;
    await tag.save();
    
    // Update in Elasticsearch
    try {
      await elasticSearch.updateDocument(
        elasticSearch.client.indices.tags,
        tag.id,
        { usageCount: tag.usageCount }
      );
    } catch (esError) {
      logger.warn(`Failed to update tag usage count in Elasticsearch: ${esError.message}`);
    }
    
    return res.status(200).json({
      success: true,
      data: tag
    });
  } catch (error) {
    logger.error(`Error incrementing tag usage: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Server error while incrementing tag usage',
      error: error.message
    });
  }
};
