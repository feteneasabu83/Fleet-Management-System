"use client";
import React from "react";
import { usePathname } from "next/navigation";
import { Car } from "lucide-react";

export default function RightSidebar() {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
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

  if (onAuthPages || isMobile) return null;

  const card: React.CSSProperties = {
    background: "#ffffff",
    borderRadius: 12,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    padding: "14px 16px",
    marginBottom: 16,
  };

  return (
    <aside className="hidden xl:block" style={{ width: 300, flexShrink: 0, padding: "16px 16px 16px 0", alignSelf: "flex-start", position: "sticky", top: 0 }}>
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
