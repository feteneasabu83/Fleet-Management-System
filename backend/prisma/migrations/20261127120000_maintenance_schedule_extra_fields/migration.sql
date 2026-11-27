-- AlterTable
ALTER TABLE "MaintenanceSchedule" ADD COLUMN "remainingFuelKm" DOUBLE PRECISION,
ADD COLUMN "fuelLevelStatus" TEXT,
ADD COLUMN "severity" TEXT;
