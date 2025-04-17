/**
 * Resource Model
 * Defines the schema for academic resources including versioning support
 */

const mongoose = require('mongoose');

/**
 * Resource Version Schema
 * Supports tracking different versions of the same resource
 */
const ResourceVersionSchema = new mongoose.Schema({
  versionNumber: {
    type: Number,
    required: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  description: {
    type: String,
    trim: true
  }
});

/**
 * Resource Schema
 * Main schema for academic resources with metadata and versioning
 */
const ResourceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Resource title is required'],
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Description cannot be more than 2000 characters']
  },
  resourceType: {
    type: String,
    required: [true, 'Resource type is required'],
    enum: ['document', 'presentation', 'image', 'video', 'audio', 'other'],
    default: 'document'
  },
  tags: [{
    type: String,
    trim: true
  }],
  categories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  thumbnailUrl: {
    type: String
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  visibility: {
    type: String,
    enum: ['public', 'private', 'restricted'],
    default: 'public'
  },
  accessList: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isVerified: {
    type: Boolean,
    default: false
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verificationDate: {
    type: Date
  },
  versions: [ResourceVersionSchema],
  currentVersion: {
    type: Number,
    default: 1
  },
  viewCount: {
    type: Number,
    default: 0
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  averageRating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  ratingCount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'archived', 'flagged', 'deleted'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  collections: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Collection'
  }]
});

// Indexes for performance
ResourceSchema.index({ title: 'text', description: 'text', tags: 'text' });
ResourceSchema.index({ owner: 1 });
ResourceSchema.index({ categories: 1 });
ResourceSchema.index({ createdAt: -1 });
ResourceSchema.index({ status: 1 });
ResourceSchema.index({ visibility: 1 });
ResourceSchema.index({ averageRating: -1 });
ResourceSchema.index({ viewCount: -1 });

// Update 'updatedAt' timestamp on document updates
ResourceSchema.pre('findOneAndUpdate', function() {
  this.set({ updatedAt: Date.now() });
});

/**
 * Get current version of the resource
 * @returns {Object} Current version object
 */
ResourceSchema.methods.getCurrentVersion = function() {
  const currentVersionNumber = this.currentVersion;
  return this.versions.find(version => version.versionNumber === currentVersionNumber);
};

/**
 * Add a new version to the resource
 * @param {Object} versionData - Version data to add
 * @returns {Object} Added version object
 */
ResourceSchema.methods.addVersion = function(versionData) {
  // Increment version number
  const newVersionNumber = this.currentVersion + 1;
  
  // Create new version object
  const newVersion = {
    versionNumber: newVersionNumber,
    ...versionData
  };
  
  // Add to versions array
  this.versions.push(newVersion);
  
  // Update current version
  this.currentVersion = newVersionNumber;
  this.updatedAt = Date.now();
  
  return newVersion;
};

/**
 * Verify the resource (faculty only)
 * @param {Object} verifier - User object of the verifier
 * @returns {Boolean} Success status
 */
ResourceSchema.methods.verify = function(verifier) {
  // Only faculty or admin can verify
  if (!verifier || !['faculty', 'admin'].includes(verifier.role)) {
    return false;
  }
  
  this.isVerified = true;
  this.verifiedBy = verifier._id;
  this.verificationDate = Date.now();
  this.updatedAt = Date.now();
  
  return true;
};

/**
 * Update resource statistics
 * @param {String} stat - Statistic to update ('view' or 'download')
 * @returns {Number} Updated count
 */
ResourceSchema.methods.updateStats = function(stat) {
  if (stat === 'view') {
    this.viewCount += 1;
  } else if (stat === 'download') {
    this.downloadCount += 1;
  }
  
  return stat === 'view' ? this.viewCount : this.downloadCount;
};

/**
 * Update resource rating
 * @param {Number} newRating - New rating to add
 * @returns {Number} Updated average rating
 */
ResourceSchema.methods.updateRating = function(newRating) {
  // Calculate new average
  const totalRating = this.averageRating * this.ratingCount + newRating;
  this.ratingCount += 1;
  this.averageRating = totalRating / this.ratingCount;
  
  return this.averageRating;
};

const Resource = mongoose.model('Resource', ResourceSchema);

module.exports = Resource;
