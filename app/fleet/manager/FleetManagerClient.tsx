'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import {
  Car,
  Users,
  ClipboardList,
  FileText,
  CheckCircle2,
  Truck,
  Wrench,
  Fuel,
  BarChart3,
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
  const [fuelRequests, setFuelRequests] = useState<any[]>([])
  const [fleetCosts, setFleetCosts] = useState<any[]>([])
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
        loadFuelRequests(),
        loadFleetCosts(),
      ])
    }
    loadData()
  }, [])

  const monthlyFuelData = useMemo(() => {
    const months: Record<string, number> = {}
    fuelRequests.forEach((r: any) => {
      const d = r?.createdAt || r?.requestDate || r?.date
      if (!d) return
      const date = new Date(d)
      if (Number.isNaN(date.getTime())) return
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const amt = Number(r?.amount ?? 0)
      months[key] = (months[key] || 0) + (Number.isFinite(amt) ? amt : 0)
    })
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, total]) => {
        const [y, m] = key.split('-')
        return { month: `${m}/${y.slice(2)}`, ነዳጅ: Math.round(total) }
      })
  }, [fuelRequests])

  const costAmount = (c: any) => {
    const n = Number(c?.amount ?? c?.cost ?? c?.total ?? 0)
    return Number.isFinite(n) ? n : 0
  }
  const costCategory = (c: any) => String(c?.category ?? c?.type ?? c?.name ?? '').toLowerCase()

  const fuelCostTotal = useMemo(
    () =>
      fleetCosts
        .filter((c) => /fuel|gas|petrol|diesel|ነዳጅ/.test(costCategory(c)))
        .reduce((sum, c) => sum + costAmount(c), 0),
    [fleetCosts]
  )
  const maintenanceCostTotal = useMemo(
    () =>
      fleetCosts
        .filter((c) => /maint|service|repair|ጥገና/.test(costCategory(c)))
        .reduce((sum, c) => sum + costAmount(c), 0),
    [fleetCosts]
  )

  const vehicleStatusData = useMemo(() => {
    const counts: Record<string, number> = {}
    vehicles.forEach((v: any) => {
      const s = String(v?.status || 'UNKNOWN').toUpperCase()
      counts[s] = (counts[s] || 0) + 1
    })
    const colors: Record<string, string> = {
      AVAILABLE: '#10b981',
      ASSIGNED: '#3b82f6',
      MAINTENANCE: '#f59e0b',
      INACTIVE: '#94a3b8',
      UNKNOWN: '#cbd5e1',
    }
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      fill: colors[name] || '#64748b',
    }))
  }, [vehicles])

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

  const statCards = [
    {
      label: 'የመኪና መመደቢያ',
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

            <button
              type="button"
              onClick={() => router.push('/fleet/manager/fuel-requests')}
              className="group rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-md"
            >
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <Fuel className="h-5 w-5" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{fuelRequests.length}</p>
              <p className="mt-0.5 text-xs font-medium text-slate-500">የነዳጅ ጥያቄዎች</p>
            </button>
            <button
              type="button"
              onClick={() => router.push('/fleet/maintenance-approval')}
              className="group rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md"
            >
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600">
                <Wrench className="h-5 w-5" />
              </div>
              <p className="text-2xl font-bold text-slate-900">የጥገና ጥያቄዎች</p>
              <p className="mt-0.5 text-xs font-medium text-slate-500">ከሹፌሮች ይቀበሉ</p>
            </button>
          </div>

          {/* ── Cost Analysis ──────────────────────────────── */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500">ጠቅላላ መኪናዎች</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{stats.totalVehicles}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500">ጠቅላላ ሹፌሮች</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{drivers.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500">ጠቅላላ የነዳጅ ወጪ</p>
              <p className="mt-1 text-2xl font-bold text-rose-600">{fuelCostTotal.toLocaleString('en-US')}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500">ጠቅላላ የጥገና ወጪ</p>
              <p className="mt-1 text-2xl font-bold text-amber-600">{maintenanceCostTotal.toLocaleString('en-US')}</p>
            </div>
          </div>

          {/* ── Report Charts ──────────────────────────────── */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">የነዳጅ ጥያቄዎች ሪፖርት</h3>
                  <p className="text-xs text-slate-500">Monthly fuel requests (last 6 months)</p>
                </div>
              </div>
              <div className="h-64 p-4">
                {monthlyFuelData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">
                    ምንም የነዳጅ ጥያቄ የለም
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyFuelData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="ነዳጅ" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Car className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">የመኪና ሁኔታ ሪፖርት</h3>
                  <p className="text-xs text-slate-500">Vehicle status distribution</p>
                </div>
              </div>
              <div className="h-64 p-4">
                {vehicleStatusData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">
                    ምንም መኪና የለም
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={vehicleStatusData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                      >
                        {vehicleStatusData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
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
