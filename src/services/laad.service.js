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

  // transaction to create laad and its items
  const result = await prisma.$transaction(async (tx) => {
    const laad = await tx.laad.create({
      data: {
        ...laadData,
        items: { create: items.map(it => {
          // Auto-calculate totalAmount if ratePerBag is provided
          const totalAmount = it.ratePerBag && it.totalBags 
            ? parseFloat(it.ratePerBag) * parseInt(it.totalBags)
            : null;

          return {
            itemId: it.itemId,
            totalBags: it.totalBags,
            remainingBags: it.remainingBags ?? it.totalBags,
            qualityGrade: it.qualityGrade || null,
            weightPerBag: it.weightPerBag || null,
            ratePerBag: it.ratePerBag ? parseFloat(it.ratePerBag) : null,
            totalAmount: totalAmount,
            jacobabadParchiNo: it.jacobabadParchiNo || null,
            kantyParchiNo: it.kantyParchiNo || null
          };
        }) }
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
