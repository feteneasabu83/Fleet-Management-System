import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { MaintenanceApprovalService } from './maintenance-approval.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { UserRole } from '@prisma/client'

@ApiTags('Maintenance Approval')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('maintenance-approval')
export class MaintenanceApprovalController {
  constructor(private readonly service: MaintenanceApprovalService) {}

  private actor(req: any) {
    return { userId: req.user.userId as string, role: req.user.role as UserRole }
  }

  // ---------- DRIVER ----------

  @ApiOperation({ summary: 'Submit a maintenance request (Driver)' })
  @Roles(UserRole.Driver, UserRole.ADMIN)
  @Post('requests')
  submitRequest(@Req() req: any, @Body() dto: any) {
    return this.service.submitRequest(this.actor(req).userId, dto)
  }

  @ApiOperation({ summary: 'List my maintenance requests (Driver)' })
  @Roles(UserRole.Driver, UserRole.ADMIN)
  @Get('requests/my')
  listMyRequests(@Req() req: any) {
    return this.service.listMyRequests(this.actor(req).userId)
  }

  @ApiOperation({ summary: 'Cancel a maintenance request' })
  @Post('requests/:id/cancel')
  cancelRequest(@Req() req: any, @Param('id') id: string) {
    const { userId, role } = this.actor(req)
    return this.service.cancelRequest(id, userId, role)
  }

  // ---------- MAINTENANCE TEAM ----------

  @ApiOperation({ summary: 'Start review of a request (Maintenance Team)' })
  @Roles(UserRole.Maintenace_Team, UserRole.ADMIN)
  @Post('requests/:id/start-review')
  startReview(@Req() req: any, @Param('id') id: string) {
    const { userId, role } = this.actor(req)
    return this.service.startReview(id, userId, role)
  }

  @ApiOperation({ summary: 'Submit inspection & decision (Form 2, Maintenance Team)' })
  @Roles(UserRole.Maintenace_Team, UserRole.ADMIN)
  @Post('requests/:id/inspection')
  submitInspection(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    const { userId, role } = this.actor(req)
    return this.service.submitInspection(id, userId, role, dto)
  }

  // ---------- FLEET MANAGER ----------

  @ApiOperation({ summary: 'Submit final decision (Form 3, Fleet Manager)' })
  @Roles(UserRole.Fleet_Manager, UserRole.ADMIN)
  @Post('requests/:id/manager-decision')
  submitManagerDecision(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    const { userId, role } = this.actor(req)
    return this.service.submitManagerDecision(id, userId, role, dto)
  }

  // ---------- EXECUTION ----------

  @ApiOperation({ summary: 'Create/update maintenance execution record (Form 4)' })
  @Post('requests/:id/task')
  upsertTask(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    const { userId, role } = this.actor(req)
    return this.service.upsertTask(id, userId, role, dto)
  }

  @ApiOperation({ summary: 'Driver confirms vehicle received' })
  @Roles(UserRole.Driver, UserRole.ADMIN)
  @Post('requests/:id/driver-confirm')
  driverConfirm(@Req() req: any, @Param('id') id: string) {
    return this.service.driverConfirm(id, this.actor(req).userId)
  }

  // ---------- REGISTER / DASHBOARD ----------

  @ApiOperation({ summary: 'List maintenance requests (register)' })
  @Get('requests')
  listRequests(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('driverId') driverId?: string,
  ) {
    return this.service.listRequests(this.actor(req).role, { status, q, driverId })
  }

  @ApiOperation({ summary: 'Get maintenance request detail' })
  @Get('requests/:id')
  getRequestDetail(@Req() req: any, @Param('id') id: string) {
    const { userId, role } = this.actor(req)
    return this.service.getRequestDetail(id, userId, role)
  }

  @ApiOperation({ summary: 'Dashboard stats for current user role' })
  @Get('dashboard')
  getDashboard(@Req() req: any) {
    return this.service.getDashboardStats(this.actor(req).role)
  }
}
