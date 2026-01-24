const mongoose = require('mongoose');
const Sale = require('./src/models/Sale');
require('dotenv').config();

async function checkAndRunFirstTimeDetailsMigration() {
  try {
    console.log('🔍 Checking if first-time sales details migration is needed...');
    
    await mongoose.connect(process.env.DATABASE_URL);
    
    // Check if there are any sales with incomplete details
    const incompleteSales = await Sale.countDocuments({
      $or: [
        { itemName: { $exists: false } },
        { itemName: null },
        { itemName: '' },
        { itemName: 'Unknown Item' },
        { qualityGrade: { $exists: false } },
        { qualityGrade: null },
        { qualityGrade: '' },
        { laadNumber: { $exists: false } },
        { laadNumber: null },
        { laadNumber: '' }
      ]
    });
    
    if (incompleteSales > 0) {
      console.log(`📦 Found ${incompleteSales} sales with incomplete details. Running migration...`);
      
      // Run the migration
      const { migrateAllSalesDetails } = require('./src/scripts/migrateAllSalesDetails');
      await migrateAllSalesDetails();
      
      console.log('✅ First-time sales details migration completed!');
    } else {
      console.log('✅ All sales already have complete details. No migration needed.');
    }
    
  } catch (error) {
    console.error('❌ First-time details migration check failed:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

// Auto-run if this script is executed directly
if (require.main === module) {
  checkAndRunFirstTimeDetailsMigration();
}

module.exports = { checkAndRunFirstTimeDetailsMigration };
