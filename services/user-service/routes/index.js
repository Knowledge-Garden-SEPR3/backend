/**
 * User Service Routes
 * Defines all routes for the user management service
 */

const express = require('express');
const { validate } = require('../../../middleware');
const authController = require('../controllers/auth.controller');
const userController = require('../controllers/user.controller');
const { authenticate, authorize } = require('../../../middleware');
const { 
  registerSchema, 
  loginSchema, 
  updateDetailsSchema,
  updatePasswordSchema,
  createUserSchema,
  updateUserSchema,
  roleSchema
} = require('../validators');

const router = express.Router();

// Auth routes (public)
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/forgotpassword', authController.forgotPassword);
router.put('/resetpassword/:resettoken', validate(updatePasswordSchema), authController.resetPassword);

// Protected routes (authenticated users)
router.use(authenticate);

router.get('/logout', authController.logout);
router.get('/me', authController.getMe);
router.put('/updatedetails', validate(updateDetailsSchema), authController.updateDetails);
router.put('/updatepassword', validate(updatePasswordSchema), authController.updatePassword);

// Admin only routes
router.use(authorize(['admin']));

router.route('/')
  .get(userController.getUsers)
  .post(validate(createUserSchema), userController.createUser);

router.route('/:id')
  .get(userController.getUser)
  .put(validate(updateUserSchema), userController.updateUser)
  .delete(userController.deleteUser);

router.put('/:id/role', validate(roleSchema), userController.changeUserRole);

module.exports = router;
