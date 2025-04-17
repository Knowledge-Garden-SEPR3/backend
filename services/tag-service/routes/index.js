/**
 * Tag Service Routes
 * Defines all routes for the tagging and categorization service
 */

const express = require('express');
const { validate } = require('../../../middleware');
const { authenticate, authorize } = require('../../../middleware');
const tagController = require('../controllers/tag.controller');
const categoryController = require('../controllers/category.controller');

const router = express.Router();

// Tag public routes
router.get('/tags', tagController.getTags);
router.get('/tags/popular', tagController.getPopularTags);
router.get('/tags/suggestions', tagController.getTagSuggestions);
router.get('/tags/:id', tagController.getTag);

// Category public routes
router.get('/categories', categoryController.getCategories);
router.get('/categories/:id', categoryController.getCategory);
router.get('/categories/:id/subcategories', categoryController.getSubcategories);

// Protected routes - require authentication
router.use(authenticate);

// Tag protected routes
router.post('/tags', tagController.createTag);
router.put('/tags/:id', tagController.updateTag);
router.delete('/tags/:id', tagController.deleteTag);
router.post('/tags/:id/increment', tagController.incrementUsage);

// Category protected routes - admin only
router.use('/categories', authorize(['admin']));
router.post('/categories', categoryController.createCategory);
router.put('/categories/:id', categoryController.updateCategory);
router.delete('/categories/:id', categoryController.deleteCategory);
router.put('/categories/:id/move', categoryController.moveCategory);

module.exports = router;
