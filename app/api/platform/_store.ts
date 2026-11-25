// In-memory store for fleet maintenance and platform users
export type ModuleKey = 'users' | 'fleet'

export type ItemRecord = { id: string; [key: string]: any }

// =============================
// Fleet Maintenance (in-memory)
// =============================
export type IncidentSeverity = 'HIGH' | 'LOW'
export type ReceiptPeriod = 'Daily' | 'Weekly' | 'Monthly' | 'Yearly'

export type MaintenanceReceipt = {
  id: string
  organization: string // vendor/garage name
  number?: string      // receipt/invoice number
  date?: string        // ISO date
  amount: number
  currency?: string
  fileName?: string
  fileUrl?: string // optional if uploaded somewhere
}

export type MaintenanceRecord = {
  id: string
  driverId: string
  vehicleId?: string
  incidentId?: string
  incidentDate?: string
  incidentSeverity: IncidentSeverity
  description?: string
  receipts: MaintenanceReceipt[]
  receiptPeriod: ReceiptPeriod
  createdAt: string
}

export type MaintenanceRequest = {
  id: string
  managerId: string
  driverId: string
  vehicleId?: string
  sourceRecordId?: string // optional reference to a driver record
  status: 'OPEN' | 'SENT_TO_FINANCE' | 'PAID'
  incidentSeverity: IncidentSeverity
  organization: string
  receipts: MaintenanceReceipt[]
  receiptPeriod: ReceiptPeriod
  notes?: string
  createdAt: string
}

export type FinanceBatch = {
  id: string
  createdAt: string
  createdBy: string // user id/email
  period: ReceiptPeriod
  totalAmount: number
  requestIds: string[]
  receiptIds: string[]
  status: 'QUEUED' | 'SENT' | 'PAID'
}

export const MAINTENANCE_RECORDS: MaintenanceRecord[] = []
export const MAINTENANCE_REQUESTS: MaintenanceRequest[] = []
export const FINANCE_QUEUE: FinanceBatch[] = []

export function nextMaintenanceId(prefix: 'MR'|'MQ'|'FB'): string {
  // MR: maintenance record, MQ: maintenance request, FB: finance batch
  if (prefix === 'MR') return `MR-${String(MAINTENANCE_RECORDS.length + 1).padStart(3,'0')}`
  if (prefix === 'MQ') return `MQ-${String(MAINTENANCE_REQUESTS.length + 1).padStart(3,'0')}`
  return `FB-${String(FINANCE_QUEUE.length + 1).padStart(3,'0')}`
}

export const PLATFORM_STORE: Record<ModuleKey, ItemRecord[]> = {
  users: [],
  fleet: [
    { id: 'F-001', name: 'Sample Fleet Record', type: 'meta' },
  ],
}
