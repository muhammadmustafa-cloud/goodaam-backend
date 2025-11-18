-- Manual SQL script to replace jacobabadParchiNo and kantyParchiNo with weight columns
-- Run this directly on your PostgreSQL database if Prisma migration fails

-- Step 1: Add new columns (if they don't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'LaadItem' AND column_name = 'weightFromJacobabad'
    ) THEN
        ALTER TABLE "LaadItem" ADD COLUMN "weightFromJacobabad" DECIMAL(65,30);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'LaadItem' AND column_name = 'faisalabadWeight'
    ) THEN
        ALTER TABLE "LaadItem" ADD COLUMN "faisalabadWeight" DECIMAL(65,30);
    END IF;
END $$;

-- Step 2: Drop old columns (if they exist)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'LaadItem' AND column_name = 'jacobabadParchiNo'
    ) THEN
        ALTER TABLE "LaadItem" DROP COLUMN "jacobabadParchiNo";
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'LaadItem' AND column_name = 'kantyParchiNo'
    ) THEN
        ALTER TABLE "LaadItem" DROP COLUMN "kantyParchiNo";
    END IF;
END $$;

