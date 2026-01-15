const Laad = require('../models/Laad');
const LaadItem = require('../models/LaadItem');
const Item = require('../models/Item');
const TruckArrivalEntry = require('../models/TruckArrivalEntry');

/**
 * Get combined stock items for sale
 * Combines items with same: itemName + qualityGrade + laadId
 * This allows same item (by name) with same quality in same laad to be combined
 * Also includes DUPLICATE_SKIPPED items from TruckArrivalEntry to ensure all bags are available
 * 
 * NEW: Weight-based tracking system - tracks inventory by weight but displays bag count
 * Remaining bags calculated as: remainingWeight / originalBagWeight
 * 
 * @returns {Promise<Array>} Combined stock items with remaining bags calculated by weight
 */
exports.getCombinedStockItems = async () => {
  try {
    // Get all laads with items
    const laads = await Laad.find()
      .populate('supplierId')
      .lean();

    // Get all laad items with remaining stock
    // NEW: Get items with remainingBags > 0 OR items that might have remaining weight but 0 bags due to weight-based sales
    const laadItems = await LaadItem.find({ 
      $or: [
        { remainingBags: { $gt: 0 } },
        { remainingBags: 0 } // Include items with 0 bags - they might have remaining weight
      ]
    })
      .populate('itemId')
      .populate('laadId')
      .lean();

    console.log('DEBUG: Found laadItems:', laadItems.length);
    laadItems.forEach(item => {
      console.log(`DEBUG: Item ${item.itemId?.name} - remainingBags: ${item.remainingBags}, weightPerBag: ${item.weightPerBag}`);
    });

    // Combine items with same: itemName + qualityGrade + laadId
    const combinedItemsMap = new Map(); // Key: itemName-qualityGrade-laadId

    laadItems.forEach((item) => {
      if (!item.itemId || !item.laadId) return;

      const itemName = (item.itemId.name || 'Unknown').trim().toLowerCase();
      const qualityGrade = (item.qualityGrade || '').trim();
      const laadId = item.laadId._id?.toString() || item.laadId.toString();
      
      // Create unique key for combining
      const combineKey = `${itemName}-${qualityGrade}-${laadId}`;

      // Calculate weights for this item
      const originalBagWeight = item.weightPerBag || item.itemId?.bagWeight || 50; // Default 50kg
      const totalWeight = (item.totalBags || 0) * originalBagWeight;
      const remainingWeight = (item.remainingBags || 0) * originalBagWeight;

      console.log(`DEBUG: Processing ${item.itemId.name} - totalBags: ${item.totalBags}, remainingBags: ${item.remainingBags}, originalBagWeight: ${originalBagWeight}, remainingWeight: ${remainingWeight}`);

      // Skip items with no remaining weight
      if (remainingWeight <= 0) {
        console.log(`DEBUG: Skipping ${item.itemId.name} - no remaining weight`);
        return;
      }

      if (combinedItemsMap.has(combineKey)) {
        // Combine with existing entry - sum the weights and quantities
        const existing = combinedItemsMap.get(combineKey);
        
        // Add weights
        existing.totalWeight = (existing.totalWeight || 0) + totalWeight;
        existing.remainingWeight = (existing.remainingWeight || 0) + remainingWeight;
        
        // Also keep bag counts for reference
        existing.totalBags = (existing.totalBags || 0) + (item.totalBags || 0);
        existing.originalRemainingBags = (existing.originalRemainingBags || 0) + (item.remainingBags || 0);
        
        // Store all matching LaadItem IDs for sale creation
        if (!existing.matchingLaadItemIds) {
          existing.matchingLaadItemIds = [existing.id || existing._id?.toString()];
        }
        existing.matchingLaadItemIds.push(item.id || item._id?.toString());
      } else {
        // First occurrence - add to map
        combinedItemsMap.set(combineKey, {
          ...item,
          id: item.id || item._id?.toString(),
          matchingLaadItemIds: [item.id || item._id?.toString()],
          // Weight-based tracking
          totalWeight: totalWeight,
          remainingWeight: remainingWeight,
          originalBagWeight: originalBagWeight,
          // Keep original bag counts for reference
          totalBags: item.totalBags || 0,
          originalRemainingBags: item.remainingBags || 0,
          item: {
            id: item.itemId.id || item.itemId._id?.toString(),
            name: item.itemId.name || 'Unknown',
            quality: item.itemId.quality || '',
            bagWeight: item.itemId.bagWeight || 0,
          },
          laad: {
            id: item.laadId.id || item.laadId._id?.toString(),
            laadNumber: item.laadId.laadNumber || '',
            supplier: item.laadId.supplierId ? {
              name: item.laadId.supplierId.name || 'Unknown',
            } : { name: 'Unknown' },
          },
        });
      }
    });

    // Now add DUPLICATE_SKIPPED items from TruckArrivalEntry
    // These are items that were skipped but should still be available for sale
    const truckArrivalEntries = await TruckArrivalEntry.find()
      .populate('laadId')
      .populate('supplierId')
      .populate('items.itemId')
      .lean();

    truckArrivalEntries.forEach((entry) => {
      if (!entry.items || entry.items.length === 0) return;
      if (!entry.laadId) return; // Skip if no laad associated

      entry.items.forEach((entryItem) => {
        // Only process DUPLICATE_SKIPPED items
        if (entryItem.status !== 'DUPLICATE_SKIPPED') return;
        if (!entryItem.itemId) return;

        const itemDoc = entryItem.itemId;
        const itemName = (itemDoc.name || entryItem.itemName || 'Unknown').trim().toLowerCase();
        const qualityGrade = (entryItem.qualityGrade || '').trim();
        const laadId = entry.laadId._id?.toString() || entry.laadId.toString();
        
        // Create unique key for combining (same as above)
        const combineKey = `${itemName}-${qualityGrade}-${laadId}`;
        
        const skippedBags = parseInt(entryItem.totalBags) || 0;
        if (skippedBags <= 0) return; // Skip if no bags

        // Calculate weight for skipped items
        const skippedBagWeight = entryItem.weightPerBag || itemDoc.bagWeight || 50;
        const skippedWeight = skippedBags * skippedBagWeight;

        if (combinedItemsMap.has(combineKey)) {
          // Match found - add skipped weight to existing stock entry
          const existing = combinedItemsMap.get(combineKey);
          existing.remainingWeight = (existing.remainingWeight || 0) + skippedWeight;
          existing.totalWeight = (existing.totalWeight || 0) + skippedWeight;
          existing.originalRemainingBags = (existing.originalRemainingBags || 0) + skippedBags;
          existing.totalBags = (existing.totalBags || 0) + skippedBags;
          
          // Mark that this includes skipped items for audit
          if (!existing.includesSkippedItems) {
            existing.includesSkippedItems = true;
          }
        } else {
          // No match found - create new stock entry for skipped items
          // IMPORTANT: Only include skipped items if we can map them to a real LaadItem.
          // Otherwise the frontend can select an ID that the sales endpoint cannot process.
          if (!entryItem.laadItemId) {
            return;
          }

          const virtualId = entryItem.laadItemId.toString();
          
          combinedItemsMap.set(combineKey, {
            id: virtualId,
            _id: entryItem.laadItemId || null,
            totalBags: skippedBags,
            originalRemainingBags: skippedBags,
            qualityGrade: qualityGrade || null,
            weightPerBag: entryItem.weightPerBag || null,
            weightFromJacobabad: entryItem.weightFromJacobabad || null,
            faisalabadWeight: entryItem.faisalabadWeight || null,
            ratePerBag: entryItem.ratePerBag || null,
            matchingLaadItemIds: [entryItem.laadItemId.toString()],
            includesSkippedItems: true, // Mark as including skipped items
            // Weight-based tracking
            totalWeight: skippedWeight,
            remainingWeight: skippedWeight,
            originalBagWeight: skippedBagWeight,
            item: {
              id: itemDoc._id?.toString() || itemDoc.id?.toString() || '',
              name: itemDoc.name || entryItem.itemName || 'Unknown',
              quality: itemDoc.quality || entryItem.itemQuality || '',
              bagWeight: itemDoc.bagWeight || 0,
            },
            laad: {
              id: entry.laadId._id?.toString() || entry.laadId.id?.toString() || '',
              laadNumber: entry.laadNumber || entry.laadId.laadNumber || '',
              supplier: entry.supplierId ? {
                name: entry.supplierId.name || 'Unknown',
              } : (entry.laadId.supplierId ? {
                name: entry.laadId.supplierId.name || 'Unknown',
              } : { name: 'Unknown' }),
            },
          });
        }
      });
    });

    // Convert map to array and format for frontend
    const combinedItems = Array.from(combinedItemsMap.values());

    return combinedItems.map(item => {
      // Calculate remaining bags based on weight
      // remainingBags = remainingWeight / originalBagWeight
      const calculatedRemainingBags = item.originalBagWeight > 0 
        ? Math.floor(item.remainingWeight / item.originalBagWeight)
        : item.originalRemainingBags || 0;

      console.log(`DEBUG: Final calculation for ${item.item.name}:`);
      console.log(`  - remainingWeight: ${item.remainingWeight}kg`);
      console.log(`  - originalBagWeight: ${item.originalBagWeight}kg`);
      console.log(`  - calculatedRemainingBags: ${calculatedRemainingBags}`);

      return {
        id: item.id,
        totalBags: item.totalBags || 0,
        remainingBags: calculatedRemainingBags, // NEW: Calculated by weight
        originalRemainingBags: item.originalRemainingBags || 0, // Original bag count for reference
        qualityGrade: item.qualityGrade || null,
        weightPerBag: item.weightPerBag || null,
        weightFromJacobabad: item.weightFromJacobabad || null,
        faisalabadWeight: item.faisalabadWeight || null,
        ratePerBag: item.ratePerBag || null,
        // NEW: Weight-based tracking fields
        totalWeight: item.totalWeight || 0,
        remainingWeight: item.remainingWeight || 0,
        originalBagWeight: item.originalBagWeight || 50,
        item: item.item,
        laad: item.laad,
        matchingLaadItemIds: item.matchingLaadItemIds || [item.id],
        includesSkippedItems: item.includesSkippedItems || false, // Flag for frontend
      };
    }).filter(item => item.remainingBags > 0); // Only return items with remaining bags > 0
  } catch (error) {
    console.error('Error getting combined stock items:', error);
    throw error;
  }
};

