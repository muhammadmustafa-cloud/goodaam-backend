const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const LaadItem = require('../models/LaadItem');
const Item = require('../models/Item');

async function migrateSalesCategories() {
  try {
    console.log('Starting sales category migration...');
    
    // Use the same DATABASE_URL as the main app
    const dbUrl = process.env.DATABASE_URL || 'mongodb://localhost:27017/godam_management_local';
    console.log(`Connecting to database: ${dbUrl}`);
    
    // Connect to database
    await mongoose.connect(dbUrl);
    console.log('Connected to database');
    
    // First, let's check if we have any sales at all
    const totalSales = await Sale.countDocuments();
    console.log(`Total sales in database: ${totalSales}`);
    
    if (totalSales === 0) {
      console.log('No sales found in database. Migration not needed.');
      await mongoose.disconnect();
      return;
    }
    
    // Find all sales
    const sales = await Sale.find({});
    console.log(`Found ${sales.length} sales to process`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const sale of sales) {
      try {
        let itemCategory = null;
        
        // Handle both single item sales and mix orders
        if (sale.items && sale.items.length > 0) {
          // Mix order - get category from first item
          const firstLaadItemId = sale.items[0].laadItemId;
          if (firstLaadItemId) {
            const laadItem = await LaadItem.findById(firstLaadItemId).populate('itemId');
            itemCategory = laadItem?.itemId?.category;
          }
        } else if (sale.laadItemId) {
          // Single item sale
          const laadItem = await LaadItem.findById(sale.laadItemId).populate('itemId');
          itemCategory = laadItem?.itemId?.category;
        }
        
        if (itemCategory) {
          // Add itemCategory field to sale for analytics
          await Sale.updateOne(
            { _id: sale._id },
            { $set: { itemCategory } }
          );
          
          const itemName = sale.items?.[0]?.itemId?.name || 
                          (await LaadItem.findById(sale.laadItemId)?.populate('itemId'))?.itemId?.name || 
                          'Unknown Item';
          
          console.log(`Updated sale ${sale.id || sale._id}: Item "${itemName}" -> Category: ${itemCategory}`);
          updatedCount++;
        } else {
          console.log(`Skipped sale ${sale.id || sale._id}: No item category found`);
          skippedCount++;
        }
      } catch (error) {
        console.error(`Error updating sale ${sale._id}:`, error.message);
      }
    }
    
    console.log(`Migration completed!`);
    console.log(`Updated: ${updatedCount} sales`);
    console.log(`Skipped: ${skippedCount} sales`);
    
    // Show summary by category
    const daalCount = await Sale.countDocuments({ itemCategory: 'daal' });
    const channaCount = await Sale.countDocuments({ itemCategory: 'channa' });
    console.log(`Summary: ${daalCount} Daal sales, ${channaCount} Channa sales`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database');
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateSalesCategories();
}

module.exports = migrateSalesCategories;
