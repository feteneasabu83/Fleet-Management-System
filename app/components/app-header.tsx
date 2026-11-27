"use client"
import React from "react"
import { usePathname } from "next/navigation"
import Image from "next/image"
import { signOut, decodeJwt } from "@/app/lib/auth"
import { FleetInboxToggle } from "@/app/components/fleet-inbox"
import ToastHost from "@/app/components/toast"


export default function AppHeader() {
  const pathname = usePathname()
  // Minimal header (registration only). Hide header on login, forgot-password, and about pages.
  const isLogin = pathname === "/login" || pathname?.startsWith("/login/")
  const isAbout = pathname === "/about" || pathname?.startsWith("/about/")
  const isForgot = pathname === "/forgot-password" || pathname?.startsWith("/forgot-password/")
  const onAuthPages =
    pathname === "/register" || pathname?.startsWith("/register/")
  if (isLogin || isForgot || isAbout) {
    return null
  }

  if (onAuthPages) {
    return (
      <header style={{ width: "100vw", background: "#fe6100", borderBottom: "1px solid #e5e7eb" }}>
        <div
          style={{
            display: "flex",
            flexDirection: 'column',
            alignItems: "center",
            justifyContent: "center",
            padding: "12px 10px",
            gap: 12,
            color: "#ffffff",
            flexWrap: 'wrap',
          }}
        >
          <div style={{ background: '#ffffff', borderRadius: 9999, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '1px solid rgba(0,0,0,0.08)' }}>
            <Image src="/gallery/FCSC.jpg" alt="FCSC Logo" width={96} height={96} priority style={{ borderRadius: 12, objectFit: 'contain', background: '#ffffff' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{ fontWeight: 800, fontSize: 22, lineHeight: 1.2, whiteSpace: 'nowrap', color: '#ffffff' }}>የፌደራል ሲቪል ሰርቪስ ኮሚሽን</div>
            <div style={{ fontWeight: 800, fontSize: 20, lineHeight: 1.2, whiteSpace: 'nowrap', color: '#ffffff' }}>Federal Civil Service Commission</div>
            <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.2, whiteSpace: 'nowrap', color: '#000000' }}>INTEGRATED CSC DIGITAL SOLUTION</div>
          </div>
        </div>
        <ToastHost />
      </header>
    )
  }

  // Default header for all other pages
  const [userName, setUserName] = React.useState<string>("Guest")
  const [userPhotoUrl, setUserPhotoUrl] = React.useState<string | null>(null)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [fcscMenuOpen, setFcscMenuOpen] = React.useState(false)
  const [isAdmin, setIsAdmin] = React.useState(false)
  const [isPlanner, setIsPlanner] = React.useState(false)
  const [isDeptHead, setIsDeptHead] = React.useState(false)
  const [isTeamLead, setIsTeamLead] = React.useState(false)
  const [isEmployee, setIsEmployee] = React.useState(false)
  const [roleLabel, setRoleLabel] = React.useState<string>("User")
  const [pwFormOpen, setPwFormOpen] = React.useState(false)
  const [pwCurrent, setPwCurrent] = React.useState("")
  const [pwNew, setPwNew] = React.useState("")
  const [pwBusy, setPwBusy] = React.useState(false)
  const [pwMsg, setPwMsg] = React.useState<string | null>(null)

  const submitChangePassword = async () => {
    if (!pwCurrent || pwNew.length < 8) {
      setPwMsg("New password must be at least 8 characters.")
      return
    }
    setPwBusy(true)
    setPwMsg(null)
    try {
      const token = localStorage.getItem("accessToken") || localStorage.getItem("jwt") || localStorage.getItem("token") || ""
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
      const res = await fetch(`${apiBase}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setPwMsg("Password changed successfully.")
        setPwCurrent("")
        setPwNew("")
      } else {
        setPwMsg(data?.message || "Failed to change password.")
      }
    } catch {
      setPwMsg("Network error.")
    } finally {
      setPwBusy(false)
    }
  }

  React.useEffect(() => {
    try {
      const token = typeof window !== "undefined" ? (localStorage.getItem("accessToken") || localStorage.getItem("jwt") || localStorage.getItem("token")) : null
      if (token) {
        const payload = decodeJwt(token)
        const name = (payload as any)?.name || (payload as any)?.preferred_username || (payload as any)?.given_name || (payload as any)?.email || "User"
        setUserName(String(name))
        // derive roles and admin flag
        const roles: string[] = []
        const p: any = payload || {}
        if (typeof p.role === 'string') roles.push(p.role)
        if (Array.isArray(p.role)) roles.push(...p.role)
        if (Array.isArray(p.roles)) roles.push(...p.roles)
        if (p.realm_access?.roles) roles.push(...p.realm_access.roles)
        if (p.resource_access) {
          for (const v of Object.values(p.resource_access)) {
            const rr = (v as any)?.roles
            if (Array.isArray(rr)) roles.push(...rr)
          }
        }
        const upperRoles = roles.map(String).map(r => r.toUpperCase())

        const isAdm = upperRoles.some(r => /(ADMIN|SYSTEM[_-]?ADMIN|SUPERUSER)/.test(r))
        setIsAdmin(isAdm)
        const planner = upperRoles.includes('PLANNING') || upperRoles.includes('PLANNER') || upperRoles.includes('STRATEGY')
        const deptHead = upperRoles.includes('DEPARTMENT_HEAD') || upperRoles.includes('DEPT_HEAD')
        const teamLead = upperRoles.includes('TEAM_LEAD') || upperRoles.includes('SUPERVISOR')
        const employee = upperRoles.includes('EMPLOYEE') || upperRoles.includes('STAFF')

        setIsPlanner(planner)
        setIsDeptHead(deptHead)
        setIsTeamLead(teamLead)
        setIsEmployee(employee)

        // Derive a human-readable role label for header display.
        // Priority: System Admin > HR supervisor > Fleet manager > Planner > Dept Head > Team Lead > Employee > User.
        const hrSupervisor = upperRoles.includes('HR_SUPERVISOR') || upperRoles.includes('HR SUPERVISOR') || upperRoles.includes('HR-SUPERVISOR')
        const fleetManager = upperRoles.includes('FLEET_MANAGER') || upperRoles.includes('FLEET MANAGER') || upperRoles.includes('FLEET-MANAGER')
        const endUser = upperRoles.includes('END_USER') || upperRoles.includes('END USER') || upperRoles.includes('END-USER')

        let label = 'User'
        if (isAdm) label = 'System Admin'
        else if (hrSupervisor) label = 'HR supervisor'
        else if (fleetManager) label = 'Fleet manager'
        else if (planner) label = 'Planner'
        else if (deptHead) label = 'Department Head'
        else if (teamLead) label = 'Team Lead'
        else if (employee || endUser) label = 'User'

        setRoleLabel(label)

        const userId = (payload as any)?.id || (payload as any)?.userId || (payload as any)?.sub
        if (userId) {
          const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
          const base = apiBase.replace(/\/$/, "")
          fetch(`${base}/api/users/${userId}`, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (!data?.photoUrl) return
              const raw = String(data.photoUrl)
              const fullUrl = raw.startsWith("http://") || raw.startsWith("https://")
                ? raw
                : `${base}${raw.startsWith("/") ? "" : "/"}${raw}`
              setUserPhotoUrl(fullUrl)
            })
            .catch(() => {})
        }
      }
    } catch {
      // ignore
    }
  }, [])

  return (
    <header style={{ width: "100%", background: "linear-gradient(90deg, #ffffff 0%, #14532d 33%, #3a2f16 66%, #eab308 100%)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: 'space-between',
        padding: "12px 12px",
        gap: 12,
        flexWrap: 'wrap',
        rowGap: 8,
        minHeight: 64,
      }}>
        {/* Left: App title */}
        <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '1.1rem', whiteSpace: 'nowrap' }}>
          Fleet Management System
        </span>

        {/* Right: Fleet Inbox + User */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative', flexWrap: 'wrap', justifyContent: 'flex-end', marginLeft: 'auto' }}>
          <FleetInboxToggle />
          <button
            onClick={() => setMenuOpen((v: boolean) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title={`Welcome ${userName}`}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ffffff', padding: 0 }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 28,
                height: 28,
                borderRadius: '9999px',
                background: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(255,255,255,0.25)'
              }}>
                <span role="img" aria-label="user">👤</span>
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}>
                <span style={{ color: '#ffffff', fontWeight: 700, fontSize: 12 }}>{userName}</span>
                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>{roleLabel}</span>
              </span>
            </span>
          </button>
          {menuOpen ? (
            <div
              role="menu"
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                minWidth: 200,
                padding: 8,
                zIndex: 40,
              }}
            >
              {pwFormOpen ? (
                <div style={{ padding: '4px 2px' }}>
                  <input
                    type="password"
                    placeholder="Current password"
                    value={pwCurrent}
                    onChange={(e) => setPwCurrent(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', marginBottom: 6, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }}
                  />
                  <input
                    type="password"
                    placeholder="New password (min 8 chars)"
                    value={pwNew}
                    onChange={(e) => setPwNew(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', marginBottom: 6, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }}
                  />
                  {pwMsg && <div style={{ fontSize: 11, color: pwMsg.includes('success') ? '#15803d' : '#b91c1c', marginBottom: 6 }}>{pwMsg}</div>}
                  <button
                    onClick={submitChangePassword}
                    disabled={pwBusy}
                    style={{ width: '100%', padding: '6px 8px', background: '#125899', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                  >
                    {pwBusy ? 'Saving…' : 'Save'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setPwFormOpen(true); setPwMsg(null) }}
                  style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: '8px 10px', cursor: 'pointer', color: '#111827', fontWeight: 600, borderRadius: 6 }}
                  onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => ((e.target as HTMLButtonElement).style.background = '#f3f4f6')}
                  onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => ((e.target as HTMLButtonElement).style.background = 'transparent')}
                >
                  Change Password
                </button>
              )}
              <button
                onClick={() => { setMenuOpen(false); signOut('/login') }}
                style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: '8px 10px', cursor: 'pointer', color: '#b91c1c', fontWeight: 700, borderRadius: 6 }}
                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => ((e.target as HTMLButtonElement).style.background = '#fef2f2')}
                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => ((e.target as HTMLButtonElement).style.background = 'transparent')}
              >
                Sign Out
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <ToastHost />
    </header>
  )
}
