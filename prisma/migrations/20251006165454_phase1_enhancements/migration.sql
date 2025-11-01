-- CreateEnum
CREATE TYPE "GateStatus" AS ENUM ('PENDING', 'WEIGHED', 'PROCESSED', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "LaadItem" ADD COLUMN     "jacobabadParchiNo" TEXT,
ADD COLUMN     "kantyParchiNo" TEXT,
ADD COLUMN     "qualityGrade" TEXT,
ADD COLUMN     "weightPerBag" INTEGER;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "isMixOrder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mixOrderDetails" JSONB,
ADD COLUMN     "qualityGrade" TEXT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';

-- CreateTable
CREATE TABLE "GateEntry" (
    "id" SERIAL NOT NULL,
    "truckNumber" TEXT NOT NULL,
    "driverName" TEXT,
    "arrivalTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weightMachineReading" DECIMAL(65,30),
    "grossWeight" DECIMAL(65,30),
    "tareWeight" DECIMAL(65,30),
    "netWeight" DECIMAL(65,30),
    "gatepassNumber" TEXT,
    "status" "GateStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" INTEGER NOT NULL,
    "laadId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GateEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialBalance" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER,
    "supplierId" INTEGER,
    "balance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GateEntry_gatepassNumber_key" ON "GateEntry"("gatepassNumber");

-- AddForeignKey
ALTER TABLE "GateEntry" ADD CONSTRAINT "GateEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateEntry" ADD CONSTRAINT "GateEntry_laadId_fkey" FOREIGN KEY ("laadId") REFERENCES "Laad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialBalance" ADD CONSTRAINT "FinancialBalance_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialBalance" ADD CONSTRAINT "FinancialBalance_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
