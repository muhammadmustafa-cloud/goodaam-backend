const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { authLimiter } = require('../middleware/rateLimiter.middleware');

// Public routes (rate-limited)
router.post('/login', authLimiter, userController.login); // Login endpoint
router.post('/register', authLimiter, userController.createUser); // Initial registration (only if explicitly allowed)

// Protected routes - require authentication
router.get('/verify', authenticate, userController.verifyToken); // Verify token
router.get('/system-user', authenticate, userController.getSystemUser);
router.get('/me', authenticate, userController.getSystemUser); // Get current user

// Password change - requires authentication (any authenticated user)
router.post('/change-password', authenticate, userController.changePassword);

// Admin only routes
router.get('/', authenticate, authorize('ADMIN'), userController.getUsers);
router.get('/:id', authenticate, authorize('ADMIN'), userController.getUserById);
router.put('/:id', authenticate, authorize('ADMIN'), userController.updateUser);
router.delete('/:id', authenticate, authorize('ADMIN'), userController.deleteUser);

module.exports = router;
