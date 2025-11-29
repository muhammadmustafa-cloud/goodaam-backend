const mongoose = require('mongoose');
require('dotenv').config();

async function migrateSaleGatePassNumber() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || process.env.DATABASE_URL);
    console.log('✅ Connected to MongoDB');

    // Get the Sale collection
    const db = mongoose.connection.db;
    const salesCollection = db.collection('sales');

    // Check if gatePassNumber field already exists in any documents
    const existingWithGatePass = await salesCollection.findOne({
      gatePassNumber: { $exists: true }
    });

    if (existingWithGatePass) {
      console.log('ℹ️ Gate pass number field already exists in some documents');
      console.log('📊 Migration not needed, but will continue to ensure all documents have the field');
    }

    // Add gatePassNumber field to all documents that don't have it
    const result = await salesCollection.updateMany(
      { gatePassNumber: { $exists: false } },
      { 
        $set: { 
          gatePassNumber: null 
        } 
      }
    );

    console.log(`📊 Updated ${result.modifiedCount} sale documents`);

    // Verify the migration
    const totalSales = await salesCollection.countDocuments();
    const salesWithGatePass = await salesCollection.countDocuments({
      gatePassNumber: { $exists: true }
    });

    console.log(`📈 Total sales: ${totalSales}`);
    console.log(`📈 Sales with gatePassNumber field: ${salesWithGatePass}`);

    if (totalSales === salesWithGatePass) {
      console.log('✅ Migration completed successfully!');
      console.log('🎉 All sale documents now have the gatePassNumber field');
    } else {
      console.log('⚠️ Migration incomplete - some documents may not have been updated');
    }

  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the migration
migrateSaleGatePassNumber();
