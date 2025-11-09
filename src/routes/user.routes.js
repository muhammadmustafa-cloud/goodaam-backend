const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { authLimiter } = require('../middleware/rateLimiter.middleware');

// Public routes
router.post('/login', authLimiter, userController.login); // Login endpoint
router.post('/register', userController.createUser); // Initial registration (only if no user exists)

// Protected routes - require authentication
router.get('/verify', authenticate, userController.verifyToken); // Verify token
router.get('/system-user', authenticate, userController.getSystemUser);
router.get('/me', authenticate, userController.getSystemUser); // Get current user

// Admin only routes
router.get('/', authenticate, authorize('ADMIN'), userController.getUsers);
router.get('/:id', authenticate, authorize('ADMIN'), userController.getUserById);
router.put('/:id', authenticate, authorize('ADMIN'), userController.updateUser);
router.delete('/:id', authenticate, authorize('ADMIN'), userController.deleteUser);

module.exports = router;
