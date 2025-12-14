/**
 * Script to update user password (hash it properly)
 * Usage: node scripts/updateUserPassword.js <email> <newPassword>
 * Example: node scripts/updateUserPassword.js admin@godam.com godam123
 */

require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../src/models/User');

async function updateUserPassword() {
  try {
    // Get arguments
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
      console.error('❌ Usage: node scripts/updateUserPassword.js <email> <newPassword>');
      console.error('   Example: node scripts/updateUserPassword.js admin@godam.com godam123');
      process.exit(1);
    }

    const [email, password] = args;

    // Validate inputs
    if (!email || !password) {
      console.error('❌ Email and password are required');
      process.exit(1);
    }

    // Connect to MongoDB
    const dbUrl = process.env.DATABASE_URL || 'mongodb://localhost:27017/godam_management_local';
    console.log('📡 Connecting to database...');
    await mongoose.connect(dbUrl);
    console.log('✅ Connected to database');

    // Find user
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      console.error(`❌ User with email ${email} not found`);
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(`👤 Found user: ${user.name} (${user.email})`);

    // Hash password
    console.log('🔐 Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password
    console.log('💾 Updating password...');
    user.password = hashedPassword;
    await user.save();

    console.log('✅ Password updated successfully!');
    console.log('\n📋 Updated User Details:');
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log('\n💡 You can now login with the new password.');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

updateUserPassword();

