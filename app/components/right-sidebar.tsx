"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getCurrentUserRoles } from "@/app/lib/auth";
import {
  LayoutDashboard,
  FileText,
  Fuel,
  Wrench,
  Users,
  BarChart3,
  Plus,
  UserPlus,
  Building2,
  Car,
} from "lucide-react";

type Shortcut = { icon: React.ComponentType<{ size?: number | string; className?: string }>; label: string; href: string };

export default function RightSidebar() {
  const pathname = usePathname();
  const [roles, setRoles] = React.useState<string[]>([]);
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    setRoles(getCurrentUserRoles());
    const check = () => setIsMobile(window.innerWidth < 1280);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const onAuthPages =
    pathname === "/login" || pathname?.startsWith("/login/") ||
    pathname === "/register" || pathname?.startsWith("/register/") ||
    pathname === "/forgot-password" || pathname?.startsWith("/forgot-password/") ||
    pathname === "/about" || pathname?.startsWith("/about/");

  if (onAuthPages || isMobile || roles.length === 0) return null;

  const upper = roles.map((r) => r.toUpperCase());
  const isDriver = upper.includes("DRIVER") || upper.includes("SHOFAR") || upper.includes("CHOFER");
  const isMaint = upper.includes("MAINTENANCE") || upper.includes("MAINTENANCE_TEAM");
  const isFleet = upper.includes("FLEET_MANAGER") || upper.includes("FLEET MANAGER") || upper.includes("FLEET-MANAGER");
  const isAdmin = upper.some((r) => /(ADMIN|SYSTEM[_-]?ADMIN|SUPERUSER)/.test(r));
  const isHr = upper.includes("HR_SUPERVISOR") || upper.includes("HR SUPERVISOR") || upper.includes("HR-SUPERVISOR");
  const isStaff = isFleet || isAdmin || isHr || isMaint;

  const shortcuts: Shortcut[] = [
    ...(isStaff ? [{ icon: LayoutDashboard, label: "Dashboard", href: "/fleet/manager" }] : []),
    { icon: FileText, label: "የተሽከርካሪ መጠየቂያ ቅፅ", href: "/fleet/request" },
    { icon: Fuel, label: "የነዳጅ እና ጥገና", href: "/fleet/request?tab=fuel" },
    ...(isDriver || isMaint || isFleet || isAdmin
      ? [{ icon: Wrench, label: isDriver ? "የጥገና መጠየቂያ" : "የጥገና ጥያቄ ማጽደቂያ", href: "/fleet/maintenance-approval" }]
      : []),
    ...(isDriver
      ? [
          { icon: Plus, label: "Maintenance Request", href: "/fleet/maintenance-approval?tab=new-request" },
          { icon: FileText, label: "My Requests", href: "/fleet/maintenance-approval?tab=my-requests" },
        ]
      : []),
    ...(isStaff
      ? [
          { icon: UserPlus, label: "ሹ፜ር ይመድቡ", href: "/fleet/manager?tab=requests" },
          { icon: Fuel, label: "የነዳጅ ጥያቄዎች", href: "/fleet/manager/fuel-requests" },
          { icon: Users, label: "የሹ፜ር ማስተዳደሪያ", href: "/fleet/manager/driver-management" },
          { icon: BarChart3, label: "ጠቅላላ ሪፖርት", href: "/fleet/manager/reports" },
        ]
      : []),
    ...(isAdmin
      ? [
          { icon: Users, label: "User Management", href: "/users" },
          { icon: Building2, label: "Departments", href: "/departments" },
        ]
      : []),
  ];

  const card: React.CSSProperties = {
    background: "#ffffff",
    borderRadius: 12,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    padding: "14px 16px",
    marginBottom: 16,
  };

  return (
    <aside className="hidden xl:block" style={{ width: 300, flexShrink: 0, padding: "16px 16px 16px 0", alignSelf: "flex-start", position: "sticky", top: 0 }}>
      {/* Shortcuts */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#050505", marginBottom: 10 }}>Shortcuts</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {shortcuts.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.href + s.label}
                href={s.href}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, textDecoration: "none", color: "#050505", fontSize: 14, fontWeight: 500 }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = "#f0f2f5")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = "transparent")}
              >
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, background: "#e7f3ff", color: "#1877f2", flexShrink: 0 }}>
                  <Icon size={17} />
                </span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Fleet info card */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#14532d,#3a2f16)", color: "#fff" }}>
            <Car size={18} />
          </span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#050505" }}>ICSDS Fleet</div>
            <div style={{ fontSize: 12, color: "#65676b" }}>Fleet Management System</div>
          </div>
        </div>
        <p style={{ fontSize: 12, color: "#65676b", margin: 0, lineHeight: 1.5 }}>
          Manage vehicles, drivers, fuel, and maintenance requests in one place.
        </p>
      </div>

      <div style={{ fontSize: 11, color: "#8a8d91", padding: "0 4px" }}>
        ICSDS Fleet v2.0 — Fleet Management System
      </div>
    </aside>
  );
}
