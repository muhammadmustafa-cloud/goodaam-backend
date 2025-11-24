const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

const User = require('../models/User');
const { connectDB } = require('../config/mongodb');

/**
 * Seed Admin User
 * Creates the first admin user if no users exist
 */
const seedAdmin = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    console.log('✅ Connected to MongoDB');

    // Check if any user exists
    const existingUser = await User.findOne();
    
    if (existingUser) {
      console.log('⚠️  User already exists. Skipping seed.');
      console.log(`   Existing user: ${existingUser.email}`);
      process.exit(0);
    }

    // Default admin credentials
    const adminData = {
      name: process.env.ADMIN_NAME || 'Admin User',
      email: process.env.ADMIN_EMAIL || 'admin@godam.com',
      password: process.env.ADMIN_PASSWORD || 'admin123',
      role: 'ADMIN'
    };

    // Hash password
    const hashedPassword = await bcrypt.hash(adminData.password, 10);

    // Create admin user
    const admin = new User({
      name: adminData.name,
      email: adminData.email,
      password: hashedPassword,
      role: adminData.role
    });

    await admin.save();

    console.log('✅ Admin user created successfully!');
    console.log('📧 Email:', adminData.email);
    console.log('🔑 Password:', adminData.password);
    console.log('⚠️  Please change the password after first login!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding admin user:', error);
    process.exit(1);
  }
};

// Run seed
seedAdmin();

