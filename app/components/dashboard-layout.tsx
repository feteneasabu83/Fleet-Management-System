"use client"

import type React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { useEffect, useState } from "react"
import { Menu, User, Users, Settings, Car, ClipboardList, FormInput } from "lucide-react"
import { Button } from "@/app/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { Badge } from "@/app/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import { cn } from "@/backend/lib/utils"
import { LanguageSelector } from "./language-selector"
import { getCurrentUserRoles } from "@/app/lib/auth"
import { useLocalization } from "@/app/hooks/use-localization"

interface DashboardLayoutProps {
  children: React.ReactNode
  showHeading?: boolean
}

type SidebarItem = { icon: any; href: string; labelKey?: string; label?: string }

function buildSidebarItems(roles: string[]): SidebarItem[] {
  const lower = roles.map((r) => r.toLowerCase())
  const base: SidebarItem[] = [
    { icon: Car, href: "/fleet", label: "Fleet" },
    { icon: FormInput, href: "/fleet/maintenance/record", label: "Maintenance Record" },
  ]

  if (lower.includes("admin") || lower.includes("manager") || lower.includes("department_head")) {
    base.push({ icon: ClipboardList, href: "/fleet/maintenance/request", label: "Maintenance Request" })
  }

  if (lower.includes("admin")) {
    base.splice(0, 0, { icon: Users, href: "/users", labelKey: "nav.users" })
    base.push({ icon: Settings, href: "/settings", labelKey: "nav.settings" })
  }

  return base
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { language, setLanguage, t, languageConfig } = useLocalization()
  const pathname = usePathname()
  const roles = getCurrentUserRoles()
  const sidebarItems = buildSidebarItems(roles)
  const [forceShowMenu, setForceShowMenu] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const sp = new URLSearchParams(window.location.search)
      setForceShowMenu(sp.get('menu') === '1')
    } catch {}
  }, [])
  const hideOnThisPage = !forceShowMenu && sidebarItems.some((i) => pathname === i.href || pathname.startsWith(i.href + '/'))
  // Always hide the outer sidebar to avoid covering internal page navigation
  const hideOuterSidebar = true

  return (
    <div className="min-h-screen bg-background relative overflow-hidden" dir={languageConfig.direction}>
      {/* Watermark */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%) rotate(-30deg)',
        fontSize: '4rem',
        fontWeight: 'bold',
        color: 'rgba(0, 0, 0, 0.05)',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        zIndex: 0,
        userSelect: 'none',
        width: '100%',
        textAlign: 'center',
        lineHeight: '1.2'
      }}>
      </div>
      {/* Sidebar disabled to prevent overlapping the internal navigation */}
      {!hideOnThisPage && !hideOuterSidebar && (
        <aside
          className={cn(
            "fixed left-0 z-40 transition-all duration-300",
            sidebarOpen ? "w-56" : "w-14",
            languageConfig.direction === "rtl" && "right-0 left-auto",
          )}
          style={{ background: "#135a98", top: 56, height: "calc(100vh - 56px)" }}
        >
          <div className="flex h-full flex-col">
            <nav className="flex-1 p-0 space-y-0">
              {sidebarItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <div key={item.href}>
                    <Link href={item.href}>
                      <Button
                        variant={isActive ? "default" : "ghost"}
                        size="lg"
                        className={cn(
                          "w-full justify-start gap-4 h-12 text-base rounded-none",
                          !sidebarOpen && "px-0",
                          "bg-[#135a98] text-white hover:bg-[#0f4e84] border-0",
                          isActive && "brightness-110",
                          languageConfig.direction === "rtl" && "flex-row-reverse",
                        )}
                      >
                        <item.icon className="w-6 h-6 flex-shrink-0" />
                        {sidebarOpen && (
                          <span className="text-base">{item.labelKey ? t(item.labelKey) : item.label}</span>
                        )}
                      </Button>
                    </Link>
                  </div>
                )
              })}
            </nav>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <div
        className={cn(
          "transition-all duration-300",
          hideOnThisPage || hideOuterSidebar ? "ml-0" : sidebarOpen ? "ml-56" : "ml-14",
          languageConfig.direction === "rtl" && ((hideOnThisPage || hideOuterSidebar) ? "mr-0 ml-0" : sidebarOpen ? "mr-56 ml-0" : "mr-14 ml-0"),
        )}
      >
        <main className="px-6 pb-6 pt-0">
          {children}
        </main>
      </div>
    </div>
  )
}
