"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [success, setSuccess] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");

    if (!token) {
      setMsg("Invalid or missing reset token. Please request a new reset link.");
      return;
    }
    if (password.length < 6) {
      setMsg("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setMsg("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "Failed to reset password");
      }
      setSuccess(true);
      setMsg(data?.message || "Password has been reset successfully.");
    } catch (err: any) {
      setMsg(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        marginLeft: "calc(50% - 50vw)",
        backgroundColor: "#135a98",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        flexDirection: "column",
        padding: "8px 12px 24px",
      }}
    >
      <div style={{ color: "#b8860b", fontWeight: 900, fontSize: 28, marginBottom: 12, textAlign: "center" }}>
        INTEGRATED CSC DIGITAL SOLUTION
      </div>
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "#ffffff",
          boxShadow: "0 12px 30px rgba(0,0,0,0.15)",
          padding: 24,
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>Reset password</h1>
        <p style={{ fontSize: 13, color: "#475569", marginBottom: 16 }}>
          Enter your new password below.
        </p>

        {!token && !success ? (
          <p style={{ fontSize: 13, color: "#b91c1c" }}>
            This reset link is invalid or has expired. Please request a new one.
          </p>
        ) : success ? (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "#16a34a", fontWeight: 600 }}>{msg}</p>
            <Link
              href="/login"
              style={{ display: "inline-block", marginTop: 16, fontSize: 13, fontWeight: 700, color: "#2563eb", textDecoration: "none" }}
            >
              Go to Sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
            <div>
              <label htmlFor="password" style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 6 }}>New password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e7eb" }}
                placeholder="Enter new password"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 6 }}>Confirm password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e7eb" }}
                placeholder="Confirm new password"
              />
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
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Resetting..." : "Reset password"}
            </button>
          </form>
        )}

        {msg && !success && (
          <p style={{ marginTop: 12, fontSize: 13, color: "#b91c1c" }}>{msg}</p>
        )}
        {!success && (
          <div style={{ marginTop: 12, textAlign: "center" }}>
            <Link href="/login" style={{ fontSize: 13, fontWeight: 700, color: "#2563eb", textDecoration: "none" }}>
              Back to Sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
