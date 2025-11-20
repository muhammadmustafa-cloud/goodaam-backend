/**
 * Production Migration Script
 * Applies all pending migrations to production database
 * 
 * Run this on production server:
 * DATABASE_URL="your-production-url" node scripts/apply-production-migrations.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function applyAllMigrations() {
  try {
    console.log('🚀 Starting production migrations...\n');

    // 1. Add weight columns to LaadItem
    console.log('📦 Step 1: Adding weight columns to LaadItem...');
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
              RAISE NOTICE '✅ Added weightFromJacobabad column';
          ELSE
              RAISE NOTICE '⏭️  weightFromJacobabad column already exists';
          END IF;
      END $$;
    `);

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
              RAISE NOTICE '✅ Added faisalabadWeight column';
          ELSE
              RAISE NOTICE '⏭️  faisalabadWeight column already exists';
          END IF;
      END $$;
    `);

    // 2. Remove unique constraint from Laad.laadNumber
    console.log('🔓 Step 2: Removing unique constraint from Laad.laadNumber...');
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
              RAISE NOTICE '✅ Dropped unique index Laad_laadNumber_key';
          ELSE
              RAISE NOTICE '⏭️  Unique index Laad_laadNumber_key does not exist';
          END IF;
      END $$;
    `);

    // 3. Add process sale fields to Sale table
    console.log('💰 Step 3: Adding process sale fields to Sale...');
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
              RAISE NOTICE '✅ Added laadNumber column to Sale';
          ELSE
              RAISE NOTICE '⏭️  laadNumber column already exists';
          END IF;
      END $$;
    `);

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
              RAISE NOTICE '✅ Added truckNumber column to Sale';
          ELSE
              RAISE NOTICE '⏭️  truckNumber column already exists';
          END IF;
      END $$;
    `);

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
              RAISE NOTICE '✅ Added address column to Sale';
          ELSE
              RAISE NOTICE '⏭️  address column already exists';
          END IF;
      END $$;
    `);

    // 4. Create indexes
    console.log('📊 Step 4: Creating indexes...');
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Sale_laadNumber_idx" ON "Sale"("laadNumber");
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Sale_truckNumber_idx" ON "Sale"("truckNumber");
    `);

    console.log('\n✅ All migrations applied successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Weight columns added to LaadItem');
    console.log('   ✅ Unique constraint removed from Laad.laadNumber');
    console.log('   ✅ Process sale fields added to Sale');
    console.log('   ✅ Indexes created');
    console.log('\n🔄 Next steps:');
    console.log('   1. Regenerate Prisma client: npx prisma generate');
    console.log('   2. Restart your backend service');
    console.log('   3. Test the API endpoints');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

applyAllMigrations()
  .then(() => {
    console.log('\n✅ Production migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Production migration failed:', error);
    process.exit(1);
  });

