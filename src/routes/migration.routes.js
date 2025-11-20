const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Migration endpoint - Run database migrations via API
 * SECURITY: Only accessible by ADMIN users
 */
router.post('/apply-weight-columns', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    console.log('🔄 Applying weight columns migration via API...');

    // Add weightFromJacobabad column
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = 'public' 
              AND table_name = 'LaadItem' 
              AND column_name = 'weightFromJacobabad'
          ) THEN
              ALTER TABLE "LaadItem" ADD COLUMN "weightFromJacobabad" DECIMAL(65,30);
          END IF;
      END $$;
    `);

    // Add faisalabadWeight column
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = 'public' 
              AND table_name = 'LaadItem' 
              AND column_name = 'faisalabadWeight'
          ) THEN
              ALTER TABLE "LaadItem" ADD COLUMN "faisalabadWeight" DECIMAL(65,30);
          END IF;
      END $$;
    `);

    res.json({
      success: true,
      message: 'Weight columns migration applied successfully!'
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({
      success: false,
      message: 'Migration failed: ' + error.message
    });
  }
});

/**
 * Apply all production migrations
 */
router.post('/apply-all', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    console.log('🔄 Applying all production migrations via API...');

    const results = [];

    // 1. Add weight columns
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = 'public' 
              AND table_name = 'LaadItem' 
              AND column_name = 'weightFromJacobabad'
          ) THEN
              ALTER TABLE "LaadItem" ADD COLUMN "weightFromJacobabad" DECIMAL(65,30);
          END IF;
      END $$;
    `);
    results.push('✅ weightFromJacobabad column');

    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = 'public' 
              AND table_name = 'LaadItem' 
              AND column_name = 'faisalabadWeight'
          ) THEN
              ALTER TABLE "LaadItem" ADD COLUMN "faisalabadWeight" DECIMAL(65,30);
          END IF;
      END $$;
    `);
    results.push('✅ faisalabadWeight column');

    // 2. Remove unique constraint
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
          IF EXISTS (
              SELECT 1 FROM pg_indexes 
              WHERE schemaname = 'public' 
              AND tablename = 'Laad' 
              AND indexname = 'Laad_laadNumber_key'
          ) THEN
              DROP INDEX IF EXISTS "public"."Laad_laadNumber_key";
          END IF;
      END $$;
    `);
    results.push('✅ Removed laadNumber unique constraint');

    // 3. Add process sale fields
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = 'public' 
              AND table_name = 'Sale' 
              AND column_name = 'laadNumber'
          ) THEN
              ALTER TABLE "Sale" ADD COLUMN "laadNumber" TEXT;
          END IF;
      END $$;
    `);
    results.push('✅ Sale.laadNumber column');

    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = 'public' 
              AND table_name = 'Sale' 
              AND column_name = 'truckNumber'
          ) THEN
              ALTER TABLE "Sale" ADD COLUMN "truckNumber" TEXT;
          END IF;
      END $$;
    `);
    results.push('✅ Sale.truckNumber column');

    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = 'public' 
              AND table_name = 'Sale' 
              AND column_name = 'address'
          ) THEN
              ALTER TABLE "Sale" ADD COLUMN "address" TEXT;
          END IF;
      END $$;
    `);
    results.push('✅ Sale.address column');

    // 4. Create indexes
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Sale_laadNumber_idx" ON "Sale"("laadNumber");
    `);
    results.push('✅ Sale_laadNumber_idx index');

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Sale_truckNumber_idx" ON "Sale"("truckNumber");
    `);
    results.push('✅ Sale_truckNumber_idx index');

    res.json({
      success: true,
      message: 'All migrations applied successfully!',
      results: results
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({
      success: false,
      message: 'Migration failed: ' + error.message
    });
  }
});

/**
 * Check migration status
 */
router.get('/status', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const checks = {};

    // Check weight columns
    const weightColumns = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'LaadItem' 
      AND column_name IN ('weightFromJacobabad', 'faisalabadWeight')
    `;
    const columnNames = weightColumns.map(r => r.column_name);
    checks.weightColumns = {
      weightFromJacobabad: columnNames.includes('weightFromJacobabad'),
      faisalabadWeight: columnNames.includes('faisalabadWeight')
    };

    // Check unique constraint
    const uniqueIndex = await prisma.$queryRaw`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND tablename = 'Laad' 
      AND indexname = 'Laad_laadNumber_key'
    `;
    checks.laadNumberUnique = uniqueIndex.length > 0;

    // Check sale fields
    const saleColumns = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'Sale' 
      AND column_name IN ('laadNumber', 'truckNumber', 'address')
    `;
    const saleColumnNames = saleColumns.map(r => r.column_name);
    checks.saleFields = {
      laadNumber: saleColumnNames.includes('laadNumber'),
      truckNumber: saleColumnNames.includes('truckNumber'),
      address: saleColumnNames.includes('address')
    };

    res.json({
      success: true,
      data: checks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Status check failed: ' + error.message
    });
  }
});

module.exports = router;

