"use client";
import React from "react";
import { usePathname } from "next/navigation";

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

  return (
    <aside className="hidden xl:block" style={{ width: 300, flexShrink: 0, padding: "16px 16px 16px 0", alignSelf: "flex-start", position: "sticky", top: 0 }}>
      <div style={{ fontSize: 11, color: "#8a8d91", padding: "0 4px" }}>
        ICSDS Fleet v2.0 — Fleet Management System
      </div>
    </aside>
  );
}
