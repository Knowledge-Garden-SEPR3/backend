/**
 * Resource Service Routes
 * Defines all routes for the resource management service
 */

const express = require('express');
const multer = require('multer');
const resourceController = require('../controllers/resource.controller');
const { authenticate, authorize } = require('../../../middleware');

const router = express.Router();

// Configure multer for memory storage (we'll upload to S3 from memory)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
  },
});

// Public routes
router.get('/', resourceController.getResources);

// Add special routes before the generic ID route
router.get('/popular', resourceController.getPopularResources);
router.get('/stats', resourceController.getResourceStats);

// Generic resource by ID route
router.get('/:id', resourceController.getResource);

// Protected routes
router.use(authenticate);

router.post('/', resourceController.createResource);
router.put('/:id', resourceController.updateResource);
router.delete('/:id', resourceController.deleteResource);
router.post('/:id/upload', upload.single('file'), resourceController.uploadResource);
router.get('/:id/download/:versionNumber?', resourceController.downloadResource);
router.get('/:id/versions', resourceController.getResourceVersions);

// Faculty/Admin only routes
router.put('/:id/verify', authorize(['faculty', 'admin']), resourceController.verifyResource);

module.exports = router;
