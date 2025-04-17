/**
 * User Service Validators
 * Defines validation schemas for user-related operations
 */

const Joi = require('joi');

// Registration validation schema
const registerSchema = Joi.object({
  name: Joi.string().required().max(50).trim()
    .messages({
      'string.empty': 'Name is required',
      'string.max': 'Name cannot be more than 50 characters'
    }),
  email: Joi.string().required().email().trim().lowercase()
    .messages({
      'string.empty': 'Email is required',
      'string.email': 'Please provide a valid email address'
    }),
  password: Joi.string().required().min(8)
    .messages({
      'string.empty': 'Password is required',
      'string.min': 'Password must be at least 8 characters long'
    }),
  role: Joi.string().valid('student', 'faculty').default('student'),
  institution: Joi.string().allow('').trim(),
  department: Joi.string().allow('').trim(),
  bio: Joi.string().allow('').max(500)
    .messages({
      'string.max': 'Bio cannot be more than 500 characters'
    })
});

// Login validation schema
const loginSchema = Joi.object({
  email: Joi.string().required().email()
    .messages({
      'string.empty': 'Email is required',
      'string.email': 'Please provide a valid email address'
    }),
  password: Joi.string().required()
    .messages({
      'string.empty': 'Password is required'
    })
});

// Update user details validation schema
const updateDetailsSchema = Joi.object({
  name: Joi.string().max(50).trim()
    .messages({
      'string.max': 'Name cannot be more than 50 characters'
    }),
  bio: Joi.string().allow('').max(500)
    .messages({
      'string.max': 'Bio cannot be more than 500 characters'
    }),
  institution: Joi.string().allow('').trim(),
  department: Joi.string().allow('').trim(),
  preferences: Joi.object({
    notifications: Joi.object({
      email: Joi.boolean(),
      inApp: Joi.boolean()
    }),
    privacy: Joi.object({
      showEmail: Joi.boolean(),
      showActivity: Joi.boolean()
    }),
    theme: Joi.string().valid('light', 'dark', 'system')
  })
}).min(1) // At least one field must be provided
  .messages({
    'object.min': 'At least one field to update must be provided'
  });

// Update password validation schema
const updatePasswordSchema = Joi.object({
  currentPassword: Joi.string().when('$isReset', {
    is: false,
    then: Joi.required(),
    otherwise: Joi.forbidden()
  }),
  newPassword: Joi.string().required().min(8)
    .messages({
      'string.empty': 'New password is required',
      'string.min': 'New password must be at least 8 characters long'
    }),
  confirmPassword: Joi.string().required().valid(Joi.ref('newPassword'))
    .messages({
      'string.empty': 'Please confirm your password',
      'any.only': 'Passwords do not match'
    })
});

// Admin create user validation schema
const createUserSchema = Joi.object({
  name: Joi.string().required().max(50).trim()
    .messages({
      'string.empty': 'Name is required',
      'string.max': 'Name cannot be more than 50 characters'
    }),
  email: Joi.string().required().email().trim().lowercase()
    .messages({
      'string.empty': 'Email is required',
      'string.email': 'Please provide a valid email address'
    }),
  password: Joi.string().required().min(8)
    .messages({
      'string.empty': 'Password is required',
      'string.min': 'Password must be at least 8 characters long'
    }),
  role: Joi.string().valid('student', 'faculty', 'admin').required()
    .messages({
      'string.empty': 'Role is required',
      'any.only': 'Role must be one of student, faculty, or admin'
    }),
  isVerified: Joi.boolean(),
  isActive: Joi.boolean(),
  institution: Joi.string().allow('').trim(),
  department: Joi.string().allow('').trim(),
  bio: Joi.string().allow('').max(500)
    .messages({
      'string.max': 'Bio cannot be more than 500 characters'
    })
});

// Admin update user validation schema
const updateUserSchema = Joi.object({
  name: Joi.string().max(50).trim(),
  email: Joi.string().email().trim().lowercase(),
  role: Joi.string().valid('student', 'faculty', 'admin'),
  isVerified: Joi.boolean(),
  isActive: Joi.boolean(),
  institution: Joi.string().allow('').trim(),
  department: Joi.string().allow('').trim(),
  bio: Joi.string().allow('').max(500),
  preferences: Joi.object({
    notifications: Joi.object({
      email: Joi.boolean(),
      inApp: Joi.boolean()
    }),
    privacy: Joi.object({
      showEmail: Joi.boolean(),
      showActivity: Joi.boolean()
    }),
    theme: Joi.string().valid('light', 'dark', 'system')
  })
}).min(1) // At least one field must be provided
  .messages({
    'object.min': 'At least one field to update must be provided'
  });

// Role change validation schema
const roleSchema = Joi.object({
  role: Joi.string().valid('student', 'faculty', 'admin').required()
    .messages({
      'string.empty': 'Role is required',
      'any.only': 'Role must be one of student, faculty, or admin'
    })
});

module.exports = {
  registerSchema,
  loginSchema,
  updateDetailsSchema,
  updatePasswordSchema,
  createUserSchema,
  updateUserSchema,
  roleSchema
};
