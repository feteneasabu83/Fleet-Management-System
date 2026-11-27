"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { getCurrentUserRoles, getCurrentUserPrimaryRole } from "@/app/lib/auth"

// ---------- types ----------
type Status =
  | "DRAFT" | "SUBMITTED" | "UNDER_MAINTENANCE_REVIEW"
  | "MAINTENANCE_APPROVED" | "MAINTENANCE_DISAPPROVED"
  | "PENDING_FLEET_MANAGER" | "FLEET_MANAGER_ACCEPTED"
  | "FLEET_MANAGER_REJECTED" | "IN_PROGRESS" | "COMPLETED"
  | "RETURNED_TO_DRIVER" | "CANCELLED"

interface MaintRequest {
  id: string
  requestNumber: string
  status: Status
  priority?: string | null
  category: string
  problemDescription: string
  vehicleCondition: string
  location?: string | null
  currentOdometerKm?: number | null
  employeeId?: string | null
  department?: string | null
  phone?: string | null
  attachments?: string | null
  submittedAt: string
  driver?: { id: string; firstName: string; lastName: string; email?: string; phone?: string; department?: { name?: string } | null }
  vehicle?: { id: string; plate?: string; make?: string; model?: string; vehicleTypeName?: string; year?: number }
  inspection?: any
  managerDecision?: any
  task?: any
  history?: { id: string; action: string; fromStatus?: Status | null; toStatus?: Status | null; notes?: string; createdAt: string; actor?: { firstName?: string; lastName?: string; role?: string } | null }[]
}

const STATUS_LABELS: Record<Status, string> = {
  DRAFT: "ረቅድ",
  SUBMITTED: "ተልኳል",
  UNDER_MAINTENANCE_REVIEW: "በጥገና ግምገማ ላይ",
  MAINTENANCE_APPROVED: "ጥገና ጸድቋል",
  MAINTENANCE_DISAPPROVED: "ጥገና አልተሳካም",
  PENDING_FLEET_MANAGER: "የባህሪ ስራ አስኪያጅ በመጠባበቅ ላይ",
  FLEET_MANAGER_ACCEPTED: "የባህሪ ስራ አስኪያጅ ተቀብሏል",
  FLEET_MANAGER_REJECTED: "የባህሪ ስራ አስኪያጅ አልተቀበለም",
  IN_PROGRESS: "በሂደት ላይ",
  COMPLETED: "ተጠናቋል",
  RETURNED_TO_DRIVER: "ወደ ሹፌሩ ተመልሷል",
  CANCELLED: "ተሰርዟል",
}

const STATUS_COLORS: Record<Status, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SUBMITTED: "bg-blue-100 text-blue-800",
  UNDER_MAINTENANCE_REVIEW: "bg-indigo-100 text-indigo-800",
  MAINTENANCE_APPROVED: "bg-green-100 text-green-800",
  MAINTENANCE_DISAPPROVED: "bg-orange-100 text-orange-800",
  PENDING_FLEET_MANAGER: "bg-yellow-100 text-yellow-800",
  FLEET_MANAGER_ACCEPTED: "bg-emerald-100 text-emerald-800",
  FLEET_MANAGER_REJECTED: "bg-red-100 text-red-800",
  IN_PROGRESS: "bg-cyan-100 text-cyan-800",
  COMPLETED: "bg-teal-100 text-teal-800",
  RETURNED_TO_DRIVER: "bg-purple-100 text-purple-800",
  CANCELLED: "bg-gray-200 text-gray-600",
}

const CATEGORIES = ["MECHANICAL", "ELECTRICAL", "TIRE", "ENGINE", "ACCIDENT", "ROUTINE_SERVICE", "OTHER"]
const CATEGORY_LABELS: Record<string, string> = {
  MECHANICAL: "ሜካኒካዊ",
  ELECTRICAL: "ኤሌክትሪካዊ",
  TIRE: "ጎማ",
  ENGINE: "ሞተር / ኢንጅን",
  ACCIDENT: "አደጋ",
  ROUTINE_SERVICE: "መደበኛ አገልግሎት",
  OTHER: "ሌላ",
}
const CONDITIONS = ["OPERATIONAL", "PARTIALLY_OPERATIONAL", "NOT_OPERATIONAL"]
const CONDITION_LABELS: Record<string, string> = {
  OPERATIONAL: "በሥራ ላይ ያለ",
  PARTIALLY_OPERATIONAL: "በከፊል በሥራ ላይ ያለ",
  NOT_OPERATIONAL: "በሥራ ላይ ያልሆነ",
}
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"]
const PRIORITY_LABELS: Record<string, string> = {
  LOW: "ዝቅተኛ",
  MEDIUM: "መካከለኛ",
  HIGH: "ከፍተኛ",
  URGENT: "አስቸኳይ",
}

function authHeaders() {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("accessToken") || localStorage.getItem("jwt") || localStorage.getItem("token")
      : null
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`/api/maintenance-approval${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || data?.error || `Request failed (${res.status})`)
  return data
}

const inputCls = "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
const labelCls = "block text-sm font-medium text-gray-700"

// ---------- small components ----------
function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[status] || "bg-gray-100 text-gray-700"}`}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}

function StatCard({ label, value, color = "text-gray-900" }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="bg-white rounded-lg shadow border p-4">
      <p className="text-xs text-gray-500 truncate">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  )
}

// ---------- main page ----------
export default function MaintenanceApprovalPage() {
  const [roles, setRoles] = useState<string[]>([])
  const [primaryRole, setPrimaryRole] = useState<string>("employee")
  const [tab, setTab] = useState<string>("dashboard")
  const [requests, setRequests] = useState<MaintRequest[]>([])
  const [myRequests, setMyRequests] = useState<MaintRequest[]>([])
  const [stats, setStats] = useState<any>(null)
  const [vehicles, setVehicles] = useState<any[]>([])
  const [technicians, setTechnicians] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // detail / forms
  const [detail, setDetail] = useState<MaintRequest | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")

  // Form 1 state
  const [form1, setForm1] = useState<any>({
    vehicleId: "", priority: "MEDIUM", category: "MECHANICAL",
    problemDescription: "", vehicleCondition: "OPERATIONAL",
    location: "", currentOdometerKm: "", employeeId: "", phone: "",
  })
  const [attachments, setAttachments] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  // Form 2 state
  const [form2, setForm2] = useState<any>({
    problemVerified: true, technicalFindings: "", requiredRepairs: "",
    estimatedPartsCost: "", estimatedLaborCost: "", estimatedOtherCost: "",
    estimatedDurationHours: "", workshop: "INTERNAL",
    decision: "APPROVED", decisionReason: "", technicalJustification: "",
    officerEmployeeId: "", signature: "",
  })

  // Form 3 state
  const [form3, setForm3] = useState<any>({ decision: "ACCEPTED", remarks: "", budgetAvailable: true, signature: "" })

  // Form 4 state
  const [form4, setForm4] = useState<any>({
    technicianId: "", workshop: "", repairStartDate: "", partsUsed: "",
    actualCost: "", repairDescription: "", completionDate: "",
    finalOdometerKm: "", vehicleStatus: "REPAIRED", technicianRemarks: "",
  })

  const isDriver = primaryRole === "driver" || roles.includes("driver")
  const isMaintTeam = roles.includes("maintenance_team") || primaryRole === "maintenance_team"
  const isManager = roles.includes("manager") || primaryRole === "manager" || roles.includes("admin")
  const isStaff = isMaintTeam || isManager

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [dash, reqs, mine, vehs, techs] = await Promise.all([
        api("/dashboard").catch(() => null),
        isStaff ? api("/requests").catch(() => []) : Promise.resolve([]),
        isDriver ? api("/requests/my").catch(() => []) : Promise.resolve([]),
        api("/requests").then(() => null).catch(() => null), // placeholder
        isStaff ? api("/technicians").catch(() => []) : Promise.resolve([]),
      ])
      setStats(dash)
      setRequests(Array.isArray(reqs) ? reqs : [])
      setMyRequests(Array.isArray(mine) ? mine : [])
      setTechnicians(Array.isArray(techs) ? techs : [])
    } catch (e: any) {
      setError(e?.message || "Failed to load data")
    } finally {
      setLoading(false)
    }
  }, [isStaff, isDriver])

  useEffect(() => {
    const r = getCurrentUserRoles()
    setRoles(r)
    setPrimaryRole(getCurrentUserPrimaryRole())
  }, [])

  // Deep-link support: /fleet/maintenance-approval?tab=new-request
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const t = new URLSearchParams(window.location.search).get('tab')
      if (t) setTab(t)
    } catch {}
  }, [])

  // Drivers have no dashboard tab — default them to the request form
  useEffect(() => {
    if (isDriver && tab === 'dashboard') setTab('new-request')
  }, [isDriver, tab])

  useEffect(() => { loadAll() }, [loadAll])

  // fetch vehicles for driver form via existing fleet endpoint
  useEffect(() => {
    if (!isDriver) return
    const token = localStorage.getItem("accessToken") || localStorage.getItem("jwt") || localStorage.getItem("token")
    fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/fleet/vehicles`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((d) => {
        const items = Array.isArray(d) ? d : d?.items || d?.data || []
        setVehicles(items)
      })
      .catch(() => setVehicles([]))
  }, [isDriver])

  const openDetail = async (id: string) => {
    try {
      const d = await api(`/requests/${id}`)
      setDetail(d)
      if (d?.inspection) setForm2((f: any) => ({ ...f }))
    } catch (e: any) {
      showToast(e?.message || "Failed to load request")
    }
  }

  // ---------- Form 1: driver submit ----------
  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api("/requests", {
        method: "POST",
        body: JSON.stringify({ ...form1, currentOdometerKm: form1.currentOdometerKm ? Number(form1.currentOdometerKm) : null, attachments }),
      })
      showToast("የጥገና ጥያቄ ተልኳል")
      setForm1({ vehicleId: "", priority: "MEDIUM", category: "MECHANICAL", problemDescription: "", vehicleCondition: "OPERATIONAL", location: "", currentOdometerKm: "", employeeId: "", phone: "" })
      setAttachments([])
      setTab("my-requests")
      loadAll()
    } catch (e: any) {
      showToast(e?.message || "Submit failed")
    }
  }

  const uploadFile = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      const data = await res.json()
      if (data?.url) setAttachments((a) => [...a, data.url])
      else showToast(data?.error || "Upload failed")
    } catch {
      showToast("Upload failed")
    } finally {
      setUploading(false)
    }
  }

  // ---------- Form 2: inspection ----------
  const submitInspection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!detail) return
    try {
      await api(`/requests/${detail.id}/inspection`, {
        method: "POST",
        body: JSON.stringify({
          ...form2,
          problemVerified: !!form2.problemVerified,
          estimatedPartsCost: form2.estimatedPartsCost || null,
          estimatedLaborCost: form2.estimatedLaborCost || null,
          estimatedOtherCost: form2.estimatedOtherCost || null,
          estimatedDurationHours: form2.estimatedDurationHours ? Number(form2.estimatedDurationHours) : null,
        }),
      })
      showToast("ጥገና ግምገማ ተልኳል — ወደ ባህሪ ስራ አስኪያጅ ተላክ")
      setDetail(null)
      loadAll()
    } catch (e: any) {
      showToast(e?.message || "Inspection failed")
    }
  }

  const startReview = async (id: string) => {
    try {
      await api(`/requests/${id}/start-review`, { method: "POST" })
      showToast("ግምገማ ተጀምሯል")
      loadAll()
    } catch (e: any) { showToast(e?.message || "Failed") }
  }

  // ---------- Form 3: manager decision ----------
  const submitManagerDecision = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!detail) return
    try {
      await api(`/requests/${detail.id}/manager-decision`, { method: "POST", body: JSON.stringify(form3) })
      showToast(form3.decision === "ACCEPTED" ? "ጥያቄ ተቀብሏል" : "ጥያቄ ተቀባይነት አላገኘም")
      setDetail(null)
      loadAll()
    } catch (e: any) {
      showToast(e?.message || "Decision failed")
    }
  }

  // ---------- Form 4: execution ----------
  const submitTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!detail) return
    try {
      let partsUsed: any = null
      if (form4.partsUsed) {
        try { partsUsed = JSON.parse(form4.partsUsed) } catch { partsUsed = form4.partsUsed }
      }
      await api(`/requests/${detail.id}/task`, {
        method: "POST",
        body: JSON.stringify({
          ...form4,
          actualCost: form4.actualCost || null,
          finalOdometerKm: form4.finalOdometerKm ? Number(form4.finalOdometerKm) : null,
          partsUsed,
        }),
      })
      showToast("የአፈጻጸም መዝገብ ተቀምጧል")
      setDetail(null)
      loadAll()
    } catch (e: any) {
      showToast(e?.message || "Save failed")
    }
  }

  const driverConfirm = async (id: string) => {
    try {
      await api(`/requests/${id}/driver-confirm`, { method: "POST" })
      showToast("መኪና መቀበያ ተረጋግጧል")
      loadAll()
    } catch (e: any) { showToast(e?.message || "Failed") }
  }

  const cancelRequest = async (id: string) => {
    try {
      await api(`/requests/${id}/cancel`, { method: "POST" })
      showToast("ጥገና ተሰርዟል")
      loadAll()
    } catch (e: any) { showToast(e?.message || "Cancel failed") }
  }

  // ---------- filtered lists ----------
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const q = search.toLowerCase()
      const matchQ =
        !q ||
        r.requestNumber.toLowerCase().includes(q) ||
        r.problemDescription.toLowerCase().includes(q) ||
        `${r.driver?.firstName || ""} ${r.driver?.lastName || ""}`.toLowerCase().includes(q) ||
        (r.vehicle?.plate || "").toLowerCase().includes(q)
      const matchS = !statusFilter || r.status === statusFilter
      return matchQ && matchS
    })
  }, [requests, search, statusFilter])

  const pendingManager = useMemo(() => requests.filter((r) => r.status === "PENDING_FLEET_MANAGER"), [requests])
  const reviewQueue = useMemo(
    () => requests.filter((r) => ["SUBMITTED", "UNDER_MAINTENANCE_REVIEW"].includes(r.status)),
    [requests],
  )

  // ---------- render helpers ----------
  const renderRequestTable = (list: MaintRequest[], showActions = false) => (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b">
            <th className="py-2 pr-4">የጥያቄ ቁጥር</th>
            <th className="py-2 pr-4">ሹፌር</th>
            <th className="py-2 pr-4">የመኪና ቁጥር</th>
            <th className="py-2 pr-4">ችግር</th>
            <th className="py-2 pr-4">የጥገና ውሳኔ</th>
            <th className="py-2 pr-4">የባህሪ ስራ አስኪያጅ ውሳኔ</th>
            <th className="py-2 pr-4">ሁኔታ</th>
            {showActions && <th className="py-2">እርምጃዎች</th>}
          </tr>
        </thead>
        <tbody>
          {list.length === 0 && (
            <tr><td colSpan={8} className="py-6 text-center text-gray-400">ምንም ጥያቄ አልተገኘም</td></tr>
          )}
          {list.map((r) => (
            <tr key={r.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => openDetail(r.id)}>
              <td className="py-2 pr-4 font-medium">{r.requestNumber}</td>
              <td className="py-2 pr-4">{r.driver?.firstName} {r.driver?.lastName}</td>
              <td className="py-2 pr-4">{r.vehicle?.plate || "-"}</td>
              <td className="py-2 pr-4 max-w-[200px] truncate">{r.problemDescription}</td>
              <td className="py-2 pr-4">{r.inspection ? (r.inspection.decision === "APPROVED" ? "ጸድቋል" : "አልተሳካም") : "-"}</td>
              <td className="py-2 pr-4">{r.managerDecision ? (r.managerDecision.decision === "ACCEPTED" ? "ተቀብሏል" : "ተቀባይነት አላገኘም") : "በመጠባበቅ ላይ"}</td>
              <td className="py-2 pr-4"><StatusBadge status={r.status} /></td>
              {showActions && (
                <td className="py-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-2">
                    {isMaintTeam && r.status === "SUBMITTED" && (
                      <button onClick={() => startReview(r.id)} className="text-xs bg-indigo-600 text-white px-2 py-1 rounded">ግምገማ ጀምር</button>
                    )}
                    {isDriver && ["SUBMITTED", "DRAFT"].includes(r.status) && (
                      <button onClick={() => cancelRequest(r.id)} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">ሰርዝ</button>
                    )}
                    {isDriver && r.status === "COMPLETED" && (
                      <button onClick={() => driverConfirm(r.id)} className="text-xs bg-emerald-600 text-white px-2 py-1 rounded">መቀበያ አረጋግጥ</button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  // ---------- detail panel ----------
  const renderDetail = () => {
    if (!detail) return null
    const d = detail
    const canInspect = isMaintTeam && !d.inspection && ["SUBMITTED", "UNDER_MAINTENANCE_REVIEW"].includes(d.status)
    const canDecide = isManager && d.status === "PENDING_FLEET_MANAGER" && !d.managerDecision
    const canExecute = isStaff && d.status === "FLEET_MANAGER_ACCEPTED" && !["COMPLETED", "RETURNED_TO_DRIVER", "FLEET_MANAGER_REJECTED"].includes(d.status)
    const showTask = isStaff && d.task

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetail(null)}>
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white">
            <div>
              <h3 className="text-lg font-bold">{d.requestNumber}</h3>
              <StatusBadge status={d.status} />
            </div>
            <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
          </div>

          <div className="p-6 space-y-6">
            {/* Request info */}
            <section>
              <h4 className="font-semibold text-gray-800 mb-2">የሹፌር ጥያቄ</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><span className="text-gray-500">ሹፌር:</span> {d.driver?.firstName} {d.driver?.lastName}</div>
                <div><span className="text-gray-500">መኪና:</span> {d.vehicle?.plate} ({d.vehicle?.make} {d.vehicle?.model})</div>
                <div><span className="text-gray-500">ምድብ:</span> {CATEGORY_LABELS[d.category] || d.category}</div>
                <div><span className="text-gray-500">ቅድሚያ ምድብ:</span> {PRIORITY_LABELS[d.priority || ""] || d.priority || "-"}</div>
                <div><span className="text-gray-500">ሁኔታ:</span> {CONDITION_LABELS[d.vehicleCondition] || d.vehicleCondition}</div>
                <div><span className="text-gray-500">ኦዶሜትር:</span> {d.currentOdometerKm ? `${d.currentOdometerKm} ኪ.ሜ` : "-"}</div>
                <div><span className="text-gray-500">ቦታ:</span> {d.location || "-"}</div>
                <div><span className="text-gray-500">የቀረበበት:</span> {new Date(d.submittedAt).toLocaleString()}</div>
              </div>
              <p className="mt-2 text-sm bg-gray-50 p-3 rounded">{d.problemDescription}</p>
              {d.attachments && (
                <div className="mt-2 text-sm">
                  <span className="text-gray-500">አባሪያዎች: </span>
                  {JSON.parse(d.attachments).map((u: string, i: number) => (
                    <a key={i} href={u} target="_blank" className="text-blue-600 underline mr-2">{u.split("/").pop()}</a>
                  ))}
                </div>
              )}
            </section>

            {/* Inspection report */}
            {d.inspection && (
              <section className="border rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2">የጥገና ቡድን ግምገማ</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div><span className="text-gray-500">ውሳኔ:</span> <b>{d.inspection.decision === "APPROVED" ? "ጸድቋል" : "አልተሳካም"}</b></div>
                  <div><span className="text-gray-500">ምክንያት:</span> {d.inspection.decisionReason}</div>
                  <div><span className="text-gray-500">የሚገመት ወጪ:</span> {[
                    d.inspection.estimatedPartsCost, d.inspection.estimatedLaborCost, d.inspection.estimatedOtherCost,
                  ].some(Boolean) ? `$${(Number(d.inspection.estimatedPartsCost || 0) + Number(d.inspection.estimatedLaborCost || 0) + Number(d.inspection.estimatedOtherCost || 0)).toFixed(2)}` : "-"}</div>
                  <div><span className="text-gray-500">ሥራ ቤት:</span> {d.inspection.workshop === "INTERNAL" ? "ውስጣዊ" : d.inspection.workshop === "EXTERNAL" ? "ውጫዊ" : d.inspection.workshop || "-"}</div>
                </div>
                {d.inspection.technicalFindings && <p className="mt-2 text-sm"><b>ግኝቶች:</b> {d.inspection.technicalFindings}</p>}
                {d.inspection.requiredRepairs && <p className="text-sm"><b>የሚያስፈልጉ ጥገናዎች:</b> {d.inspection.requiredRepairs}</p>}
              </section>
            )}

            {/* Manager decision */}
            {d.managerDecision && (
              <section className="border rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2">የባህሪ ስራ አስኪያጅ ውሳኔ</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div><span className="text-gray-500">ውሳኔ:</span> <b>{d.managerDecision.decision === "ACCEPTED" ? "ተቀብሏል" : "ተቀባይነት አላገኘም"}</b></div>
                  <div><span className="text-gray-500">ማስታወሻ:</span> {d.managerDecision.remarks}</div>
                  <div><span className="text-gray-500">በጀት:</span> {d.managerDecision.budgetAvailable == null ? "-" : d.managerDecision.budgetAvailable ? "አለ" : "የለም"}</div>
                  <div><span className="text-gray-500">ቀን:</span> {new Date(d.managerDecision.decidedAt).toLocaleString()}</div>
                </div>
              </section>
            )}

            {/* Execution */}
            {showTask && d.task && (
              <section className="border rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2">የጥገና አፈጻጸም</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div><span className="text-gray-500">ሥራ ቤት:</span> {d.task.workshop || "-"}</div>
                  <div><span className="text-gray-500">ትክክለኛ ወጪ:</span> {d.task.actualCost ? `$${d.task.actualCost}` : "-"}</div>
                  <div><span className="text-gray-500">የመኪና ሁኔታ:</span> {d.task.vehicleStatus === "REPAIRED" ? "ተጠግኗል" : d.task.vehicleStatus === "PARTIALLY_REPAIRED" ? "በከፊል ተጠግኗል" : d.task.vehicleStatus === "NOT_REPAIRED" ? "አልተጠገነም" : d.task.vehicleStatus || "-"}</div>
                  <div><span className="text-gray-500">የተጠናቀቀበት:</span> {d.task.completionDate ? new Date(d.task.completionDate).toLocaleDateString() : "-"}</div>
                </div>
              </section>
            )}

            {/* History */}
            {d.history && d.history.length > 0 && (
              <section>
                <h4 className="font-semibold text-gray-800 mb-2">የፍቃድ ታሪክ</h4>
                <ol className="text-sm space-y-1 border-l-2 border-gray-200 pl-4">
                  {d.history.map((h) => (
                    <li key={h.id}>
                      <b>{h.action}</b>
                      {h.fromStatus && h.toStatus ? ` (${STATUS_LABELS[h.fromStatus]} → ${STATUS_LABELS[h.toStatus]})` : ""}
                      {" — "}{h.actor ? `${h.actor.firstName} ${h.actor.lastName}` : "ስርዓት"} ({h.actor?.role || ""})
                      <span className="text-gray-400"> · {new Date(h.createdAt).toLocaleString()}</span>
                      {h.notes && <div className="text-gray-500">{h.notes}</div>}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* Form 2 */}
            {canInspect && (
              <form onSubmit={submitInspection} className="border-2 border-indigo-200 rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-indigo-800">ቅጽ 2 — የጥገና ቡድን ግምገማ እና ውሳኔ</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Field label="የግምገማ ኦፊሰር የሰራተኛ መለያ"><input className={inputCls} value={form2.officerEmployeeId} onChange={(e) => setForm2({ ...form2, officerEmployeeId: e.target.value })} /></Field>
                  <Field label="ሥራ ቤት">
                    <select className={inputCls} value={form2.workshop} onChange={(e) => setForm2({ ...form2, workshop: e.target.value })}>
                      <option value="INTERNAL">ውስጣዊ ሥራ ቤት</option>
                      <option value="EXTERNAL">ውጫዊ ሥራ ቤት</option>
                    </select>
                  </Field>
                  <Field label="የሚገመት ጊዜ (ሰዓታት)"><input type="number" className={inputCls} value={form2.estimatedDurationHours} onChange={(e) => setForm2({ ...form2, estimatedDurationHours: e.target.value })} /></Field>
                  <Field label="የክፍሎች ወጪ"><input type="number" className={inputCls} value={form2.estimatedPartsCost} onChange={(e) => setForm2({ ...form2, estimatedPartsCost: e.target.value })} /></Field>
                  <Field label="የሰራተኛ ወጪ"><input type="number" className={inputCls} value={form2.estimatedLaborCost} onChange={(e) => setForm2({ ...form2, estimatedLaborCost: e.target.value })} /></Field>
                  <Field label="ሌላ ወጪ"><input type="number" className={inputCls} value={form2.estimatedOtherCost} onChange={(e) => setForm2({ ...form2, estimatedOtherCost: e.target.value })} /></Field>
                </div>
                <Field label="ችግሩ ተረጋግጧል?">
                  <select className={inputCls} value={form2.problemVerified ? "yes" : "no"} onChange={(e) => setForm2({ ...form2, problemVerified: e.target.value === "yes" })}>
                    <option value="yes">ተረጋግጧል</option>
                    <option value="no">አልተረጋገጠም</option>
                  </select>
                </Field>
                <Field label="ቴክኒካዊ ግኝቶች"><textarea className={inputCls} rows={2} value={form2.technicalFindings} onChange={(e) => setForm2({ ...form2, technicalFindings: e.target.value })} /></Field>
                <Field label="የሚያስፈልጉ ጥገናዎች (ክፍሎች እና አገልግሎቶች)"><textarea className={inputCls} rows={2} value={form2.requiredRepairs} onChange={(e) => setForm2({ ...form2, requiredRepairs: e.target.value })} /></Field>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="ውሳኔ">
                    <select className={inputCls} value={form2.decision} onChange={(e) => setForm2({ ...form2, decision: e.target.value })}>
                      <option value="APPROVED">አጽድቅ</option>
                      <option value="DISAPPROVED">አትስማማ</option>
                    </select>
                  </Field>
                  <Field label="የውሳኔ ምክንያት *"><input required className={inputCls} value={form2.decisionReason} onChange={(e) => setForm2({ ...form2, decisionReason: e.target.value })} /></Field>
                </div>
                <Field label="ቴክኒካዊ ማረጋገጫ"><textarea className={inputCls} rows={2} value={form2.technicalJustification} onChange={(e) => setForm2({ ...form2, technicalJustification: e.target.value })} /></Field>
                <Field label="ዲጂታል ፊርማ (ስም)"><input className={inputCls} value={form2.signature} onChange={(e) => setForm2({ ...form2, signature: e.target.value })} /></Field>
                <button className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-medium">ግምገማ አስገባ → ወደ ባህሪ ስራ አስኪያጅ ላክ</button>
              </form>
            )}

            {/* Form 3 */}
            {canDecide && (
              <form onSubmit={submitManagerDecision} className="border-2 border-emerald-200 rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-emerald-800">ቅጽ 3 — የባህሪ ስራ አስኪያጅ መጨረሻ ውሳኔ</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="ውሳኔ">
                    <select className={inputCls} value={form3.decision} onChange={(e) => setForm3({ ...form3, decision: e.target.value })}>
                      <option value="ACCEPTED">ተቀብል</option>
                      <option value="REJECTED">አትቀበል</option>
                    </select>
                  </Field>
                  <Field label="በጀት አለ?">
                    <select className={inputCls} value={form3.budgetAvailable ? "yes" : "no"} onChange={(e) => setForm3({ ...form3, budgetAvailable: e.target.value === "yes" })}>
                      <option value="yes">በጀት አለ</option>
                      <option value="no">የለም</option>
                    </select>
                  </Field>
                </div>
                <Field label="የአስኪያጅ ማስታወሻ / ማብራሪያ *"><textarea required className={inputCls} rows={2} value={form3.remarks} onChange={(e) => setForm3({ ...form3, remarks: e.target.value })} /></Field>
                <Field label="የአስኪያጅ ፊርማ (ስም)"><input className={inputCls} value={form3.signature} onChange={(e) => setForm3({ ...form3, signature: e.target.value })} /></Field>
                <button className="bg-emerald-600 text-white px-4 py-2 rounded text-sm font-medium">መጨረሻ ውሳኔ አስገባ</button>
              </form>
            )}

            {/* Form 4 */}
            {canExecute && (
              <form onSubmit={submitTask} className="border-2 border-cyan-200 rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-cyan-800">ቅጽ 4 — የጥገና አፈጻጸም እና ማጠናቀቂያ</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Field label="ቴክኒሻን">
                    <select className={inputCls} value={form4.technicianId} onChange={(e) => setForm4({ ...form4, technicianId: e.target.value })}>
                      <option value="">ቴክኒሻን ይምረጡ…</option>
                      {technicians.map((t: any) => (
                        <option key={t.id} value={t.id}>{t.firstName} {t.lastName} ({t.role})</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="ሥራ ቤት"><input className={inputCls} value={form4.workshop} onChange={(e) => setForm4({ ...form4, workshop: e.target.value })} /></Field>
                  <Field label="የጥገና የመጀመሪያ ቀን"><input type="datetime-local" className={inputCls} value={form4.repairStartDate} onChange={(e) => setForm4({ ...form4, repairStartDate: e.target.value })} /></Field>
                  <Field label="ትክክለኛ ወጪ"><input type="number" className={inputCls} value={form4.actualCost} onChange={(e) => setForm4({ ...form4, actualCost: e.target.value })} /></Field>
                  <Field label="የማጠናቀቂያ ቀን"><input type="datetime-local" className={inputCls} value={form4.completionDate} onChange={(e) => setForm4({ ...form4, completionDate: e.target.value })} /></Field>
                  <Field label="መጨረሻ ኦዶሜትር (ኪ.ሜ)"><input type="number" className={inputCls} value={form4.finalOdometerKm} onChange={(e) => setForm4({ ...form4, finalOdometerKm: e.target.value })} /></Field>
                  <Field label="የመኪና ሁኔታ">
                    <select className={inputCls} value={form4.vehicleStatus} onChange={(e) => setForm4({ ...form4, vehicleStatus: e.target.value })}>
                      <option value="REPAIRED">ተጠግኗል</option>
                      <option value="PARTIALLY_REPAIRED">በከፊል ተጠግኗል</option>
                      <option value="NOT_REPAIRED">አልተጠገነም</option>
                    </select>
                  </Field>
                </div>
                <Field label="የተጠቀሙ ክፍሎች (JSON: [{&quot;name&quot;:&quot;...&quot;,&quot;quantity&quot;:1}])"><textarea className={inputCls} rows={2} value={form4.partsUsed} onChange={(e) => setForm4({ ...form4, partsUsed: e.target.value })} placeholder='[{"name":"የፍሬን ኩሽና","quantity":2}]' /></Field>
                <Field label="የጥገና መግለጫ / የተሰራው ስራ"><textarea className={inputCls} rows={2} value={form4.repairDescription} onChange={(e) => setForm4({ ...form4, repairDescription: e.target.value })} /></Field>
                <Field label="የቴክኒሻን ማስታወሻ"><textarea className={inputCls} rows={2} value={form4.technicianRemarks} onChange={(e) => setForm4({ ...form4, technicianRemarks: e.target.value })} /></Field>
                <button className="bg-cyan-600 text-white px-4 py-2 rounded text-sm font-medium">የአፈጻጸም መዝገብ አስቀምጥ</button>
              </form>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ---------- tabs (staff only; drivers use sidebar deep links) ----------
  const teamTabs = [
    { id: "dashboard", label: "ዳሽቦርድ" },
    { id: "review", label: "የግምገማ ወረፊት" },
    { id: "register", label: "የጥያቄዎች መዝገብ" },
  ]
  const managerTabs = [
    { id: "dashboard", label: "ዳሽቦርድ" },
    { id: "pending", label: "በመጠባበቅ ላይ ያሉ ውሳኔዎች" },
    { id: "register", label: "የጥያቄዎች መዝገብ" },
  ]
  const tabs = isManager ? managerTabs : teamTabs

  // ---------- render ----------
  return (
    <div className="p-4 md:p-6 w-full">
      {toast && <div className="fixed top-4 right-4 z-[60] bg-green-600 text-white px-4 py-2 rounded shadow">{toast}</div>}

      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">{error}</div>}

      {isStaff && (
        <div className="mb-6 border-b border-gray-200 overflow-x-auto">
          <nav className="flex gap-1 -mb-px">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">በመጫን ላይ…</div>
      ) : (
        <>
          {/* DRIVER VIEWS */}
          {isDriver && tab === "new-request" && (
            <form onSubmit={submitRequest} className="bg-white rounded-lg shadow border p-6 space-y-4 w-full">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="መኪና *">
                  <select required className={inputCls} value={form1.vehicleId} onChange={(e) => setForm1({ ...form1, vehicleId: e.target.value })}>
                    <option value="">መኪና ይምረጡ…</option>
                    {vehicles.map((v: any) => (
                      <option key={v.id} value={v.id}>{v.plate || v.id} {v.make ? `— ${v.make} ${v.model || ""}` : ""}</option>
                    ))}
                  </select>
                </Field>
                <Field label="ቅድሚያ ምድብ">
                  <select className={inputCls} value={form1.priority} onChange={(e) => setForm1({ ...form1, priority: e.target.value })}>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                  </select>
                </Field>
                <Field label="የጥገና ምድብ *">
                  <select required className={inputCls} value={form1.category} onChange={(e) => setForm1({ ...form1, category: e.target.value })}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                  </select>
                </Field>
                <Field label="የመኪና ሁኔታ *">
                  <select required className={inputCls} value={form1.vehicleCondition} onChange={(e) => setForm1({ ...form1, vehicleCondition: e.target.value })}>
                    {CONDITIONS.map((c) => <option key={c} value={c}>{CONDITION_LABELS[c]}</option>)}
                  </select>
                </Field>
                <Field label="የአሁኑ ኦዶሜትር (ኪ.ሜ)"><input type="number" className={inputCls} value={form1.currentOdometerKm} onChange={(e) => setForm1({ ...form1, currentOdometerKm: e.target.value })} /></Field>
                <Field label="ቦታ"><input className={inputCls} value={form1.location} onChange={(e) => setForm1({ ...form1, location: e.target.value })} placeholder="የመኪናው አሁን ያለበት ቦታ" /></Field>
                <Field label="የሰራተኛ መለያ"><input className={inputCls} value={form1.employeeId} onChange={(e) => setForm1({ ...form1, employeeId: e.target.value })} /></Field>
                <Field label="ስልክ"><input className={inputCls} value={form1.phone} onChange={(e) => setForm1({ ...form1, phone: e.target.value })} /></Field>
              </div>
              <Field label="የችግር መግለጫ *">
                <textarea required rows={3} className={inputCls} value={form1.problemDescription} onChange={(e) => setForm1({ ...form1, problemDescription: e.target.value })} />
              </Field>
              <Field label="የሚደግፉ ሰነዶች (ፎቶዎች / መዝገቦች)">
                <input type="file" multiple accept="image/*,.pdf" className="text-sm"
                  onChange={(e) => { Array.from(e.target.files || []).forEach(uploadFile) }} />
                {uploading && <p className="text-xs text-gray-500 mt-1">በመስቀል ላይ…</p>}
                {attachments.length > 0 && (
                  <div className="mt-1 text-xs text-blue-600">{attachments.length} ፋይል ተያይዟል</div>
                )}
              </Field>
              <button className="bg-blue-600 text-white px-5 py-2 rounded font-medium">ጥያቄ አስገባ</button>
            </form>
          )}

          {isDriver && tab === "my-requests" && (
            <div className="bg-white rounded-lg shadow border p-4">
              {renderRequestTable(myRequests, true)}
            </div>
          )}

          {/* DASHBOARDS */}
          {isStaff && tab === "dashboard" && stats && (
            <div className="space-y-6">
              {isMaintTeam && (
                <>
                  <h2 className="text-lg font-semibold">የጥገና ቡድን ዳሽቦርድ</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="አዲስ ጥያቄዎች" value={stats.newRequests} color="text-blue-600" />
                    <StatCard label="በግምገማ ላይ" value={stats.underInspection} color="text-indigo-600" />
                    <StatCard label="የጸደቁ" value={stats.approved} color="text-green-600" />
                    <StatCard label="ያልጸደቁ" value={stats.disapproved} color="text-orange-600" />
                    <StatCard label="አስኪያጅ በመጠባበቅ ላይ" value={stats.pendingManager} color="text-yellow-600" />
                    <StatCard label="በሂደት ላይ" value={stats.inProgress} color="text-cyan-600" />
                    <StatCard label="የተጠናቀቁ" value={stats.completed} color="text-teal-600" />
                    <StatCard label="የተቀባይነት ያላገኙ" value={stats.rejected} color="text-red-600" />
                  </div>
                  <div className="bg-white rounded-lg shadow border p-4">
                    <h3 className="text-base font-semibold mb-3">ግምገማ የሚጠብቁ ጥያቄዎች</h3>
                    {renderRequestTable(reviewQueue, true)}
                  </div>
                </>
              )}
              {isManager && (
                <>
                  <h2 className="text-lg font-semibold">የባህሪ ስራ አስኪያጅ ዳሽቦርድ</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="በመጠባበቅ ላይ ያሉ ውሳኔዎች" value={stats.pendingDecisions} color="text-yellow-600" />
                    <StatCard label="የተቀበሉ" value={stats.accepted} color="text-emerald-600" />
                    <StatCard label="የተቀባይነት ያላገኙ" value={stats.rejected} color="text-red-600" />
                    <StatCard label="በሂደት ላይ" value={stats.inProgress} color="text-cyan-600" />
                    <StatCard label="የተጠናቀቁ" value={stats.completed} color="text-teal-600" />
                    <StatCard label="ወደ ሹፌሩ የተመለሱ" value={stats.returnedToDriver} color="text-purple-600" />
                  </div>
                  <div className="bg-white rounded-lg shadow border p-4">
                    <h3 className="text-base font-semibold mb-3">የመጨረሻ ውሳኔዎን የሚጠብቁ ጥያቄዎች</h3>
                    {renderRequestTable(pendingManager, true)}
                  </div>
                </>
              )}
            </div>
          )}

          {/* REVIEW QUEUE (maintenance team) */}
          {isMaintTeam && tab === "review" && (
            <div className="bg-white rounded-lg shadow border p-4">
              <h2 className="text-lg font-semibold mb-3">ግምገማ የሚጠብቁ ጥያቄዎች</h2>
              {renderRequestTable(reviewQueue, true)}
            </div>
          )}

          {/* PENDING (manager) */}
          {isManager && tab === "pending" && (
            <div className="bg-white rounded-lg shadow border p-4">
              <h2 className="text-lg font-semibold mb-3">በመጠባበቅ ላይ ያሉ መጨረሻ ውሳኔዎች</h2>
              {renderRequestTable(pendingManager, true)}
            </div>
          )}

          {/* REGISTER */}
          {isStaff && tab === "register" && (
            <div className="bg-white rounded-lg shadow border p-4 space-y-3">
              <div className="flex flex-wrap gap-3 items-center">
                <input
                  className="border rounded px-3 py-2 text-sm flex-1 min-w-[200px]"
                  placeholder="በጥያቄ ቁጥር፣ ሹፌር ወይም የመኪና ቁጥር ይፈልጉ…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select className="border rounded px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">ሁሉም ሁኔታዎች</option>
                  {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              {renderRequestTable(filteredRequests, true)}
            </div>
          )}
        </>
      )}

      {renderDetail()}
    </div>
  )
}
