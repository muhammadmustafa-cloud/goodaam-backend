/**
 * Script to add a user directly to the database
 * Usage: node scripts/addUser.js <name> <email> <password> [role]
 * Example: node scripts/addUser.js "Admin User" admin@example.com password123 ADMIN
 */

require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../src/models/User');

async function addUser() {
  try {
    // Get arguments
    const args = process.argv.slice(2);
    
    if (args.length < 3) {
      console.error('❌ Usage: node scripts/addUser.js <name> <email> <password> [role]');
      console.error('   Example: node scripts/addUser.js "Admin User" admin@example.com password123 ADMIN');
      process.exit(1);
    }

    const [name, email, password, role = 'ADMIN'] = args;

    // Validate inputs
    if (!name || !email || !password) {
      console.error('❌ Name, email, and password are required');
      process.exit(1);
    }

    if (!['ADMIN', 'USER'].includes(role.toUpperCase())) {
      console.error('❌ Role must be either ADMIN or USER');
      process.exit(1);
    }

    // Connect to MongoDB
    const dbUrl = process.env.DATABASE_URL || 'mongodb://localhost:27017/godam_management_local';
    console.log('📡 Connecting to database...');
    await mongoose.connect(dbUrl);
    console.log('✅ Connected to database');

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      console.error(`❌ User with email ${email} already exists`);
      await mongoose.disconnect();
      process.exit(1);
    }

    // Hash password
    console.log('🔐 Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    console.log('👤 Creating user...');
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: role.toUpperCase()
    });

    await user.save();

    console.log('✅ User created successfully!');
    console.log('\n📋 User Details:');
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   ID: ${user._id}`);
    console.log('\n💡 You can now login with this user.');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 11000) {
      console.error('   Email already exists in database');
    }
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

addUser();

