"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { decodeJwt, getCurrentUserPrimaryRole } from "@/app/lib/auth";
import { saveAuthSession } from "@/app/lib/session";

function LoginPageInner() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [showVerifyMessage, setShowVerifyMessage] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      setShowVerifyMessage(params.get("verify") === "1");
    } catch {}
  }, []);

  const doLogin = async (emailArg: string, passwordArg: string) => {
    setLoading(true);
    setMsg("");
    try {
      const apiBase = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "")
      const res = await fetch(`${apiBase}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: emailArg, password: passwordArg }),
      });

      const raw = await res.text();
      let data: any = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw || undefined }; }

      if (!res.ok) {
        const errMsg = data?.message || data?.error || data?.detail || raw || "Invalid credentials";
        throw new Error(String(errMsg));
      }

      const token = data?.access_token || data?.accessToken || data?.token || data?.jwt || data?.data?.token || data?.data?.access_token || data?.data?.jwt;
      if (typeof window !== "undefined" && token) {
        const val = String(token)
        localStorage.setItem("token", val)
        localStorage.setItem("accessToken", val)
        localStorage.setItem("jwt", val)
        // Set auth cookie on the frontend domain so middleware.ts allows navigation
        const secureFlag = window.location.protocol === "https:" ? "; Secure" : ""
        document.cookie = `access_token=${encodeURIComponent(val)}; path=/; max-age=86400; SameSite=Lax${secureFlag}`
        // Persist session (token + backend user and decoded payload)
        try {
          saveAuthSession(val, data?.user ?? null)
        } catch {}
        // Safe client-side logging of user data
        try {
         
          const decoded = decodeJwt(val)
  
        } catch {}
      }
      setMsg("Login successful. Redirecting...");
      // Determine role-based dashboard
      const primary = getCurrentUserPrimaryRole();

      let target = "/fleet/request";
      if (primary === "admin" || primary === "manager" || primary === "commissioner") {
        target = "/fleet/manager";
      } else if (primary === "driver") {
        target = "/fleet/driver";
      } else if (primary === "maintenance_team") {
        target = "/fleet/maintenance";
      } else if (primary === "department_head" || primary === "women_social_inclusion") {
        target = "/dashboard/department-head";
      } else if (primary === "employee") {
        target = "/dashboard/end-user";
      }

      // Default falls back to end-user dashboard
      router.push(target);
    } catch (err: any) {
      const safeMsg = (err && typeof err.message === 'string' && err.message) || 'Login failed'
      setMsg(safeMsg)
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await doLogin(email, password)
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        minHeight: "100vh",
        width: "100vw",
        overflow: "hidden",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        background: "#ffffff", // ensure no off-white gutter is visible
      }}
    >
      <style>{`
        @keyframes floatCar { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
        @keyframes dashMove { to { stroke-dashoffset: -40; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulseGlow { 0%,100% { opacity: .35; } 50% { opacity: .7; } }
        .login-anim-1 { animation: fadeUp .7s ease both; }
        .login-anim-2 { animation: fadeUp .7s .12s ease both; }
        .login-anim-3 { animation: fadeUp .7s .24s ease both; }
        .login-anim-4 { animation: fadeUp .7s .36s ease both; }
        .login-car { animation: floatCar 4s ease-in-out infinite; }
        .login-road { animation: dashMove 1.2s linear infinite; }
        .login-glow { animation: pulseGlow 3s ease-in-out infinite; }
        @media (max-width: 860px) {
          .login-grid { grid-template-columns: 1fr !important; }
          .login-showcase { display: none !important; }
        }
      `}</style>
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "grid",
          gridTemplateColumns: "1.1fr 1fr",
          gap: 0,
        }}
        className="login-grid"
      >
        {/* ── Left: Vehicle showcase + system title ─────────── */}
        <div
          className="login-showcase"
          style={{
            position: "relative",
            overflow: "hidden",
            background: "linear-gradient(160deg, #0b2545 0%, #13315c 45%, #00579b 100%)",
            color: "#fff",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "48px 56px",
          }}
        >
          {/* decorative blobs */}
          <div style={{ position: "absolute", top: -120, right: -120, width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,189,248,.35), transparent 70%)" }} />
          <div style={{ position: "absolute", bottom: -140, left: -100, width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,.30), transparent 70%)" }} />
          <div className="login-glow" style={{ position: "absolute", top: "18%", left: "12%", width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,.12), transparent 70%)" }} />

          {/* System title */}
          <div className="login-anim-1" style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.25, letterSpacing: 0.5 }}>የመኪና አስተዳደር ሲስተም</div>
            <div style={{ fontSize: 14, color: "#93c5fd", marginTop: 8, fontWeight: 600, letterSpacing: 1 }}>Vehicle Management System</div>
          </div>

          {/* Vehicle illustration */}
          <div className="login-anim-3 login-car" style={{ margin: "8px 0 26px" }}>
            <svg width="100%" viewBox="0 0 520 220" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ maxWidth: 520, width: "100%" }}>
              {/* ground shadow */}
              <ellipse cx="260" cy="196" rx="220" ry="14" fill="rgba(0,0,0,.35)" />
              {/* road dashes */}
              <line x1="10" y1="200" x2="510" y2="200" stroke="rgba(255,255,255,.35)" strokeWidth="3" strokeDasharray="26 18" className="login-road" />
              {/* car body */}
              <path d="M60 150 C60 138 70 132 84 130 L120 96 C132 82 152 74 178 74 L330 74 C356 74 374 84 388 100 L420 130 C436 132 446 138 446 150 L446 168 C446 176 440 180 432 180 L74 180 C66 180 60 176 60 168 Z" fill="url(#carBody)" />
              <defs>
                <linearGradient id="carBody" x1="60" y1="74" x2="446" y2="180" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#38bdf8" />
                  <stop offset="1" stopColor="#0369a1" />
                </linearGradient>
                <linearGradient id="carGlass" x1="0" y1="0" x2="0" y2="1">
                  <stop stopColor="#e0f2fe" stopOpacity=".95" />
                  <stop offset="1" stopColor="#7dd3fc" stopOpacity=".75" />
                </linearGradient>
              </defs>
              {/* windows */}
              <path d="M132 100 L168 84 L250 84 L250 122 L120 122 Z" fill="url(#carGlass)" />
              <path d="M262 84 L322 84 L360 122 L262 122 Z" fill="url(#carGlass)" />
              {/* door line + handle */}
              <line x1="256" y1="122" x2="256" y2="172" stroke="rgba(255,255,255,.5)" strokeWidth="2" />
              <rect x="272" y="132" width="26" height="6" rx="3" fill="rgba(255,255,255,.65)" />
              {/* headlight / taillight */}
              <ellipse cx="432" cy="146" rx="10" ry="6" fill="#fef08a" />
              <ellipse cx="74" cy="146" rx="8" ry="6" fill="#f87171" />
              {/* wheels */}
              <circle cx="140" cy="172" r="26" fill="#0f172a" />
              <circle cx="140" cy="172" r="13" fill="#94a3b8" />
              <circle cx="140" cy="172" r="5" fill="#e2e8f0" />
              <circle cx="366" cy="172" r="26" fill="#0f172a" />
              <circle cx="366" cy="172" r="13" fill="#94a3b8" />
              <circle cx="366" cy="172" r="5" fill="#e2e8f0" />
              {/* speed lines */}
              <line x1="20" y1="120" x2="52" y2="120" stroke="rgba(255,255,255,.5)" strokeWidth="4" strokeLinecap="round" />
              <line x1="8" y1="140" x2="44" y2="140" stroke="rgba(255,255,255,.35)" strokeWidth="4" strokeLinecap="round" />
              <line x1="24" y1="160" x2="50" y2="160" stroke="rgba(255,255,255,.25)" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </div>

          {/* Feature chips */}
          <div className="login-anim-4" style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {[
              ["🚘", "Fleet Management"],
              ["⛽", "Fuel Tracking"],
              ["🔧", "Maintenance"],
              ["📊", "Smart Reports"],
            ].map(([icon, label]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 999, background: "rgba(255,255,255,.10)", border: "1px solid rgba(255,255,255,.16)", backdropFilter: "blur(6px)", fontSize: 13, fontWeight: 600 }}>
                <span>{icon}</span>{label}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            boxShadow: "none",
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
          }}
        >
          <div style={{ width: "100%", maxWidth: 440, marginRight: 0 }}>
            <div style={{ textAlign: "center", marginBottom: 18 }}>
              <div style={{
                width: 64,
                height: 64,
                borderRadius: 999,
                margin: "0 auto 12px",
                background: "linear-gradient(135deg,#4f46e5,#0ea5e9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                boxShadow: "0 10px 30px rgba(79,70,229,0.35)",
              }}>
                <span style={{ fontSize: 28 }}>🔒</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>እንኳን ደህና መጡ</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>በመጠቀሚያ አካዉንትዎ ይግቡ</div>
            </div>

            {showVerifyMessage && (
              <div style={{
                marginBottom: 12,
                padding: "10px 12px",
                borderRadius: 8,
                background: "#ecfdf5",
                color: "#065f46",
                border: "1px solid #a7f3d0",
                fontSize: 13,
              }}>
                Your account was created. Please check your email to verify your address, then sign in.
              </div>
            )}

            <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
              <div>
                <label htmlFor="email" style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 6 }}>Email Address</label>
                <input
                  id="email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#f8fafc" }}
                  placeholder="Username or email"
                />
              </div>
              <div>
                <label htmlFor="password" style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 6 }}>Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#f8fafc" }}
                  placeholder="Enter your password"
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", marginTop: 2 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#475569" }}>
                  <input type="checkbox" style={{ width: 16, height: 16 }} />
                  Remember Me
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "none",
                  background: loading ? "#a3a3a3" : "#2563eb",
                  color: "#fff",
                  fontWeight: 800,
                  cursor: loading ? "not-allowed" : "pointer",
                  boxShadow: "0 10px 25px rgba(37,99,235,0.35)",
                }}
              >
                {loading ? "Signing in..." : "Login"}
              </button>
            </form>

            

            {msg && (
              <p style={{ marginTop: 12, fontSize: 13, textAlign: "center", color: msg.includes("successful") ? "#16a34a" : "#b91c1c" }}>{msg}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <LoginPageInner />;
}