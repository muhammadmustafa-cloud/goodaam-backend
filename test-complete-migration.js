const mongoose = require('mongoose');
const Sale = require('./src/models/Sale');
const Item = require('./src/models/Item');
const LaadItem = require('./src/models/LaadItem');
require('dotenv').config();

async function testCompleteSalesMigration() {
  try {
    await mongoose.connect(process.env.DATABASE_URL);
    
    console.log('🔍 Testing complete sales migration...\n');
    
    // 1. Check overall statistics
    const totalSales = await Sale.countDocuments();
    console.log('📊 Overall Statistics:');
    console.log(`  Total Sales: ${totalSales}`);
    
    // 2. Check category completeness
    const categorizedSales = await Sale.countDocuments({
      itemCategory: { $exists: true, $ne: null, $ne: '', $ne: 'undefined' }
    });
    const uncategorizedSales = totalSales - categorizedSales;
    console.log(`  Categorized: ${categorizedSales} (${((categorizedSales/totalSales)*100).toFixed(1)}%)`);
    console.log(`  Uncategorized: ${uncategorizedSales}`);
    
    // 3. Check item name completeness
    const withItemName = await Sale.countDocuments({
      itemName: { $exists: true, $ne: null, $ne: '', $ne: 'Unknown Item' }
    });
    const withoutItemName = totalSales - withItemName;
    console.log(`  With Item Name: ${withItemName} (${((withItemName/totalSales)*100).toFixed(1)}%)`);
    console.log(`  Without Item Name: ${withoutItemName}`);
    
    // 4. Check quality grade completeness
    const withQuality = await Sale.countDocuments({
      qualityGrade: { $exists: true, $ne: null, $ne: '' }
    });
    const withoutQuality = totalSales - withQuality;
    console.log(`  With Quality: ${withQuality} (${((withQuality/totalSales)*100).toFixed(1)}%)`);
    console.log(`  Without Quality: ${withoutQuality}`);
    
    // 5. Check laad number completeness
    const withLaadNumber = await Sale.countDocuments({
      laadNumber: { $exists: true, $ne: null, $ne: '' }
    });
    const withoutLaadNumber = totalSales - withLaadNumber;
    console.log(`  With Laad Number: ${withLaadNumber} (${((withLaadNumber/totalSales)*100).toFixed(1)}%)`);
    console.log(`  Without Laad Number: ${withoutLaadNumber}`);
    
    // 6. Category distribution
    const categoryStats = await Sale.aggregate([
      { $match: { itemCategory: { $exists: true, $ne: null } } },
      { $group: { _id: '$itemCategory', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    console.log('\n📈 Category Distribution:');
    categoryStats.forEach(stat => {
      const percentage = ((stat.count / totalSales) * 100).toFixed(1);
      console.log(`  ${stat._id}: ${stat.count} sales (${percentage}%)`);
    });
    
    // 7. Show sample of complete sales
    const completeSales = await Sale.find({
      itemName: { $exists: true, $ne: null, $ne: '', $ne: 'Unknown Item' },
      qualityGrade: { $exists: true, $ne: null, $ne: '' },
      laadNumber: { $exists: true, $ne: null, $ne: '' },
      itemCategory: { $exists: true, $ne: null, $ne: '', $ne: 'undefined' }
    })
    .limit(5)
    .select('itemName itemCategory qualityGrade laadNumber bagsSold date')
    .sort({ date: -1 });
    
    console.log('\n📋 Sample Complete Sales:');
    completeSales.forEach((sale, index) => {
      console.log(`  ${index + 1}. ${sale.itemName} | ${sale.itemCategory} | ${sale.qualityGrade} | ${sale.laadNumber} | ${sale.bagsSold} bags | ${sale.date?.toISOString().split('T')[0]}`);
    });
    
    // 8. Check for any remaining issues
    const problematicSales = await Sale.find({
      $or: [
        { itemName: { $exists: false } },
        { itemName: null },
        { itemName: '' },
        { itemName: 'Unknown Item' },
        { itemCategory: { $exists: false } },
        { itemCategory: null },
        { itemCategory: '' },
        { itemCategory: 'undefined' },
        { qualityGrade: { $exists: false } },
        { qualityGrade: null },
        { qualityGrade: '' },
        { laadNumber: { $exists: false } },
        { laadNumber: null },
        { laadNumber: '' }
      ]
    }).limit(3);
    
    if (problematicSales.length > 0) {
      console.log('\n⚠️  Sample Problematic Sales:');
      problematicSales.forEach((sale, index) => {
        console.log(`  ${index + 1}. ID: ${sale._id.toString().substring(0, 8)}...`);
        console.log(`     Item: ${sale.itemName || 'MISSING'}`);
        console.log(`     Category: ${sale.itemCategory || 'MISSING'}`);
        console.log(`     Quality: ${sale.qualityGrade || 'MISSING'}`);
        console.log(`     Laad: ${sale.laadNumber || 'MISSING'}`);
      });
    }
    
    // 9. Final assessment
    const completeSalesCount = await Sale.countDocuments({
      itemName: { $exists: true, $ne: null, $ne: '', $ne: 'Unknown Item' },
      itemCategory: { $exists: true, $ne: null, $ne: '', $ne: 'undefined' },
      qualityGrade: { $exists: true, $ne: null, $ne: '' },
      laadNumber: { $exists: true, $ne: null, $ne: '' }
    });
    
    const completenessPercentage = ((completeSalesCount / totalSales) * 100).toFixed(1);
    
    console.log('\n🎯 Migration Assessment:');
    console.log(`  Complete Sales: ${completeSalesCount}/${totalSales} (${completenessPercentage}%)`);
    
    if (completenessPercentage >= 95) {
      console.log('  ✅ EXCELLENT: Migration highly successful!');
    } else if (completenessPercentage >= 80) {
      console.log('  ✅ GOOD: Migration mostly successful');
    } else if (completenessPercentage >= 60) {
      console.log('  ⚠️  FAIR: Migration partially successful');
    } else {
      console.log('  ❌ POOR: Migration needs attention');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

testCompleteSalesMigration();
