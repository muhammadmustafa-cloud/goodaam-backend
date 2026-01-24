const mongoose = require('mongoose');
const Sale = require('./src/models/Sale');
require('dotenv').config();

async function checkAndRunFirstTimeMigration() {
  try {
    console.log('🔍 Checking if first-time category migration is needed...');
    
    await mongoose.connect(process.env.DATABASE_URL);
    
    // Check if there are any sales without categories
    const uncategorizedSales = await Sale.countDocuments({
      $or: [
        { itemCategory: { $exists: false } },
        { itemCategory: null },
        { itemCategory: '' },
        { itemCategory: 'undefined' }
      ]
    });
    
    if (uncategorizedSales > 0) {
      console.log(`📦 Found ${uncategorizedSales} sales without categories. Running migration...`);
      
      // Run the migration
      const { migrateAllSalesCategories } = require('./src/scripts/migrateAllSalesCategories');
      await migrateAllSalesCategories();
      
      console.log('✅ First-time category migration completed!');
    } else {
      console.log('✅ All sales already have categories. No migration needed.');
    }
    
  } catch (error) {
    console.error('❌ First-time migration check failed:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

// Auto-run if this script is executed directly
if (require.main === module) {
  checkAndRunFirstTimeMigration();
}

module.exports = { checkAndRunFirstTimeMigration };
