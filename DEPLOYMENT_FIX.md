# 🚨 URGENT: Production Database Migration Required

## Current Issue
Production database is missing `weightFromJacobabad` and `faisalabadWeight` columns, causing API errors.

## Quick Fix (Choose One Method)

### Method 1: Using Migration Script (Recommended)

**On Render.com:**
1. Go to your backend service dashboard
2. Click on **"Shell"** tab (or use SSH)
3. Run:
   ```bash
   cd backend
   npm run db:migrate:production
   ```

**Or manually:**
```bash
node scripts/apply-production-migrations.js
```

### Method 2: Direct SQL (If you have database access)

Connect to your PostgreSQL database and run:

```sql
-- Add weight columns
ALTER TABLE "LaadItem" 
ADD COLUMN IF NOT EXISTS "weightFromJacobabad" DECIMAL(65,30),
ADD COLUMN IF NOT EXISTS "faisalabadWeight" DECIMAL(65,30);

-- Remove unique constraint from laadNumber (if exists)
DROP INDEX IF EXISTS "Laad_laadNumber_key";

-- Add process sale fields (if needed)
ALTER TABLE "Sale" 
ADD COLUMN IF NOT EXISTS "laadNumber" TEXT,
ADD COLUMN IF NOT EXISTS "truckNumber" TEXT,
ADD COLUMN IF NOT EXISTS "address" TEXT;

-- Create indexes
CREATE INDEX IF NOT EXISTS "Sale_laadNumber_idx" ON "Sale"("laadNumber");
CREATE INDEX IF NOT EXISTS "Sale_truckNumber_idx" ON "Sale"("truckNumber");
```

### Method 3: Using Prisma DB Push

```bash
cd backend
npx prisma db push
```

**Note**: This syncs schema but doesn't create migration history.

## After Migration

1. **Regenerate Prisma Client** (if needed):
   ```bash
   npx prisma generate
   ```

2. **Restart your backend service**

3. **Test the API** - Create a laad and verify it works

## Verification

After migration, verify columns exist:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'LaadItem' 
AND column_name IN ('weightFromJacobabad', 'faisalabadWeight');
```

You should see both columns.

## Important Notes

- ⚠️ **Migration is REQUIRED** - The code will fail until columns are added
- ✅ Migration script is **safe** - Uses `IF NOT EXISTS` checks
- 🔄 **No data loss** - Only adds new columns
- 📝 **Backup recommended** - Always backup before migrations

## Need Help?

If migration fails, check:
1. Database connection string is correct
2. Database user has ALTER TABLE permissions
3. No other processes are locking the table

