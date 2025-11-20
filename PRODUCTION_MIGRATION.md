# Production Database Migration Guide

## Issue
Production database is missing `weightFromJacobabad` and `faisalabadWeight` columns in `LaadItem` table.

## Quick Fix: Run Migration Script

### Option 1: Using Node Script (Recommended)

1. **SSH into your production server** or use your deployment platform's console

2. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

3. **Set production DATABASE_URL** (if not already set):
   ```bash
   export DATABASE_URL="your-production-database-url"
   ```

4. **Run the migration script**:
   ```bash
   npm run db:migrate:weight-columns
   ```

   Or directly:
   ```bash
   node scripts/apply-weight-columns-migration.js
   ```

### Option 2: Direct SQL (If you have database access)

Connect to your PostgreSQL database and run:

```sql
-- Add weightFromJacobabad column if it doesn't exist
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

-- Add faisalabadWeight column if it doesn't exist
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
```

### Option 3: Using Prisma DB Push (If migrations are not working)

```bash
cd backend
npx prisma db push
```

**Note**: This will sync schema with database but won't create migration history.

## For Render.com Deployment

If you're using Render.com:

1. **Go to your Render dashboard**
2. **Open your backend service**
3. **Go to "Shell" tab** (or use SSH)
4. **Run the migration**:
   ```bash
   cd backend
   npm run db:migrate:weight-columns
   ```

Or add it as a **one-time command** in Render:
- Go to your service settings
- Add a one-time command: `cd backend && npm run db:migrate:weight-columns`

## Verify Migration

After running migration, verify columns exist:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'LaadItem' 
AND column_name IN ('weightFromJacobabad', 'faisalabadWeight');
```

You should see both columns listed.

## After Migration

1. **Regenerate Prisma Client** (if needed):
   ```bash
   npx prisma generate
   ```

2. **Restart your backend service**

3. **Test the API** - Create a laad and verify it works

## Temporary Workaround

The code has been updated to check if columns exist before using them. However, **you should still run the migration** to enable full functionality.

