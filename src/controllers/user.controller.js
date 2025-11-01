const prisma = require('../config/prisma');
const bcrypt = require('bcrypt');

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
