/**
 * Migration script to add bagWeight field to existing Sale records
 * This script sets a default bagWeight of 50kg for existing sales without bagWeight
 */

const mongoose = require('mongoose');
require('dotenv').config();
const Sale = require('../models/Sale');
const { connectDB } = require('../config/mongodb');

async function migrateBagWeight() {
  try {
    // Connect to database
    await connectDB();
    console.log('📊 Connected to MongoDB');

    // Find all sales without bagWeight
    const salesWithoutWeight = await Sale.find({ bagWeight: { $exists: false } });
    
    if (salesWithoutWeight.length === 0) {
      console.log('✅ All sales already have bagWeight field');
      return;
    }

    console.log(`🔄 Found ${salesWithoutWeight.length} sales without bagWeight`);

    // Update each sale with default bagWeight of 50kg
    const updatePromises = salesWithoutWeight.map(async (sale) => {
      try {
        sale.bagWeight = 50; // Default weight
        await sale.save();
        console.log(`✅ Updated sale ${sale._id} with bagWeight: 50kg`);
        return sale._id;
      } catch (error) {
        console.error(`❌ Failed to update sale ${sale._id}:`, error.message);
        return null;
      }
    });

    const results = await Promise.all(updatePromises);
    const successful = results.filter(id => id !== null);

    console.log(`\n🎉 Migration completed!`);
    console.log(`✅ Successfully updated: ${successful.length} sales`);
    console.log(`❌ Failed: ${salesWithoutWeight.length - successful.length} sales`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('👋 Database connection closed');
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateBagWeight();
}

module.exports = { migrateBagWeight };
