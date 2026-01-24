const mongoose = require('mongoose');
const Sale = require('./src/models/Sale');
const Item = require('./src/models/Item');
require('dotenv').config();

async function migrateAllSalesCategories() {
  try {
    console.log('🔗 Connecting to database...');
    await mongoose.connect(process.env.DATABASE_URL);
    
    console.log('📊 Fetching all items for category mapping...');
    const items = await Item.find({}).lean();
    const itemCategoryMap = {};
    
    // Create mapping of item names to categories
    items.forEach(item => {
      if (item.name && item.category) {
        itemCategoryMap[item.name.toLowerCase()] = item.category;
      }
    });
    
    console.log(`📋 Found ${Object.keys(itemCategoryMap).length} items with categories`);
    
    // Get all sales that need category updates
    const salesNeedingUpdate = await Sale.find({
      $or: [
        { itemCategory: { $exists: false } },
        { itemCategory: null },
        { itemCategory: '' },
        { itemCategory: 'undefined' }
      ]
    });
    
    console.log(`📦 Found ${salesNeedingUpdate.length} sales needing category updates`);
    
    if (salesNeedingUpdate.length === 0) {
      console.log('✅ All sales already have categories. Migration complete!');
      await mongoose.disconnect();
      return;
    }
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    // Process each sale
    for (const sale of salesNeedingUpdate) {
      try {
        let category = null;
        let itemName = sale.itemName;
        
        // Try to determine category based on itemName
        if (itemName && itemCategoryMap[itemName.toLowerCase()]) {
          category = itemCategoryMap[itemName.toLowerCase()];
        } else if (itemName) {
          // Fallback: try to determine from item name patterns
          const lowerName = itemName.toLowerCase();
          if (lowerName.includes('daal') || lowerName.includes('دال') || 
              lowerName.includes('masoor') || lowerName.includes('moong') ||
              lowerName.includes('urad') || lowerName.includes('toor') ||
              lowerName.includes('chana') || lowerName.includes('چنا')) {
            category = lowerName.includes('chana') || lowerName.includes('چنا') ? 'channa' : 'daal';
          }
        }
        
        // If we found a category, update the sale
        if (category) {
          await Sale.findByIdAndUpdate(sale._id, {
            itemCategory: category,
            itemName: itemName || 'Unknown Item'
          });
          updatedCount++;
          console.log(`✅ Updated sale ${sale._id}: ${itemName} → ${category}`);
        } else {
          // If no category found, set to 'daal' as default
          await Sale.findByIdAndUpdate(sale._id, {
            itemCategory: 'daal',
            itemName: itemName || 'Unknown Item'
          });
          updatedCount++;
          console.log(`⚠️  Updated sale ${sale._id}: ${itemName} → daal (default)`);
        }
        
      } catch (error) {
        console.error(`❌ Error updating sale ${sale._id}:`, error.message);
        skippedCount++;
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successfully updated: ${updatedCount} sales`);
    console.log(`❌ Skipped/Errors: ${skippedCount} sales`);
    console.log(`📦 Total processed: ${salesNeedingUpdate.length} sales`);
    
    // Verify the migration
    const remainingUncategorized = await Sale.countDocuments({
      $or: [
        { itemCategory: { $exists: false } },
        { itemCategory: null },
        { itemCategory: '' },
        { itemCategory: 'undefined' }
      ]
    });
    
    if (remainingUncategorized === 0) {
      console.log('🎉 SUCCESS: All sales now have categories!');
    } else {
      console.log(`⚠️  WARNING: ${remainingUncategorized} sales still without categories`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database connection closed');
  }
}

// Run the migration
migrateAllSalesCategories();
