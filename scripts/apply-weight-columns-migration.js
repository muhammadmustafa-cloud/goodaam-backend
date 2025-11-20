/**
 * Script to apply weight columns migration to LaadItem table
 * This script safely adds weightFromJacobabad and faisalabadWeight columns
 * and removes old jacobabadParchiNo and kantyParchiNo columns if they exist
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('🔄 Applying weight columns migration...');

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
              RAISE NOTICE 'Added weightFromJacobabad column';
          ELSE
              RAISE NOTICE 'weightFromJacobabad column already exists';
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
              RAISE NOTICE 'Added faisalabadWeight column';
          ELSE
              RAISE NOTICE 'faisalabadWeight column already exists';
          END IF;
      END $$;
    `);

    // Drop old columns if they exist (optional cleanup)
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
          IF EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = 'public' 
              AND table_name = 'LaadItem' 
              AND column_name = 'jacobabadParchiNo'
          ) THEN
              ALTER TABLE "LaadItem" DROP COLUMN "jacobabadParchiNo";
              RAISE NOTICE 'Dropped jacobabadParchiNo column';
          END IF;
          
          IF EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = 'public' 
              AND table_name = 'LaadItem' 
              AND column_name = 'kantyParchiNo'
          ) THEN
              ALTER TABLE "LaadItem" DROP COLUMN "kantyParchiNo";
              RAISE NOTICE 'Dropped kantyParchiNo column';
          END IF;
      END $$;
    `);

    console.log('✅ Migration applied successfully!');
    console.log('📝 Columns added: weightFromJacobabad, faisalabadWeight');
    
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

