const mongoose = require('mongoose');
const Sale = require('./src/models/Sale');
const Item = require('./src/models/Item');
const LaadItem = require('./src/models/LaadItem');
require('dotenv').config();

async function migrateAllSalesDetails() {
  try {
    console.log('🔗 Connecting to database...');
    await mongoose.connect(process.env.DATABASE_URL);
    
    console.log('📊 Starting comprehensive sales details migration...');
    
    // Get all sales that need updates
    const salesNeedingUpdate = await Sale.find({
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
    
    console.log(`📦 Found ${salesNeedingUpdate.length} sales needing details updates`);
    
    if (salesNeedingUpdate.length === 0) {
      console.log('✅ All sales already have complete details. Migration complete!');
      await mongoose.disconnect();
      return;
    }
    
    let updatedCount = 0;
    let skippedCount = 0;
    let itemUpdates = 0;
    let qualityUpdates = 0;
    let laadUpdates = 0;
    
    // Pre-load all items for efficient lookup
    const items = await Item.find({}).lean();
    const itemMap = {};
    items.forEach(item => {
      itemMap[item._id.toString()] = item;
      if (item.id) itemMap[item.id.toString()] = item;
    });
    
    // Pre-load all LaadItems for efficient lookup
    const laadItems = await LaadItem.find({}).lean();
    const laadItemMap = {};
    laadItems.forEach(laadItem => {
      laadItemMap[laadItem._id.toString()] = laadItem;
      if (laadItem.id) laadItemMap[laadItem.id.toString()] = laadItem;
    });
    
    console.log(`📋 Pre-loaded ${items.length} items and ${laadItems.length} laad items`);
    
    // Process each sale
    for (const sale of salesNeedingUpdate) {
      try {
        let updateData = {};
        let needsUpdate = false;
        
        // 1. Update Item Name
        if (!sale.itemName || sale.itemName === 'Unknown Item' || sale.itemName === '') {
          let itemName = 'Unknown Item';
          
          // Try to get from laadItemId first
          if (sale.laadItemId && laadItemMap[sale.laadItemId.toString()]) {
            const laadItem = laadItemMap[sale.laadItemId.toString()];
            if (laadItem.itemId && itemMap[laadItem.itemId.toString()]) {
              const item = itemMap[laadItem.itemId.toString()];
              itemName = item.name || 'Unknown Item';
            }
          }
          
          // Fallback: try to extract from existing itemName if it has partial data
          if (itemName === 'Unknown Item' && sale.itemName && sale.itemName !== 'Unknown Item') {
            itemName = sale.itemName;
          }
          
          updateData.itemName = itemName;
          needsUpdate = true;
          itemUpdates++;
        }
        
        // 2. Update Quality Grade
        if (!sale.qualityGrade || sale.qualityGrade === '') {
          let qualityGrade = 'N/A';
          
          // Try to get from laadItemId
          if (sale.laadItemId && laadItemMap[sale.laadItemId.toString()]) {
            const laadItem = laadItemMap[sale.laadItemId.toString()];
            if (laadItem.qualityGrade && laadItem.qualityGrade !== '') {
              qualityGrade = laadItem.qualityGrade;
            }
          }
          
          // Fallback: try to extract from existing qualityGrade if it has partial data
          if (qualityGrade === 'N/A' && sale.qualityGrade && sale.qualityGrade !== '') {
            qualityGrade = sale.qualityGrade;
          }
          
          updateData.qualityGrade = qualityGrade;
          needsUpdate = true;
          qualityUpdates++;
        }
        
        // 3. Update Laad Number
        if (!sale.laadNumber || sale.laadNumber === '') {
          let laadNumber = 'N/A';
          
          // Try to get from laadItemId
          if (sale.laadItemId && laadItemMap[sale.laadItemId.toString()]) {
            const laadItem = laadItemMap[sale.laadItemId.toString()];
            if (laadItem.laadId && laadItem.laadId.laadNumber) {
              laadNumber = laadItem.laadId.laadNumber;
            } else if (laadItem.laadNumber) {
              laadNumber = laadItem.laadNumber;
            }
          }
          
          // Fallback: try to extract from existing laadNumber if it has partial data
          if (laadNumber === 'N/A' && sale.laadNumber && sale.laadNumber !== '') {
            laadNumber = sale.laadNumber;
          }
          
          updateData.laadNumber = laadNumber;
          needsUpdate = true;
          laadUpdates++;
        }
        
        // Apply updates if needed
        if (needsUpdate) {
          await Sale.findByIdAndUpdate(sale._id, updateData);
          updatedCount++;
          
          console.log(`✅ Updated sale ${sale._id.toString().substring(0, 8)}...:`);
          if (updateData.itemName) console.log(`   Item: ${updateData.itemName}`);
          if (updateData.qualityGrade) console.log(`   Quality: ${updateData.qualityGrade}`);
          if (updateData.laadNumber) console.log(`   Laad: ${updateData.laadNumber}`);
        }
        
      } catch (error) {
        console.error(`❌ Error updating sale ${sale._id}:`, error.message);
        skippedCount++;
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successfully updated: ${updatedCount} sales`);
    console.log(`   - Item names: ${itemUpdates}`);
    console.log(`   - Quality grades: ${qualityUpdates}`);
    console.log(`   - Laad numbers: ${laadUpdates}`);
    console.log(`❌ Skipped/Errors: ${skippedCount} sales`);
    console.log(`📦 Total processed: ${salesNeedingUpdate.length} sales`);
    
    // Verify the migration
    const remainingIncomplete = await Sale.countDocuments({
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
    
    if (remainingIncomplete === 0) {
      console.log('🎉 SUCCESS: All sales now have complete details!');
    } else {
      console.log(`⚠️  WARNING: ${remainingIncomplete} sales still incomplete`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database connection closed');
  }
}

// Run the migration
migrateAllSalesDetails();
