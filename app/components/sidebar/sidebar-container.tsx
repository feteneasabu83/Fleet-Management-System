"use client";
import React from "react";
import { usePathname } from "next/navigation";
import VerticalNavigation from "@/app/components/sidebar/vertical-navigation";
import { useIsMobile } from "@/app/hooks/use-mobile";
import { Menu, X } from "lucide-react";

const SIDEBAR_STYLE: React.CSSProperties = {
  flexShrink: 0,
  borderRight: "1px solid rgba(148, 163, 184, 0.12)",
  background: "#000000",
  boxShadow: "4px 0 24px rgba(2, 6, 23, 0.35)",
};

export default function SidebarContainer() {
  const pathname = usePathname();
  const onAuthPages =
    pathname === "/login" || pathname?.startsWith("/login/") ||
    pathname === "/register" || pathname?.startsWith("/register/") ||
    pathname === "/forgot-password" || pathname?.startsWith("/forgot-password/");
  const onAboutPage = pathname === "/about" || pathname?.startsWith("/about/");

  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(false);

  // Close the drawer whenever the route changes
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (onAuthPages || onAboutPage) return null;

  // Mobile: sidebar becomes a slide-over drawer toggled by a floating button
  if (isMobile) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
          className="fixed left-3 z-40 flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 bg-black/80 text-white shadow-lg backdrop-blur-sm"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 76px)" }}
        >
          <Menu size={22} />
        </button>

        {open && (
          <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setOpen(false)}
            />
            <div
              className="relative flex h-full flex-col"
              style={{ ...SIDEBAR_STYLE, width: "min(280px, 85vw)", borderRight: "none" }}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
                className="absolute right-2 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
              >
                <X size={20} />
              </button>
              <div className="pt-12">
                <VerticalNavigation />
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Desktop: static sidebar
  return (
    <div className="app-sidebar" style={SIDEBAR_STYLE}>
      <VerticalNavigation />
    </div>
  );
}
