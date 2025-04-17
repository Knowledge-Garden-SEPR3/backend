/**
 * Database utility for Knowledge Garden
 * Provides helper functions for database operations
 */

const mongoose = require('mongoose');
const logger = require('./logger');

/**
 * Connect to MongoDB database
 * @param {string} uri - MongoDB connection string
 * @param {object} options - Mongoose connection options
 * @returns {Promise} Mongoose connection
 */
const connect = async (uri, options = {}) => {
  try {
    const conn = await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      ...options
    });
    
    logger.info(`MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error(`MongoDB connection error: ${error.message}`);
    throw error;
  }
};

/**
 * Disconnect from MongoDB database
 * @returns {Promise} Disconnection result
 */
const disconnect = async () => {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected');
  } catch (error) {
    logger.error(`MongoDB disconnection error: ${error.message}`);
    throw error;
  }
};

/**
 * Create indexes for a collection
 * @param {Model} model - Mongoose model
 * @param {Array} indexes - Array of index specifications
 */
const createIndexes = async (model, indexes) => {
  try {
    for (const index of indexes) {
      await model.collection.createIndex(index.fields, index.options);
      logger.info(`Index created for ${model.modelName}: ${JSON.stringify(index.fields)}`);
    }
  } catch (error) {
    logger.error(`Index creation error for ${model.modelName}: ${error.message}`);
    throw error;
  }
};

/**
 * Handle duplicate key errors with custom message
 * @param {Error} error - MongoDB error
 * @param {string} message - Custom error message
 * @returns {Error} Formatted error
 */
const handleDuplicateKeyError = (error, message) => {
  if (error.name === 'MongoError' && error.code === 11000) {
    const customError = new Error(message || 'Duplicate key error');
    customError.statusCode = 400;
    return customError;
  }
  return error;
};

/**
 * Perform transaction with automatic retry
 * @param {Function} callback - Transaction callback
 * @param {Object} options - Transaction options
 * @returns {Promise} Transaction result
 */
const withTransaction = async (callback, options = {}) => {
  const session = await mongoose.startSession();
  session.startTransaction(options);
  
  try {
    const result = await callback(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

module.exports = {
  connect,
  disconnect,
  createIndexes,
  handleDuplicateKeyError,
  withTransaction
};
