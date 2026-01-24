const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const LaadItem = require('../models/LaadItem');
const Item = require('../models/Item');
require('dotenv').config();

async function migrateAllSalesToAnalytics() {
  try {
    console.log('🚀 Starting complete sales analytics migration...');
    
    // Connect to database
    const dbUrl = process.env.DATABASE_URL || 'mongodb://localhost:27017/godam_management_local';
    await mongoose.connect(dbUrl);
    console.log('✅ Connected to database:', dbUrl);

    // Get ALL sales without itemCategory or itemName
    const sales = await Sale.find({
      $or: [
        { itemCategory: { $exists: false } },
        { itemCategory: null },
        { itemName: { $exists: false } },
        { itemName: null }
      ]
    }).lean();

    console.log(`📊 Found ${sales.length} sales to migrate`);

    let updatedCount = 0;
    let daalCount = 0;
    let channaCount = 0;
    let skippedCount = 0;

    for (const sale of sales) {
      try {
        let itemName = 'Unknown Item';
        let itemCategory = 'daal'; // default

        // Case 1: Single item sale (has laadItemId)
        if (sale.laadItemId && !sale.isMixOrder) {
          const laadItem = await LaadItem.findById(sale.laadItemId).populate('itemId').lean();
          
          if (laadItem && laadItem.itemId) {
            itemName = laadItem.itemId.name || 'Unknown Item';
            itemCategory = laadItem.itemId.category || 'daal';
          }
        }
        // Case 2: Mix order (has items array)
        else if (sale.items && sale.items.length > 0) {
          // Use first item for main category
          const firstItem = sale.items[0];
          const laadItem = await LaadItem.findById(firstItem.laadItemId).populate('itemId').lean();
          
          if (laadItem && laadItem.itemId) {
            itemName = laadItem.itemId.name || 'Unknown Item';
            itemCategory = laadItem.itemId.category || 'daal';
          }

          // Also update each item in the array
          for (const item of sale.items) {
            const itemLaadItem = await LaadItem.findById(item.laadItemId).populate('itemId').lean();
            
            if (itemLaadItem && itemLaadItem.itemId) {
              item.itemName = itemLaadItem.itemId.name || 'Unknown Item';
              item.itemCategory = itemLaadItem.itemId.category || 'daal';
            }
          }
        }

        // Update the sale with analytics data
        await Sale.updateOne(
          { _id: sale._id },
          { 
            $set: { 
              itemName,
              itemCategory,
              // Update items array if it's a mix order
              ...(sale.items && { items: sale.items })
            }
          }
        );

        updatedCount++;
        
        if (itemCategory === 'daal') {
          daalCount++;
        } else if (itemCategory === 'channa') {
          channaCount++;
        }

        console.log(`✅ Updated sale ${sale._id}: "${itemName}" -> Category: ${itemCategory}`);

      } catch (error) {
        console.error(`❌ Error updating sale ${sale._id}:`, error.message);
        skippedCount++;
      }
    }

    console.log('\n🎉 Migration completed!');
    console.log(`📈 Summary:`);
    console.log(`   - Total sales processed: ${sales.length}`);
    console.log(`   - Successfully updated: ${updatedCount}`);
    console.log(`   - Skipped (errors): ${skippedCount}`);
    console.log(`   - Daal sales: ${daalCount}`);
    console.log(`   - Channa sales: ${channaCount}`);

    // Verify results
    const totalSales = await Sale.countDocuments();
    const categorizedSales = await Sale.countDocuments({
      itemCategory: { $exists: true, $ne: null }
    });

    console.log('\n📊 Database Summary:');
    console.log(`   - Total sales in database: ${totalSales}`);
    console.log(`   - Sales with category: ${categorizedSales}`);
    console.log(`   - Migration success rate: ${((categorizedSales / totalSales) * 100).toFixed(1)}%`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the migration
migrateAllSalesToAnalytics();
