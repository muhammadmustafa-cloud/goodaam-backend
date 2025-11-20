/**
 * Script to apply process sale fields migration to Sale table
 * Adds: laadNumber, truckNumber, address fields for process sale history
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('🔄 Applying process sale fields migration...');

    // Add laadNumber column
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
              RAISE NOTICE 'Added laadNumber column';
          ELSE
              RAISE NOTICE 'laadNumber column already exists';
          END IF;
      END $$;
    `);

    // Add truckNumber column
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
              RAISE NOTICE 'Added truckNumber column';
          ELSE
              RAISE NOTICE 'truckNumber column already exists';
          END IF;
      END $$;
    `);

    // Add address column
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
              RAISE NOTICE 'Added address column';
          ELSE
              RAISE NOTICE 'address column already exists';
          END IF;
      END $$;
    `);

    // Create indexes
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Sale_laadNumber_idx" ON "Sale"("laadNumber");
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Sale_truckNumber_idx" ON "Sale"("truckNumber");
    `);

    console.log('✅ Migration applied successfully!');
    console.log('📝 Columns added: laadNumber, truckNumber, address');
    console.log('📊 Indexes created for better query performance');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

