import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import {
  MaintenanceRequestStatus,
  MaintenanceCategory,
  VehicleCondition,
  InspectionDecision,
  ManagerDecision,
  RepairVehicleStatus,
  WorkshopType,
  UserRole,
} from '@prisma/client'

const MAINTENANCE_TEAM_ROLES = [UserRole.Maintenace_Team, UserRole.ADMIN]
const MANAGER_ROLES = [UserRole.Fleet_Manager, UserRole.ADMIN]
const STAFF_ROLES = [UserRole.Maintenace_Team, UserRole.Fleet_Manager, UserRole.ADMIN]

const requestInclude = {
  driver: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      role: true,
      department: { select: { id: true, name: true } },
    },
  },
  vehicle: true,
  inspection: { include: { officer: { select: { id: true, firstName: true, lastName: true, email: true } } } },
  managerDecision: { include: { manager: { select: { id: true, firstName: true, lastName: true, email: true } } } },
  task: { include: { technician: { select: { id: true, firstName: true, lastName: true, email: true } } } },
  history: {
    orderBy: { createdAt: 'asc' as const },
    include: { actor: { select: { id: true, firstName: true, lastName: true, role: true } } },
  },
}

@Injectable()
export class MaintenanceApprovalService {
  constructor(private prisma: PrismaService) {}

  // ---------- helpers ----------

  private hasAnyRole(role: UserRole, allowed: UserRole[]) {
    return allowed.includes(role)
  }

  private async nextRequestNumber() {
    const count = await this.prisma.maintenanceRequest.count()
    return `MR-${String(count + 1).padStart(4, '0')}`
  }

  private async addHistory(
    requestId: string,
    action: string,
    fromStatus: MaintenanceRequestStatus | null,
    toStatus: MaintenanceRequestStatus | null,
    actorId: string | null,
    actorRole: string | null,
    notes?: string,
  ) {
    await this.prisma.maintenanceApprovalHistory.create({
      data: { requestId, action, fromStatus, toStatus, actorId, actorRole, notes },
    })
  }

  private async notifyUsers(
    userIds: string[],
    message: string,
    actionByUserId?: string,
  ) {
    const unique = Array.from(new Set(userIds.filter(Boolean)))
    if (unique.length === 0) return
    await this.prisma.userNotification.createMany({
      data: unique.map((userId) => ({
        userId,
        message,
        actionByUserId: actionByUserId ?? null,
      })),
    })
  }

  private async usersWithRoles(roles: UserRole[]): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: { role: { in: roles }, isActive: true },
      select: { id: true },
    })
    return users.map((u) => u.id)
  }

  private async getRequestOrFail(id: string) {
    const request = await this.prisma.maintenanceRequest.findUnique({ where: { id } })
    if (!request) throw new NotFoundException('Maintenance request not found')
    return request
  }

  // ---------- DRIVER: submit request (Form 1) ----------

  async submitRequest(driverId: string, dto: any) {
    if (!dto.vehicleId) throw new BadRequestException('vehicleId is required')
    if (!dto.category) throw new BadRequestException('category is required')
    if (!dto.problemDescription) throw new BadRequestException('problemDescription is required')
    if (!dto.vehicleCondition) throw new BadRequestException('vehicleCondition is required')

    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } })
    if (!vehicle) throw new NotFoundException('Vehicle not found')

    const driver = await this.prisma.user.findUnique({
      where: { id: driverId },
      select: { firstName: true, lastName: true, phone: true, department: { select: { name: true } } },
    })

    const requestNumber = await this.nextRequestNumber()

    const request = await this.prisma.maintenanceRequest.create({
      data: {
        requestNumber,
        driverId,
        vehicleId: dto.vehicleId,
        priority: dto.priority ?? null,
        category: dto.category as MaintenanceCategory,
        problemDescription: dto.problemDescription,
        vehicleCondition: dto.vehicleCondition as VehicleCondition,
        location: dto.location ?? null,
        currentOdometerKm: dto.currentOdometerKm ?? null,
        employeeId: dto.employeeId ?? null,
        department: dto.department ?? driver?.department?.name ?? null,
        phone: dto.phone ?? driver?.phone ?? null,
        attachments: dto.attachments ? JSON.stringify(dto.attachments) : null,
        status: MaintenanceRequestStatus.SUBMITTED,
      },
    })

    await this.addHistory(
      request.id, 'REQUEST_SUBMITTED', null, MaintenanceRequestStatus.SUBMITTED,
      driverId, 'Driver', `Request ${requestNumber} submitted`,
    )

    // Notify maintenance team
    const teamIds = await this.usersWithRoles(MAINTENANCE_TEAM_ROLES)
    await this.notifyUsers(
      teamIds,
      `New maintenance request ${requestNumber} submitted by ${driver?.firstName ?? ''} ${driver?.lastName ?? ''}`,
      driverId,
    )

    return this.prisma.maintenanceRequest.findUnique({
      where: { id: request.id },
      include: requestInclude,
    })
  }

  async listMyRequests(driverId: string) {
    return this.prisma.maintenanceRequest.findMany({
      where: { driverId },
      orderBy: { createdAt: 'desc' },
      include: requestInclude,
    })
  }

  async cancelRequest(id: string, actorId: string, actorRole: UserRole) {
    const request = await this.getRequestOrFail(id)
    const isOwner = request.driverId === actorId
    const isStaff = this.hasAnyRole(actorRole, STAFF_ROLES)
    if (!isOwner && !isStaff) throw new ForbiddenException('Not allowed to cancel this request')
    if (request.status !== MaintenanceRequestStatus.SUBMITTED && request.status !== MaintenanceRequestStatus.DRAFT) {
      throw new BadRequestException('Only submitted or draft requests can be cancelled')
    }

    const updated = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: { status: MaintenanceRequestStatus.CANCELLED },
    })
    await this.addHistory(id, 'REQUEST_CANCELLED', request.status, MaintenanceRequestStatus.CANCELLED, actorId, actorRole)
    return updated
  }

  // ---------- MAINTENANCE TEAM: inspection (Form 2) ----------

  async startReview(id: string, actorId: string, actorRole: UserRole) {
    if (!this.hasAnyRole(actorRole, MAINTENANCE_TEAM_ROLES)) {
      throw new ForbiddenException('Only the maintenance team can review requests')
    }
    const request = await this.getRequestOrFail(id)
    if (request.status !== MaintenanceRequestStatus.SUBMITTED) {
      throw new BadRequestException(`Cannot start review from status ${request.status}`)
    }
    const updated = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: { status: MaintenanceRequestStatus.UNDER_MAINTENANCE_REVIEW },
    })
    await this.addHistory(id, 'REVIEW_STARTED', request.status, MaintenanceRequestStatus.UNDER_MAINTENANCE_REVIEW, actorId, actorRole)
    return updated
  }

  async submitInspection(id: string, officerId: string, actorRole: UserRole, dto: any) {
    if (!this.hasAnyRole(actorRole, MAINTENANCE_TEAM_ROLES)) {
      throw new ForbiddenException('Only the maintenance team can submit inspections')
    }
    const request = await this.getRequestOrFail(id)
    const existingInspection = await this.prisma.maintenanceInspection.findUnique({ where: { requestId: id } })
    if (existingInspection) throw new BadRequestException('Inspection already submitted for this request')
    const allowedStatuses: MaintenanceRequestStatus[] = [MaintenanceRequestStatus.SUBMITTED, MaintenanceRequestStatus.UNDER_MAINTENANCE_REVIEW]
    if (!allowedStatuses.includes(request.status)) {
      throw new BadRequestException(`Cannot inspect request in status ${request.status}`)
    }
    if (!dto.decision) throw new BadRequestException('decision is required')
    if (!dto.decisionReason) throw new BadRequestException('decisionReason is required')

    const decision = dto.decision as InspectionDecision
    // Per spec: BOTH approve and disapprove go to Fleet Manager
    const nextStatus = MaintenanceRequestStatus.PENDING_FLEET_MANAGER

    await this.prisma.$transaction(async (tx) => {
      await tx.maintenanceInspection.create({
        data: {
          requestId: id,
          inspectionOfficerId: officerId,
          officerEmployeeId: dto.officerEmployeeId ?? null,
          problemVerified: !!dto.problemVerified,
          technicalFindings: dto.technicalFindings ?? null,
          requiredRepairs: dto.requiredRepairs ?? null,
          estimatedPartsCost: dto.estimatedPartsCost ?? null,
          estimatedLaborCost: dto.estimatedLaborCost ?? null,
          estimatedOtherCost: dto.estimatedOtherCost ?? null,
          estimatedDurationHours: dto.estimatedDurationHours ?? null,
          workshop: (dto.workshop as WorkshopType) ?? null,
          attachments: dto.attachments ? JSON.stringify(dto.attachments) : null,
          decision,
          decisionReason: dto.decisionReason,
          technicalJustification: dto.technicalJustification ?? null,
          signature: dto.signature ?? null,
        },
      })
      await tx.maintenanceRequest.update({
        where: { id },
        data: { status: nextStatus },
      })
      await tx.maintenanceApprovalHistory.create({
        data: {
          requestId: id,
          action: decision === InspectionDecision.APPROVED ? 'MAINTENANCE_APPROVED' : 'MAINTENANCE_DISAPPROVED',
          fromStatus: request.status,
          toStatus: nextStatus,
          actorId: officerId,
          actorRole: actorRole,
          notes: dto.decisionReason,
        },
      })
    })

    // Notify fleet managers + driver
    const managerIds = await this.usersWithRoles(MANAGER_ROLES)
    const driverIds = [request.driverId]
    const decisionText = decision === InspectionDecision.APPROVED ? 'approved' : 'disapproved'
    await this.notifyUsers(
      [...managerIds, ...driverIds],
      `Maintenance team ${decisionText} request ${request.requestNumber}. Awaiting fleet manager decision.`,
      officerId,
    )

    return this.prisma.maintenanceRequest.findUnique({ where: { id }, include: requestInclude })
  }

  // ---------- FLEET MANAGER: final decision (Form 3) ----------

  async submitManagerDecision(id: string, managerId: string, actorRole: UserRole, dto: any) {
    if (!this.hasAnyRole(actorRole, MANAGER_ROLES)) {
      throw new ForbiddenException('Only the fleet manager can make the final decision')
    }
    const request = await this.getRequestOrFail(id)
    if (request.status !== MaintenanceRequestStatus.PENDING_FLEET_MANAGER) {
      throw new BadRequestException(`Request is not pending fleet manager decision (status: ${request.status})`)
    }
    if (!dto.decision) throw new BadRequestException('decision is required')
    if (!dto.remarks || !dto.remarks.trim()) {
      throw new BadRequestException('remarks are required for the final decision')
    }
    const existingDecision = await this.prisma.fleetManagerDecision.findUnique({ where: { requestId: id } })
    if (existingDecision) throw new BadRequestException('Final decision already recorded')

    const decision = dto.decision as ManagerDecision
    const nextStatus = decision === ManagerDecision.ACCEPTED
      ? MaintenanceRequestStatus.FLEET_MANAGER_ACCEPTED
      : MaintenanceRequestStatus.FLEET_MANAGER_REJECTED

    await this.prisma.$transaction(async (tx) => {
      await tx.fleetManagerDecision.create({
        data: {
          requestId: id,
          managerId,
          decision,
          remarks: dto.remarks,
          budgetAvailable: dto.budgetAvailable ?? null,
          signature: dto.signature ?? null,
        },
      })
      await tx.maintenanceRequest.update({ where: { id }, data: { status: nextStatus } })
      await tx.maintenanceApprovalHistory.create({
        data: {
          requestId: id,
          action: decision === ManagerDecision.ACCEPTED ? 'FLEET_MANAGER_ACCEPTED' : 'FLEET_MANAGER_REJECTED',
          fromStatus: request.status,
          toStatus: nextStatus,
          actorId: managerId,
          actorRole,
          notes: dto.remarks,
        },
      })
    })

    // Notify driver + maintenance team of final decision
    const teamIds = await this.usersWithRoles(MAINTENANCE_TEAM_ROLES)
    const decisionText = decision === ManagerDecision.ACCEPTED ? 'ACCEPTED' : 'REJECTED'
    await this.notifyUsers(
      [request.driverId, ...teamIds],
      `Final decision for request ${request.requestNumber}: ${decisionText}. ${dto.remarks}`,
      managerId,
    )

    return this.prisma.maintenanceRequest.findUnique({ where: { id }, include: requestInclude })
  }

  async listTechnicians() {
    return this.prisma.user.findMany({
      where: { role: { in: STAFF_ROLES }, isActive: true },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    })
  }

  // ---------- EXECUTION (Form 4) ----------

  async upsertTask(id: string, actorId: string, actorRole: UserRole, dto: any) {
    const request = await this.getRequestOrFail(id)
    const isStaff = this.hasAnyRole(actorRole, STAFF_ROLES)
    const isDriver = request.driverId === actorId
    if (!isStaff && !isDriver) throw new ForbiddenException('Not allowed')

    if (request.status === MaintenanceRequestStatus.FLEET_MANAGER_REJECTED) {
      throw new BadRequestException('Rejected requests cannot enter maintenance execution')
    }

    const existing = await this.prisma.maintenanceTask.findUnique({ where: { requestId: id } })

    if (dto.technicianId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dto.technicianId)) {
      throw new BadRequestException('Invalid technicianId: must be a user UUID')
    }

    const data: any = {
      technicianId: dto.technicianId || existing?.technicianId || null,
      workshop: dto.workshop ?? existing?.workshop ?? null,
      repairStartDate: dto.repairStartDate ? new Date(dto.repairStartDate) : existing?.repairStartDate ?? null,
      partsUsed: dto.partsUsed !== undefined ? JSON.stringify(dto.partsUsed) : existing?.partsUsed ?? null,
      actualCost: dto.actualCost ?? existing?.actualCost ?? null,
      repairDescription: dto.repairDescription ?? existing?.repairDescription ?? null,
      completionDate: dto.completionDate ? new Date(dto.completionDate) : existing?.completionDate ?? null,
      finalOdometerKm: dto.finalOdometerKm ?? existing?.finalOdometerKm ?? null,
      vehicleStatus: (dto.vehicleStatus as RepairVehicleStatus) ?? existing?.vehicleStatus ?? null,
      technicianRemarks: dto.technicianRemarks ?? existing?.technicianRemarks ?? null,
      teamVerification: dto.teamVerification ?? existing?.teamVerification ?? false,
      driverConfirmation: dto.driverConfirmation ?? existing?.driverConfirmation ?? false,
    }

    const task = existing
      ? await this.prisma.maintenanceTask.update({ where: { id: existing.id }, data })
      : await this.prisma.maintenanceTask.create({ data: { requestId: id, ...data } })

    // Auto-transition statuses
    let newStatus = request.status
    if (request.status === MaintenanceRequestStatus.FLEET_MANAGER_ACCEPTED && dto.repairStartDate) {
      newStatus = MaintenanceRequestStatus.IN_PROGRESS
    }
    if (dto.completionDate && dto.vehicleStatus) {
      newStatus = MaintenanceRequestStatus.COMPLETED
    }
    if (newStatus !== request.status) {
      await this.prisma.maintenanceRequest.update({ where: { id }, data: { status: newStatus } })
      await this.addHistory(id, 'EXECUTION_UPDATE', request.status, newStatus, actorId, actorRole)
    }

    // Notify driver when completed
    if (newStatus === MaintenanceRequestStatus.COMPLETED) {
      await this.notifyUsers([request.driverId], `Maintenance for request ${request.requestNumber} is completed.`, actorId)
    }

    return this.prisma.maintenanceRequest.findUnique({ where: { id }, include: requestInclude })
  }

  async driverConfirm(id: string, actorId: string) {
    const request = await this.getRequestOrFail(id)
    if (request.driverId !== actorId) throw new ForbiddenException('Only the requesting driver can confirm')
    if (request.status !== MaintenanceRequestStatus.COMPLETED) {
      throw new BadRequestException('Request is not completed yet')
    }
    const task = await this.prisma.maintenanceTask.findUnique({ where: { requestId: id } })
    if (!task) throw new BadRequestException('No maintenance task found')

    await this.prisma.$transaction(async (tx) => {
      await tx.maintenanceTask.update({ where: { id: task.id }, data: { driverConfirmation: true } })
      await tx.maintenanceRequest.update({
        where: { id },
        data: { status: MaintenanceRequestStatus.RETURNED_TO_DRIVER },
      })
      await tx.maintenanceApprovalHistory.create({
        data: {
          requestId: id,
          action: 'RETURNED_TO_DRIVER',
          fromStatus: MaintenanceRequestStatus.COMPLETED,
          toStatus: MaintenanceRequestStatus.RETURNED_TO_DRIVER,
          actorId,
          actorRole: 'Driver',
        },
      })
    })

    return this.prisma.maintenanceRequest.findUnique({ where: { id }, include: requestInclude })
  }

  // ---------- REGISTER / DASHBOARDS ----------

  async listRequests(actorRole: UserRole, query: { status?: string; q?: string; driverId?: string }) {
    const where: any = {}
    if (query.status) where.status = query.status
    if (query.driverId) where.driverId = query.driverId
    if (query.q) {
      where.OR = [
        { requestNumber: { contains: query.q, mode: 'insensitive' } },
        { problemDescription: { contains: query.q, mode: 'insensitive' } },
        { driver: { firstName: { contains: query.q, mode: 'insensitive' } } },
        { driver: { lastName: { contains: query.q, mode: 'insensitive' } } },
        { vehicle: { plate: { contains: query.q, mode: 'insensitive' } } },
      ]
    }
    return this.prisma.maintenanceRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: requestInclude,
    })
  }

  async getRequestDetail(id: string, actorId: string, actorRole: UserRole) {
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id },
      include: requestInclude,
    })
    if (!request) throw new NotFoundException('Maintenance request not found')
    const isOwner = request.driverId === actorId
    const isStaff = this.hasAnyRole(actorRole, STAFF_ROLES)
    if (!isOwner && !isStaff) throw new ForbiddenException('Not allowed to view this request')
    return request
  }

  async getDashboardStats(actorRole: UserRole) {
    const groupByStatus = await this.prisma.maintenanceRequest.groupBy({
      by: ['status'],
      _count: { id: true },
    })
    const counts: Record<string, number> = {}
    groupByStatus.forEach((g) => { counts[g.status] = g._count.id })

    if (this.hasAnyRole(actorRole, MAINTENANCE_TEAM_ROLES)) {
      return {
        role: 'maintenance_team',
        newRequests: (counts.SUBMITTED ?? 0) + (counts.DRAFT ?? 0),
        underInspection: counts.UNDER_MAINTENANCE_REVIEW ?? 0,
        approved: counts.MAINTENANCE_APPROVED ?? 0,
        disapproved: counts.MAINTENANCE_DISAPPROVED ?? 0,
        pendingManager: counts.PENDING_FLEET_MANAGER ?? 0,
        inProgress: counts.IN_PROGRESS ?? 0,
        completed: counts.COMPLETED ?? 0,
        rejected: counts.FLEET_MANAGER_REJECTED ?? 0,
      }
    }

    if (this.hasAnyRole(actorRole, MANAGER_ROLES)) {
      return {
        role: 'fleet_manager',
        pendingDecisions: counts.PENDING_FLEET_MANAGER ?? 0,
        accepted: counts.FLEET_MANAGER_ACCEPTED ?? 0,
        rejected: counts.FLEET_MANAGER_REJECTED ?? 0,
        inProgress: counts.IN_PROGRESS ?? 0,
        completed: counts.COMPLETED ?? 0,
        returnedToDriver: counts.RETURNED_TO_DRIVER ?? 0,
      }
    }

    // Driver dashboard
    return {
      role: 'driver',
      total: Object.values(counts).reduce((a, b) => a + b, 0),
      submitted: counts.SUBMITTED ?? 0,
      inReview: (counts.UNDER_MAINTENANCE_REVIEW ?? 0) + (counts.PENDING_FLEET_MANAGER ?? 0),
      accepted: counts.FLEET_MANAGER_ACCEPTED ?? 0,
      rejected: counts.FLEET_MANAGER_REJECTED ?? 0,
      inProgress: counts.IN_PROGRESS ?? 0,
      completed: counts.COMPLETED ?? 0,
      returned: counts.RETURNED_TO_DRIVER ?? 0,
    }
  }
}
