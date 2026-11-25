"use client";

import React, { useEffect, useState } from "react";
import { DashboardLayout } from "@/app/components/dashboard-layout";
import { AuthGuard } from "@/app/components/auth-guard";
import { ClipboardList } from "lucide-react";
import { useRouter } from "next/navigation";
import { getCurrentUserPrimaryRole, getCurrentUserId } from "@/app/lib/auth";
import { getDepartmentInfo } from "@/app/lib/session";

export default function DepartmentHeadDashboardPage() {
  const router = useRouter();

  const [fleetPendingCount, setFleetPendingCount] = useState<number | null>(null);
  const [statusCounts, setStatusCounts] = useState({ pending: 0, approved: 0, completed: 0, rejected: 0, total: 0 });
  const deptInfo = getDepartmentInfo();

  // Simple helper reused from other pages
  function getToken() {
    try {
      return (
        localStorage.getItem("accessToken") ||
        localStorage.getItem("jwt") ||
        localStorage.getItem("token") ||
        ""
      );
    } catch {
      return "";
    }
  }

  const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");

  useEffect(() => {
    async function loadCounts() {
      try {
        // 1) Fleet requests PENDING approval for this department
        //    - Increments when users submit new requests (status = PENDING)
        //    - Decrements automatically after Department Head approves (status changes to APPROVED)
        // Use the same source as the department-head approvals page so we only count
        // team members' pending requests assigned to this department head.
        const token = getToken();

        // --- Fleet requests pending approval ---
        const res = await fetch(`${API_BASE}/api/fleet/requests/department-requests`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json().catch(() => ({}));
        const items = Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data)
          ? data
          : [];
        const currentUserId = getCurrentUserId();
        const teamRequests = items.filter((req: any) => {
          const requesterId = req?.requestor?.id;
          return requesterId && requesterId !== currentUserId;
        });

        const pending = teamRequests.filter((req: any) => {
          const status = (req as any).status || (req as any).requestStatus || (req as any).currentStatus;
          return typeof status === "string" && status.toLowerCase() === "pending";
        });

        const next = { pending: 0, approved: 0, completed: 0, rejected: 0, total: teamRequests.length };
        teamRequests.forEach((req: any) => {
          const s = String((req as any).status || (req as any).requestStatus || (req as any).currentStatus || "").toUpperCase();
          if (s === "PENDING" || s === "SUBMITTED" || s === "DRAFT") next.pending++;
          else if (s === "APPROVED") next.approved++;
          else if (s === "COMPLETED" || s === "DONE" || s === "CLOSED") next.completed++;
          else if (s === "REJECTED" || s === "CANCELLED" || s === "DENIED") next.rejected++;
        });

        setFleetPendingCount(pending.length);
        setStatusCounts(next);
      } catch {
        setFleetPendingCount(0);
        setStatusCounts({ pending: 0, approved: 0, completed: 0, rejected: 0, total: 0 });
      }
    }

    // Only load counts for department heads; others will be redirected below
    loadCounts();
  }, []);

  // If user is not a department head, send them to the main dashboard router
  useEffect(() => {
    const role = getCurrentUserPrimaryRole();
    if (role !== "department_head" && role !== "women_social_inclusion") {
      router.replace("/fleet/request");
    }
  }, [router]);

  const formatCount = (value: number | null) => {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return "0";
    }
    return String(value);
  };

  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-1 text-center">
            {deptInfo?.name && (
              <h2 className="text-2xl font-bold text-gray-900">
                {deptInfo.name}
              </h2>
            )}
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Pending Approvals card */}
            <button
              type="button"
              onClick={() => router.push("/fleet/department-head?tab=approvals")}
              className="bg-white rounded-2xl shadow-md border flex items-center justify-between px-10 py-8 relative overflow-hidden text-left hover:shadow-lg transition-shadow cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              {/* Left accent border */}
              <div className="absolute inset-y-0 left-0 w-1 bg-emerald-500" />

              <div className="relative flex flex-col">
                <span className="text-base font-semibold text-amber-500 mb-2">
                  የመጣ የመኪና ጥያቄ
                </span>
                <span className="text-5xl font-extrabold text-gray-800 leading-tight">
                  {formatCount(fleetPendingCount)}
                </span>
              </div>

              <div className="relative flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50 text-emerald-500">
                <ClipboardList className="w-7 h-7" />
              </div>
            </button>
          </div>

          {/* Report charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">የቡድን ጥያቄዎች ሁኔታ — Team Request Status</h3>
              <StatusBarChart counts={statusCounts} />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">የቡድን ጥያቄ ክፍፍል — Team Share</h3>
              <StatusDonut counts={statusCounts} />
            </div>
          </div>
        </div>
      </DashboardLayout>
    </AuthGuard>
  );
}

const STATUS_ITEMS = [
  { key: "pending", label: "Pending", color: "#F59E0B" },
  { key: "approved", label: "Approved", color: "#10B981" },
  { key: "completed", label: "Completed", color: "#6366F1" },
  { key: "rejected", label: "Rejected", color: "#EF4444" },
] as const;

function StatusBarChart({ counts }: { counts: { pending: number; approved: number; completed: number; rejected: number; total: number } }) {
  const max = Math.max(1, ...STATUS_ITEMS.map((s) => counts[s.key]));
  return (
    <div className="flex h-56 items-end justify-around gap-3">
      {STATUS_ITEMS.map((s) => {
        const v = counts[s.key];
        const h = Math.max(4, (v / max) * 160);
        return (
          <div key={s.key} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-xs font-bold text-slate-700">{v}</span>
            <div className="w-full rounded-t-md" style={{ height: h, background: s.color }} />
            <span className="text-[11px] text-slate-500">{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function StatusDonut({ counts }: { counts: { pending: number; approved: number; completed: number; rejected: number; total: number } }) {
  const size = 180;
  const stroke = 24;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let acc = 0;
  const slices = STATUS_ITEMS.filter((s) => counts[s.key] > 0).map((s) => {
    const frac = counts.total > 0 ? counts[s.key] / counts.total : 0;
    const dash = frac * circumference;
    const offset = -acc * circumference;
    acc += frac;
    return { ...s, dash, offset };
  });
  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[200px]">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E5E7EB" strokeWidth={stroke} />
        {slices.map((s) => (
          <circle key={s.key} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={stroke}
            strokeDasharray={`${s.dash} ${circumference - s.dash}`} strokeDashoffset={s.offset}
            transform={`rotate(-90 ${cx} ${cy})`} />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={22} fontWeight={700} fill="#111827">{counts.total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize={10} fill="#6B7280">Total</text>
      </svg>
      <div className="flex flex-wrap justify-center gap-3 text-xs">
        {STATUS_ITEMS.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-gray-600">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: s.color }} />
            {s.label}: {counts[s.key]}
          </span>
        ))}
      </div>
    </div>
  );
}
