/**
 * Tag Model
 * Defines the schema for resource tags
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TagSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Tag name is required'],
    trim: true,
    lowercase: true,
    unique: true,
    index: true
  },
  description: {
    type: String,
    trim: true
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tag',
    default: null
  },
  usageCount: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isSystemTag: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create indexes for better search performance
TagSchema.index({ name: 'text', description: 'text' });

// Pre-save middleware to update timestamps
TagSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Create virtual id property
TagSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// Make sure virtuals are included in JSON output
TagSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Tag', TagSchema);
