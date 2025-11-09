const prisma = require('../config/prisma');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const logger = require('../config/logger');

// Create user with single user constraint
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, role = 'ADMIN' } = req.body;

    // Check if any user already exists
    const existingUser = await prisma.user.findFirst();
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Only one user is allowed in the system'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });

    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

// Update user (only one user allowed)
exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // If updating password, hash it
    if (req.body.password) {
      req.body.password = await bcrypt.hash(req.body.password, 10);
    }

    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: req.body,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });

    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

// Get all users
exports.getUsers = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });
    res.json({ success: true, data: users });
  } catch (err) { next(err); }
};

// Get user by ID
exports.getUserById = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(req.params.id) },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

// Delete user (prevent deletion of the only user)
exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent deletion of the only user
    const userCount = await prisma.user.count();
    
    if (userCount === 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the only user in the system'
      });
    }

    await prisma.user.delete({
      where: { id: parseInt(id) }
    });

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) { next(err); }
};

// Get the only user in the system
exports.getSystemUser = async (req, res, next) => {
  try {
    const user = await prisma.user.findFirst();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No user found in the system'
      });
    }

    res.json({ success: true, data: user });
  } catch (err) { next(err); }
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
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

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
    const token = jwt.sign(
      { 
        userId: user.id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      { 
        expiresIn: process.env.JWT_EXPIRES_IN || '7d' // 7 days default
      }
    );

    // Return user data (without password) and token
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
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
