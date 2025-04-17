/**
 * Knowledge Garden API Server
 * Main entry point for the application
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const mongoose = require('mongoose');

// Load configuration
const config = require('./config');

// Import middleware
const { errorHandler } = require('./middleware');
const requestLogger = require('./middleware/requestLogger');

// Import route handlers
const userRoutes = require('./services/user-service/routes');
const resourceRoutes = require('./services/resource-service/routes');
const searchRoutes = require('./services/search-service/routes');
const tagRoutes = require('./services/tag-service/routes');
const collaborationRoutes = require('./services/collaboration-service/routes');
const ratingRoutes = require('./services/rating-service/routes');
const analyticsRoutes = require('./services/analytics-service/routes');

// Import utils
const logger = require('./utils/logger');

// Initialize Express app
const app = express();

// Connect to MongoDB
mongoose.connect(config.database.uri, config.database.options)
  .then(() => {
    logger.info('Connected to MongoDB');
  })
  .catch(err => {
    logger.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Swagger documentation setup
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Knowledge Garden API',
      version: '1.0.0',
      description: 'API documentation for Knowledge Garden platform',
    },
    servers: [
      {
        url: `http://localhost:${config.server.port}`,
        description: 'Development server',
      },
    ],
  },
  apis: ['./services/**/routes/*.js'], // Path to the API routes
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Middleware setup
app.use(helmet()); // Security headers
app.use(cors()); // CORS support
app.use(express.json()); // JSON parsing
app.use(express.urlencoded({ extended: true })); // URL-encoded parsing
app.use(requestLogger); // Request logging

// Rate limiting
app.use(rateLimit(config.rateLimit));

// API documentation route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API routes
app.use('/api/users', userRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/collaboration', collaborationRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Error handling middleware
app.use(errorHandler);

// Start the server
const PORT = config.server.port;
app.listen(PORT, () => {
  logger.info(`Server running in ${config.server.env} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  // Close server & exit process
  // server.close(() => process.exit(1));
});

module.exports = app; // Export for testing
