/**
 * Search Service Routes
 * Defines all routes for the search and discovery service
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../../../middleware');
const searchController = require('../controllers/search.controller');

// Public search routes
router.get('/', searchController.globalSearch);
router.get('/suggestions', searchController.getSearchSuggestions);
router.get('/advanced', searchController.advancedSearch);

// Protected routes (if needed in the future)
// router.use(authenticate);

module.exports = router;
