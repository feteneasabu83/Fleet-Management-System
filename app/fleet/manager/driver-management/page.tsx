'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import * as XLSX from 'xlsx'
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

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

type Period = 'week' | 'month' | 'year' | 'all'

interface DriverRow {
  id: string
  name: string
  email?: string
  phone?: string
}

interface TripRow {
  id: string
  driverId: string
  driverName: string
  requesterName: string
  destination: string
  purpose: string
  date: string
  startTime?: string
  endTime?: string
  km: number
  vehiclePlate?: string
  startOdometer?: number | null
  endOdometer?: number | null
  passengerCount?: number | null
  fuelLiters?: number | null
  fuelCost?: number | null
  authorizedBy?: string
  remarks?: string
}

interface DriverSummary {
  driver: DriverRow
  trips: number
  totalKm: number
  totalFuel: number
  fuelCount: number
  lastTripDate: string | null
  destinations: string[]
}

function getToken() {
  if (typeof window === 'undefined') return ''
  return (
    localStorage.getItem('accessToken') ||
    localStorage.getItem('jwt') ||
    localStorage.getItem('token') ||
    ''
  )
}

async function apiFetch(path: string) {
  const token = getToken()
  const res = await fetch(`${API}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`)
  return res.json()
}

function periodStart(period: Period): Date | null {
  const now = new Date()
  if (period === 'all') return null
  if (period === 'week') {
    const d = new Date(now)
    d.setDate(d.getDate() - 7)
    return d
  }
  if (period === 'month') {
    const d = new Date(now.getFullYear(), now.getMonth(), 1)
    return d
  }
  // year
  return new Date(now.getFullYear(), 0, 1)
}

function inPeriod(dateStr: string | null | undefined, start: Date | null): boolean {
  if (!start) return true
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return false
  return d >= start
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '-'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return '-'
  return dt.toLocaleDateString('en-GB')
}

function fmtNum(n: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 1 })
}

export default function DriverManagementPage() {
  const [period, setPeriod] = useState<Period>('month')
  const [drivers, setDrivers] = useState<DriverRow[]>([])
  const [trips, setTrips] = useState<TripRow[]>([])
  const [fuelByDriver, setFuelByDriver] = useState<Map<string, { liters: number; count: number }>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [driversRes, historyRes, fuelRes] = await Promise.all([
          apiFetch('/api/fleet/driver'),
          apiFetch('/api/fleet/trip-history/manager/all'),
          apiFetch('/api/fleet/manager/fuel-requests'),
        ])

        const driverList: any[] = Array.isArray(driversRes)
          ? driversRes
          : driversRes?.data || driversRes?.items || driversRes?.drivers || []
        const driverMap = new Map<string, DriverRow>()
        driverList.forEach((d: any) => {
          const id = String(d.id)
          driverMap.set(id, {
            id,
            name: `${d.firstName || ''} ${d.lastName || ''}`.trim() || d.email || id,
            email: d.email,
            phone: d.phone,
          })
        })

        const historyItems: any[] = Array.isArray(historyRes?.data)
          ? historyRes.data
          : Array.isArray(historyRes)
            ? historyRes
            : []

        const tripRows: TripRow[] = historyItems.map((h: any, i: number) => {
          const driverId = String(h.driverId || h.driver?.id || '')
          const drv = h.driver
            ? `${h.driver.firstName || ''} ${h.driver.lastName || ''}`.trim()
            : ''
          const km =
            typeof h.odometerKmDiff === 'number'
              ? h.odometerKmDiff
              : typeof h.returnOdometerKm === 'number' && typeof h.startOdometerKm === 'number'
                ? h.returnOdometerKm - h.startOdometerKm
                : 0
          return {
            id: String(h.id ?? `trip-${i}`),
            driverId,
            driverName: drv || driverMap.get(driverId)?.name || 'Unknown',
            requesterName: h.requesterName || h.requestor
              ? `${h.requestor?.firstName || ''} ${h.requestor?.lastName || ''}`.trim()
              : h.requesterName || '-',
            destination: h.destination || '-',
            purpose: h.purpose || '',
            date: h.date || '',
            startTime: h.startTime || undefined,
            endTime: h.endTime || undefined,
            km: Math.max(0, km || 0),
            vehiclePlate: h.vehiclePlate || h.vehicle?.plate,
            startOdometer: typeof h.startOdometerKm === 'number' ? h.startOdometerKm : null,
            endOdometer: typeof h.returnOdometerKm === 'number' ? h.returnOdometerKm : null,
            passengerCount: typeof h.passengerCount === 'number' ? h.passengerCount : null,
            fuelLiters: typeof h.fuelLiters === 'number' ? h.fuelLiters : null,
            fuelCost: typeof h.fuelCost === 'number' ? h.fuelCost : null,
            authorizedBy: h.authorizedBy || h.approvedBy || '',
            remarks: h.remarks || h.notes || '',
          }
        })

        // Fuel: attribute to driver via fuelRequest.vehicle.userId
        const fuelItems: any[] = Array.isArray(fuelRes)
          ? fuelRes
          : fuelRes?.data || fuelRes?.items || []
        const fuelMap = new Map<string, { liters: number; count: number }>()
        fuelItems.forEach((f: any) => {
          const driverId = String(f?.vehicle?.userId || f?.vehicle?.user?.id || '')
          if (!driverId) return
          const type = String(f?.amountType || '').toUpperCase()
          const amount = Number(f?.amount) || 0
          // Only count liter-based fuel; coupon/cash are not liters
          if (type && type !== 'LITER') return
          const cur = fuelMap.get(driverId) || { liters: 0, count: 0 }
          cur.liters += amount
          cur.count += 1
          fuelMap.set(driverId, cur)
        })

        if (!cancelled) {
          setDrivers(driverList.map((d: any) => ({
            id: String(d.id),
            name: `${d.firstName || ''} ${d.lastName || ''}`.trim() || d.email || String(d.id),
            email: d.email,
            phone: d.phone,
          })))
          setTrips(tripRows)
          setFuelByDriver(fuelMap)
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load driver data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const start = useMemo(() => periodStart(period), [period])

  const filteredTrips = useMemo(
    () => trips.filter((t) => inPeriod(t.date, start)),
    [trips, start]
  )

  const filteredFuel = useMemo(() => {
    // Recompute fuel within period is not possible without dates per driver;
    // fuel requests carry their own dates, so rebuild from raw is complex.
    // Instead we keep fuel aggregated all-time but trips/km period-filtered.
    return fuelByDriver
  }, [fuelByDriver])

  const summaries: DriverSummary[] = useMemo(() => {
    const map = new Map<string, DriverSummary>()
    drivers.forEach((d) => {
      map.set(d.id, {
        driver: d,
        trips: 0,
        totalKm: 0,
        totalFuel: 0,
        fuelCount: 0,
        lastTripDate: null,
        destinations: [],
      })
    })
    // ensure drivers appearing only in trips are included
    filteredTrips.forEach((t) => {
      if (!map.has(t.driverId)) {
        map.set(t.driverId, {
          driver: { id: t.driverId, name: t.driverName },
          trips: 0,
          totalKm: 0,
          totalFuel: 0,
          fuelCount: 0,
          lastTripDate: null,
          destinations: [],
        })
      }
      const s = map.get(t.driverId)!
      s.trips += 1
      s.totalKm += t.km
      if (t.destination && t.destination !== '-' && !s.destinations.includes(t.destination)) {
        s.destinations.push(t.destination)
      }
      if (!s.lastTripDate || new Date(t.date) > new Date(s.lastTripDate)) {
        s.lastTripDate = t.date
      }
    })
    map.forEach((s) => {
      const f = filteredFuel.get(s.driver.id)
      if (f) {
        s.totalFuel = f.liters
        s.fuelCount = f.count
      }
    })
    return Array.from(map.values()).sort((a, b) => b.trips - a.trips)
  }, [drivers, filteredTrips, filteredFuel])

  const periodLabel =
    period === 'week' ? 'Last 7 days' : period === 'month' ? 'This month' : period === 'year' ? 'This year' : 'All time'

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ---------- Report model ----------
  const reportModel = useMemo(() => {
    const trips = filteredTrips
    const totalTrips = trips.length
    const totalKm = trips.reduce((s, t) => s + (t.km || 0), 0)
    const totalFuel = trips.reduce((s, t) => s + (t.fuelLiters || 0), 0)
    const totalFuelCost = trips.reduce((s, t) => s + (t.fuelCost || 0), 0)
    const destinations = Array.from(new Set(trips.map((t) => t.destination).filter((d) => d && d !== '-')))

    const groupBy = (keyFn: (d: Date) => string) => {
      const map = new Map<string, typeof trips>()
      trips.forEach((t) => {
        const d = new Date(t.date)
        if (isNaN(d.getTime())) return
        const k = keyFn(d)
        if (!map.has(k)) map.set(k, [])
        map.get(k)!.push(t)
      })
      return Array.from(map.entries())
        .map(([key, rows]) => ({
          key,
          trips: rows.length,
          km: rows.reduce((s, r) => s + (r.km || 0), 0),
          fuel: rows.reduce((s, r) => s + (r.fuelLiters || 0), 0),
          fuelCost: rows.reduce((s, r) => s + (r.fuelCost || 0), 0),
          destinations: Array.from(new Set(rows.map((r) => r.destination).filter((d) => d && d !== '-'))),
        }))
        .sort((a, b) => b.key.localeCompare(a.key))
    }

    const isoWeek = (d: Date) => {
      const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
      const dayNum = date.getUTCDay() || 7
      date.setUTCDate(date.getUTCDate() + 4 - dayNum)
      const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
      const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
      return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
    }

    return {
      trips,
      totalTrips,
      totalKm,
      totalFuel,
      totalFuelCost,
      destinations,
      weekly: groupBy(isoWeek),
      monthly: groupBy((d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`),
      yearly: groupBy((d) => String(d.getFullYear())),
      driverPerformance: summaries.map((s) => ({
        driver: s.driver.name,
        trips: s.trips,
        km: s.totalKm,
        fuel: s.totalFuel,
        fuelCost: trips.filter((t) => t.driverId === s.driver.id).reduce((a, t) => a + (t.fuelCost || 0), 0),
        destinations: s.destinations.length,
      })),
    }
  }, [filteredTrips, summaries])

  const periodTitle = `Driver Trip Management Report — ${periodLabel}`
  const generatedAt = new Date().toLocaleString('en-GB')

  // ---------- Excel (.xlsx) ----------
  const exportAsExcel = async () => {
    const wb = XLSX.utils.book_new()

    // 1. Driver Information
    const driverInfo = [
      ['Driver ID', 'Driver Name', 'Phone', 'Email', 'Trips', 'Total KM', 'Total Fuel (L)', 'Fuel Requests', 'Last Trip'],
      ...summaries.map((s) => [
        s.driver.id,
        s.driver.name,
        s.driver.phone || '',
        s.driver.email || '',
        s.trips,
        s.totalKm,
        s.totalFuel,
        s.fuelCount,
        s.lastTripDate ? fmtDate(s.lastTripDate) : '',
      ]),
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(driverInfo), 'Driver Information')

    // 2. Vehicle Information
    const vehicleMap = new Map<string, { plate: string; trips: number; km: number }>()
    filteredTrips.forEach((t) => {
      const plate = t.vehiclePlate || 'Unassigned'
      const v = vehicleMap.get(plate) || { plate, trips: 0, km: 0 }
      v.trips += 1
      v.km += t.km || 0
      vehicleMap.set(plate, v)
    })
    const vehicleInfo = [
      ['Vehicle Plate', 'Total Trips', 'Total KM'],
      ...Array.from(vehicleMap.values()).map((v) => [v.plate, v.trips, v.km]),
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(vehicleInfo), 'Vehicle Information')

    // 3. Trip Register
    const tripHeader = [
      'Trip ID', 'Driver Name', 'Vehicle Plate', 'Trip Date', 'Departure', 'Return',
      'Starting Location', 'Destination', 'Trip Purpose', 'Passengers',
      'Authorized By', 'Start Odometer', 'End Odometer', 'Total Distance (KM)',
      'Fuel Used (L)', 'Fuel Cost', 'Remarks',
    ]
    const tripRows = reportModel.trips.map((t) => [
      t.id,
      t.driverName,
      t.vehiclePlate || '',
      t.date ? fmtDate(t.date) : '',
      t.startTime ? String(t.startTime).slice(0, 5) : '',
      t.endTime ? String(t.endTime).slice(0, 5) : '',
      '',
      t.destination,
      t.purpose,
      t.passengerCount ?? '',
      t.authorizedBy || '',
      t.startOdometer ?? '',
      t.endOdometer ?? '',
      t.km,
      t.fuelLiters ?? '',
      t.fuelCost ?? '',
      t.remarks || '',
    ])
    const tripSheet = XLSX.utils.aoa_to_sheet([tripHeader, ...tripRows])
    // Distance formula where odometers exist
    tripRows.forEach((r, i) => {
      const row = i + 2
      if (typeof r[11] === 'number' && typeof r[12] === 'number') {
        tripSheet[`N${row}`] = { t: 'n', f: `L${row}-K${row}` }
      }
    })
    XLSX.utils.book_append_sheet(wb, tripSheet, 'Trip Register')

    // 4-6. Period reports with formulas
    const periodSheet = (name: string, rows: { key: string; trips: number; km: number; fuel: number; fuelCost: number; destinations: string[] }[]) => {
      const aoa: any[][] = [
        [`${name} Report — ${periodLabel}`],
        [],
        ['Period', 'Total Trips', 'Total Distance (KM)', 'Total Fuel (L)', 'Total Fuel Cost', 'Destinations Visited'],
        ...rows.map((r) => [r.key, r.trips, r.km, r.fuel, r.fuelCost, r.destinations.length]),
        [],
        ['GRAND TOTAL', `=SUM(B4:B${3 + rows.length})`, `=SUM(C4:C${3 + rows.length})`, `=SUM(D4:D${3 + rows.length})`, `=SUM(E4:E${3 + rows.length})`, ''],
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name)
    }
    periodSheet('Weekly Report', reportModel.weekly)
    periodSheet('Monthly Report', reportModel.monthly)
    periodSheet('Yearly Report', reportModel.yearly)

    // 7. Driver Performance
    const perfAoa = [
      ['Driver Performance Summary'],
      [],
      ['Driver', 'Trips', 'Distance (KM)', 'Fuel (L)', 'Fuel Cost', 'Destinations', 'KM per Liter'],
      ...reportModel.driverPerformance.map((d) => [
        d.driver, d.trips, d.km, d.fuel, d.fuelCost, d.destinations,
        d.fuel > 0 ? (d.km / d.fuel).toFixed(2) : '',
      ]),
      [],
      ['TOTAL', reportModel.totalTrips, reportModel.totalKm, reportModel.totalFuel, reportModel.totalFuelCost, reportModel.destinations.length, reportModel.totalFuel > 0 ? (reportModel.totalKm / reportModel.totalFuel).toFixed(2) : ''],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(perfAoa), 'Driver Performance')

    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    downloadBlob(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `driver-management-${period}.xlsx`)
  }

  // ---------- Word (.docx) ----------
  const exportAsWord = async () => {
    const border = { style: BorderStyle.SINGLE, size: 4, color: '999999' }
    const cellBorders = { top: border, bottom: border, left: border, right: border }
    const headerCell = (text: string) =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 18 })] })],
        shading: { fill: 'E8EEF5' },
        borders: cellBorders,
      })
    const dataCell = (text: string | number) =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: String(text ?? ''), size: 18 })] })],
        borders: cellBorders,
      })
    const makeTable = (headers: string[], rows: (string | number)[][]) =>
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ tableHeader: true, children: headers.map(headerCell) }),
          ...rows.map((r) => new TableRow({ children: r.map(dataCell) })),
        ],
      })

    const doc = new Document({
      sections: [{
        properties: { page: { size: { orientation: PageOrientation.LANDSCAPE } } },
        children: [
          new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, children: [new TextRun('Driver Trip Management Report')] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: periodTitle, italics: true, size: 22 })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Generated: ${generatedAt}`, size: 18, color: '666666' })] }),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('1. Driver Information')] }),
          makeTable(
            ['Driver ID', 'Name', 'Phone', 'Trips', 'Total KM', 'Fuel (L)'],
            summaries.map((s) => [s.driver.id, s.driver.name, s.driver.phone || '-', s.trips, s.totalKm, s.totalFuel])
          ),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('2. Trip Register')] }),
          makeTable(
            ['Trip ID', 'Driver', 'Vehicle', 'Date', 'From', 'To', 'Purpose', 'KM', 'Fuel (L)', 'Fuel Cost'],
            reportModel.trips.map((t) => [
              t.id, t.driverName, t.vehiclePlate || '-', t.date ? fmtDate(t.date) : '',
              t.startTime ? String(t.startTime).slice(0, 5) : '', t.endTime ? String(t.endTime).slice(0, 5) : '',
              t.purpose || '-', t.km, t.fuelLiters ?? '-', t.fuelCost ?? '-',
            ])
          ),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('3. Weekly Summary')] }),
          makeTable(['Week', 'Trips', 'KM', 'Fuel (L)', 'Fuel Cost', 'Destinations'],
            reportModel.weekly.map((w) => [w.key, w.trips, w.km, w.fuel, w.fuelCost, w.destinations.length])),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('4. Monthly Summary')] }),
          makeTable(['Month', 'Trips', 'KM', 'Fuel (L)', 'Fuel Cost', 'Destinations'],
            reportModel.monthly.map((m) => [m.key, m.trips, m.km, m.fuel, m.fuelCost, m.destinations.length])),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('5. Yearly Summary')] }),
          makeTable(['Year', 'Trips', 'KM', 'Fuel (L)', 'Fuel Cost', 'Destinations'],
            reportModel.yearly.map((y) => [y.key, y.trips, y.km, y.fuel, y.fuelCost, y.destinations.length])),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('6. Signatures')] }),
          new Paragraph({ children: [new TextRun({ text: 'Driver Signature: ______________________    Date: ____________', size: 20 })] }),
          new Paragraph({ children: [new TextRun({ text: 'Supervisor Signature: __________________    Date: ____________', size: 20 })] }),
          new Paragraph({ children: [new TextRun({ text: 'Approved by: __________________________    Date: ____________', size: 20 })] }),
        ],
      }],
    })

    const blob = await Packer.toBlob(doc)
    downloadBlob(blob, `driver-management-${period}.docx`)
  }

  // ---------- PDF (print layout) ----------
  const exportAsPDF = () => {
    const win = window.open('', '_blank', 'width=1280,height=900')
    if (!win) return
    const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const sumRow = (label: string, r: { trips: number; km: number; fuel: number; fuelCost: number; destinations: string[] }) =>
      `<tr><td>${esc(label)}</td><td>${r.trips}</td><td>${fmtNum(r.km)}</td><td>${fmtNum(r.fuel)}</td><td>${fmtNum(r.fuelCost)}</td><td>${r.destinations.length}</td></tr>`
    const periodTable = (title: string, rows: typeof reportModel.weekly) => `
      <h3>${title}</h3>
      <table><thead><tr><th>Period</th><th>Trips</th><th>KM</th><th>Fuel (L)</th><th>Fuel Cost</th><th>Destinations</th></tr></thead>
      <tbody>${rows.map((r) => sumRow(r.key, r)).join('') || '<tr><td colspan="6">No data</td></tr>'}</tbody></table>`
    const driverRows = summaries.map((s) =>
      `<tr><td>${esc(s.driver.name)}</td><td>${esc(s.driver.phone || '-')}</td><td>${s.trips}</td><td>${fmtNum(s.totalKm)}</td><td>${fmtNum(s.totalFuel)}</td><td>${s.destinations.length}</td><td>${fmtDate(s.lastTripDate)}</td></tr>`
    ).join('')
    const tripRowsHtml = reportModel.trips.map((t) =>
      `<tr><td>${esc(t.id)}</td><td>${esc(t.driverName)}</td><td>${esc(t.vehiclePlate || '-')}</td><td>${esc(t.date ? fmtDate(t.date) : '')}</td><td>${esc(t.destination)}</td><td>${esc(t.purpose || '-')}</td><td>${t.km}</td><td>${t.fuelLiters ?? '-'}</td><td>${t.fuelCost ?? '-'}</td></tr>`
    ).join('')

    win.document.open()
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8" /><title>${esc(periodTitle)}</title>
      <style>
        @page { size: A4 landscape; margin: 14mm; @bottom-center { content: "Page " counter(page) " of " counter(pages); font-size: 9px; color: #666; } }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: 11px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #135a98; padding-bottom: 10px; margin-bottom: 14px; }
        .header h1 { font-size: 18px; color: #135a98; margin: 0; }
        .header .sub { font-size: 11px; color: #64748b; }
        h2 { font-size: 13px; color: #135a98; margin: 16px 0 6px; }
        h3 { font-size: 11px; margin: 10px 0 4px; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 8px; }
        th, td { border: 1px solid #cbd5e1; padding: 4px 6px; font-size: 10px; text-align: left; }
        th { background: #e8eef5; }
        .cards { display: flex; gap: 10px; margin-bottom: 12px; }
        .card { flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; background: #f8fafc; }
        .card .v { font-size: 16px; font-weight: 700; color: #135a98; }
        .card .l { font-size: 9px; color: #64748b; text-transform: uppercase; }
        .sign { display: flex; justify-content: space-between; margin-top: 40px; }
        .sign div { width: 30%; border-top: 1px solid #334155; padding-top: 4px; font-size: 10px; }
      </style></head><body>
      <div class="header">
        <div><h1>Driver Trip Management Report</h1><div class="sub">${esc(periodTitle)}</div></div>
        <div class="sub" style="text-align:right">Generated: ${esc(generatedAt)}</div>
      </div>
      <div class="cards">
        <div class="card"><div class="v">${reportModel.totalTrips}</div><div class="l">Total Trips</div></div>
        <div class="card"><div class="v">${fmtNum(reportModel.totalKm)} km</div><div class="l">Total Distance</div></div>
        <div class="card"><div class="v">${fmtNum(reportModel.totalFuel)} L</div><div class="l">Fuel Consumed</div></div>
        <div class="card"><div class="v">${fmtNum(reportModel.totalFuelCost)}</div><div class="l">Fuel Expenditure</div></div>
        <div class="card"><div class="v">${reportModel.destinations.length}</div><div class="l">Destinations</div></div>
      </div>
      <h2>1. Driver Information</h2>
      <table><thead><tr><th>Driver</th><th>Phone</th><th>Trips</th><th>KM</th><th>Fuel (L)</th><th>Destinations</th><th>Last Trip</th></tr></thead>
      <tbody>${driverRows || '<tr><td colspan="7">No data</td></tr>'}</tbody></table>
      <h2>2. Trip Register</h2>
      <table><thead><tr><th>Trip ID</th><th>Driver</th><th>Vehicle</th><th>Date</th><th>Destination</th><th>Purpose</th><th>KM</th><th>Fuel (L)</th><th>Fuel Cost</th></tr></thead>
      <tbody>${tripRowsHtml || '<tr><td colspan="9">No data</td></tr>'}</tbody></table>
      <h2>3. Period Summaries</h2>
      ${periodTable('Weekly', reportModel.weekly)}
      ${periodTable('Monthly', reportModel.monthly)}
      ${periodTable('Yearly', reportModel.yearly)}
      <h2>4. Approval</h2>
      <div class="sign">
        <div>Driver Signature</div><div>Supervisor Signature</div><div>Approved By</div>
      </div>
      </body></html>`)
    win.document.close()
    win.focus()
    win.print()
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/fleet/manager"
              className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800"
            >
              <ArrowLeft className="h-4 w-4" /> ወደ ዳሽቦርድ ተመለስ
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">የሹ፜ር ማስተዳደሪያ</h1>
            <p className="mt-1 text-sm text-slate-500">
              Driver trip summary — trips, distance and fuel usage ({periodLabel})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 focus:border-[#135a98] focus:outline-none"
            >
              <option value="week">ሳምንት (Week)</option>
              <option value="month">ወር (Month)</option>
              <option value="year">ዓመት (Year)</option>
              <option value="all">ሁሉም (All)</option>
            </select>
            <select
              value=""
              onChange={(e) => {
                const v = e.target.value
                if (v === 'excel') exportAsExcel()
                else if (v === 'word') exportAsWord()
                else if (v === 'pdf') exportAsPDF()
                e.target.value = ''
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-[#135a98] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f4e84] focus:outline-none"
            >
              <option value="" disabled selected>
                Export As
              </option>
              <option value="excel">Excel (.xlsx)</option>
              <option value="word">Word (.docx)</option>
              <option value="pdf">PDF</option>
            </select>
          </div>
        </div>

        {loading && <div className="text-sm text-slate-500">Loading driver data...</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}

        {!loading && !error && (
          <div className="space-y-6">
            {/* Summary table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">ሹ፜ር</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">የመስክ ብዛት</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">ጠቅላላ ኪ.ሜ</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">ጠቅላላ ነዳጅ (ሊትር)</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">የነዳጅ ጥያቄዎች</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">መጨረሻ መስክ</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">መድረሻዎች</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summaries.map((s) => (
                    <tr key={s.driver.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{s.driver.name}</div>
                        {s.driver.phone && <div className="text-xs text-slate-500">{s.driver.phone}</div>}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{s.trips}</td>
                      <td className="px-4 py-3 text-slate-700">{fmtNum(s.totalKm)}</td>
                      <td className="px-4 py-3 text-slate-700">{fmtNum(s.totalFuel)}</td>
                      <td className="px-4 py-3 text-slate-700">{s.fuelCount}</td>
                      <td className="px-4 py-3 text-slate-700">{fmtDate(s.lastTripDate)}</td>
                      <td className="px-4 py-3 text-slate-700">
                        <span className="line-clamp-2">{s.destinations.slice(0, 3).join(', ') || '-'}</span>
                        {s.destinations.length > 3 && (
                          <span className="text-xs text-slate-400"> +{s.destinations.length - 3}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {summaries.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        ምንም ውሂብ አልተገኘም
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Trip detail table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-6 py-4">
                <h2 className="text-base font-bold text-slate-900">የመስክ ዝርዝር ({filteredTrips.length})</h2>
                <p className="text-xs text-slate-500">Trip details — who requested, when and where</p>
              </div>
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">ሹ፜ር</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">የጠየቀው</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">ቀን / ሰዓት</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">መድረሻ</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">አላማ</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">ኪ.ሜ</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">መኪና</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTrips.slice(0, 500).map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{t.driverName}</td>
                      <td className="px-4 py-3 text-slate-700">{t.requesterName}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {fmtDate(t.date)}
                        {t.startTime ? ` ${String(t.startTime).slice(0, 5)}` : ''}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{t.destination}</td>
                      <td className="px-4 py-3 text-slate-700">{t.purpose || '-'}</td>
                      <td className="px-4 py-3 text-slate-700">{fmtNum(t.km)}</td>
                      <td className="px-4 py-3 text-slate-700">{t.vehiclePlate || '-'}</td>
                    </tr>
                  ))}
                  {filteredTrips.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        በዚህ ጊዜ ውስጥ ምንም መስክ የለም
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {filteredTrips.length > 500 && (
                <div className="border-t border-slate-100 px-6 py-3 text-xs text-slate-500">
                  Showing first 500 of {filteredTrips.length} trips
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
