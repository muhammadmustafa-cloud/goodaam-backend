# Database Migration Instructions

## Issue
Prisma migration is failing due to shadow database issues. Use one of these solutions:

## Solution 1: Use Prisma DB Push (Recommended for Development)

This doesn't require migrations and directly updates the database schema:

```bash
cd backend
npx prisma db push
```

This will:
- Add `weightFromJacobabad` column
- Add `faisalabadWeight` column  
- Remove `jacobabadParchiNo` column
- Remove `kantyParchiNo` column

## Solution 2: Run Manual SQL Script

If `prisma db push` doesn't work, run the SQL script directly on your database:

1. Connect to your PostgreSQL database
2. Run the SQL from: `prisma/migrations/MANUAL_UPDATE_WEIGHT_COLUMNS.sql`

Or use psql:
```bash
psql "your-database-connection-string" -f prisma/migrations/MANUAL_UPDATE_WEIGHT_COLUMNS.sql
```

## Solution 3: Fix Shadow Database Issue

If you want to use proper migrations, configure shadow database in `.env`:

```env
DATABASE_URL="your-main-database-url"
SHADOW_DATABASE_URL="your-shadow-database-url"
```

Then run:
```bash
npx prisma migrate dev --name replace_parchi_with_weights
```

## After Migration

After updating the database, regenerate Prisma client:

```bash
npx prisma generate
```

## Verify Changes

Check that the columns were updated:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'LaadItem' 
AND column_name IN ('weightFromJacobabad', 'faisalabadWeight', 'jacobabadParchiNo', 'kantyParchiNo');
```

You should see:
- ✅ `weightFromJacobabad` (DECIMAL)
- ✅ `faisalabadWeight` (DECIMAL)
- ❌ `jacobabadParchiNo` (should not exist)
- ❌ `kantyParchiNo` (should not exist)

