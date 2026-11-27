'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Car,
  Users,
  ClipboardList,
  FileText,
  CheckCircle2,
  Truck,
  Wrench,
  Fuel,
} from 'lucide-react'
import { useToast } from '@/app/components/toast-provider'
import { decodeJwt } from '@/app/lib/auth'
import { Vehicle, Driver, Assignment, FleetRequestDTO, AssignmentRequest } from '@/app/components/fleet-manager/types'
import VehiclesTab from '@/app/components/fleet-manager/VehiclesTab'
import DriversTab from '@/app/components/fleet-manager/DriversTab'
import AssignmentsTab from '@/app/components/fleet-manager/AssignmentsTab'
import RequestsTab from '@/app/components/fleet-manager/RequestsTab'
import ServicedTab from '@/app/components/fleet-manager/ServicedTab'

export default function FleetManagerClient() {
  const router = useRouter()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [requests, setRequests] = useState<FleetRequestDTO[]>([])
  const [assignmentRequests, setAssignmentRequests] = useState<AssignmentRequest[]>([])
  const [serviceRegistrations, setServiceRegistrations] = useState<any[]>([])
  const [fleetCosts, setFleetCosts] = useState<any[]>([])
  const [fuelRequests, setFuelRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<
    'overview' | 'vehicles' | 'drivers' | 'assignments' | 'requests' | 'serviced'
  >('overview')
  const { show: toast } = useToast()

  // Restrict page to fleet staff only (fleet manager, admin, HR supervisor)
  useEffect(() => {
    try {
      const token =
        localStorage.getItem('accessToken') ||
        localStorage.getItem('jwt') ||
        localStorage.getItem('token') ||
        ''
      const payload = token ? decodeJwt(token) : null
      const raw: any = payload || {}
      const candidates: string[] = []
      if (typeof raw.role === 'string') candidates.push(raw.role)
      if (Array.isArray(raw.role)) candidates.push(...raw.role)
      if (Array.isArray(raw.roles)) {
        for (const r of raw.roles) {
          if (typeof r === 'string') candidates.push(r)
          else if (r && typeof r.name === 'string') candidates.push(r.name)
        }
      }
      if (raw.realm_access?.roles) candidates.push(...raw.realm_access.roles)
      const roles = candidates.map((r) => String(r).toUpperCase())
      const allowed =
        roles.some((r: string) => /(ADMIN|SYSTEM[_-]?ADMIN|SUPERUSER)/.test(r)) ||
        roles.includes('FLEET_MANAGER') ||
        roles.includes('FLEET MANAGER') ||
        roles.includes('FLEET-MANAGER') ||
        roles.includes('HR_SUPERVISOR') ||
        roles.includes('HR SUPERVISOR') ||
        roles.includes('HR-SUPERVISOR')
      if (!allowed) {
        router.replace('/fleet/request')
      }
    } catch {
      router.replace('/fleet/request')
    }
  }, [router])

  // Initialize active tab from URL ?tab=...
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const sp = new URLSearchParams(window.location.search)
      const tabParam = (sp.get('tab') || '').toLowerCase()
      const allowed = [
        'overview',
        'vehicles',
        'drivers',
        'assignments',
        'requests',
        'serviced',
      ] as const
      if (allowed.includes(tabParam as any)) {
        setActiveTab(tabParam as any)
      }
    } catch {}
  }, [])

  const loadFleetCosts = async () => {
    try {
      const token =
        localStorage.getItem('accessToken') ||
        localStorage.getItem('jwt') ||
        localStorage.getItem('token') ||
        ''
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
      const res = await fetch(`${apiBase}/api/fleet/costs`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) {
        setFleetCosts([])
        return
      }
      const data = await res.json().catch(() => ({}))
      const arr = data?.data || data?.items || data
      setFleetCosts(Array.isArray(arr) ? arr : [])
    } catch (err) {
      console.error('Error fetching fleet costs:', err)
      setFleetCosts([])
    }
  }

  const loadFuelRequests = async () => {
    try {
      const token =
        localStorage.getItem('accessToken') ||
        localStorage.getItem('jwt') ||
        localStorage.getItem('token') ||
        ''
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
      const res = await fetch(`${apiBase}/api/fleet/manager/fuel-requests`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) {
        setFuelRequests([])
        return
      }
      const data = await res.json().catch(() => ({}))
      const arr = data?.data || data?.items || data
      setFuelRequests(Array.isArray(arr) ? arr : [])
    } catch (err) {
      console.error('Error fetching fuel requests:', err)
      setFuelRequests([])
    }
  }

  const loadServiceRegistrations = async () => {
    try {
      const token =
        localStorage.getItem('accessToken') ||
        localStorage.getItem('jwt') ||
        localStorage.getItem('token') ||
        ''

      const apiBase = process.env.NEXT_PUBLIC_API_URL
      const url = apiBase
        ? `${apiBase}/api/fleet/service-registrations`
        : '/api/fleet/service-registrations'

      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (!res.ok) {
        console.error('Failed to load service registrations', await res.text())
        setServiceRegistrations([])
        return
      }

      const data = await res.json()
      const items: any[] = Array.isArray(data) ? data : data?.items || data?.data || []
      setServiceRegistrations(items || [])
    } catch (err) {
      console.error('Error fetching service registrations:', err)
      setServiceRegistrations([])
    }
  }

  const activeServiceRegistrationsCount = Array.isArray(serviceRegistrations)
    ? serviceRegistrations.filter((r: any) => {
        if (!r) return false

        const rawStatus = (r.status || '').toString().toUpperCase().trim()

        // Explicitly exclude COMPLETED (or any other non-active) statuses
        if (rawStatus === 'COMPLETED' || rawStatus === 'DONE' || rawStatus === 'FINISHED') {
          return false
        }

        // Only treat PENDING / IN_PROGRESS / empty as potentially active
        const isActiveStatus =
          rawStatus === 'PENDING' || rawStatus === 'IN_PROGRESS' || rawStatus === ''

        if (!isActiveStatus) return false

        // If serviceEnd is in the past, also treat as no longer active
        const endRaw: string | undefined = (r as any).serviceEnd
        if (endRaw) {
          const end = new Date(endRaw)
          if (!Number.isNaN(end.getTime())) {
            const now = new Date()
            if (now >= end) return false
          }
        }

        return true
      }).length
    : 0

  const servicedVehiclesCount = Array.isArray(serviceRegistrations)
    ? serviceRegistrations.filter((r: any) => {
        if (!r) return false

        const rawStatus = (r.status || '').toString().toUpperCase().trim()

        // 1) If status text clearly indicates completion, count it.
        if (
          rawStatus === 'COMPLETED' ||
          rawStatus === 'DONE' ||
          rawStatus === 'FINISHED' ||
          rawStatus === 'APPROVED' ||
          rawStatus === 'COMPLETE'
        ) {
          return true
        }

        // 2) If status is missing/unclear but serviceEnd is in the past,
        // also treat as completed.
        const endRaw: string | undefined = (r as any).serviceEnd
        if (endRaw) {
          const end = new Date(endRaw)
          if (!Number.isNaN(end.getTime())) {
            const now = new Date()
            if (now >= end) return true
          }
        }

        return false
      }).length
    : 0

  const stats = {
    totalVehicles: Array.isArray(vehicles) ? vehicles.length : 0,
    availableVehicles: Array.isArray(vehicles)
      ? vehicles.filter((v) => v?.status === 'available').length
      : 0,
    assignedVehicles: Array.isArray(vehicles)
      ? vehicles.filter((v) => v?.status === 'assigned').length
      : 0,
    // Number of vehicles currently registered "on service" based on
    // Service Registration History (pending or in-progress records).
    maintenanceVehicles: activeServiceRegistrationsCount,
    totalDrivers: Array.isArray(drivers) ? drivers.length : 0,
    activeDrivers: Array.isArray(drivers) ? drivers.filter((d) => d?.isActive).length : 0,
    activeAssignments: Array.isArray(assignments)
      ? assignments.filter((a) => a?.status === 'active').length
      : 0,
  }

  const assignedVehiclesCount = Array.isArray(assignmentRequests)
    ? assignmentRequests.reduce((sum, req) => sum + (req.vehicles ? req.vehicles.length : 0), 0)
    : 0

  const fetchVehicles = async () => {
    try {
      setLoading(true)
      setFetchError(null)
      const token =
        localStorage.getItem('accessToken') ||
        localStorage.getItem('jwt') ||
        localStorage.getItem('token') ||
        ''
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/fleet/vehicles`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
      const data = await res.json()
      setVehicles(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error fetching vehicles:', err)
      setFetchError('Failed to load vehicles. Please try again later.')
      setVehicles([])
      toast({
        title: 'Error',
        description: 'Failed to load vehicles. Please try again later.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const loadDrivers = async () => {
    try {
      const token = localStorage.getItem('accessToken') || ''
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/fleet/driver`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`Error: ${res.status}`)
      const data = await res.json()
      const driversData = data.data || data.items || data.drivers || data || []
      setDrivers(driversData)
    } catch (err) {
      console.error('Error fetching drivers:', err)
      toast({ title: 'Error', description: 'Failed to load drivers.', variant: 'destructive' })
    }
  }

  const loadRequests = async () => {
    try {
      const token = localStorage.getItem('accessToken') || ''
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/fleet/manager/requests/approved`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!res.ok) throw new Error(`Error: ${res.status}`)
      const data = await res.json()
      const arr = (data?.data || data?.items || data) as any
      const list: FleetRequestDTO[] = Array.isArray(arr) ? arr : []
      setRequests(list)
    } catch (err) {
      console.error('Error fetching approved requests:', err)
      toast({
        title: 'Error',
        description: 'Failed to load approved requests.',
        variant: 'destructive',
      })
    }
  }

  const loadAssignmentDetails = async () => {
    try {
      const token = localStorage.getItem('accessToken') || ''
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
      const res = await fetch(
        `${apiBase}/api/fleet/requests/summary`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      )
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
      const data = await res.json()
      const arr = (data?.data || data?.items || []) as any
      console.log("========================",arr)
      const list: AssignmentRequest[] = Array.isArray(arr) ? arr : []
      setAssignmentRequests((prev) => {
        const map = new Map<string | number, AssignmentRequest>()

        ;(prev || []).forEach((req) => {
          if (req) map.set(req.id, req)
        })

        list.forEach((req) => {
          if (req) map.set(req.id, req)
        })

        return Array.from(map.values())
      })
    } catch (err) {
      console.error('Error fetching assignment details:', err)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        fetchVehicles(),
        loadDrivers(),
        loadRequests(),
        loadAssignmentDetails(),
        loadServiceRegistrations(),
        loadFleetCosts(),
        loadFuelRequests(),
      ])
    }
    loadData()
  }, [])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading fleet data...</div>
        </div>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert">
          <p className="font-bold">Error</p>
          <p>{fetchError}</p>
          <button
            onClick={fetchVehicles}
            className="mt-2 bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const costAmount = (c: any) => {
    const n = Number(c?.amount ?? c?.cost ?? c?.total ?? 0)
    return Number.isFinite(n) ? n : 0
  }
  const costCategory = (c: any) => String(c?.category ?? c?.type ?? c?.name ?? '').toLowerCase()

  const maintenanceCosts = fleetCosts.filter((c) =>
    /maint|service|repair|ጥገና/.test(costCategory(c))
  )
  const maintenanceCost = maintenanceCosts.reduce((sum, c) => sum + costAmount(c), 0)
  const maintenanceCostCount = maintenanceCosts.length

  const fuelCost = fleetCosts
    .filter((c) => /fuel|gas|petrol|diesel|ነዳጅ/.test(costCategory(c)))
    .reduce((sum, c) => sum + costAmount(c), 0)

  const formatCost = (n: number) => n.toLocaleString('en-US')

  const totalFuelLiters = fuelRequests.reduce((sum, r: any) => {
    const n = Number(r?.amount ?? 0)
    return sum + (Number.isFinite(n) ? n : 0)
  }, 0)
  const fueledCount = fuelRequests.filter((r: any) => {
    const s = String(r?.status || '').toUpperCase()
    return s === 'FUELED' || s === 'COMPLETED' || s === 'APPROVED'
  }).length

  const statCards = [
    {
      label: 'ጠቅላላ የተመዘገበ መኪና',
      value: stats.totalVehicles,
      icon: Car,
      chip: 'bg-blue-50 text-blue-600',
      tab: 'vehicles' as const,
      tabParam: 'vehicles',
    },
    {
      label: 'የመኪና ጥያቄዎች',
      value: requests.length,
      icon: FileText,
      chip: 'bg-emerald-50 text-emerald-600',
      tab: 'requests' as const,
      tabParam: 'requests',
    },
    {
      label: 'መስክ ላይ ያልሆኑ ሹፌሮች',
      value: stats.activeDrivers,
      icon: Users,
      chip: 'bg-sky-50 text-sky-600',
      tab: 'drivers' as const,
      tabParam: 'drivers&status=unassigned',
    },
    {
      label: 'የሹፌሮች የመስክ ሪፖርት',
      value: assignedVehiclesCount,
      icon: ClipboardList,
      chip: 'bg-orange-50 text-orange-600',
      tab: 'assignments' as const,
      tabParam: 'assignments',
    },
    {
      label: 'ሰርቪስ የተደረገላቸው መኪኖች',
      value: servicedVehiclesCount,
      icon: CheckCircle2,
      chip: 'bg-indigo-50 text-indigo-600',
      tab: 'serviced' as const,
      tabParam: 'serviced',
    },
    {
      label: 'መስክ ላይ ያልሆኑ መኪኖች',
      value: stats.availableVehicles,
      icon: Truck,
      chip: 'bg-teal-50 text-teal-600',
      tab: 'vehicles' as const,
      tabParam: 'vehicles&status=available',
    },
  ]

  const goToTab = (tab: string, tabParam?: string) => {
    setActiveTab(tab as any)
    router.push(`/fleet/manager?tab=${tabParam || tab}`)
  }

  const handleCardClick = (card: (typeof statCards)[number]) => {
    if ('tab' in card && card.tab) {
      goToTab(card.tab, 'tabParam' in card ? card.tabParam : undefined)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        {activeTab === 'overview' ? (
          /* ── Dashboard: stat buttons + fuel container ──────── */
          <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {statCards.map((card) => (
              <button
                key={card.label}
                type="button"
                onClick={() => handleCardClick(card)}
                className="group rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
              >
                <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ${card.chip}`}>
                  <card.icon className="h-5 w-5" />
                </div>
                <p className="text-2xl font-bold text-slate-900">{card.value}</p>
                <p className="mt-0.5 text-xs font-medium text-slate-500">{card.label}</p>
              </button>
            ))}
          </div>

          {/* ── Fuel Container ─────────────────────────────── */}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                  <Fuel className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">የነዳጅ ማጠቃለያ</h3>
                  <p className="text-xs text-slate-500">Fuel summary</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.push('/fleet/manager/costs?kind=fuel')}
                className="rounded-lg bg-[#135a98] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0f4e84]"
              >
                ዝርዝር ይመልከቱ
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 p-6 sm:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500">ጠቅላላ የነዳጅ ጥያቄዎች</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{fuelRequests.length}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500">ጠቅላላ ነዳጅ (ሊትር)</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{totalFuelLiters.toLocaleString('en-US')}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500">ነዳጅ የተሞላላቸው</p>
                <p className="mt-1 text-2xl font-bold text-emerald-600">{fueledCount}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500">ጠቅላላ የነዳጅ ወጪ</p>
                <p className="mt-1 text-2xl font-bold text-rose-600">{formatCost(fuelCost)}</p>
              </div>
            </div>
          </div>

          {/* ── Maintenance Cost Status Container ──────────── */}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <Wrench className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">የጥገና ወጪ ሁኔታ</h3>
                  <p className="text-xs text-slate-500">Maintenance cost status</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.push('/fleet/manager/costs?kind=maintenance')}
                className="rounded-lg bg-[#135a98] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0f4e84]"
              >
                ዝርዝር ይመልከቱ
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 p-6 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500">የጥገና ወጪ መዝገቦች</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{maintenanceCostCount}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500">ጠቅላላ የጥገና ወጪ</p>
                <p className="mt-1 text-2xl font-bold text-amber-600">{formatCost(maintenanceCost)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500">ሰርቪስ የተደረገላቸው መኪኖች</p>
                <p className="mt-1 text-2xl font-bold text-indigo-600">{servicedVehiclesCount}</p>
              </div>
            </div>
          </div>
          </>
        ) : (
          /* ── Tab Content (deep links via ?tab=...) ────────── */
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab('overview')
                router.push('/fleet/manager')
              }}
              className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              ← ወደ ዳሽቦርድ ተመለስ
            </button>
            {activeTab === 'vehicles' && (
            <VehiclesTab
              vehicles={vehicles}
              drivers={drivers}
              assignments={assignmentRequests}
              serviceRegistrations={serviceRegistrations}
              onVehiclesUpdate={setVehicles}
            />
          )}

          {activeTab === 'drivers' && <DriversTab drivers={drivers} onDriversUpdate={setDrivers} />}

          {activeTab === 'requests' && (
            <RequestsTab requests={requests} onRequestsUpdate={setRequests} />
          )}

          {activeTab === 'assignments' && (
            <AssignmentsTab
              requests={assignmentRequests}
              onAssignmentsUpdate={setAssignmentRequests}
            />
          )}

          {activeTab === 'serviced' && <ServicedTab />}
          </div>
        )}
      </div>
    </div>
  )
}
