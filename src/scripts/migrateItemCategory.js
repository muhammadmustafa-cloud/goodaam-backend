const mongoose = require('mongoose');
const Item = require('../models/Item');

async function migrateItemCategory() {
  try {
    console.log('Starting item category migration...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/godam');
    console.log('Connected to database');
    
    // Find all items without category field
    const itemsWithoutCategory = await Item.find({ category: { $exists: false } });
    console.log(`Found ${itemsWithoutCategory.length} items without category`);
    
    // Update items with default category based on name analysis
    let updatedCount = 0;
    for (const item of itemsWithoutCategory) {
      let category = 'daal'; // default
      
      // Simple heuristic - you can adjust this logic
      const itemName = item.name.toLowerCase();
      if (itemName.includes('channa') || itemName.includes('chanay') || itemName.includes('gram')) {
        category = 'channa';
      }
      
      await Item.updateOne(
        { _id: item._id },
        { $set: { category } }
      );
      
      console.log(`Updated item "${item.name}" with category: ${category}`);
      updatedCount++;
    }
    
    console.log(`Migration completed! Updated ${updatedCount} items.`);
    
    // Show summary
    const daalCount = await Item.countDocuments({ category: 'daal' });
    const channaCount = await Item.countDocuments({ category: 'channa' });
    console.log(`Summary: ${daalCount} Daal items, ${channaCount} Channa items`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database');
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateItemCategory();
}

module.exports = migrateItemCategory;
