const mongoose = require('mongoose');
require('../models/Sale');
require('../models/LaadItem');
require('../models/Item');
require('../models/Laad');

const Sale = mongoose.model('Sale');
const LaadItem = mongoose.model('LaadItem');
const Item = mongoose.model('Item');
const Laad = mongoose.model('Laad');

/**
 * Database Analysis Script
 * 
 * PURPOSE: Understand exactly what's in the database before fixing anything
 * This will help us identify why entries are being missed
 */
async function analyzeDatabase() {
  console.log('🔍 Starting comprehensive database analysis...\n');

  try {
    // Connect to database
    console.log('📡 Connecting to database...');
    await mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/godam_management_local');
    console.log('✅ Database connected!\n');

    // STEP 1: Analyze ALL sales
    console.log('📊 STEP 1: Analyzing ALL sales...');
    const allSales = await Sale.find({}).lean();
    console.log(`Total sales in database: ${allSales.length}\n`);

    // Show structure of each sale type
    const salesByType = {
      regular: [],
      mix: [],
      unknown: []
    };

    allSales.forEach((sale, index) => {
      console.log(`📝 Sale ${index + 1}:`, {
        id: sale._id,
        hasLaadItemId: !!sale.laadItemId,
        hasItems: !!sale.items && Array.isArray(sale.items),
        itemsCount: sale.items?.length || 0,
        hasBagWeight: sale.bagWeight !== undefined && sale.bagWeight !== null,
        bagsSold: sale.bagsSold,
        bagWeight: sale.bagWeight,
        isMixOrder: sale.isMixOrder
      });

      if (sale.isMixOrder && sale.items) {
        salesByType.mix.push(sale);
      } else if (sale.laadItemId) {
        salesByType.regular.push(sale);
      } else {
        salesByType.unknown.push(sale);
      }
    });

    console.log('\n📈 Sales by Type:');
    console.log(`Regular sales: ${salesByType.regular.length}`);
    console.log(`Mix orders: ${salesByType.mix.length}`);
    console.log(`Unknown type: ${salesByType.unknown.length}\n`);

    // STEP 2: Analyze regular sales with potential weight issues
    console.log('🔍 STEP 2: Analyzing regular sales for weight issues...');
    const regularWithWeight = salesByType.regular.filter(sale => 
      sale.bagWeight !== undefined && sale.bagWeight !== null && sale.bagWeight > 0
    );
    console.log(`Regular sales with bagWeight: ${regularWithWeight.length}\n`);

    // STEP 3: Analyze mix orders for weight issues
    console.log('🔍 STEP 3: Analyzing mix orders for weight issues...');
    let mixItemsWithWeight = 0;
    salesByType.mix.forEach((mixOrder, index) => {
      console.log(`📝 Mix Order ${index + 1} (${mixOrder._id}):`);
      console.log(`   Items count: ${mixOrder.items?.length || 0}`);
      
      if (mixOrder.items) {
        mixOrder.items.forEach((item, itemIndex) => {
          console.log(`   Item ${itemIndex + 1}:`, {
            bagsSold: item.bagsSold,
            bagWeight: item.bagWeight,
            hasLaadItemId: !!item.laadItemId,
            laadItemId: item.laadItemId
          });
          
          if (item.bagWeight !== undefined && item.bagWeight !== null && item.bagWeight > 0) {
            mixItemsWithWeight++;
          }
        });
      }
      console.log('');
    });
    console.log(`Mix order items with bagWeight: ${mixItemsWithWeight}\n`);

    // STEP 4: Analyze LaadItems to see current stock
    console.log('🔍 STEP 4: Analyzing LaadItems (current stock)...');
    const allLaadItems = await LaadItem.find({})
      .populate('itemId')
      .populate('laadId')
      .lean();
    
    console.log(`Total LaadItems: ${allLaadItems.length}\n`);

    const itemsWithIssues = [];
    allLaadItems.forEach((laadItem, index) => {
      console.log(`📝 LaadItem ${index + 1}:`, {
        id: laadItem._id,
        itemName: laadItem.itemId?.name,
        totalBags: laadItem.totalBags,
        remainingBags: laadItem.remainingBags,
        weightPerBag: laadItem.weightPerBag,
        itemBagWeight: laadItem.itemId?.bagWeight
      });

      // Check for potential issues
      if (laadItem.remainingBags < 0) {
        itemsWithIssues.push({
          id: laadItem._id,
          name: laadItem.itemId?.name,
          issue: 'Negative remaining bags',
          remainingBags: laadItem.remainingBags
        });
      } else if (laadItem.remainingBags > laadItem.totalBags) {
        itemsWithIssues.push({
          id: laadItem._id,
          name: laadItem.itemId?.name,
          issue: 'Remaining bags more than total',
          remainingBags: laadItem.remainingBags,
          totalBags: laadItem.totalBags
        });
      }
    });

    if (itemsWithIssues.length > 0) {
      console.log('\n⚠️  Items with issues:');
      itemsWithIssues.forEach(item => {
        console.log(`   ${item.name}: ${item.issue}`);
      });
    } else {
      console.log('\n✅ No obvious issues found in LaadItems');
    }

    // STEP 5: Summary
    console.log('\n📋 SUMMARY:');
    console.log(`Total sales: ${allSales.length}`);
    console.log(`Regular sales with weight: ${regularWithWeight.length}`);
    console.log(`Mix order items with weight: ${mixItemsWithWeight}`);
    console.log(`Total items needing potential fix: ${regularWithWeight.length + mixItemsWithWeight}`);
    console.log(`LaadItems with issues: ${itemsWithIssues.length}`);

    console.log('\n🎯 RECOMMENDATIONS:');
    if (regularWithWeight.length > 0) {
      console.log('✅ Found regular sales with weight - these need fixing');
    }
    if (mixItemsWithWeight > 0) {
      console.log('✅ Found mix order items with weight - these need fixing');
    }
    if (itemsWithIssues.length > 0) {
      console.log('⚠️  Found LaadItems with issues - these need immediate attention');
    }
    if (regularWithWeight.length === 0 && mixItemsWithWeight === 0) {
      console.log('ℹ️  No sales with weight discrepancies found - stock might already be correct');
    }

  } catch (error) {
    console.error('❌ Error during analysis:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('\n📡 Database connection closed');
  }
}

// Run the analysis
if (require.main === module) {
  console.log('🚀 Database Analysis Script Started');
  console.log('===================================\n');
  analyzeDatabase()
    .then(() => {
      console.log('\n✅ Analysis completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Analysis failed:', error);
      process.exit(1);
    });
}

module.exports = { analyzeDatabase };
