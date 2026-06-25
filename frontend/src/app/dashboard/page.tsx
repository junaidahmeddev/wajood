"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store";
import { getRoleName, getRoleColor, getPortalPath } from "@/lib/auth";
import api from "@/lib/api";
import { DashboardStats, Case } from "@/types";
import { getStatusLabel, getStatusColor, formatDate, timeAgo } from "@/lib/utils";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, loadFromStorage } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentCases, setRecentCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    async function load() {
      try {
        const [s, r] = await Promise.all([
          api.getDashboardStats() as unknown as Promise<DashboardStats>,
          api.getRecentCases(8) as unknown as Promise<Case[]>,
        ]);
        setStats(s);
        setRecentCases(Array.isArray(r) ? r : []);
      } catch { /* empty */ }
      setLoading(false);
    }
    load();
  }, []);

  const demoUser = user || { full_name: "Demo Citizen", role: "PUBLIC" as any };

  const statCards = stats ? [
    { label: "Total Cases", value: stats.cases.total, icon: "📋", color: "#6366f1" },
    { label: "Active Cases", value: stats.cases.active, icon: "🔍", color: "#3b82f6" },
    { label: "Resolved", value: stats.cases.resolved, icon: "✅", color: "#10b981" },
    { label: "Resolution Rate", value: `${stats.cases.resolution_rate}%`, icon: "📈", color: "#f59e0b" },
    { label: "Missing Persons", value: stats.persons.missing, icon: "🚨", color: "#ef4444" },
    { label: "Found Persons", value: stats.persons.found, icon: "🤝", color: "#8b5cf6" },
  ] : [];

  return (
    <div className="page-enter" style={{ minHeight: "100vh" }}>
      {/* ─── STEP 4: FYP DEMO MODE BANNER ─── */}
      <div style={{ background: "#1d4ed8", color: "white", textAlign: "center", padding: "8px", fontSize: "14px", fontWeight: "bold", zIndex: 100, position: "relative" }}>
        🎓 FYP Demo Mode — WAJOOD: Pakistan&apos;s Missing Persons Platform | SSUET 2026 | All portals open for evaluation
      </div>

      <div className="mesh-gradient" />

      {/* Nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(10, 10, 15, 0.85)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <span style={{ fontSize: 22, fontWeight: 800 }} className="gradient-text">WAJOOD</span>
          </Link>
          <span style={{ color: "#475569", fontSize: "0.8rem" }}>/ Dashboard</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/public" className="btn-secondary" style={{ padding: "6px 16px", fontSize: "0.8rem" }}>
            Explore Portals
          </Link>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: "6px 14px",
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: getRoleColor(demoUser.role),
            }} />
            <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>{demoUser.full_name}</span>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
        {/* Welcome */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: 8, letterSpacing: "-0.02em" }}>
            Welcome back, <span className="gradient-text">{demoUser.full_name.split(" ")[0]}</span>
          </h1>
          <p style={{ color: "#64748b", fontSize: "0.95rem" }}>
            Here&apos;s an overview of the WAJOOD platform
          </p>
        </div>

        {/* Stats Grid */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>Loading dashboard data...</div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 40 }}>
              {statCards.map((s) => (
                <div key={s.label} className="glass-card" style={{ padding: 24 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <span style={{ fontSize: 28 }}>{s.icon}</span>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, opacity: 0.6 }} />
                  </div>
                  <div style={{ fontSize: "1.8rem", fontWeight: 800, letterSpacing: "-0.02em" }} className="stat-number">
                    {s.value}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Recent Cases */}
            <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{
                padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <h2 style={{ fontSize: "1.15rem", fontWeight: 700 }}>Recent Cases</h2>
                <Link href={getPortalPath(demoUser.role)} style={{ color: "#818cf8", fontSize: "0.85rem", textDecoration: "none" }}>
                  View All →
                </Link>
              </div>

              {recentCases.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
                  No cases yet. Be the first to report.
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Case #</th>
                      <th>Title</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Location</th>
                      <th>Filed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentCases.map((c) => (
                      <tr key={c.id}>
                        <td style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "#818cf8" }}>{c.case_number}</td>
                        <td style={{ fontWeight: 500 }}>{c.title}</td>
                        <td>
                          <span className="badge" style={{
                            background: `${getStatusColor(c.status)}20`,
                            color: getStatusColor(c.status),
                          }}>
                            {getStatusLabel(c.status)}
                          </span>
                        </td>
                        <td>
                          <span className={`badge badge-${c.priority}`}>{c.priority}</span>
                        </td>
                        <td style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
                          {c.last_seen_district || c.last_seen_province || "—"}
                        </td>
                        <td style={{ color: "#64748b", fontSize: "0.85rem" }}>{timeAgo(c.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
