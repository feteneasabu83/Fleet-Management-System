"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
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
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_MAINTENANCE_REVIEW: "Under Maintenance Review",
  MAINTENANCE_APPROVED: "Maintenance Approved",
  MAINTENANCE_DISAPPROVED: "Maintenance Disapproved",
  PENDING_FLEET_MANAGER: "Pending Fleet Manager",
  FLEET_MANAGER_ACCEPTED: "Fleet Manager Accepted",
  FLEET_MANAGER_REJECTED: "Fleet Manager Rejected",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  RETURNED_TO_DRIVER: "Returned to Driver",
  CANCELLED: "Cancelled",
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
const CONDITIONS = ["OPERATIONAL", "PARTIALLY_OPERATIONAL", "NOT_OPERATIONAL"]
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"]

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
      const [dash, reqs, mine, vehs] = await Promise.all([
        api("/dashboard").catch(() => null),
        isStaff ? api("/requests").catch(() => []) : Promise.resolve([]),
        isDriver ? api("/requests/my").catch(() => []) : Promise.resolve([]),
        api("/requests").then(() => null).catch(() => null), // placeholder
      ])
      setStats(dash)
      setRequests(Array.isArray(reqs) ? reqs : [])
      setMyRequests(Array.isArray(mine) ? mine : [])
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
      showToast("Maintenance request submitted")
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
      showToast("Inspection submitted — forwarded to Fleet Manager")
      setDetail(null)
      loadAll()
    } catch (e: any) {
      showToast(e?.message || "Inspection failed")
    }
  }

  const startReview = async (id: string) => {
    try {
      await api(`/requests/${id}/start-review`, { method: "POST" })
      showToast("Review started")
      loadAll()
    } catch (e: any) { showToast(e?.message || "Failed") }
  }

  // ---------- Form 3: manager decision ----------
  const submitManagerDecision = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!detail) return
    try {
      await api(`/requests/${detail.id}/manager-decision`, { method: "POST", body: JSON.stringify(form3) })
      showToast(`Request ${form3.decision === "ACCEPTED" ? "accepted" : "rejected"}`)
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
      showToast("Execution record saved")
      setDetail(null)
      loadAll()
    } catch (e: any) {
      showToast(e?.message || "Save failed")
    }
  }

  const driverConfirm = async (id: string) => {
    try {
      await api(`/requests/${id}/driver-confirm`, { method: "POST" })
      showToast("Vehicle receipt confirmed")
      loadAll()
    } catch (e: any) { showToast(e?.message || "Failed") }
  }

  const cancelRequest = async (id: string) => {
    try {
      await api(`/requests/${id}/cancel`, { method: "POST" })
      showToast("Request cancelled")
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
            <th className="py-2 pr-4">Request ID</th>
            <th className="py-2 pr-4">Driver</th>
            <th className="py-2 pr-4">Plate No.</th>
            <th className="py-2 pr-4">Problem</th>
            <th className="py-2 pr-4">Maint. Decision</th>
            <th className="py-2 pr-4">Manager Decision</th>
            <th className="py-2 pr-4">Status</th>
            {showActions && <th className="py-2">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {list.length === 0 && (
            <tr><td colSpan={8} className="py-6 text-center text-gray-400">No requests found</td></tr>
          )}
          {list.map((r) => (
            <tr key={r.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => openDetail(r.id)}>
              <td className="py-2 pr-4 font-medium">{r.requestNumber}</td>
              <td className="py-2 pr-4">{r.driver?.firstName} {r.driver?.lastName}</td>
              <td className="py-2 pr-4">{r.vehicle?.plate || "-"}</td>
              <td className="py-2 pr-4 max-w-[200px] truncate">{r.problemDescription}</td>
              <td className="py-2 pr-4">{r.inspection ? (r.inspection.decision === "APPROVED" ? "Approved" : "Disapproved") : "-"}</td>
              <td className="py-2 pr-4">{r.managerDecision ? (r.managerDecision.decision === "ACCEPTED" ? "Accepted" : "Rejected") : "Pending"}</td>
              <td className="py-2 pr-4"><StatusBadge status={r.status} /></td>
              {showActions && (
                <td className="py-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-2">
                    {isMaintTeam && r.status === "SUBMITTED" && (
                      <button onClick={() => startReview(r.id)} className="text-xs bg-indigo-600 text-white px-2 py-1 rounded">Start Review</button>
                    )}
                    {isDriver && ["SUBMITTED", "DRAFT"].includes(r.status) && (
                      <button onClick={() => cancelRequest(r.id)} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">Cancel</button>
                    )}
                    {isDriver && r.status === "COMPLETED" && (
                      <button onClick={() => driverConfirm(r.id)} className="text-xs bg-emerald-600 text-white px-2 py-1 rounded">Confirm Receipt</button>
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
              <h4 className="font-semibold text-gray-800 mb-2">Driver Request</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><span className="text-gray-500">Driver:</span> {d.driver?.firstName} {d.driver?.lastName}</div>
                <div><span className="text-gray-500">Vehicle:</span> {d.vehicle?.plate} ({d.vehicle?.make} {d.vehicle?.model})</div>
                <div><span className="text-gray-500">Category:</span> {d.category}</div>
                <div><span className="text-gray-500">Priority:</span> {d.priority || "-"}</div>
                <div><span className="text-gray-500">Condition:</span> {d.vehicleCondition}</div>
                <div><span className="text-gray-500">Odometer:</span> {d.currentOdometerKm ? `${d.currentOdometerKm} km` : "-"}</div>
                <div><span className="text-gray-500">Location:</span> {d.location || "-"}</div>
                <div><span className="text-gray-500">Submitted:</span> {new Date(d.submittedAt).toLocaleString()}</div>
              </div>
              <p className="mt-2 text-sm bg-gray-50 p-3 rounded">{d.problemDescription}</p>
              {d.attachments && (
                <div className="mt-2 text-sm">
                  <span className="text-gray-500">Attachments: </span>
                  {JSON.parse(d.attachments).map((u: string, i: number) => (
                    <a key={i} href={u} target="_blank" className="text-blue-600 underline mr-2">{u.split("/").pop()}</a>
                  ))}
                </div>
              )}
            </section>

            {/* Inspection report */}
            {d.inspection && (
              <section className="border rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2">Maintenance Team Inspection</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div><span className="text-gray-500">Decision:</span> <b>{d.inspection.decision}</b></div>
                  <div><span className="text-gray-500">Reason:</span> {d.inspection.decisionReason}</div>
                  <div><span className="text-gray-500">Estimated cost:</span> {[
                    d.inspection.estimatedPartsCost, d.inspection.estimatedLaborCost, d.inspection.estimatedOtherCost,
                  ].some(Boolean) ? `$${(Number(d.inspection.estimatedPartsCost || 0) + Number(d.inspection.estimatedLaborCost || 0) + Number(d.inspection.estimatedOtherCost || 0)).toFixed(2)}` : "-"}</div>
                  <div><span className="text-gray-500">Workshop:</span> {d.inspection.workshop || "-"}</div>
                </div>
                {d.inspection.technicalFindings && <p className="mt-2 text-sm"><b>Findings:</b> {d.inspection.technicalFindings}</p>}
                {d.inspection.requiredRepairs && <p className="text-sm"><b>Required repairs:</b> {d.inspection.requiredRepairs}</p>}
              </section>
            )}

            {/* Manager decision */}
            {d.managerDecision && (
              <section className="border rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2">Fleet Manager Decision</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div><span className="text-gray-500">Decision:</span> <b>{d.managerDecision.decision}</b></div>
                  <div><span className="text-gray-500">Remarks:</span> {d.managerDecision.remarks}</div>
                  <div><span className="text-gray-500">Budget:</span> {d.managerDecision.budgetAvailable == null ? "-" : d.managerDecision.budgetAvailable ? "Available" : "Not available"}</div>
                  <div><span className="text-gray-500">Date:</span> {new Date(d.managerDecision.decidedAt).toLocaleString()}</div>
                </div>
              </section>
            )}

            {/* Execution */}
            {showTask && d.task && (
              <section className="border rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2">Maintenance Execution</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div><span className="text-gray-500">Workshop:</span> {d.task.workshop || "-"}</div>
                  <div><span className="text-gray-500">Actual cost:</span> {d.task.actualCost ? `$${d.task.actualCost}` : "-"}</div>
                  <div><span className="text-gray-500">Vehicle status:</span> {d.task.vehicleStatus || "-"}</div>
                  <div><span className="text-gray-500">Completed:</span> {d.task.completionDate ? new Date(d.task.completionDate).toLocaleDateString() : "-"}</div>
                </div>
              </section>
            )}

            {/* History */}
            {d.history && d.history.length > 0 && (
              <section>
                <h4 className="font-semibold text-gray-800 mb-2">Approval History</h4>
                <ol className="text-sm space-y-1 border-l-2 border-gray-200 pl-4">
                  {d.history.map((h) => (
                    <li key={h.id}>
                      <b>{h.action}</b>
                      {h.fromStatus && h.toStatus ? ` (${STATUS_LABELS[h.fromStatus]} → ${STATUS_LABELS[h.toStatus]})` : ""}
                      {" — "}{h.actor ? `${h.actor.firstName} ${h.actor.lastName}` : "System"} ({h.actor?.role || ""})
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
                <h4 className="font-semibold text-indigo-800">Form 2 — Maintenance Team Inspection & Decision</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Field label="Inspection Officer Employee ID"><input className={inputCls} value={form2.officerEmployeeId} onChange={(e) => setForm2({ ...form2, officerEmployeeId: e.target.value })} /></Field>
                  <Field label="Workshop">
                    <select className={inputCls} value={form2.workshop} onChange={(e) => setForm2({ ...form2, workshop: e.target.value })}>
                      <option value="INTERNAL">Internal workshop</option>
                      <option value="EXTERNAL">External workshop</option>
                    </select>
                  </Field>
                  <Field label="Estimated duration (hours)"><input type="number" className={inputCls} value={form2.estimatedDurationHours} onChange={(e) => setForm2({ ...form2, estimatedDurationHours: e.target.value })} /></Field>
                  <Field label="Parts cost"><input type="number" className={inputCls} value={form2.estimatedPartsCost} onChange={(e) => setForm2({ ...form2, estimatedPartsCost: e.target.value })} /></Field>
                  <Field label="Labor cost"><input type="number" className={inputCls} value={form2.estimatedLaborCost} onChange={(e) => setForm2({ ...form2, estimatedLaborCost: e.target.value })} /></Field>
                  <Field label="Other cost"><input type="number" className={inputCls} value={form2.estimatedOtherCost} onChange={(e) => setForm2({ ...form2, estimatedOtherCost: e.target.value })} /></Field>
                </div>
                <Field label="Problem verified?">
                  <select className={inputCls} value={form2.problemVerified ? "yes" : "no"} onChange={(e) => setForm2({ ...form2, problemVerified: e.target.value === "yes" })}>
                    <option value="yes">Confirmed</option>
                    <option value="no">Not confirmed</option>
                  </select>
                </Field>
                <Field label="Technical findings"><textarea className={inputCls} rows={2} value={form2.technicalFindings} onChange={(e) => setForm2({ ...form2, technicalFindings: e.target.value })} /></Field>
                <Field label="Required repairs (parts & services)"><textarea className={inputCls} rows={2} value={form2.requiredRepairs} onChange={(e) => setForm2({ ...form2, requiredRepairs: e.target.value })} /></Field>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Decision">
                    <select className={inputCls} value={form2.decision} onChange={(e) => setForm2({ ...form2, decision: e.target.value })}>
                      <option value="APPROVED">Approve</option>
                      <option value="DISAPPROVED">Disapprove</option>
                    </select>
                  </Field>
                  <Field label="Decision reason *"><input required className={inputCls} value={form2.decisionReason} onChange={(e) => setForm2({ ...form2, decisionReason: e.target.value })} /></Field>
                </div>
                <Field label="Technical justification"><textarea className={inputCls} rows={2} value={form2.technicalJustification} onChange={(e) => setForm2({ ...form2, technicalJustification: e.target.value })} /></Field>
                <Field label="Digital signature (name)"><input className={inputCls} value={form2.signature} onChange={(e) => setForm2({ ...form2, signature: e.target.value })} /></Field>
                <button className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-medium">Submit Inspection → Forward to Fleet Manager</button>
              </form>
            )}

            {/* Form 3 */}
            {canDecide && (
              <form onSubmit={submitManagerDecision} className="border-2 border-emerald-200 rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-emerald-800">Form 3 — Fleet Manager Final Decision</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Decision">
                    <select className={inputCls} value={form3.decision} onChange={(e) => setForm3({ ...form3, decision: e.target.value })}>
                      <option value="ACCEPTED">Accept</option>
                      <option value="REJECTED">Reject</option>
                    </select>
                  </Field>
                  <Field label="Budget available?">
                    <select className={inputCls} value={form3.budgetAvailable ? "yes" : "no"} onChange={(e) => setForm3({ ...form3, budgetAvailable: e.target.value === "yes" })}>
                      <option value="yes">Budget available</option>
                      <option value="no">Not available</option>
                    </select>
                  </Field>
                </div>
                <Field label="Manager remarks / explanation *"><textarea required className={inputCls} rows={2} value={form3.remarks} onChange={(e) => setForm3({ ...form3, remarks: e.target.value })} /></Field>
                <Field label="Manager signature (name)"><input className={inputCls} value={form3.signature} onChange={(e) => setForm3({ ...form3, signature: e.target.value })} /></Field>
                <button className="bg-emerald-600 text-white px-4 py-2 rounded text-sm font-medium">Submit Final Decision</button>
              </form>
            )}

            {/* Form 4 */}
            {canExecute && (
              <form onSubmit={submitTask} className="border-2 border-cyan-200 rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-cyan-800">Form 4 — Maintenance Execution & Completion</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Field label="Technician ID"><input className={inputCls} value={form4.technicianId} onChange={(e) => setForm4({ ...form4, technicianId: e.target.value })} /></Field>
                  <Field label="Workshop"><input className={inputCls} value={form4.workshop} onChange={(e) => setForm4({ ...form4, workshop: e.target.value })} /></Field>
                  <Field label="Repair start date"><input type="datetime-local" className={inputCls} value={form4.repairStartDate} onChange={(e) => setForm4({ ...form4, repairStartDate: e.target.value })} /></Field>
                  <Field label="Actual cost"><input type="number" className={inputCls} value={form4.actualCost} onChange={(e) => setForm4({ ...form4, actualCost: e.target.value })} /></Field>
                  <Field label="Completion date"><input type="datetime-local" className={inputCls} value={form4.completionDate} onChange={(e) => setForm4({ ...form4, completionDate: e.target.value })} /></Field>
                  <Field label="Final odometer (km)"><input type="number" className={inputCls} value={form4.finalOdometerKm} onChange={(e) => setForm4({ ...form4, finalOdometerKm: e.target.value })} /></Field>
                  <Field label="Vehicle status">
                    <select className={inputCls} value={form4.vehicleStatus} onChange={(e) => setForm4({ ...form4, vehicleStatus: e.target.value })}>
                      <option value="REPAIRED">Repaired</option>
                      <option value="PARTIALLY_REPAIRED">Partially repaired</option>
                      <option value="NOT_REPAIRED">Not repaired</option>
                    </select>
                  </Field>
                </div>
                <Field label="Parts used (JSON: [{&quot;name&quot;:&quot;...&quot;,&quot;quantity&quot;:1}])"><textarea className={inputCls} rows={2} value={form4.partsUsed} onChange={(e) => setForm4({ ...form4, partsUsed: e.target.value })} placeholder='[{"name":"Brake pads","quantity":2}]' /></Field>
                <Field label="Repair description / work performed"><textarea className={inputCls} rows={2} value={form4.repairDescription} onChange={(e) => setForm4({ ...form4, repairDescription: e.target.value })} /></Field>
                <Field label="Technician remarks"><textarea className={inputCls} rows={2} value={form4.technicianRemarks} onChange={(e) => setForm4({ ...form4, technicianRemarks: e.target.value })} /></Field>
                <button className="bg-cyan-600 text-white px-4 py-2 rounded text-sm font-medium">Save Execution Record</button>
              </form>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ---------- tabs ----------
  const driverTabs = [
    { id: "new-request", label: "New Maintenance Request" },
    { id: "my-requests", label: "My Requests" },
  ]
  const teamTabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "review", label: "Review Queue" },
    { id: "register", label: "Request Register" },
  ]
  const managerTabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "pending", label: "Pending Decisions" },
    { id: "register", label: "Request Register" },
  ]

  const tabs = isDriver ? driverTabs : isManager ? managerTabs : teamTabs

  // ---------- render ----------
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {toast && <div className="fixed top-4 right-4 z-[60] bg-green-600 text-white px-4 py-2 rounded shadow">{toast}</div>}

      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Maintenance Request & Approval</h1>
          <p className="text-sm text-gray-500">Driver → Maintenance Team → Fleet Manager workflow</p>
        </div>
        <Link href="/fleet" className="text-sm text-blue-600 hover:underline">← Back to Fleet</Link>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">{error}</div>}

      {/* Tabs */}
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

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : (
        <>
          {/* DRIVER VIEWS */}
          {isDriver && tab === "new-request" && (
            <form onSubmit={submitRequest} className="bg-white rounded-lg shadow border p-6 space-y-4 max-w-3xl">
              <h2 className="text-lg font-semibold">Form 1 — Driver Maintenance Request</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Vehicle *">
                  <select required className={inputCls} value={form1.vehicleId} onChange={(e) => setForm1({ ...form1, vehicleId: e.target.value })}>
                    <option value="">Select vehicle…</option>
                    {vehicles.map((v: any) => (
                      <option key={v.id} value={v.id}>{v.plate || v.id} {v.make ? `— ${v.make} ${v.model || ""}` : ""}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Priority">
                  <select className={inputCls} value={form1.priority} onChange={(e) => setForm1({ ...form1, priority: e.target.value })}>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label="Maintenance category *">
                  <select required className={inputCls} value={form1.category} onChange={(e) => setForm1({ ...form1, category: e.target.value })}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                  </select>
                </Field>
                <Field label="Vehicle condition *">
                  <select required className={inputCls} value={form1.vehicleCondition} onChange={(e) => setForm1({ ...form1, vehicleCondition: e.target.value })}>
                    {CONDITIONS.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                  </select>
                </Field>
                <Field label="Current odometer (KM)"><input type="number" className={inputCls} value={form1.currentOdometerKm} onChange={(e) => setForm1({ ...form1, currentOdometerKm: e.target.value })} /></Field>
                <Field label="Location"><input className={inputCls} value={form1.location} onChange={(e) => setForm1({ ...form1, location: e.target.value })} placeholder="Current vehicle location" /></Field>
                <Field label="Employee ID"><input className={inputCls} value={form1.employeeId} onChange={(e) => setForm1({ ...form1, employeeId: e.target.value })} /></Field>
                <Field label="Phone"><input className={inputCls} value={form1.phone} onChange={(e) => setForm1({ ...form1, phone: e.target.value })} /></Field>
              </div>
              <Field label="Problem description *">
                <textarea required rows={3} className={inputCls} value={form1.problemDescription} onChange={(e) => setForm1({ ...form1, problemDescription: e.target.value })} />
              </Field>
              <Field label="Supporting documents (photos / records)">
                <input type="file" multiple accept="image/*,.pdf" className="text-sm"
                  onChange={(e) => { Array.from(e.target.files || []).forEach(uploadFile) }} />
                {uploading && <p className="text-xs text-gray-500 mt-1">Uploading…</p>}
                {attachments.length > 0 && (
                  <div className="mt-1 text-xs text-blue-600">{attachments.length} file(s) attached</div>
                )}
              </Field>
              <button className="bg-blue-600 text-white px-5 py-2 rounded font-medium">Submit Request</button>
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
                  <h2 className="text-lg font-semibold">Maintenance Team Dashboard</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="New requests" value={stats.newRequests} color="text-blue-600" />
                    <StatCard label="Under inspection" value={stats.underInspection} color="text-indigo-600" />
                    <StatCard label="Approved" value={stats.approved} color="text-green-600" />
                    <StatCard label="Disapproved" value={stats.disapproved} color="text-orange-600" />
                    <StatCard label="Pending manager" value={stats.pendingManager} color="text-yellow-600" />
                    <StatCard label="In progress" value={stats.inProgress} color="text-cyan-600" />
                    <StatCard label="Completed" value={stats.completed} color="text-teal-600" />
                    <StatCard label="Rejected" value={stats.rejected} color="text-red-600" />
                  </div>
                  <div className="bg-white rounded-lg shadow border p-4">
                    <h3 className="text-base font-semibold mb-3">Requests awaiting your inspection</h3>
                    {renderRequestTable(reviewQueue, true)}
                  </div>
                </>
              )}
              {isManager && (
                <>
                  <h2 className="text-lg font-semibold">Fleet Manager Dashboard</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Pending decisions" value={stats.pendingDecisions} color="text-yellow-600" />
                    <StatCard label="Accepted" value={stats.accepted} color="text-emerald-600" />
                    <StatCard label="Rejected" value={stats.rejected} color="text-red-600" />
                    <StatCard label="In progress" value={stats.inProgress} color="text-cyan-600" />
                    <StatCard label="Completed" value={stats.completed} color="text-teal-600" />
                    <StatCard label="Returned to driver" value={stats.returnedToDriver} color="text-purple-600" />
                  </div>
                  <div className="bg-white rounded-lg shadow border p-4">
                    <h3 className="text-base font-semibold mb-3">Requests awaiting your final decision</h3>
                    {renderRequestTable(pendingManager, true)}
                  </div>
                </>
              )}
            </div>
          )}

          {/* REVIEW QUEUE (maintenance team) */}
          {isMaintTeam && tab === "review" && (
            <div className="bg-white rounded-lg shadow border p-4">
              <h2 className="text-lg font-semibold mb-3">Requests awaiting inspection</h2>
              {renderRequestTable(reviewQueue, true)}
            </div>
          )}

          {/* PENDING (manager) */}
          {isManager && tab === "pending" && (
            <div className="bg-white rounded-lg shadow border p-4">
              <h2 className="text-lg font-semibold mb-3">Pending final decisions</h2>
              {renderRequestTable(pendingManager, true)}
            </div>
          )}

          {/* REGISTER */}
          {isStaff && tab === "register" && (
            <div className="bg-white rounded-lg shadow border p-4 space-y-3">
              <div className="flex flex-wrap gap-3 items-center">
                <input
                  className="border rounded px-3 py-2 text-sm flex-1 min-w-[200px]"
                  placeholder="Search by request ID, driver or plate…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select className="border rounded px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">All statuses</option>
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
