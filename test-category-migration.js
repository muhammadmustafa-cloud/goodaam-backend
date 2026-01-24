const mongoose = require('mongoose');
const Sale = require('./src/models/Sale');
require('dotenv').config();

async function testCategoryMigration() {
  try {
    await mongoose.connect(process.env.DATABASE_URL);
    
    console.log('🔍 Testing category migration script...\n');
    
    // Check current state
    const totalSales = await Sale.countDocuments();
    const categorizedSales = await Sale.countDocuments({
      itemCategory: { $exists: true, $ne: null, $ne: '', $ne: 'undefined' }
    });
    const uncategorizedSales = totalSales - categorizedSales;
    
    console.log('📊 Current Status:');
    console.log(`  Total Sales: ${totalSales}`);
    console.log(`  Categorized: ${categorizedSales}`);
    console.log(`  Uncategorized: ${uncategorizedSales}`);
    
    // Show sample of categories
    const categoryStats = await Sale.aggregate([
      { $match: { itemCategory: { $exists: true, $ne: null } } },
      { $group: { _id: '$itemCategory', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    console.log('\n📈 Category Distribution:');
    categoryStats.forEach(stat => {
      console.log(`  ${stat._id}: ${stat.count} sales`);
    });
    
    // Test a few sample sales
    const sampleSales = await Sale.find({ itemCategory: { $exists: true } })
      .limit(3)
      .select('itemName itemCategory date');
    
    console.log('\n📋 Sample Sales with Categories:');
    sampleSales.forEach((sale, index) => {
      console.log(`  ${index + 1}. ${sale.itemName} → ${sale.itemCategory} (${sale.date?.toISOString().split('T')[0]})`);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

testCategoryMigration();
