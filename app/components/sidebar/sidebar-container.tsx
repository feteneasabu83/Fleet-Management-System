"use client";
import React from "react";
import { usePathname } from "next/navigation";
import VerticalNavigation from "@/app/components/sidebar/vertical-navigation";
import { useIsMobile } from "@/app/hooks/use-mobile";

export default function SidebarContainer() {
  const pathname = usePathname();
  const onAuthPages =
    pathname === "/login" || pathname?.startsWith("/login/") ||
    pathname === "/register" || pathname?.startsWith("/register/") ||
    pathname === "/forgot-password" || pathname?.startsWith("/forgot-password/");
  const onAboutPage = pathname === "/about" || pathname?.startsWith("/about/");

  const isMobile = useIsMobile();

  // Currently we always show the main sidebar (except auth/about), even on mobile,
  // so that header, sidebar, and workspace are visible together.
  if (onAuthPages || onAboutPage) return null;

  return (
    <div
      style={{
        width: 280,
        flexShrink: 0,
        borderRight: "1px solid rgba(148, 163, 184, 0.12)",
        background: "linear-gradient(180deg, #0b1220 0%, #0f172a 55%, #111c33 100%)",
        boxShadow: "4px 0 24px rgba(2, 6, 23, 0.35)",
      }}
    >
      <VerticalNavigation />
    </div>
  );
}
