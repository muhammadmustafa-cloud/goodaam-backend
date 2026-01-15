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
 * One-Time Stock Correction Script for Render Deployment
 * 
 * PURPOSE: Run stock correction only once on deployment
 * Creates a flag file to prevent re-running
 */

async function oneTimeStockCorrection() {
  console.log('🚀 One-Time Stock Correction for Render Deployment');
  console.log('===============================================\n');

  // Check if already run
  const fs = require('fs');
  const flagFile = './.stock-correction-complete';
  
  if (fs.existsSync(flagFile)) {
    console.log('✅ Stock correction already completed on this deployment');
    console.log('📁 Flag file exists at:', flagFile);
    return;
  }

  console.log('🔍 Running stock correction for first time...\n');

  try {
    // Connect to database
    console.log('📡 Connecting to database...');
    await mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/godam_management_local');
    console.log('✅ Database connected!\n');

    // Find sales with weight discrepancies
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

    console.log(`📊 Found ${salesToFix.length} sales to fix\n`);

    // Group by LaadItem and calculate corrections
    const stockCorrections = new Map();

    for (const sale of salesToFix) {
      if (!sale.laadItemId) continue;

      const laadItemId = sale.laadItemId._id?.toString() || sale.laadItemId.id;
      if (!laadItemId) continue;

      const originalBagWeight = sale.laadItemId.weightPerBag || 
                             sale.laadItemId.itemId?.bagWeight || 50;
      const weightSold = sale.bagsSold * sale.bagWeight;
      const correctBagsDeducted = Math.ceil(weightSold / originalBagWeight);

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

    // Calculate final remaining bags
    const corrections = Array.from(stockCorrections.values());
    let totalFixed = 0;

    for (const correction of corrections) {
      correction.finalRemainingBags = correction.originalBags - correction.correctDeduction;
      
      if (correction.finalRemainingBags !== correction.currentRemainingBags) {
        console.log(`🔧 Fixing ${correction.itemName}...`);
        console.log(`   Current: ${correction.currentRemainingBags} bags`);
        console.log(`   Fixed: ${correction.finalRemainingBags} bags`);
        
        // Update LaadItem
        await LaadItem.findByIdAndUpdate(
          correction.laadItemId,
          { remainingBags: correction.finalRemainingBags }
        );
        
        totalFixed++;
      }
    }

    // Create flag file to prevent re-running
    fs.writeFileSync(flagFile, `Stock correction completed on ${new Date().toISOString()}`);
    console.log(`\n📁 Created flag file: ${flagFile}`);

    console.log('\n🎉 One-time stock correction completed!');
    console.log(`✅ Fixed ${totalFixed} items`);
    console.log('🔄 Stock is now mathematically correct!\n');

  } catch (error) {
    console.error('❌ Error during stock correction:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('📡 Database connection closed');
  }
}

// Run correction
if (require.main === module) {
  oneTimeStockCorrection()
    .then(() => {
      console.log('\n✅ One-time correction completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Correction failed:', error);
      process.exit(1);
    });
}

module.exports = { oneTimeStockCorrection };
