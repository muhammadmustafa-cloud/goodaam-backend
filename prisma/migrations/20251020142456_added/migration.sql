-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('TRUCK', 'PICKUP', 'LOADER', 'TRACTOR', 'OTHER');

-- AlterTable
ALTER TABLE "Laad" ADD COLUMN     "vehicleId" INTEGER;

-- AlterTable
ALTER TABLE "LaadItem" ADD COLUMN     "ratePerBag" DECIMAL(65,30),
ADD COLUMN     "totalAmount" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "ratePerBag" DECIMAL(65,30),
ADD COLUMN     "totalAmount" DECIMAL(65,30);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "type" "VehicleType" NOT NULL,
    "capacity" DECIMAL(65,30),
    "ownerName" TEXT,
    "ownerContact" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_number_key" ON "Vehicle"("number");

-- AddForeignKey
ALTER TABLE "Laad" ADD CONSTRAINT "Laad_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
