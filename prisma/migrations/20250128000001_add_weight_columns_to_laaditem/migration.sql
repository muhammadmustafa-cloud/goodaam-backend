-- AlterTable: Add weight columns to LaadItem
-- These columns replace the old jacobabadParchiNo and kantyParchiNo columns

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

-- Drop old columns if they exist (optional cleanup)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'LaadItem' 
        AND column_name = 'jacobabadParchiNo'
    ) THEN
        ALTER TABLE "LaadItem" DROP COLUMN "jacobabadParchiNo";
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'LaadItem' 
        AND column_name = 'kantyParchiNo'
    ) THEN
        ALTER TABLE "LaadItem" DROP COLUMN "kantyParchiNo";
    END IF;
END $$;

