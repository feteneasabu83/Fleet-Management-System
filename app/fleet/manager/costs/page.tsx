'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Fuel, Wrench, Plus, RefreshCw, BarChart3 } from 'lucide-react'
import { useToast } from '@/app/components/toast-provider'

interface VehicleOption {
  id: string
  plate?: string | null
  make?: string | null
  model?: string | null
}

interface FleetCost {
  id: string
  date: string
  vehicleId: string
  category: string | null
  amount: number
  currency: string
  reference?: string | null
  description?: string | null
  vehicle?: {
    plate?: string | null
    make?: string | null
    model?: string | null
  } | null
}

type CostKind = 'fuel' | 'maintenance'

const MAINTENANCE_ISSUE_TYPES = [
  'የሞተር / ኢንጅን ችግር',
  'የፍሬን ስርዓት',
  'የአየር ኮንዲሽነር',
  'የኤሌክትሪክ ስርዓት',
  'የስታርተር',
  'የጎማ / የአገልግሎት',
  'የማገዶ ስርዓት',
  'የባዶ ሰው / ገጽታ',
  'የማዞሪያ ስርዓት',
  'ሌሎች',
] as const

const ISSUE_PREFIX = '__issue__:'

const CATEGORY_MAP: Record<CostKind, string> = {
  fuel: 'Fuel & Energy',
  maintenance: 'Maintenance & Repairs',
}

const KIND_META: Record<
  CostKind,
  { title: string; subtitle: string; icon: any; chip: string; button: string }
> = {
  fuel: {
    title: 'የነዳጅ ወጪ',
    subtitle: 'Fuel & Energy cost',
    icon: Fuel,
    chip: 'bg-rose-50 text-rose-600',
    button: 'bg-rose-600 hover:bg-rose-700',
  },
  maintenance: {
    title: 'የጥገና ወጪ',
    subtitle: 'Maintenance & Repairs cost',
    icon: Wrench,
    chip: 'bg-amber-50 text-amber-600',
    button: 'bg-amber-600 hover:bg-amber-700',
  },
}

export default function FleetCostsPage() {
  const router = useRouter()
  const { show: toast } = useToast()

  const [vehicles, setVehicles] = useState<VehicleOption[]>([])
  const [costs, setCosts] = useState<FleetCost[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<CostKind | null>(null)
  const [activeKind, setActiveKind] = useState<CostKind>('fuel')

  const [form, setForm] = useState<Record<CostKind, {
    date: string
    vehicleId: string
    amount: string
    currency: string
    reference: string
    description: string
    issueType: string
  }>>({
    fuel: { date: '', vehicleId: '', amount: '', currency: 'ETB', reference: '', description: '', issueType: '' },
    maintenance: { date: '', vehicleId: '', amount: '', currency: 'ETB', reference: '', description: '', issueType: '' },
  })

  const getToken = () =>
    typeof window !== 'undefined'
      ? window.localStorage.getItem('accessToken') ||
        window.localStorage.getItem('jwt') ||
        window.localStorage.getItem('token') ||
        ''
      : ''

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

  const loadVehicles = async () => {
    try {
      const res = await fetch(`${apiBase}/api/fleet/vehicles`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      const data = await res.json().catch(() => ({}))
      const arr = data?.data || data?.items || data
      setVehicles(Array.isArray(arr) ? arr : [])
    } catch (e) {
      console.error('Error loading vehicles:', e)
      setVehicles([])
    }
  }

  const loadCosts = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${apiBase}/api/fleet/costs`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error(`Failed to load costs (${res.status})`)
      const data = await res.json().catch(() => ({}))
      const arr = data?.data || data?.items || data
      setCosts(Array.isArray(arr) ? arr : [])
    } catch (e: any) {
      console.error('Error loading fleet costs:', e)
      toast({ title: e?.message || 'Failed to load costs', variant: 'destructive' })
      setCosts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const kind = new URLSearchParams(window.location.search).get('kind')
    if (kind === 'fuel' || kind === 'maintenance') {
      setActiveKind(kind)
    }
    loadVehicles()
    loadCosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredCosts = useMemo(() => {
    const pattern =
      activeKind === 'maintenance'
        ? /maint|service|repair|ጥገና/i
        : /fuel|gas|petrol|diesel|energy|ነዳጅ/i
    return costs.filter((c) => pattern.test(String(c.category || '')))
  }, [costs, activeKind])

  const totalAmount = useMemo(
    () => filteredCosts.reduce((sum, c) => sum + (Number(c.amount) || 0), 0),
    [filteredCosts]
  )

  const distinctVehicleCount = useMemo(
    () => new Set(filteredCosts.map((c) => c.vehicleId)).size,
    [filteredCosts]
  )

  const updateForm = (kind: CostKind, field: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      [kind]: { ...prev[kind], [field]: value },
    }))
  }

  const handleSubmit = async (kind: CostKind) => {
    const f = form[kind]
    if (!f.date || !f.vehicleId || !f.amount || (kind === 'maintenance' && !f.issueType)) {
      const missing: string[] = []
      if (!f.date) missing.push('ቀን (date)')
      if (!f.vehicleId) missing.push('መኪና (vehicle)')
      if (!f.amount) missing.push('ወጪ (amount)')
      if (kind === 'maintenance' && !f.issueType) missing.push('የችግር አይነት (issue type)')
      toast({ title: `Missing: ${missing.join(', ')}`, variant: 'destructive' })
      return
    }
    const amountNum = Number(f.amount)
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast({ title: 'Amount must be a positive number', variant: 'destructive' })
      return
    }

    try {
      setSaving(kind)
      const res = await fetch(`${apiBase}/api/fleet/costs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          date: f.date,
          vehicleId: f.vehicleId,
          category: CATEGORY_MAP[kind],
          amount: amountNum,
          currency: f.currency || 'ETB',
          reference: f.reference || undefined,
          description:
            kind === 'maintenance' && f.issueType
              ? `${ISSUE_PREFIX}${f.issueType}${f.description ? ` — ${f.description}` : ''}`
              : f.description || undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const msg = Array.isArray(err?.message)
          ? err.message.join(', ')
          : err?.message || err?.error || `Failed to save (${res.status})`
        console.error('Fleet cost save failed:', res.status, err)
        throw new Error(msg)
      }

      toast({ title: `${KIND_META[kind].title} ተመዝግቧል`, variant: 'success' })
      setForm((prev) => ({
        ...prev,
        [kind]: { date: '', vehicleId: '', amount: '', currency: 'ETB', reference: '', description: '', issueType: '' },
      }))
      await loadCosts()
    } catch (e: any) {
      console.error('Error saving fleet cost:', e)
      toast({ title: e?.message || 'Failed to save cost', variant: 'destructive' })
    } finally {
      setSaving(null)
    }
  }

  const renderForm = (kind: CostKind) => {
    const meta = KIND_META[kind]
    const f = form[kind]
    const Icon = meta.icon

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${meta.chip}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">{meta.title} ይመዝግቡ</h3>
            <p className="text-xs text-slate-500">{meta.subtitle}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">ቀን *</label>
            <input
              type="date"
              value={f.date}
              onChange={(e) => updateForm(kind, 'date', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">መኪና *</label>
            <select
              value={f.vehicleId}
              onChange={(e) => updateForm(kind, 'vehicleId', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">መኪና ይምረጡ</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate || v.id}
                  {v.make || v.model ? ` — ${[v.make, v.model].filter(Boolean).join(' ')}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">ወጪ (ብር) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={f.amount}
              onChange={(e) => updateForm(kind, 'amount', e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">ምንዛሪ</label>
            <input
              type="text"
              value={f.currency}
              onChange={(e) => updateForm(kind, 'currency', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">ማጣቀሻ</label>
            <input
              type="text"
              value={f.reference}
              onChange={(e) => updateForm(kind, 'reference', e.target.value)}
              placeholder="Invoice / receipt no."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          {kind === 'maintenance' && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">የችግር / የኢንሲደንት አይነት *</label>
              <select
                value={f.issueType}
                onChange={(e) => updateForm(kind, 'issueType', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">ይምረጡ</option>
                {MAINTENANCE_ISSUE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">መግለጫ</label>
            <input
              type="text"
              value={f.description}
              onChange={(e) => updateForm(kind, 'description', e.target.value)}
              placeholder="Description"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => handleSubmit(kind)}
            disabled={saving === kind}
            className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60 ${meta.button}`}
          >
            <Plus className="h-4 w-4" />
            {saving === kind ? 'በማስቀመጥ ላይ...' : `${meta.title} ይመዝግቡ`}
          </button>
        </div>
      </div>
    )
  }

  const renderTable = () => {
    const meta = KIND_META[activeKind]
    const Icon = meta.icon

    return (
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${meta.chip}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{meta.title} ሰንጠረዥ</h3>
              <p className="text-xs text-slate-500">
                ጠቅላላ ወጪ: <span className="font-bold text-slate-900">{totalAmount.toLocaleString('en-US')} {filteredCosts[0]?.currency || 'ETB'}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadCosts}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            አድስ
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-6 py-3">ቀን</th>
                <th className="px-6 py-3">መኪና</th>
                {activeKind === 'maintenance' && <th className="px-6 py-3">የችግር አይነት</th>}
                <th className="px-6 py-3">ወጪ</th>
                <th className="px-6 py-3">ምንዛሪ</th>
                <th className="px-6 py-3">ማጣቀሻ</th>
                <th className="px-6 py-3">መግለጫ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    በመጫን ላይ...
                  </td>
                </tr>
              ) : filteredCosts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    ምንም መረጃ የለም
                  </td>
                </tr>
              ) : (
                filteredCosts.map((c) => {
                  const rawDesc = c.description || ''
                  const hasIssue = rawDesc.startsWith(ISSUE_PREFIX)
                  const issueType = hasIssue ? rawDesc.slice(ISSUE_PREFIX.length).split(' — ')[0] : ''
                  const descText = hasIssue ? rawDesc.slice(ISSUE_PREFIX.length + issueType.length).replace(/^ — /, '') : rawDesc
                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3 whitespace-nowrap">{new Date(c.date).toLocaleDateString()}</td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        {c.vehicle?.plate || c.vehicleId}
                      </td>
                      {activeKind === 'maintenance' && (
                        <td className="px-6 py-3">
                          {issueType ? (
                            <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                              {issueType}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      )}
                      <td className="px-6 py-3 font-semibold">{Number(c.amount).toLocaleString('en-US')}</td>
                      <td className="px-6 py-3">{c.currency || 'ETB'}</td>
                      <td className="px-6 py-3">{c.reference || '—'}</td>
                      <td className="px-6 py-3">{descText || '—'}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <button
            type="button"
            onClick={() => router.push('/fleet/manager')}
            className="mb-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            ← ወደ ዳሽቦርድ ተመለስ
          </button>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">የነዳጅ እና የጥገና ወጪዎች</h1>
              <p className="mt-1 text-sm text-slate-500">Fuel & Maintenance cost registration and records</p>
            </div>
            <button
              type="button"
              onClick={() => router.push('/fleet/manager/cost-report')}
              className="inline-flex items-center gap-2 rounded-lg bg-[#135a98] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0f4e84]"
            >
              <BarChart3 className="h-4 w-4" />
              የወጪ ሪፖርት
            </button>
          </div>
        </div>

        {/* Kind tabs */}
        <div className="mb-6 flex gap-2">
          {(Object.keys(KIND_META) as CostKind[]).map((kind) => {
            const meta = KIND_META[kind]
            const Icon = meta.icon
            const isActive = activeKind === kind
            return (
              <button
                key={kind}
                type="button"
                onClick={() => setActiveKind(kind)}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-[#135a98] text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-4 w-4" />
                {meta.title}
              </button>
            )
          })}
        </div>

        {/* Summary containers */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                <Fuel className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">የነዳጅ ማጠቃለያ</h3>
                <p className="text-xs text-slate-500">Fuel summary</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 p-6">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500">ጠቅላላ መዝገቦች</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {activeKind === 'fuel' ? filteredCosts.length : '—'}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500">ጠቅላላ ወጪ</p>
                <p className="mt-1 text-2xl font-bold text-rose-600">
                  {activeKind === 'fuel' ? totalAmount.toLocaleString('en-US') : '—'}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500">ልዩ መኪኖች</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {activeKind === 'fuel' ? distinctVehicleCount : '—'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <Wrench className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">የጥገና ወጪ ሁኔታ</h3>
                <p className="text-xs text-slate-500">Maintenance cost status</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 p-6">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500">የጥገና ወጪ መዝገቦች</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {activeKind === 'maintenance' ? filteredCosts.length : '—'}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500">ጠቅላላ ወጪ</p>
                <p className="mt-1 text-2xl font-bold text-amber-600">
                  {activeKind === 'maintenance' ? totalAmount.toLocaleString('en-US') : '—'}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500">ልዩ መኪኖች</p>
                <p className="mt-1 text-2xl font-bold text-indigo-600">
                  {activeKind === 'maintenance' ? distinctVehicleCount : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Form + Table for active kind */}
        {renderForm(activeKind)}
        <div className="mt-6">{renderTable()}</div>
      </div>
    </div>
  )
}
