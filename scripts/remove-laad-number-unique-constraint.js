/**
 * Script to remove unique constraint from laadNumber column
 * This allows multiple laads with the same laadNumber
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function removeUniqueConstraint() {
  try {
    console.log('🔄 Removing unique constraint from laadNumber...');

    // Drop the unique index if it exists
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
              RAISE NOTICE 'Dropped unique index Laad_laadNumber_key';
          ELSE
              RAISE NOTICE 'Unique index Laad_laadNumber_key does not exist';
          END IF;
      END $$;
    `);

    // Also check for index without schema prefix
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
          IF EXISTS (
              SELECT 1 FROM pg_indexes 
              WHERE schemaname = 'public' 
              AND tablename = 'Laad' 
              AND indexname = 'Laad_laadNumber_key'
          ) THEN
              DROP INDEX IF EXISTS "Laad_laadNumber_key";
              RAISE NOTICE 'Dropped unique index Laad_laadNumber_key (without schema)';
          END IF;
      END $$;
    `);

    console.log('✅ Unique constraint removed successfully!');
    console.log('📝 Multiple laads can now have the same laadNumber');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

removeUniqueConstraint()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

