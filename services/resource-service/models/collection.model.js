/**
 * Collection Model
 * Defines the schema for organizing resources into collections/folders
 */

const mongoose = require('mongoose');

const CollectionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Collection name is required'],
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  parentCollection: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Collection',
    default: null
  },
  visibility: {
    type: String,
    enum: ['public', 'private', 'restricted'],
    default: 'private'
  },
  accessList: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  resources: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resource'
  }],
  iconType: {
    type: String,
    enum: ['folder', 'star', 'book', 'document', 'custom'],
    default: 'folder'
  },
  iconColor: {
    type: String,
    default: '#4285F4'  // Default blue color
  },
  customIcon: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for performance
CollectionSchema.index({ owner: 1 });
CollectionSchema.index({ parentCollection: 1 });
CollectionSchema.index({ name: 'text', description: 'text' });
CollectionSchema.index({ visibility: 1 });
CollectionSchema.index({ createdAt: -1 });

// Update 'updatedAt' timestamp on document updates
CollectionSchema.pre('findOneAndUpdate', function() {
  this.set({ updatedAt: Date.now() });
});

/**
 * Add a resource to the collection
 * @param {String} resourceId - ID of the resource to add
 * @returns {Boolean} Success status
 */
CollectionSchema.methods.addResource = function(resourceId) {
  // Check if resource already exists in collection
  if (this.resources.includes(resourceId)) {
    return false;
  }
  
  // Add resource to collection
  this.resources.push(resourceId);
  this.updatedAt = Date.now();
  
  return true;
};

/**
 * Remove a resource from the collection
 * @param {String} resourceId - ID of the resource to remove
 * @returns {Boolean} Success status
 */
CollectionSchema.methods.removeResource = function(resourceId) {
  // Check if resource exists in collection
  const index = this.resources.indexOf(resourceId);
  if (index === -1) {
    return false;
  }
  
  // Remove resource from collection
  this.resources.splice(index, 1);
  this.updatedAt = Date.now();
  
  return true;
};

/**
 * Check if user has access to this collection
 * @param {Object} user - User object
 * @returns {Boolean} Access status
 */
CollectionSchema.methods.hasAccess = function(user) {
  if (!user) {
    return this.visibility === 'public';
  }
  
  // Owners always have access
  if (this.owner.toString() === user._id.toString()) {
    return true;
  }
  
  // Public collections are accessible to all
  if (this.visibility === 'public') {
    return true;
  }
  
  // For restricted collections, check access list
  if (this.visibility === 'restricted') {
    return this.accessList.some(id => id.toString() === user._id.toString());
  }
  
  // Private collections are only accessible to owner
  return false;
};

const Collection = mongoose.model('Collection', CollectionSchema);

module.exports = Collection;
