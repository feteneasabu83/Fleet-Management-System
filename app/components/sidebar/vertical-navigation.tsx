"use client";
import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentUserRoles } from "@/app/lib/auth";
import {
  Users,
  Truck,
  Fuel,
  Wrench,
  BarChart3,
  Plus,
  UserPlus,
  LayoutDashboard,
  FileText,
  ChevronRight,
  Building2,
} from "lucide-react";

type NavItem = {
  icon: React.ElementType;
  label: string;
  href: string;
  match?: string[];
};

export default function VerticalNavigation() {
  const router = useRouter();
  const pathname = usePathname();

  const [isLoading, setIsLoading] = React.useState(true);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [isHr, setIsHr] = React.useState(false);
  const [isFleetManag, setIsFleetManag] = React.useState(false);
  const [isMaintenanceTeam, setIsMaintenanceTeam] = React.useState(false);
  const [isDeptHead, setIsDeptHead] = React.useState(false);
  const [isEndUser, setIsEndUser] = React.useState(false);
  const [isDriver, setIsDriver] = React.useState(false);

  React.useEffect(() => {
    try {
      const roles = getCurrentUserRoles()?.map((r) => String(r).toLowerCase()) || [];
      setIsAdmin(roles.includes("admin"));
      setIsFleetManag(roles.includes("fleet_manager") || roles.includes("manager"));
      setIsMaintenanceTeam(roles.includes("maintenance_team") || roles.includes("maintenace_team"));
      setIsHr(roles.includes("hr"));
      setIsDeptHead(roles.includes("department_head") || roles.includes("women_social_inclusion"));
      setIsEndUser(roles.includes("employee"));
      setIsDriver(roles.includes("driver"));
    } catch (error) {
      console.error("Error loading user roles:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const isActive = (item: NavItem) => {
    const base = pathname || "";
    return (item.match || [item.href.split("?")[0]]).some(
      (m) => base === m || base.startsWith(m + "/")
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400" />
      </div>
    );
  }

  const fleetItems: NavItem[] = [
    { icon: FileText, label: "የተሽከርካሪ መጠየቂያ ቅፅ", href: "/fleet/request", match: ["/fleet/request"] },
    { icon: Fuel, label: "የነዳጅ እና የመኪና ጥገና መጠየቂያ", href: "/fleet/request?tab=fuel", match: ["/fleet/request"] },
    ...(isMaintenanceTeam
      ? [{ icon: LayoutDashboard, label: "Maintenance Team Dashboard", href: "/fleet/maintenance", match: ["/fleet/maintenance"] }]
      : []),
    ...(isDriver || isMaintenanceTeam || isFleetManag || isAdmin
      ? [{ icon: Wrench, label: "የጥገና ጥያቄ ማጽደቂያ", href: "/fleet/maintenance-approval", match: ["/fleet/maintenance-approval"] }]
      : []),
    ...(isFleetManag || isAdmin || isHr
      ? [
          { icon: Plus, label: "መኪና ይመዝግቡ", href: "/fleet/vehicleAdd", match: ["/fleet/vehicleAdd"] },
          { icon: UserPlus, label: "ሹ፜ር ይመድቡ", href: "/fleet/manager?tab=requests", match: ["/fleet/manager"] },
          { icon: Fuel, label: "የነዳጅ ጥያቄዎች", href: "/fleet/manager/fuel-requests", match: ["/fleet/manager/fuel-requests"] },
          { icon: Wrench, label: "Maintenance Request", href: "/fleet/manager/maintenance", match: ["/fleet/manager/maintenance"] },
          { icon: Fuel, label: "የነዳጅ እና የጥገና ወጪዎች", href: "/fleet/manager/costs", match: ["/fleet/manager/costs"] },
          { icon: BarChart3, label: "የወጪ ሪፖርት", href: "/fleet/manager/cost-report", match: ["/fleet/manager/cost-report"] },
          { icon: BarChart3, label: "ጠቅላላ ሪፖርት", href: "/fleet/manager/reports", match: ["/fleet/manager/reports"] },
          { icon: Users, label: "የሹ፜ር ማስተዳደሪያ", href: "/fleet/manager/driver-management", match: ["/fleet/manager/driver-management"] },
          { icon: Truck, label: "Fleet Manager Dashboard", href: "/fleet/manager", match: ["/fleet/manager"] },
        ]
      : []),
    ...(isDeptHead
      ? [{ icon: LayoutDashboard, label: "Department Head Dashboard", href: "/dashboard/department-head", match: ["/dashboard/department-head"] }]
      : []),
    ...(isEndUser
      ? [{ icon: LayoutDashboard, label: "End-User Dashboard", href: "/dashboard/end-user", match: ["/dashboard/end-user"] }]
      : []),
    ...(isAdmin
      ? [
          { icon: Users, label: "User Management", href: "/users", match: ["/users"] },
          { icon: Building2, label: "Departments", href: "/departments", match: ["/departments"] },
        ]
      : []),
  ];

  return (
    <div className="flex h-full flex-col">
      <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
        <div className="space-y-0.5">
          {fleetItems.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;
            return (
              <button
                key={item.href + item.label}
                onClick={() => router.push(item.href)}
                className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-all duration-150 ${
                  active
                    ? "bg-sky-500/15 text-sky-300"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-sky-400" />
                )}
                <Icon
                  size={17}
                  className={`flex-shrink-0 transition-colors ${
                    active ? "text-sky-400" : "text-slate-400 group-hover:text-slate-200"
                  }`}
                />
                <span className="flex-1 truncate">{item.label}</span>
                <ChevronRight
                  size={14}
                  className={`flex-shrink-0 transition-all ${
                    active
                      ? "text-sky-400"
                      : "text-slate-600 opacity-0 group-hover:opacity-100"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-white/[0.06] px-5 py-3">
        <p className="text-[10px] text-slate-600">ICSDS Fleet v2.0 — Fleet Management System</p>
      </div>
    </div>
  );
}
