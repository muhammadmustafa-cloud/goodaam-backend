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
 * Stock Correction Script
 * 
 * PURPOSE: Fix incorrect stock calculations from historical sales
 * 
 * PROBLEM: Previous sales used bag-based deduction instead of weight-based
 * - Sale: 500 bags × 25kg = 12,500kg
 * - Wrong: Deducted 500 bags → 0 remaining
 * - Correct: Deduct 250 bags (12,500kg ÷ 50kg) → 250 remaining
 * 
 * This script identifies and fixes all such discrepancies
 */

async function fixStockCalculations() {
  console.log('🔍 Starting stock correction analysis...\n');

  try {
    // STEP 1: Connect to database
    console.log('📡 STEP 1: Connecting to database...');
    await mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/godam_management_local');
    console.log('✅ Database connected successfully!\n');

    // STEP 2: Find all sales that need correction
    console.log('🔍 STEP 2: Finding sales with weight discrepancies...');
    
    // First, let's see ALL sales to understand what we're working with
    const allSales = await Sale.find({}).lean();
    console.log(`📊 Total sales in database: ${allSales.length}`);
    
    // Show structure of first few sales to debug
    allSales.slice(0, 3).forEach((sale, index) => {
      console.log(`📝 Sale ${index + 1} structure:`, {
        id: sale._id,
        hasLaadItemId: !!sale.laadItemId,
        hasBagWeight: sale.bagWeight !== undefined && sale.bagWeight !== null,
        bagsSold: sale.bagsSold,
        bagWeight: sale.bagWeight,
        isMixOrder: sale.isMixOrder
      });
    });
    
    // Find sales with bagWeight (these are the ones that need correction)
    const salesWithWeight = await Sale.find({
      bagWeight: { $exists: true, $ne: null }
    }).lean();
    
    console.log(`📊 Sales with bagWeight: ${salesWithWeight.length}`);
    
    // Find sales that have both bagWeight and laadItemId
    const salesToFix = await Sale.find({
      bagWeight: { $exists: true, $ne: null },
      laadItemId: { $exists: true }
    })
    .populate('laadItemId')
    .populate({
      path: 'laadItemId',
      populate: [
        { path: 'itemId', model: 'Item' },
        { path: 'laadId', model: 'Laad' }
      ]
    })
    .lean();

    console.log(`📊 Sales with bagWeight AND laadItemId: ${salesToFix.length}\n`);

    // Also check for mix orders (they might have items array)
    console.log('🔍 Checking for mix orders...');
    const mixOrders = await Sale.find({
      isMixOrder: true,
      items: { $exists: true, $ne: [] }
    })
    .populate('items.laadItemId')
    .populate({
      path: 'items.laadItemId',
      populate: [
        { path: 'itemId', model: 'Item' },
        { path: 'laadId', model: 'Laad' }
      ]
    })
    .lean();
    
    console.log(`📊 Mix orders with items: ${mixOrders.length}`);
    
    // Show mix order structure
    mixOrders.slice(0, 2).forEach((order, index) => {
      console.log(`📝 Mix Order ${index + 1}:`, {
        id: order._id,
        itemCount: order.items?.length || 0,
        items: order.items?.map(item => ({
          bagsSold: item.bagsSold,
          bagWeight: item.bagWeight,
          laadItemId: item.laadItemId?._id
        }))
      });
    });

    // Combine both types of sales for processing
    const allSalesToProcess = [...salesToFix, ...mixOrders];
    console.log(`📊 Total sales to process: ${allSalesToProcess.length}\n`);

    // STEP 3: Group sales by LaadItem to calculate total weight sold
    console.log('🧮 STEP 3: Calculating correct stock for each item...');
    
    const stockCorrections = new Map(); // laadItemId -> correction data

    // Process regular sales
    for (const sale of salesToFix) {
      if (!sale.laadItemId) continue;

      const laadItemId = sale.laadItemId._id?.toString() || sale.laadItemId.id;
      if (!laadItemId) continue;

      // Get original item weight (what it should have been)
      const originalBagWeight = sale.laadItemId.weightPerBag || 
                             sale.laadItemId.itemId?.bagWeight || 50;

      // Calculate what should have been deducted
      const weightSold = sale.bagsSold * sale.bagWeight;
      const correctBagsDeducted = Math.ceil(weightSold / originalBagWeight);

      console.log(`📝 Analyzing Sale ID: ${sale._id} (Regular)`);
      console.log(`   Item: ${sale.laadItemId.itemId?.name}`);
      console.log(`   Original weight: ${originalBagWeight}kg per bag`);
      console.log(`   Sale details: ${sale.bagsSold} bags × ${sale.bagWeight}kg = ${weightSold}kg`);
      console.log(`   Wrong deduction: ${sale.bagsSold} bags`);
      console.log(`   Correct deduction: ${correctBagsDeducted} bags`);
      console.log(`   Difference: ${sale.bagsSold - correctBagsDeducted} bags\n`);

      if (!stockCorrections.has(laadItemId)) {
        stockCorrections.set(laadItemId, {
          laadItemId: laadItemId,
          itemName: sale.laadItemId.itemId?.name || 'Unknown',
          originalBags: sale.laadItemId.totalBags || 0,
          currentRemainingBags: sale.laadItemId.remainingBags || 0,
          wrongDeduction: 0,
          correctDeduction: 0,
          finalRemainingBags: sale.laadItemId.remainingBags || 0
        });
      }

      const correction = stockCorrections.get(laadItemId);
      correction.wrongDeduction += sale.bagsSold;
      correction.correctDeduction += correctBagsDeducted;
    }

    // Process mix orders
    for (const mixOrder of mixOrders) {
      if (!mixOrder.items || !Array.isArray(mixOrder.items)) continue;

      for (const item of mixOrder.items) {
        if (!item.laadItemId) continue;

        const laadItemId = item.laadItemId._id?.toString() || item.laadItemId.id;
        if (!laadItemId) continue;

        // Get original item weight
        const originalBagWeight = item.laadItemId.weightPerBag || 
                               item.laadItemId.itemId?.bagWeight || 50;

        // Calculate what should have been deducted
        const weightSold = item.bagsSold * item.bagWeight;
        const correctBagsDeducted = Math.ceil(weightSold / originalBagWeight);

        console.log(`📝 Analyzing Mix Order ID: ${mixOrder._id} - Item: ${item.laadItemId.itemId?.name}`);
        console.log(`   Original weight: ${originalBagWeight}kg per bag`);
        console.log(`   Sale details: ${item.bagsSold} bags × ${item.bagWeight}kg = ${weightSold}kg`);
        console.log(`   Wrong deduction: ${item.bagsSold} bags`);
        console.log(`   Correct deduction: ${correctBagsDeducted} bags`);
        console.log(`   Difference: ${item.bagsSold - correctBagsDeducted} bags\n`);

        if (!stockCorrections.has(laadItemId)) {
          stockCorrections.set(laadItemId, {
            laadItemId: laadItemId,
            itemName: item.laadItemId.itemId?.name || 'Unknown',
            originalBags: item.laadItemId.totalBags || 0,
            currentRemainingBags: item.laadItemId.remainingBags || 0,
            wrongDeduction: 0,
            correctDeduction: 0,
            finalRemainingBags: item.laadItemId.remainingBags || 0
          });
        }

        const correction = stockCorrections.get(laadItemId);
        correction.wrongDeduction += item.bagsSold;
        correction.correctDeduction += correctBagsDeducted;
      }
    }

    // STEP 4: Calculate final correct remaining bags
    console.log('🔄 STEP 4: Calculating final correct stock...\n');

    const corrections = Array.from(stockCorrections.values());
    let totalItemsFixed = 0;

    for (const correction of corrections) {
      // Calculate what should be the correct remaining bags
      const totalWeightDeductedWrongly = correction.wrongDeduction * 50; // Assuming 50kg as base
      const totalWeightDeductedCorrectly = correction.correctDeduction * 50;
      
      // Fix the calculation: original - wrong + correct
      correction.finalRemainingBags = correction.originalBags - correction.correctDeduction;
      
      console.log(`🎯 Item: ${correction.itemName}`);
      console.log(`   Original bags: ${correction.originalBags}`);
      console.log(`   Wrongly deducted: ${correction.wrongDeduction} bags`);
      console.log(`   Correctly should deduct: ${correction.correctDeduction} bags`);
      console.log(`   Final remaining bags: ${correction.finalRemainingBags}`);
      console.log(`   Current remaining bags: ${correction.currentRemainingBags}`);
      console.log(`   Adjustment needed: ${correction.finalRemainingBags - correction.currentRemainingBags} bags\n`);

      if (correction.finalRemainingBags !== correction.currentRemainingBags) {
        totalItemsFixed++;
      }
    }

    // STEP 5: Ask for confirmation
    console.log('💾 STEP 5: Ready to fix stock data');
    console.log(`📊 Summary: ${totalItemsFixed} items need correction`);
    console.log('⚠️  This will update LaadItem remainingBags in database\n');

    // STEP 6: Apply corrections
    console.log('🔧 STEP 6: Applying corrections...\n');

    for (const correction of corrections) {
      if (correction.finalRemainingBags !== correction.currentRemainingBags) {
        console.log(`🔧 Fixing ${correction.itemName}...`);
        
        // Update the LaadItem with correct remaining bags
        await LaadItem.findByIdAndUpdate(
          correction.laadItemId,
          { 
            $set: { 
              remainingBags: correction.finalRemainingBags 
            } 
          }
        );
        
        console.log(`✅ Updated ${correction.itemName}: ${correction.currentRemainingBags} → ${correction.finalRemainingBags} bags`);
      } else {
        console.log(`⏭ Skipping ${correction.itemName}: already correct`);
      }
    }

    // STEP 7: Final report
    console.log('\n🎉 STEP 7: Stock correction completed!');
    console.log(`✅ Fixed ${totalItemsFixed} items`);
    console.log('🔄 Please restart your application to see changes');
    console.log('📋 Check Process Sale page to verify correct stock counts\n');

  } catch (error) {
    console.error('❌ Error during stock correction:', error);
    throw error;
  } finally {
    // STEP 8: Close database connection
    await mongoose.connection.close();
    console.log('📡 Database connection closed');
  }
}

// Run the correction
if (require.main === module) {
  console.log('🚀 Stock Correction Script Started');
  console.log('=====================================\n');
  fixStockCalculations()
    .then(() => {
      console.log('\n✅ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixStockCalculations };
