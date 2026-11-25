"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/app/components/dashboard-layout";
import { AuthGuard } from "@/app/components/auth-guard";
import { getCurrentUserId, getCurrentUserPrimaryRole } from "@/app/lib/auth";
import { listFleetRequests } from "@/app/lib/fleet-api";

export default function EndUserDashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState({
    pending: 0,
    approved: 0,
    completed: 0,
    rejected: 0,
    total: 0,
  });

  // If the logged-in user is a Department Head, send them to the Department Head dashboard instead
  useEffect(() => {
    const role = getCurrentUserPrimaryRole();
    if (role === "department_head") {
      router.replace("/dashboard/department-head");
    }
  }, [router]);

  // Load basic system reports available to end-users
  const loadCounts = useCallback(async () => {
    setError(null);
    try {
      // Fleet management requests for current user, grouped by status
      const next = { pending: 0, approved: 0, completed: 0, rejected: 0, total: 0 };
      try {
        const me = getCurrentUserId();
        if (me) {
          const fleet = await listFleetRequests();
          const fleetArray = Array.isArray(fleet) ? fleet : [];
          const mine = fleetArray.filter((req: any) => req.requestorId === me);
          next.total = mine.length;
          mine.forEach((req: any) => {
            const s = String(req?.status || req?.requestStatus || req?.currentStatus || "").toUpperCase();
            if (s === "PENDING" || s === "SUBMITTED" || s === "DRAFT") next.pending++;
            else if (s === "APPROVED") next.approved++;
            else if (s === "COMPLETED" || s === "DONE" || s === "CLOSED") next.completed++;
            else if (s === "REJECTED" || s === "CANCELLED" || s === "DENIED") next.rejected++;
          });
        }
      } catch {
        // keep zeros
      }

      setCounts(next);
    } catch (e: any) {
      setError(e?.message || "Failed to load dashboard report");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  // Auto-refresh every 30 seconds to update counts when items are created
  useEffect(() => {
    const intervalId = setInterval(() => {
      loadCounts();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(intervalId);
  }, [loadCounts]);

  // Refresh when window regains focus (user comes back to tab)
  useEffect(() => {
    const handleFocus = () => {
      loadCounts();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadCounts]);

  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="space-y-6">
          {error && (
            <div className="p-3 rounded border border-red-200 bg-red-50 text-red-700">{error}</div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard
              title="የጥያቄ ሁኔታ በስታቲስቲክስ — Request Status"
              onRefresh={loadCounts}
              loading={loading}
            >
              <VerticalBars
                items={[
                  { label: "Pending", value: counts.pending, color: "#F59E0B" },
                  { label: "Approved", value: counts.approved, color: "#10B981" },
                  { label: "Completed", value: counts.completed, color: "#6366F1" },
                  { label: "Rejected", value: counts.rejected, color: "#EF4444" },
                ]}
              />
            </SectionCard>
            <SectionCard title="የጥያቄ ክፍፍል — Share">
              <DonutChart
                items={[
                  { label: "Pending", value: counts.pending, color: "#F59E0B" },
                  { label: "Approved", value: counts.approved, color: "#10B981" },
                  { label: "Completed", value: counts.completed, color: "#6366F1" },
                  { label: "Rejected", value: counts.rejected, color: "#EF4444" },
                ]}
                total={counts.total}
              />
            </SectionCard>
          </div>
        </div>
      </DashboardLayout>
    </AuthGuard>
  );
}

function ReportCard({
  title,
  value,
  loading,
  href,
  subtitle,
}: {
  title: string;
  value: number;
  loading: boolean;
  href: string;
  subtitle?: string;
}) {
  return (
    <Link href={href} className="group block rounded-lg border p-4 hover:border-blue-300 hover:shadow">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="mt-1 flex items-end justify-between">
        <div className="text-3xl font-bold">{loading ? "…" : value}</div>
        <div className="text-xs text-gray-400">{subtitle}</div>
      </div>
    </Link>
  );
}

function SectionCard({ 
  title, 
  children, 
  onRefresh,
  loading 
}: { 
  title: string; 
  children: React.ReactNode;
  onRefresh?: () => void;
  loading?: boolean;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">{title}</div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            title="Refresh counts"
          >
            <svg 
              className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? '' : ''}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function VerticalBars({ items }: { items: Array<{ label: string; value: number; color: string }> }) {
  const max = Math.max(1, ...items.map((i) => i.value || 0));
  const height = 220; // px
  const padding = { top: 20, right: 12, bottom: 40, left: 12 };
  const innerHeight = height - padding.top - padding.bottom;
  const gridLines = 4; // 25% steps
  const formatValue = (n: number) => new Intl.NumberFormat().format(n);

  return (
    <div className="w-full">
      <svg viewBox={`0 0 600 ${height}`} className="w-full h-[240px]">
        {/* Grid */}
        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const y = padding.top + (innerHeight * i) / gridLines;
          return (
            <line
              key={i}
              x1={padding.left}
              x2={600 - padding.right}
              y1={y}
              y2={y}
              stroke="#E5E7EB"
              strokeWidth={1}
            />
          );
        })}

        {/* Bars */}
        {items.map((it, idx) => {
          const barAreaWidth = (600 - padding.left - padding.right) / items.length;
          const barWidth = Math.min(60, barAreaWidth * 0.5);
          const cx = padding.left + barAreaWidth * idx + barAreaWidth / 2;
          const h = max === 0 ? 0 : (it.value / max) * innerHeight;
          const x = cx - barWidth / 2;
          const y = padding.top + innerHeight - h;
          return (
            <g key={it.label}>
              {/* value label above bar */}
              <text x={cx} y={y - 6} textAnchor="middle" fontSize={12} fill="#374151">
                {formatValue(it.value)}
              </text>
              <rect x={x} y={y} width={barWidth} height={h} fill={it.color} rx={2} />
              {/* x label */}
              <text x={cx} y={height - 12} textAnchor="middle" fontSize={12} fill="#374151">
                {it.label}
              </text>
            </g>
          );
        })}

        {/* Axis baseline */}
        <line
          x1={padding.left}
          x2={600 - padding.right}
          y1={padding.top + innerHeight}
          y2={padding.top + innerHeight}
          stroke="#9CA3AF"
          strokeWidth={1}
        />
      </svg>
    </div>
  );
}

function DonutChart({
  items,
  total,
}: {
  items: Array<{ label: string; value: number; color: string }>;
  total: number;
}) {
  const size = 220;
  const stroke = 28;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  let acc = 0;
  const slices = items
    .filter((i) => i.value > 0)
    .map((i) => {
      const frac = total > 0 ? i.value / total : 0;
      const dash = frac * circumference;
      const offset = -acc * circumference;
      acc += frac;
      return { ...i, dash, offset, pct: Math.round(frac * 100) };
    });

  return (
    <div className="flex flex-col items-center gap-4">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[240px]">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E5E7EB" strokeWidth={stroke} />
        {slices.map((s) => (
          <circle
            key={s.label}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeDasharray={`${s.dash} ${circumference - s.dash}`}
            strokeDashoffset={s.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize={26} fontWeight={700} fill="#111827">
          {total}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize={11} fill="#6B7280">
          Total
        </text>
      </svg>
      <div className="flex flex-wrap justify-center gap-3 text-xs">
        {items.map((i) => (
          <span key={i.label} className="inline-flex items-center gap-1.5 text-gray-600">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: i.color }} />
            {i.label}: {i.value}
          </span>
        ))}
      </div>
    </div>
  );
}

