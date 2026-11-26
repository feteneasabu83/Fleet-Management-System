-- CreateEnum
CREATE TYPE "public"."MaintenanceRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_MAINTENANCE_REVIEW', 'MAINTENANCE_APPROVED', 'MAINTENANCE_DISAPPROVED', 'PENDING_FLEET_MANAGER', 'FLEET_MANAGER_ACCEPTED', 'FLEET_MANAGER_REJECTED', 'IN_PROGRESS', 'COMPLETED', 'RETURNED_TO_DRIVER', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."MaintenanceCategory" AS ENUM ('MECHANICAL', 'ELECTRICAL', 'TIRE', 'ENGINE', 'ACCIDENT', 'ROUTINE_SERVICE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."VehicleCondition" AS ENUM ('OPERATIONAL', 'PARTIALLY_OPERATIONAL', 'NOT_OPERATIONAL');

-- CreateEnum
CREATE TYPE "public"."InspectionDecision" AS ENUM ('APPROVED', 'DISAPPROVED');

-- CreateEnum
CREATE TYPE "public"."ManagerDecision" AS ENUM ('ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."RepairVehicleStatus" AS ENUM ('REPAIRED', 'PARTIALLY_REPAIRED', 'NOT_REPAIRED');

-- CreateEnum
CREATE TYPE "public"."WorkshopType" AS ENUM ('INTERNAL', 'EXTERNAL');

-- CreateTable
CREATE TABLE "public"."MaintenanceRequest" (
    "id" UUID NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "driverId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "priority" TEXT,
    "category" "public"."MaintenanceCategory" NOT NULL,
    "problemDescription" TEXT NOT NULL,
    "vehicleCondition" "public"."VehicleCondition" NOT NULL,
    "location" TEXT,
    "currentOdometerKm" INTEGER,
    "employeeId" TEXT,
    "department" TEXT,
    "phone" TEXT,
    "attachments" TEXT,
    "status" "public"."MaintenanceRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MaintenanceInspection" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "inspectionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inspectionOfficerId" UUID NOT NULL,
    "officerEmployeeId" TEXT,
    "problemVerified" BOOLEAN NOT NULL,
    "technicalFindings" TEXT,
    "requiredRepairs" TEXT,
    "estimatedPartsCost" DECIMAL(12,2),
    "estimatedLaborCost" DECIMAL(12,2),
    "estimatedOtherCost" DECIMAL(12,2),
    "estimatedDurationHours" DOUBLE PRECISION,
    "workshop" "public"."WorkshopType",
    "attachments" TEXT,
    "decision" "public"."InspectionDecision" NOT NULL,
    "decisionReason" TEXT NOT NULL,
    "technicalJustification" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FleetManagerDecision" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "managerId" UUID NOT NULL,
    "decision" "public"."ManagerDecision" NOT NULL,
    "remarks" TEXT NOT NULL,
    "budgetAvailable" BOOLEAN,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FleetManagerDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MaintenanceTask" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "technicianId" UUID,
    "workshop" TEXT,
    "repairStartDate" TIMESTAMP(3),
    "partsUsed" TEXT,
    "actualCost" DECIMAL(12,2),
    "repairDescription" TEXT,
    "completionDate" TIMESTAMP(3),
    "finalOdometerKm" INTEGER,
    "vehicleStatus" "public"."RepairVehicleStatus",
    "technicianRemarks" TEXT,
    "teamVerification" BOOLEAN NOT NULL DEFAULT false,
    "driverConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MaintenanceApprovalHistory" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" "public"."MaintenanceRequestStatus",
    "toStatus" "public"."MaintenanceRequestStatus",
    "actorId" UUID,
    "actorRole" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceApprovalHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceRequest_requestNumber_key" ON "public"."MaintenanceRequest"("requestNumber");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_driverId_idx" ON "public"."MaintenanceRequest"("driverId");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_vehicleId_idx" ON "public"."MaintenanceRequest"("vehicleId");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_status_idx" ON "public"."MaintenanceRequest"("status");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_requestNumber_idx" ON "public"."MaintenanceRequest"("requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceInspection_requestId_key" ON "public"."MaintenanceInspection"("requestId");

-- CreateIndex
CREATE INDEX "MaintenanceInspection_requestId_idx" ON "public"."MaintenanceInspection"("requestId");

-- CreateIndex
CREATE INDEX "MaintenanceInspection_inspectionOfficerId_idx" ON "public"."MaintenanceInspection"("inspectionOfficerId");

-- CreateIndex
CREATE UNIQUE INDEX "FleetManagerDecision_requestId_key" ON "public"."FleetManagerDecision"("requestId");

-- CreateIndex
CREATE INDEX "FleetManagerDecision_requestId_idx" ON "public"."FleetManagerDecision"("requestId");

-- CreateIndex
CREATE INDEX "FleetManagerDecision_managerId_idx" ON "public"."FleetManagerDecision"("managerId");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceTask_requestId_key" ON "public"."MaintenanceTask"("requestId");

-- CreateIndex
CREATE INDEX "MaintenanceTask_requestId_idx" ON "public"."MaintenanceTask"("requestId");

-- CreateIndex
CREATE INDEX "MaintenanceTask_technicianId_idx" ON "public"."MaintenanceTask"("technicianId");

-- CreateIndex
CREATE INDEX "MaintenanceApprovalHistory_requestId_idx" ON "public"."MaintenanceApprovalHistory"("requestId");

-- CreateIndex
CREATE INDEX "MaintenanceApprovalHistory_actorId_idx" ON "public"."MaintenanceApprovalHistory"("actorId");

-- AddForeignKey
ALTER TABLE "public"."MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "public"."Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaintenanceInspection" ADD CONSTRAINT "MaintenanceInspection_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "public"."MaintenanceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaintenanceInspection" ADD CONSTRAINT "MaintenanceInspection_inspectionOfficerId_fkey" FOREIGN KEY ("inspectionOfficerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FleetManagerDecision" ADD CONSTRAINT "FleetManagerDecision_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "public"."MaintenanceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FleetManagerDecision" ADD CONSTRAINT "FleetManagerDecision_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaintenanceTask" ADD CONSTRAINT "MaintenanceTask_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "public"."MaintenanceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaintenanceTask" ADD CONSTRAINT "MaintenanceTask_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaintenanceApprovalHistory" ADD CONSTRAINT "MaintenanceApprovalHistory_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "public"."MaintenanceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaintenanceApprovalHistory" ADD CONSTRAINT "MaintenanceApprovalHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
