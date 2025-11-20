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

  // Check if weight columns exist in database
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

      const baseItem = {
        itemId: it.itemId,
        totalBags: it.totalBags,
        remainingBags: it.remainingBags ?? it.totalBags,
        qualityGrade: it.qualityGrade || null,
        weightPerBag: it.weightPerBag || null,
        ratePerBag: it.ratePerBag ? parseFloat(it.ratePerBag) : null,
        totalAmount: totalAmount,
      };

      // Only add weight fields if columns exist in database
      // This prevents Prisma from trying to use non-existent columns
      if (hasWeightColumns) {
        baseItem.weightFromJacobabad = it.weightFromJacobabad ? parseFloat(it.weightFromJacobabad) : null;
        baseItem.faisalabadWeight = it.faisalabadWeight ? parseFloat(it.faisalabadWeight) : null;
      }
      // If columns don't exist, we simply don't include them in the data object

      return baseItem;
    });

    try {
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
    } catch (error) {
      // If error is about unknown arguments, it means Prisma Client expects fields that don't exist
      // This happens when schema has fields but database doesn't
      if (error.message && error.message.includes('Unknown argument')) {
        const helpfulError = new Error(
          'Database schema mismatch detected.\n\n' +
          'The Prisma schema includes weight columns, but they don\'t exist in the database.\n\n' +
          'SOLUTION: Run migration on production:\n' +
          '1. SSH into your production server\n' +
          '2. Run: npm run db:migrate:production\n' +
          '3. Or run: node scripts/apply-production-migrations.js\n\n' +
          'Original error: ' + error.message
        );
        helpfulError.status = 500;
        throw helpfulError;
      }
      throw error;
    }
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
