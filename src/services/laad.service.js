const prisma = require('../config/prisma');

/**
 * payload = {
 *   laadNumber, vehicleNumber, vehicleId?, arrivalDate, supplierId, notes,
 *   items: [{ 
 *     itemId, totalBags, remainingBags?, 
 *     qualityGrade?, weightPerBag?, ratePerBag?,
 *     jacobabadParchiNo?, kantyParchiNo? 
 *   }]
 * }
 */
exports.createLaadWithItems = async (payload) => {
  const { items = [], ...laadData } = payload;

  // Ensure items is an array
  if (!Array.isArray(items)) {
    throw new Error(`Expected items to be an array, but got ${typeof items}: ${JSON.stringify(items)}`);
  }

  // Check if weight columns exist in database BEFORE transaction
  let hasWeightColumns = false;
  try {
    const result = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'LaadItem' 
      AND column_name IN ('weightFromJacobabad', 'faisalabadWeight')
    `;
    const columnNames = result.map(r => r.column_name);
    hasWeightColumns = columnNames.includes('weightFromJacobabad') && columnNames.includes('faisalabadWeight');
  } catch (err) {
    // If check fails, assume columns don't exist
    hasWeightColumns = false;
  }

  // transaction to create laad and its items
  const result = await prisma.$transaction(async (tx) => {
    // Build item data - conditionally include weight fields based on database schema
    const itemData = items.map(it => {
      // Auto-calculate totalAmount if ratePerBag is provided
      const totalAmount = it.ratePerBag && it.totalBags 
        ? parseFloat(it.ratePerBag) * parseInt(it.totalBags)
        : null;

      // Build base item WITHOUT weight fields first
      const baseItem = {
        itemId: it.itemId,
        totalBags: it.totalBags,
        remainingBags: it.remainingBags ?? it.totalBags,
        qualityGrade: it.qualityGrade || null,
        weightPerBag: it.weightPerBag || null,
        ratePerBag: it.ratePerBag ? parseFloat(it.ratePerBag) : null,
        totalAmount: totalAmount,
      };

      // CRITICAL: Only add weight fields if columns exist in database
      // We create a new object to avoid Prisma validation issues
      if (hasWeightColumns) {
        // Columns exist - include weight fields
        return {
          ...baseItem,
          weightFromJacobabad: it.weightFromJacobabad ? parseFloat(it.weightFromJacobabad) : null,
          faisalabadWeight: it.faisalabadWeight ? parseFloat(it.faisalabadWeight) : null
        };
      } else {
        // Columns DON'T exist - return base item WITHOUT weight fields
        // This prevents Prisma from trying to use non-existent columns
        return baseItem;
      }
    });

    const laad = await tx.laad.create({
      data: {
        ...laadData,
        items: { create: itemData }
      },
      include: { 
        supplier: true,
        vehicle: true,
        items: { 
          include: { 
            item: true 
          } 
        } 
      }
    });
    return laad;
  });

  return result;
};

exports.getLaads = async () => {
  return prisma.laad.findMany({
    orderBy: { arrivalDate: 'desc' },
    include: { supplier: true, items: { include: { item: true } } }
  });
};

exports.getLaadById = async (id) => {
  return prisma.laad.findUnique({
    where: { id },
    include: { supplier: true, items: { include: { item: true } } }
  });
};
