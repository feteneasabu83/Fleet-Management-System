'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  PageOrientation,
  BorderStyle,
} from 'docx'

interface VehicleRow {
  id: string
  plate?: string | null
  make?: string | null
  model?: string | null
  // From vehicle registration form: "ተሽከርካሪዉ በሊትር የሚሸፍነዉ ኪሜ"
  kmPerLiter?: number | null
}

interface TripHistoryItem {
  id: string
  fleetRequestId?: number | null
  vehicleId?: string | null
  date?: string | null
  odometerKmDiff?: number | null
  returnOdometerKm?: number | null
  vehiclePlate?: string | null
  vehicle?: {
    plate?: string | null
  } | null
}

interface FuelRequest {
  id: string
  vehicleId: string
  date: string
  odometer: number
  amount: number
  amountType: "LITER" | "COUPON" | "CASH"
  notes?: string | null
  status?: string | null
  vehicle?: {
    plate?: string | null
    make?: string | null
    model?: string | null
  } | null
}

interface FleetCostRow {
  id: string
  date: string
  amount: number
  currency: string
  category: string | null
  vehicle?: {
    plate?: string | null
  } | null
}

interface ReportRow {
  plate: string
  fuelLiters: string
  distanceKm: string
  avgKmPerLiter: string
  fuelCost: string
  brakeOilLiters: string
  brakeOilCost: string
  motorOilLiters: string
  motorOilCost: string
  maintenanceCost: string
  costPerKm: string
  totalCost: string
  remarks: string
}

export default function FleetManagerReportsPage() {
  const [items, setItems] = useState<FuelRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [costs, setCosts] = useState<FleetCostRow[]>([])
  const [loadingCosts, setLoadingCosts] = useState(false)
  const [vehicles, setVehicles] = useState<VehicleRow[]>([])
  const [tripHistory, setTripHistory] = useState<TripHistoryItem[]>([])
  const [range, setRange] = useState<'daily' | 'weekly' | 'monthly' | 'yearly' | 'all'>('monthly')
  const [search, setSearch] = useState('')
  const [exportFormat, setExportFormat] = React.useState<'excel' | 'word' | 'pdf'>('excel')
  const tableRef = useRef<HTMLTableElement | null>(null)

  const downloadBlob = (content: string, mime: string, filename: string) => {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleExport = () => {
    if (exportFormat === 'excel') return exportAsExcel()
    if (exportFormat === 'word') return exportAsWord()
    if (exportFormat === 'pdf') return exportAsPDF()
  }

  // Build a fully-styled standalone HTML document so PDF/Word/Excel
  // all render the table with borders, header and totals row.
  const buildReportDocument = () => {
    if (!tableRef.current) return ''
    const tableHtml = tableRef.current.outerHTML
    const generatedAt = new Date().toLocaleString('en-GB')
    return `<!DOCTYPE html><html><head><meta charset="UTF-8" />
      <title>Fleet Report — ${rangeLabel}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: 11px; margin: 24px; }
        .rpt-header { border-bottom: 3px solid #135a98; padding-bottom: 10px; margin-bottom: 14px; }
        .rpt-header h1 { font-size: 18px; color: #135a98; margin: 0 0 4px; }
        .rpt-header .sub { font-size: 11px; color: #64748b; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #94a3b8; padding: 5px 7px; font-size: 10px; text-align: left; }
        thead th { background: #e8eef5; font-weight: 700; white-space: nowrap; }
        tbody tr:nth-child(even) { background: #f8fafc; }
        tfoot td { background: #e2e8f0; font-weight: 700; }
        .num { text-align: center; }
        @page { size: A4 landscape; margin: 12mm;
          @bottom-center { content: "Page " counter(page) " of " counter(pages); font-size: 9px; color: #666; } }
      </style></head><body>
      <div class="rpt-header">
        <h1>የመኪናዎች ጠቅላላ ሪፖርት — Fleet Report</h1>
        <div class="sub">Period: ${rangeLabel} &nbsp;|&nbsp; Generated: ${generatedAt}</div>
      </div>
      ${tableHtml}
      </body></html>`
  }

  const exportAsExcel = () => {
    const html = buildReportDocument()
    if (!html) return
    downloadBlob(html, 'application/vnd.ms-excel', `fleet-report-${range}.xls`)
  }

  const exportAsWord = async () => {
    const border = { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' }
    const cellBorders = { top: border, bottom: border, left: border, right: border }
    const headerCell = (text: string) =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 16 })] })],
        shading: { fill: 'E8EEF5' },
        borders: cellBorders,
      })
    const dataCell = (text: string | number) =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: String(text ?? ''), size: 16 })] })],
        borders: cellBorders,
      })

    const headers = [
      '#', 'የመኪና ፕሌት', 'ነዳጅ (ሊትር)', 'ኪ.ሜ', 'ኪ.ሜ/ሊትር',
      'የነዳጅ ወጪ', 'ፍሬን ዘይት (ሊትር)', 'ፍሬን ወጪ',
      'ሞተር ዘይት (ሊትር)', 'ሞተር ወጪ', 'ጥገና ወጪ',
      'ወጪ/ኪ.ሜ', 'ጠቅላላ ወጪ', 'ምርመራ',
    ]
    const bodyRows = filteredRows.map((r, i) => [
      i + 1, r.plate, r.fuelLiters || '—', r.distanceKm || '—', r.avgKmPerLiter || '—',
      r.fuelCost || '—', r.brakeOilLiters || '—', r.brakeOilCost || '—',
      r.motorOilLiters || '—', r.motorOilCost || '—',
      r.maintenanceCost || '—', r.costPerKm || '—', r.totalCost || '—', r.remarks || '—',
    ])
    const totalRow = [
      '', 'ጠቅላላ', fmtNum(totals.fuelLiters), fmtNum(totals.distanceKm), '',
      fmtNum(totals.fuelCost), '—', '—', '—', '—',
      fmtNum(totals.maintenanceCost), '—', fmtNum(totals.totalCost), '',
    ]

    const doc = new Document({
      sections: [{
        properties: { page: { size: { orientation: PageOrientation.LANDSCAPE } } },
        children: [
          new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, children: [new TextRun('የመኪናዎች ጠቅላላ ሪፖርት — Fleet Report')] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Period: ${rangeLabel}   |   Generated: ${new Date().toLocaleString('en-GB')}`, italics: true, size: 20, color: '64748B' })] }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({ tableHeader: true, children: headers.map(headerCell) }),
              ...bodyRows.map((r) => new TableRow({ children: r.map(dataCell) })),
              new TableRow({ children: totalRow.map((c) => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: String(c ?? ''), bold: true, size: 16 })] })],
                shading: { fill: 'E2E8F0' },
                borders: cellBorders,
              })) }),
            ],
          }),
        ],
      }],
    })

    const blob = await Packer.toBlob(doc)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fleet-report-${range}.docx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const exportAsPDF = () => {
    const html = buildReportDocument()
    if (!html) return
    const win = window.open('', '_blank', 'width=1280,height=900')
    if (!win) return
    win.document.open()
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
  }

  // Load manager fuel requests once on mount
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)

        const token =
          typeof window !== 'undefined'
            ? window.localStorage.getItem('accessToken') ||
              window.localStorage.getItem('jwt') ||
              window.localStorage.getItem('token')
            : null

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/fleet/manager/fuel-requests`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })

        if (!res.ok) {
          throw new Error(`Failed to load fuel requests (${res.status})`)
        }

        const data = await res.json().catch(() => ({}))
        const arr = (data?.data || data?.items || data) as any
        setItems(Array.isArray(arr) ? (arr as FuelRequest[]) : [])

        // Also load all registered vehicles so that the report table shows
        // every vehicle, even if it has no fuel/cost activity in the period.
        try {
          // Use the generic vehicles listing endpoint (no filters) which
          // returns all vehicles, instead of /vehicles/all which may not
          // be implemented consistently on the backend.
          const vehRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/fleet/vehicles`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          })
          const vehJson = await vehRes.json().catch(() => ({} as any))
          const vehArr = (vehJson?.data || vehJson?.items || vehJson) as any
          const list: VehicleRow[] = Array.isArray(vehArr) ? vehArr : []
          setVehicles(list)
        } catch (vehErr) {
          console.error('Error loading vehicles for manager reports:', vehErr)
          setVehicles([])
        }
      } catch (e: any) {
        console.error('Error loading fuel requests for reports:', e)
        setError(e?.message || 'Failed to load fuel requests')
        setItems([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  // Load fleet cost registrations so fuel cost column matches finance view
  useEffect(() => {
    const loadCosts = async () => {
      try {
        setLoadingCosts(true)

        const token =
          typeof window !== 'undefined'
            ? window.localStorage.getItem('accessToken') ||
              window.localStorage.getItem('jwt') ||
              window.localStorage.getItem('token')
            : null

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/fleet/costs`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })

        if (!res.ok) {
          throw new Error(`Failed to load fleet costs (${res.status})`)
        }

        const data = await res.json().catch(() => ({}))
        const arr = (data?.data || data?.items || data) as any
        setCosts(Array.isArray(arr) ? (arr as FleetCostRow[]) : [])
      } catch (e) {
        console.error('Error loading fleet costs for manager reports:', e)
        setCosts([])
      } finally {
        setLoadingCosts(false)
      }
    }

    loadCosts()
  }, [])

  // Load trip history for managers so distance is computed from completed trips
  useEffect(() => {
    const loadTripHistory = async () => {
      try {
        const token =
          typeof window !== 'undefined'
            ? window.localStorage.getItem('accessToken') ||
              window.localStorage.getItem('jwt') ||
              window.localStorage.getItem('token')
            : null

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/fleet/trip-history/manager/all`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })

        if (!res.ok) {
          console.error('Failed to load trip history for manager reports', res.status)
          setTripHistory([])
          return
        }

        const data = await res.json().catch(() => ({} as any))
        const arr = (data?.data || data?.items || data) as any
        const list: TripHistoryItem[] = Array.isArray(arr) ? arr : []
        setTripHistory(list)
      } catch (e) {
        console.error('Error loading trip history for manager reports:', e)
        setTripHistory([])
      }
    }

    loadTripHistory()
  }, [])

  // Build per-vehicle aggregates for the selected range (weekly/monthly/yearly/all).
  // We no longer require fuel requests to exist; rows are built from any
  // combination of fuel requests, costs, trip history, or registered vehicles.
  const rows: ReportRow[] = useMemo(() => {
    const now = new Date()

    let rangeStart: Date | null = null
    let rangeEnd: Date | null = null

    if (range === 'daily') {
      // Today only
      rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
      rangeEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    } else if (range === 'monthly') {
      rangeStart = new Date(now.getFullYear(), now.getMonth(), 1)
      rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    } else if (range === 'weekly') {
      const dayOfWeek = now.getDay() // 0 = Sunday
      rangeStart = new Date(now)
      rangeStart.setDate(now.getDate() - dayOfWeek)
      rangeStart.setHours(0, 0, 0, 0)

      rangeEnd = new Date(rangeStart)
      rangeEnd.setDate(rangeStart.getDate() + 6)
      rangeEnd.setHours(23, 59, 59, 999)
    } else if (range === 'yearly') {
      rangeStart = new Date(now.getFullYear(), 0, 1)
      rangeEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
    } else if (range === 'all') {
      rangeStart = null
      rangeEnd = null
    }

    const byPlate = new Map<
      string,
      {
        liters: number
      }
    >()

    // For monthly total km we want the latest cumulative odometer reading per
    // vehicle (returnOdometerKm), not the sum of per-trip distances.
    const kmByPlate = new Map<string, { value: number; ts: number }>()

    const fuelCostByPlate = new Map<string, number>()
    const maintenanceCostByPlate = new Map<string, number>()

    // Per-vehicle configured km-per-liter, keyed by plate, coming from the
    // registration form field "ተሽከርካሪዉ በሊትር የሚሸፍነዉ ኪሜ" (kmPerLiter).
    const kmPerLiterByPlate = new Map<string, number>()

    ;(vehicles || []).forEach(v => {
      if (!v) return
      const anyV: any = v
      const rawPlate = (v.plate || anyV.licensePlate || '').trim()
      if (!rawPlate) return

      const rawKmPerLiter = anyV.kmPerLiter ?? anyV.km_per_liter
      const value = Number(rawKmPerLiter)
      if (!Number.isNaN(value) && value > 0) {
        kmPerLiterByPlate.set(rawPlate, value)
      }
    })

    items.forEach(req => {
      if (!req?.date) return
      const d = new Date(req.date)
      if (isNaN(d.getTime())) return
      if (rangeStart && d < rangeStart) return
      if (rangeEnd && d > rangeEnd) return

      const status = String(req?.status || '').toUpperCase()
      if (status !== 'FUELED' && status !== 'HALF_FUELED') return

      const plate = (req.vehicle?.plate || req.vehicleId || '').trim()
      if (!plate) return

      const current = byPlate.get(plate) || { liters: 0 }

      const amountVal = Number(req.amount)
      if (!isNaN(amountVal)) {
        current.liters += amountVal
      }

      byPlate.set(plate, current)
    })

    // From trip history, compute for each plate the maximum cumulative
    // returnOdometerKm recorded for that vehicle across ALL history. If the
    // history row does not carry a plate string, we try to resolve it from the
    // loaded vehicles list using vehicleId so that rows with null plates still
    // contribute (this is important for cases like bigvcar-124).
    ;(tripHistory || []).forEach((h: TripHistoryItem) => {
      if (!h) return

      let plate = (h.vehiclePlate || h.vehicle?.plate || '')?.trim() || ''

      if (!plate && h.vehicleId) {
        const match = (vehicles || []).find(v => {
          const anyV: any = v
          return anyV?.id === h.vehicleId
        })
        if (match) {
          const anyM: any = match
          plate = String((anyM.plate || anyM.licensePlate || '')).trim()
        }
      }

      plate = String(plate || '').trim()
      if (!plate) return

      const kmRaw = (h as any).returnOdometerKm
      const kmVal = Number(kmRaw)
      if (Number.isNaN(kmVal)) return

      const existing = kmByPlate.get(plate)
      if (!existing || kmVal > existing.value) {
        // timestamp is optional here; we keep it for completeness but we
        // primarily compare by value.
        const d = h?.date ? new Date(h.date as any) : null
        const ts = d && !Number.isNaN(d.getTime()) ? d.getTime() : 0
        kmByPlate.set(plate, { value: kmVal, ts })
      }
    })

    // Aggregate Fuel & Energy and Maintenance & Repairs costs per vehicle for the same month
    costs.forEach(cost => {
      if (!cost?.date) return
      const d = new Date(cost.date)
      if (isNaN(d.getTime())) return
      if (rangeStart && d < rangeStart) return
      if (rangeEnd && d > rangeEnd) return

      const plate = (cost.vehicle?.plate || '').trim()
      if (!plate) return

      const amountVal = Number(cost.amount)
      if (!isNaN(amountVal)) {
        if ((cost.category || '') === 'Fuel & Energy') {
          fuelCostByPlate.set(plate, (fuelCostByPlate.get(plate) || 0) + amountVal)
        } else if ((cost.category || '') === 'Maintenance & Repairs') {
          maintenanceCostByPlate.set(plate, (maintenanceCostByPlate.get(plate) || 0) + amountVal)
        }
      }
    })

    const result: ReportRow[] = []

    // Include plates from:
    // - vehicles with fuel activity (byPlate)
    // - vehicles with cost activity (fuelCostByPlate)
    // - all registered vehicles list (vehicles state)
    const vehiclePlates = (vehicles || [])
      .map(v => {
        const anyV = v as any
        const rawPlate = v.plate || anyV.licensePlate || ''
        return String(rawPlate || '').trim()
      })
      .filter(p => p.length > 0)

    if (process.env.NODE_ENV !== 'production') {
      console.log('Manager reports vehicles sample:', (vehicles || []).slice(0, 5))
      console.log('Manager reports derived vehiclePlates:', vehiclePlates)
    }

    const allPlates = new Set<string>([
      ...byPlate.keys(),
      ...fuelCostByPlate.keys(),
      ...kmByPlate.keys(),
      ...vehiclePlates,
    ])

    allPlates.forEach(plate => {
      const agg = byPlate.get(plate) || { liters: 0 }
      const liters = agg.liters
      const kmEntry = kmByPlate.get(plate)
      const km = kmEntry ? kmEntry.value : 0
      const fuelCost = fuelCostByPlate.get(plate) || 0
      const maintenanceCost = maintenanceCostByPlate.get(plate) || 0
      const totalCost = fuelCost + maintenanceCost

      // Prefer the configured kmPerLiter from vehicle registration; if missing,
      // fall back to the computed km/liters average.
      const configuredKmPerLiter = kmPerLiterByPlate.get(plate)
      let avgKmPerLiter = ''
      if (typeof configuredKmPerLiter === 'number' && !Number.isNaN(configuredKmPerLiter) && configuredKmPerLiter > 0) {
        avgKmPerLiter = String(configuredKmPerLiter)
      } else if (liters > 0) {
        avgKmPerLiter = (km / liters).toFixed(1)
      }

      result.push({
        plate,
        // በወር ውስጥ የተቀዳ ነዳጅ በሊትር -> sum of amount
        fuelLiters: liters ? String(liters) : '',
        // በወር ውስጥ የተጓዘዉ ጠቅላላ ኪ.ሜ -> latest cumulative odometer
        distanceKm: km ? String(km) : '',
        // በአማካኝ በሊትር የተጓዘዉ ኪ.ሜ -> configured or computed average
        avgKmPerLiter,
        // የተቀዳለት ጠቅላላ የነዳጅ ዋጋ በብር -> monthly Fuel & Energy cost
        fuelCost: fuelCost
          ? Number(fuelCost).toLocaleString('en-US', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            })
          : '',
        brakeOilLiters: '',
        brakeOilCost: '',
        motorOilLiters: '',
        motorOilCost: '',
        // የተሽከርካሪው የጥገና ወጪ በብር -> monthly Maintenance & Repairs cost
        maintenanceCost: maintenanceCost
          ? Number(maintenanceCost).toLocaleString('en-US', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            })
          : '',
        costPerKm: '',
        // የወሩ ጠቅላላ ወጪ በብር -> fuel + maintenance costs
        totalCost: totalCost
          ? Number(totalCost).toLocaleString('en-US', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            })
          : '',
        remarks: '',
      })
    })

    // Sort rows by plate for stable output
    result.sort((a, b) => a.plate.localeCompare(b.plate))
    return result
  }, [items, costs, vehicles, range, tripHistory])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.plate.toLowerCase().includes(q))
  }, [rows, search])

  const totals = useMemo(() => {
    let fuelLiters = 0
    let distanceKm = 0
    let fuelCost = 0
    let maintenanceCost = 0
    let totalCost = 0
    filteredRows.forEach((r) => {
      fuelLiters += Number(r.fuelLiters) || 0
      distanceKm += Number(r.distanceKm) || 0
      fuelCost += Number(String(r.fuelCost).replace(/,/g, '')) || 0
      maintenanceCost += Number(String(r.maintenanceCost).replace(/,/g, '')) || 0
      totalCost += Number(String(r.totalCost).replace(/,/g, '')) || 0
    })
    return { fuelLiters, distanceKm, fuelCost, maintenanceCost, totalCost }
  }, [filteredRows])

  const rangeLabel =
    range === 'daily' ? 'ዕለታዊ' :
    range === 'weekly' ? 'ሳምንታዊ' :
    range === 'monthly' ? 'ወርሃዊ' :
    range === 'yearly' ? 'ዓመታዊ' : 'ሁሉም ጊዜያት'

  const fmtNum = (n: number) => n.toLocaleString('en-US')

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="mb-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            ← ተመለስ
          </button>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">ጠቅላላ ሪፖርት</h1>
              <p className="mt-1 text-sm text-slate-500">
                የመኪናዎች ጠቅላላ ሪፖርት — ነዳጅ፣ የመንገድ ርቀት እና ወጪዎች ({rangeLabel})
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={range}
                onChange={e => setRange(e.target.value as any)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
              >
                <option value="daily">ዕለታዊ</option>
                <option value="weekly">ሳምንታዊ</option>
                <option value="monthly">ወርሃዊ</option>
                <option value="yearly">ዓመታዊ</option>
                <option value="all">ሁሉም</option>
              </select>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ፕሌት ቁጥር ፈልግ..."
                className="w-44 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'excel' | 'word' | 'pdf')}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
              >
                <option value="excel">Excel</option>
                <option value="word">Word</option>
                <option value="pdf">PDF</option>
              </select>
              <button
                type="button"
                onClick={handleExport}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                አውርድ
              </button>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">መኪናዎች</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{filteredRows.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">ጠቅላላ ነዳጅ (ሊትር)</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{fmtNum(totals.fuelLiters)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">ጠቅላላ ኪ.ሜ</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{fmtNum(totals.distanceKm)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">የነዳጅ ወጪ</p>
            <p className="mt-1 text-2xl font-bold text-rose-600">{fmtNum(totals.fuelCost)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">ጠቅላላ ወጪ</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{fmtNum(totals.totalCost)}</p>
          </div>
        </div>

        {/* Report table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table ref={tableRef} className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">#</th>
                  <th className="px-3 py-3">የመኪና ፕሌት</th>
                  <th className="px-3 py-3 text-center">የተቀዳ ነዳጅ (ሊትር)</th>
                  <th className="px-3 py-3 text-center">የተጓዘ ኪ.ሜ</th>
                  <th className="px-3 py-3 text-center">ኪ.ሜ / ሊትር</th>
                  <th className="px-3 py-3 text-center">የነዳጅ ወጪ (ብር)</th>
                  <th className="px-3 py-3 text-center">የፍሬን ዘይት (ሊትር)</th>
                  <th className="px-3 py-3 text-center">የፍሬን ዘይት ዋጋ (ብር)</th>
                  <th className="px-3 py-3 text-center">የሞተር ዘይት (ሊትር)</th>
                  <th className="px-3 py-3 text-center">የሞተር ዘይት ዋጋ (ብር)</th>
                  <th className="px-3 py-3 text-center">የጥገና ወጪ (ብር)</th>
                  <th className="px-3 py-3 text-center">ወጪ በኪ.ሜ (ብር)</th>
                  <th className="px-3 py-3 text-center">ጠቅላላ ወጪ (ብር)</th>
                  <th className="px-3 py-3">ምርመራ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading || loadingCosts ? (
                  <tr>
                    <td colSpan={14} className="px-4 py-8 text-center text-slate-500">
                      በመጫን ላይ...
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="px-4 py-8 text-center text-slate-500">
                      ምንም መረጃ የለም
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row: ReportRow, idx: number) => (
                    <tr key={row.plate + idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                      <td className="px-3 py-2.5 text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-900 whitespace-nowrap">{row.plate}</td>
                      <td className="px-3 py-2.5 text-center">{row.fuelLiters}</td>
                      <td className="px-3 py-2.5 text-center">{row.distanceKm}</td>
                      <td className="px-3 py-2.5 text-center">{row.avgKmPerLiter}</td>
                      <td className="px-3 py-2.5 text-center text-rose-600">{row.fuelCost}</td>
                      <td className="px-3 py-2.5 text-center">{row.brakeOilLiters || '—'}</td>
                      <td className="px-3 py-2.5 text-center">{row.brakeOilCost || '—'}</td>
                      <td className="px-3 py-2.5 text-center">{row.motorOilLiters || '—'}</td>
                      <td className="px-3 py-2.5 text-center">{row.motorOilCost || '—'}</td>
                      <td className="px-3 py-2.5 text-center text-amber-600">{row.maintenanceCost}</td>
                      <td className="px-3 py-2.5 text-center">{row.costPerKm || '—'}</td>
                      <td className="px-3 py-2.5 text-center font-bold text-slate-900">{row.totalCost}</td>
                      <td className="px-3 py-2.5">{row.remarks || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {!loading && !loadingCosts && filteredRows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-100 font-bold text-slate-900">
                    <td className="px-3 py-3" colSpan={2}>ጠቅላላ</td>
                    <td className="px-3 py-3 text-center">{fmtNum(totals.fuelLiters)}</td>
                    <td className="px-3 py-3 text-center">{fmtNum(totals.distanceKm)}</td>
                    <td className="px-3 py-3" />
                    <td className="px-3 py-3 text-center text-rose-600">{fmtNum(totals.fuelCost)}</td>
                    <td className="px-3 py-3 text-center">—</td>
                    <td className="px-3 py-3 text-center">—</td>
                    <td className="px-3 py-3 text-center">—</td>
                    <td className="px-3 py-3 text-center">—</td>
                    <td className="px-3 py-3 text-center text-amber-600">{fmtNum(totals.maintenanceCost)}</td>
                    <td className="px-3 py-3 text-center">—</td>
                    <td className="px-3 py-3 text-center">{fmtNum(totals.totalCost)}</td>
                    <td className="px-3 py-3" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  )
}
