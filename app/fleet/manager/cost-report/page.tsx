'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, RefreshCw } from 'lucide-react'

interface VehicleRow {
  id: string
  plate?: string | null
  make?: string | null
  model?: string | null
  vehicleTypeName?: string | null
  fuelType?: string | null
}

interface FleetCost {
  id: string
  date: string
  vehicleId: string
  category: string | null
  amount: number
  currency: string
  vehicle?: {
    plate?: string | null
    vehicleTypeName?: string | null
    make?: string | null
    model?: string | null
  } | null
}

type Period = 'daily' | 'monthly' | 'yearly' | 'all'

const PERIOD_LABELS: Record<Period, string> = {
  daily: 'ዕለታዊ (Daily)',
  monthly: 'ወርሃዊ (Monthly)',
  yearly: 'ዓመታዊ (Yearly)',
  all: 'ሁሉም (All)',
}

export default function FleetCostReportPage() {
  const router = useRouter()
  const [vehicles, setVehicles] = useState<VehicleRow[]>([])
  const [costs, setCosts] = useState<FleetCost[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('monthly')

  const getToken = () =>
    typeof window !== 'undefined'
      ? window.localStorage.getItem('accessToken') ||
        window.localStorage.getItem('jwt') ||
        window.localStorage.getItem('token') ||
        ''
      : ''

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

  const load = async () => {
    try {
      setLoading(true)
      const headers = { Authorization: `Bearer ${getToken()}` }

      const [vehRes, costRes] = await Promise.all([
        fetch(`${apiBase}/api/fleet/vehicles`, { headers }),
        fetch(`${apiBase}/api/fleet/costs`, { headers }),
      ])

      const vehData = await vehRes.json().catch(() => ({}))
      const vehArr = vehData?.data || vehData?.items || vehData
      setVehicles(Array.isArray(vehArr) ? vehArr : [])

      if (costRes.ok) {
        const costData = await costRes.json().catch(() => ({}))
        const costArr = costData?.data || costData?.items || costData
        setCosts(Array.isArray(costArr) ? costArr : [])
      } else {
        setCosts([])
      }
    } catch (e) {
      console.error('Error loading cost report data:', e)
      setCosts([])
      setVehicles([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const vehicleTypeById = useMemo(() => {
    const map = new Map<string, string>()
    vehicles.forEach((v) => {
      const typeName =
        v.vehicleTypeName ||
        [v.make, v.model].filter(Boolean).join(' ') ||
        v.fuelType ||
        'ያልተመደበ'
      map.set(v.id, typeName)
    })
    return map
  }, [vehicles])

  const rows = useMemo(() => {
    const now = new Date()
    let start: Date | null = null
    let end: Date | null = null

    if (period === 'daily') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    } else if (period === 'monthly') {
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    } else if (period === 'yearly') {
      start = new Date(now.getFullYear(), 0, 1)
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
    }

    const isFuel = (c: FleetCost) => /fuel|gas|petrol|diesel|ነዳጅ/i.test(String(c.category || ''))
    const isMaint = (c: FleetCost) => /maint|service|repair|ጥገና/i.test(String(c.category || ''))

    const byType = new Map<
      string,
      { fuel: number; maintenance: number; vehicleIds: Set<string> }
    >()

    costs.forEach((c) => {
      if (!c?.date) return
      const d = new Date(c.date)
      if (isNaN(d.getTime())) return
      if (start && d < start) return
      if (end && d > end) return

      const amount = Number(c.amount) || 0
      const typeName =
        c.vehicle?.vehicleTypeName ||
        [c.vehicle?.make, c.vehicle?.model].filter(Boolean).join(' ') ||
        vehicleTypeById.get(c.vehicleId) ||
        'ያልተመደበ'

      const entry = byType.get(typeName) || { fuel: 0, maintenance: 0, vehicleIds: new Set<string>() }
      if (isFuel(c)) entry.fuel += amount
      else if (isMaint(c)) entry.maintenance += amount
      entry.vehicleIds.add(c.vehicleId)
      byType.set(typeName, entry)
    })

    const result = Array.from(byType.entries()).map(([type, v]) => ({
      type,
      fuel: v.fuel,
      maintenance: v.maintenance,
      total: v.fuel + v.maintenance,
      vehicleCount: v.vehicleIds.size,
    }))

    result.sort((a, b) => b.total - a.total)
    return result
  }, [costs, period, vehicleTypeById])

  const grandTotal = rows.reduce((s, r) => s + r.total, 0)
  const grandFuel = rows.reduce((s, r) => s + r.fuel, 0)
  const grandMaint = rows.reduce((s, r) => s + r.maintenance, 0)

  const fmt = (n: number) => n.toLocaleString('en-US')

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button
            type="button"
            onClick={() => router.push('/fleet/manager/costs')}
            className="mb-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            ← ወደ ወጪዎች ተመለስ
          </button>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">የወጪ ሪፖርት</h1>
              <p className="mt-1 text-sm text-slate-500">
                Total cost report by vehicle type category
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600">ጊዜ ማጣሪያ:</span>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as Period)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
              >
                {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                  <option key={p} value={p}>
                    {PERIOD_LABELS[p]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={load}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4" />
                አድስ
              </button>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">ጠቅላላ ወጪ</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{fmt(grandTotal)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">የነዳጅ ወጪ</p>
            <p className="mt-1 text-2xl font-bold text-rose-600">{fmt(grandFuel)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">የጥገና ወጪ</p>
            <p className="mt-1 text-2xl font-bold text-amber-600">{fmt(grandMaint)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">የተካተቱ ምድቦች</p>
            <p className="mt-1 text-2xl font-bold text-blue-600">{rows.length}</p>
          </div>
        </div>

        {/* Report table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                የመኪና አይነት በወጪ ሪፖርት — {PERIOD_LABELS[period]}
              </h3>
              <p className="text-xs text-slate-500">Cost totals grouped by vehicle type category</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-6 py-3">#</th>
                  <th className="px-6 py-3">የመኪና አይነት / ምድብ</th>
                  <th className="px-6 py-3">የነዳጅ ወጪ (ብር)</th>
                  <th className="px-6 py-3">የጥገና ወጪ (ብር)</th>
                  <th className="px-6 py-3">ጠቅላላ ወጪ (ብር)</th>
                  <th className="px-6 py-3">መኪናዎች ብዛት</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                      በመጫን ላይ...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                      በዚህ ጊዜ ውስጥ ምንም ወጪ የለም
                    </td>
                  </tr>
                ) : (
                  rows.map((r, i) => (
                    <tr key={r.type} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                      <td className="px-6 py-3 text-slate-400">{i + 1}</td>
                      <td className="px-6 py-3 font-semibold text-slate-900">{r.type}</td>
                      <td className="px-6 py-3 text-rose-600">{fmt(r.fuel)}</td>
                      <td className="px-6 py-3 text-amber-600">{fmt(r.maintenance)}</td>
                      <td className="px-6 py-3 font-bold text-slate-900">{fmt(r.total)}</td>
                      <td className="px-6 py-3">{r.vehicleCount}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {!loading && rows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-100 font-bold text-slate-900">
                    <td className="px-6 py-3" colSpan={2}>ጠቅላላ</td>
                    <td className="px-6 py-3 text-rose-600">{fmt(grandFuel)}</td>
                    <td className="px-6 py-3 text-amber-600">{fmt(grandMaint)}</td>
                    <td className="px-6 py-3">{fmt(grandTotal)}</td>
                    <td className="px-6 py-3">
                      {rows.reduce((s, r) => s + r.vehicleCount, 0)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
