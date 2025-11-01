const prisma = require('../config/prisma');

// Register truck arrival
exports.registerTruckArrival = async (req, res, next) => {
  try {
    const { truckNumber, driverName, createdById } = req.body;

    if (!truckNumber || !createdById) {
      return res.status(400).json({
        success: false,
        message: 'truckNumber and createdById are required'
      });
    }

    const gateEntry = await prisma.gateEntry.create({
      data: {
        truckNumber,
        driverName: driverName || null,
        createdById: parseInt(createdById),
        status: 'PENDING'
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.json({ success: true, data: gateEntry });
  } catch (err) { next(err); }
};

// Record weight machine reading
exports.recordWeightReading = async (req, res, next) => {
  try {
    const { gateEntryId } = req.params;
    const { grossWeight, tareWeight, netWeight, weightMachineReading } = req.body;

    if (!grossWeight || !tareWeight || !netWeight) {
      return res.status(400).json({
        success: false,
        message: 'grossWeight, tareWeight, and netWeight are required'
      });
    }

    const gateEntry = await prisma.gateEntry.update({
      where: { id: parseInt(gateEntryId) },
      data: {
        grossWeight: parseFloat(grossWeight),
        tareWeight: parseFloat(tareWeight),
        netWeight: parseFloat(netWeight),
        weightMachineReading: weightMachineReading ? parseFloat(weightMachineReading) : null,
        status: 'WEIGHED'
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.json({ success: true, data: gateEntry });
  } catch (err) { next(err); }
};

// Generate gatepass with advanced features
exports.generateGatepass = async (req, res, next) => {
  try {
    const { gateEntryId } = req.params;
    const { laadId, items, gatepassType = 'STANDARD' } = req.body;

    if (!laadId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'laadId and items array are required'
      });
    }

    // Generate professional gatepass number with date
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = date.toTimeString().slice(0, 8).replace(/:/g, '');
    const gatepassNumber = `GP-${dateStr}-${timeStr}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    const result = await prisma.$transaction(async (tx) => {
      // Update gate entry with laad and gatepass number
      const gateEntry = await tx.gateEntry.update({
        where: { id: parseInt(gateEntryId) },
        data: {
          laadId: parseInt(laadId),
          gatepassNumber,
          status: 'PROCESSED'
        },
        include: {
          laad: {
            include: {
              supplier: true,
              items: {
                include: {
                  item: true
                }
              }
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      // Update laad items with quality grades and parchi numbers
      for (const item of items) {
        await tx.laadItem.update({
          where: { id: item.laadItemId },
          data: {
            qualityGrade: item.qualityGrade || null,
            weightPerBag: item.weightPerBag || null,
            jacobabadParchiNo: item.jacobabadParchiNo || null,
            kantyParchiNo: item.kantyParchiNo || null
          }
        });
      }

      return gateEntry;
    });

    res.json({ 
      success: true, 
      data: result,
      gatepassNumber,
      message: 'Gatepass generated successfully'
    });
  } catch (err) { next(err); }
};

// Get gate entries
exports.getGateEntries = async (req, res, next) => {
  try {
    const { status, dateFrom, dateTo } = req.query;
    
    const where = {};
    
    if (status) {
      where.status = status;
    }
    
    if (dateFrom || dateTo) {
      where.arrivalTime = {};
      if (dateFrom) where.arrivalTime.gte = new Date(dateFrom);
      if (dateTo) where.arrivalTime.lte = new Date(dateTo);
    }

    const entries = await prisma.gateEntry.findMany({
      where,
      orderBy: { arrivalTime: 'desc' },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        laad: {
          include: {
            supplier: true,
            items: {
              include: {
                item: true
              }
            }
          }
        }
      }
    });

    res.json({ success: true, data: entries });
  } catch (err) { next(err); }
};

// Get gate entry by ID
exports.getGateEntryById = async (req, res, next) => {
  try {
    const entry = await prisma.gateEntry.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        laad: {
          include: {
            supplier: true,
            items: {
              include: {
                item: true
              }
            }
          }
        }
      }
    });

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Gate entry not found'
      });
    }

    res.json({ success: true, data: entry });
  } catch (err) { next(err); }
};

// Update gate entry status
exports.updateGateEntryStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'status is required'
      });
    }

    const validStatuses = ['PENDING', 'WEIGHED', 'PROCESSED', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const entry = await prisma.gateEntry.update({
      where: { id: parseInt(id) },
      data: { status },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        laad: {
          include: {
            supplier: true,
            items: {
              include: {
                item: true
              }
            }
          }
        }
      }
    });

    res.json({ success: true, data: entry });
  } catch (err) { next(err); }
};

// Complete gate entry (final step)
exports.completeGateEntry = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes, finalWeight } = req.body;

    const entry = await prisma.gateEntry.update({
      where: { id: parseInt(id) },
      data: { 
        status: 'COMPLETED',
        notes: notes || null,
        netWeight: finalWeight ? parseFloat(finalWeight) : null
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        laad: {
          include: {
            supplier: true,
            items: {
              include: {
                item: true
              }
            }
          }
        }
      }
    });

    res.json({ 
      success: true, 
      data: entry,
      message: 'Gate entry completed successfully'
    });
  } catch (err) { next(err); }
};

// Get gate statistics
exports.getGateStatistics = async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;
    
    const where = {};
    if (dateFrom || dateTo) {
      where.arrivalTime = {};
      if (dateFrom) where.arrivalTime.gte = new Date(dateFrom);
      if (dateTo) where.arrivalTime.lte = new Date(dateTo);
    }

    const [
      totalEntries,
      pendingEntries,
      completedEntries,
      todayEntries,
      totalWeight
    ] = await Promise.all([
      prisma.gateEntry.count({ where }),
      prisma.gateEntry.count({ where: { ...where, status: 'PENDING' } }),
      prisma.gateEntry.count({ where: { ...where, status: 'COMPLETED' } }),
      prisma.gateEntry.count({ 
        where: { 
          ...where,
          arrivalTime: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      prisma.gateEntry.aggregate({
        where: { ...where, netWeight: { not: null } },
        _sum: { netWeight: true }
      })
    ]);

    res.json({
      success: true,
      data: {
        totalEntries,
        pendingEntries,
        completedEntries,
        todayEntries,
        totalWeight: totalWeight._sum.netWeight || 0,
        completionRate: totalEntries > 0 ? (completedEntries / totalEntries * 100).toFixed(2) : 0
      }
    });
  } catch (err) { next(err); }
};

// Print gatepass
exports.printGatepass = async (req, res, next) => {
  try {
    const { id } = req.params;

    const gateEntry = await prisma.gateEntry.findUnique({
      where: { id: parseInt(id) },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        laad: {
          include: {
            supplier: true,
            items: {
              include: {
                item: true
              }
            }
          }
        }
      }
    });

    if (!gateEntry) {
      return res.status(404).json({
        success: false,
        message: 'Gate entry not found'
      });
    }

    if (!gateEntry.gatepassNumber) {
      return res.status(400).json({
        success: false,
        message: 'Gatepass not generated yet'
      });
    }

    // Generate print-ready gatepass data
    const gatepassData = {
      gatepassNumber: gateEntry.gatepassNumber,
      truckNumber: gateEntry.truckNumber,
      driverName: gateEntry.driverName,
      arrivalTime: gateEntry.arrivalTime,
      grossWeight: gateEntry.grossWeight,
      tareWeight: gateEntry.tareWeight,
      netWeight: gateEntry.netWeight,
      supplier: gateEntry.laad?.supplier,
      items: gateEntry.laad?.items || [],
      createdBy: gateEntry.createdBy,
      status: gateEntry.status,
      printTime: new Date().toISOString()
    };

    res.json({
      success: true,
      data: gatepassData,
      message: 'Gatepass ready for printing'
    });
  } catch (err) { next(err); }
};
