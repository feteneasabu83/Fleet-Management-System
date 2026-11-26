import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { MaintenanceApprovalService } from './maintenance-approval.service'
import { MaintenanceApprovalController } from './maintenance-approval.controller'

@Module({
  imports: [PrismaModule],
  controllers: [MaintenanceApprovalController],
  providers: [MaintenanceApprovalService],
  exports: [MaintenanceApprovalService],
})
export class MaintenanceApprovalModule {}
