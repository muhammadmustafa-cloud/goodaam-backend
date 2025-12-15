const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const logger = require('../config/logger');

// Create user with single user constraint + bootstrap guard
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, role = 'ADMIN' } = req.body;

    // Allow registration only when explicitly enabled (bootstrap-only)
    const allowRegistration = process.env.ALLOW_REGISTRATION === 'true';
    if (!allowRegistration) {
      return res.status(403).json({
        success: false,
        message: 'Registration is disabled. Set ALLOW_REGISTRATION=true for initial bootstrap.',
      });
    }

    // Optional bootstrap secret to prevent public signups in production
    if (process.env.ADMIN_SETUP_SECRET) {
      const provided = req.headers['x-setup-secret'];
      if (provided !== process.env.ADMIN_SETUP_SECRET) {
        return res.status(403).json({
          success: false,
          message: 'Invalid setup secret for registration',
        });
      }
    }

    // Check if any user already exists
    const existingUser = await User.findOne();
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Admin already exists; registration is closed.'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      password: hashedPassword,
      role
    });

    await user.save();

    // Return user without password
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    };

    res.json({ success: true, data: userResponse });
  } catch (err) { 
    next(err); 
  }
};

// Update user (only one user allowed)
exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // If updating password, hash it
    if (req.body.password) {
      req.body.password = await bcrypt.hash(req.body.password, 10);
    }

    const user = await User.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Return user without password
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    };

    res.json({ success: true, data: userResponse });
  } catch (err) { 
    next(err); 
  }
};

// Get all users
exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password');
    
    const usersResponse = users.map(user => ({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    }));

    res.json({ success: true, data: usersResponse });
  } catch (err) { 
    next(err); 
  }
};

// Get user by ID
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    };

    res.json({ success: true, data: userResponse });
  } catch (err) { 
    next(err); 
  }
};

// Delete user (prevent deletion of the only user)
exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent deletion of the only user
    const userCount = await User.countDocuments();
    
    if (userCount === 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the only user in the system'
      });
    }

    await User.findByIdAndDelete(id);

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) { 
    next(err); 
  }
};

// Get the only user in the system
exports.getSystemUser = async (req, res, next) => {
  try {
    const user = await User.findOne().select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No user found in the system'
      });
    }

    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    };

    res.json({ success: true, data: userResponse });
  } catch (err) { 
    next(err); 
  }
};

// Login user
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    const token = jwt.sign(
      { 
        userId: user._id.toString(),
        email: user.email,
        role: user.role
      },
      secret,
      { 
        expiresIn: process.env.JWT_EXPIRES_IN || '7d' // 7 days default
      }
    );

    // Return user data (without password) and token
    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        token,
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
      },
      message: 'Login successful'
    });
  } catch (err) {
    logger.error('Login error:', err);
    next(err);
  }
};

// Verify token (for frontend to check if token is still valid)
exports.verifyToken = async (req, res, next) => {
  try {
    // User is already attached by authenticate middleware
    res.json({
      success: true,
      data: {
        user: req.user
      },
      message: 'Token is valid'
    });
  } catch (err) {
    next(err);
  }
};

// Change password - requires current password verification
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    // Get user from database (include password for verification)
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Check if new password is different from current
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password'
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    user.password = hashedNewPassword;
    await user.save();

    logger.info(`Password changed for user: ${user.email}`);

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (err) {
    logger.error('Change password error:', err);
    next(err);
  }
};
