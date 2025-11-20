-- AlterTable: Add process sale fields to Sale table
-- These fields are for process sale history and PDF generation

-- Add laadNumber column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'Sale' 
        AND column_name = 'laadNumber'
    ) THEN
        ALTER TABLE "Sale" ADD COLUMN "laadNumber" TEXT;
        RAISE NOTICE 'Added laadNumber column to Sale table';
    END IF;
END $$;

-- Add truckNumber column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'Sale' 
        AND column_name = 'truckNumber'
    ) THEN
        ALTER TABLE "Sale" ADD COLUMN "truckNumber" TEXT;
        RAISE NOTICE 'Added truckNumber column to Sale table';
    END IF;
END $$;

-- Add address column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'Sale' 
        AND column_name = 'address'
    ) THEN
        ALTER TABLE "Sale" ADD COLUMN "address" TEXT;
        RAISE NOTICE 'Added address column to Sale table';
    END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "Sale_laadNumber_idx" ON "Sale"("laadNumber");
CREATE INDEX IF NOT EXISTS "Sale_truckNumber_idx" ON "Sale"("truckNumber");

