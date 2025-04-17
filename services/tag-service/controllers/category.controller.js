/**
 * Category Controller
 * Handles operations related to categories
 */

const Category = require('../models/category.model');
const logger = require('../../../utils/logger');
const elasticSearch = require('../../../utils/elasticsearch');

/**
 * Get all categories
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getCategories = async (req, res) => {
  try {
    const { query = '', limit = 20, page = 1, sort = 'name', order = 'asc', parentId } = req.query;
    
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { [sort]: order === 'desc' ? -1 : 1 }
    };
    
    let filterQuery = {};
    if (parentId) {
      if (parentId === 'root') {
        // Return only top-level categories
        filterQuery.parent = null;
      } else {
        // Return categories with specified parent
        filterQuery.parent = parentId;
      }
    }
    
    // If search query is provided, use it
    let categories;
    if (query) {
      // Use Elasticsearch for search if available
      try {
        const searchFields = ['name', 'description'];
        const filters = parentId ? { parent: parentId } : {};
        
        const esResults = await elasticSearch.fullTextSearch(
          elasticSearch.client.indices.categories, 
          query,
          searchFields,
          filters,
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
        const searchQuery = { 
          ...filterQuery,
          $text: { $search: query } 
        };
        
        categories = await Category.find(searchQuery)
          .sort(options.sort)
          .skip((options.page - 1) * options.limit)
          .limit(options.limit);
        
        const count = await Category.countDocuments(searchQuery);
        
        return res.status(200).json({
          success: true,
          count,
          data: categories
        });
      }
    } else {
      // No search query, return paginated categories
      categories = await Category.find(filterQuery)
        .sort(options.sort)
        .skip((options.page - 1) * options.limit)
        .limit(options.limit);
      
      const count = await Category.countDocuments(filterQuery);
      
      return res.status(200).json({
        success: true,
        count,
        data: categories
      });
    }
  } catch (error) {
    logger.error(`Error fetching categories: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching categories',
      error: error.message
    });
  }
};

/**
 * Get a single category by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    logger.error(`Error fetching category: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching category',
      error: error.message
    });
  }
};

/**
 * Get subcategories of a category
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getSubcategories = async (req, res) => {
  try {
    const subcategories = await Category.find({ parent: req.params.id })
      .sort({ name: 1 });
    
    return res.status(200).json({
      success: true,
      count: subcategories.length,
      data: subcategories
    });
  } catch (error) {
    logger.error(`Error fetching subcategories: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching subcategories',
      error: error.message
    });
  }
};

/**
 * Create a new category
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createCategory = async (req, res) => {
  try {
    const { name, description, parent } = req.body;
    
    // Check if category with same name already exists
    const existingCategory = await Category.findOne({ name: name.trim() });
    
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category with this name already exists'
      });
    }
    
    const categoryData = {
      name: name.trim(),
      description,
      createdBy: req.user.id
    };
    
    // If parent is specified, validate and set ancestors
    if (parent) {
      const parentCategory = await Category.findById(parent);
      
      if (!parentCategory) {
        return res.status(404).json({
          success: false,
          message: 'Parent category not found'
        });
      }
      
      categoryData.parent = parent;
      
      // Build ancestors array (parent's ancestors + parent itself)
      categoryData.ancestors = [
        ...(parentCategory.ancestors || []),
        parent
      ];
    }
    
    const category = await Category.create(categoryData);
    
    // Index in Elasticsearch
    try {
      await elasticSearch.indexDocument(
        elasticSearch.client.indices.categories,
        category.id,
        {
          id: category.id,
          name: category.name,
          description: category.description,
          slug: category.slug,
          parent: category.parent,
          resourceCount: category.resourceCount,
          createdAt: category.createdAt
        }
      );
    } catch (esError) {
      logger.warn(`Failed to index category in Elasticsearch: ${esError.message}`);
      // Continue even if Elasticsearch indexing fails
    }
    
    return res.status(201).json({
      success: true,
      data: category
    });
  } catch (error) {
    logger.error(`Error creating category: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating category',
      error: error.message
    });
  }
};

/**
 * Update a category
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateCategory = async (req, res) => {
  try {
    let category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    // Only admin can update categories
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update categories'
      });
    }
    
    // If changing name, check for duplicates
    if (req.body.name && req.body.name.trim() !== category.name) {
      const existingCategory = await Category.findOne({ name: req.body.name.trim() });
      
      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: 'Category with this name already exists'
        });
      }
    }
    
    // We don't allow changing the parent through this endpoint
    // as it requires rebuilding the ancestors array
    if (req.body.parent) {
      delete req.body.parent;
    }
    
    // Update category
    category = await Category.findByIdAndUpdate(
      req.params.id, 
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );
    
    // Update in Elasticsearch
    try {
      await elasticSearch.updateDocument(
        elasticSearch.client.indices.categories,
        category.id,
        {
          name: category.name,
          description: category.description,
          slug: category.slug,
          updatedAt: category.updatedAt
        }
      );
    } catch (esError) {
      logger.warn(`Failed to update category in Elasticsearch: ${esError.message}`);
      // Continue even if Elasticsearch update fails
    }
    
    return res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    logger.error(`Error updating category: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating category',
      error: error.message
    });
  }
};

/**
 * Delete a category
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    // Only admin can delete categories
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete categories'
      });
    }
    
    // Check if category has subcategories
    const hasSubcategories = await Category.exists({ parent: req.params.id });
    
    if (hasSubcategories) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category with subcategories. Delete subcategories first or reassign them.'
      });
    }
    
    // Check if category has resources
    if (category.resourceCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category with resources. Remove resources first or reassign them.'
      });
    }
    
    // Delete from MongoDB
    await category.remove();
    
    // Delete from Elasticsearch
    try {
      await elasticSearch.deleteDocument(
        elasticSearch.client.indices.categories,
        category.id
      );
    } catch (esError) {
      logger.warn(`Failed to delete category from Elasticsearch: ${esError.message}`);
      // Continue even if Elasticsearch deletion fails
    }
    
    return res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    logger.error(`Error deleting category: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting category',
      error: error.message
    });
  }
};

/**
 * Move a category to a new parent
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.moveCategory = async (req, res) => {
  try {
    const { newParentId } = req.body;
    const categoryId = req.params.id;
    
    // Only admin can move categories
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to move categories'
      });
    }
    
    const category = await Category.findById(categoryId);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    // Handle moving to root level
    if (newParentId === 'root') {
      category.parent = null;
      category.ancestors = [];
    } else {
      // Validate that new parent exists
      const newParent = await Category.findById(newParentId);
      
      if (!newParent) {
        return res.status(404).json({
          success: false,
          message: 'New parent category not found'
        });
      }
      
      // Check for circular reference (cannot move to own descendant)
      if (newParent.ancestors.includes(categoryId) || newParentId === categoryId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot move category to its own subcategory or itself'
        });
      }
      
      // Update parent and ancestors
      category.parent = newParentId;
      category.ancestors = [...newParent.ancestors, newParentId];
    }
    
    await category.save();
    
    // Update all subcategories' ancestors recursively
    await updateSubcategoryAncestors(categoryId, category.ancestors);
    
    // Update in Elasticsearch
    try {
      await elasticSearch.updateDocument(
        elasticSearch.client.indices.categories,
        category.id,
        {
          parent: category.parent,
          updatedAt: category.updatedAt
        }
      );
    } catch (esError) {
      logger.warn(`Failed to update moved category in Elasticsearch: ${esError.message}`);
    }
    
    return res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    logger.error(`Error moving category: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Server error while moving category',
      error: error.message
    });
  }
};

/**
 * Helper function to update ancestors of all subcategories
 * @param {string} parentId - ID of the parent category
 * @param {Array} parentAncestors - Array of parent's ancestors
 */
async function updateSubcategoryAncestors(parentId, parentAncestors) {
  const subcategories = await Category.find({ parent: parentId });
  
  for (const subcategory of subcategories) {
    // Update ancestors to include the parent's ancestors and the parent itself
    subcategory.ancestors = [...parentAncestors, parentId];
    await subcategory.save();
    
    // Update this subcategory's children
    await updateSubcategoryAncestors(subcategory._id, subcategory.ancestors);
  }
}
