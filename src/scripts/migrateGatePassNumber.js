/**
 * Migration script to add gatePassNumber field to existing Laad records
 * This script adds the gatePassNumber field to the Laad schema and sets it to null for existing records
 */

const mongoose = require('mongoose');
require('dotenv').config();
const Laad = require('../models/Laad');
const { connectDB } = require('../config/mongodb');

async function migrateGatePassNumber() {
  try {
    // Connect to database
    await connectDB();
    console.log('📊 Connected to MongoDB');

    // Find all laads without gatePassNumber field (or where it's undefined)
    const laadsWithoutGatePass = await Laad.find({ 
      $or: [
        { gatePassNumber: { $exists: false } },
        { gatePassNumber: null }
      ]
    });
    
    console.log(`🔄 Found ${laadsWithoutGatePass.length} laads without gatePassNumber`);

    if (laadsWithoutGatePass.length === 0) {
      console.log('✅ All laads already have gatePassNumber field. Migration not needed.');
      return;
    }

    // Update each laad to add gatePassNumber field with null value
    let updatedCount = 0;
    let failedCount = 0;

    for (const laad of laadsWithoutGatePass) {
      try {
        await Laad.findByIdAndUpdate(laad._id, { 
          $set: { gatePassNumber: null } 
        });
        console.log(`✅ Updated laad ${laad.laadNumber} with gatePassNumber field`);
        updatedCount++;
      } catch (error) {
        console.error(`❌ Failed to update laad ${laad.laadNumber}:`, error.message);
        failedCount++;
      }
    }

    console.log('\n🎉 Migration completed!');
    console.log(`✅ Successfully updated: ${updatedCount} laads`);
    console.log(`❌ Failed: ${failedCount} laads`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('👋 Database connection closed');
  }
}

// Run migration
migrateGatePassNumber();
