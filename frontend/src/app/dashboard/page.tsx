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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    async function load() {
      try {
        const resStats: any = await api.getDashboardStats();
        const resCases: any = await api.getRecentCases(8);
        setStats(resStats || null);
        setRecentCases(Array.isArray(resCases) ? resCases : []);
      } catch { /* empty */ }
      setLoading(false);
    }
    load();
  }, []);

  const demoUser = user || { full_name: "Demo Citizen", role: "PUBLIC" };

  const statCards = stats
    ? [
        { label: "Total Cases", value: stats.cases.total, icon: "📋", color: "#6366f1" },
        { label: "Active Cases", value: stats.cases.active, icon: "🔍", color: "#3b82f6" },
        { label: "Resolved", value: stats.cases.resolved, icon: "✅", color: "#10b981" },
        { label: "Resolution Rate", value: `${stats.cases.resolution_rate}%`, icon: "📈", color: "#f59e0b" },
        { label: "Missing Persons", value: stats.persons.missing, icon: "🚨", color: "#ef4444" },
        { label: "Found Persons", value: stats.persons.found, icon: "🤝", color: "#8b5cf6" },
      ]
    : [];

  return (
    <div className="page-enter min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden relative w-full">
      {/* ─── NATIONAL INFRASTRUCTURE TELEMETRY BANNER ─── */}
      <div className="bg-gradient-to-r from-blue-950 via-indigo-950 to-slate-950 text-slate-300 text-center py-2 px-3 text-[11px] sm:text-xs font-semibold relative z-50 w-full border-b border-indigo-500/20 tracking-wide">
        <p className="line-clamp-1 sm:line-clamp-none">
          🇵🇰 NATIONAL CIVIC REGISTRY — WAJOOD: Pakistan&apos;s Unified AI Biometric Missing Persons Network | Real-Time Telemetry Grid
        </p>
      </div>

      <div className="mesh-gradient fixed inset-0 pointer-events-none" />

      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 min-h-[64px] flex items-center justify-between py-2 gap-2">
        <div className="flex items-center gap-2 sm:gap-6 shrink-0">
          <Link href="/" className="flex items-baseline gap-1 no-underline group">
            <span className="text-xl sm:text-2xl font-black gradient-text tracking-tight">WAJOOD</span>
            <span className="text-[9px] sm:text-[10px] font-extrabold text-slate-400 tracking-[0.2em] uppercase opacity-90 group-hover:text-indigo-400 transition-colors">PAKISTAN</span>
          </Link>
          <span className="text-slate-500 text-xs sm:text-sm font-medium hidden sm:inline">• National Dashboard</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <Link href="/public" className="hidden sm:flex btn-secondary px-4 py-2 text-sm min-h-[44px] items-center justify-center font-bold">
            Explore Portals →
          </Link>
          <div className="hidden sm:flex items-center gap-2 bg-white/5 rounded-xl px-3.5 py-1.5 border border-white/5">
            <div className="w-2 h-2 rounded-full" style={{ background: getRoleColor(demoUser.role) }} />
            <span className="text-xs text-slate-300 font-semibold truncate max-w-[120px]">{demoUser.full_name}</span>
          </div>

          {/* Mobile Hamburger Trigger */}
          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="sm:hidden p-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center text-lg shrink-0"
            aria-label="Open Menu"
          >
            {mobileNavOpen ? "✕" : "☰"}
          </button>
        </div>
      </nav>

      {/* Mobile Dropdown Drawer Menu Box */}
      {mobileNavOpen && (
        <div className="sm:hidden sticky top-[64px] z-40 bg-slate-900/95 border-b border-white/10 p-5 shadow-2xl backdrop-blur-2xl animate-fadeIn flex flex-col gap-3">
          <Link onClick={() => setMobileNavOpen(false)} href="/public" className="btn-primary w-full py-3 text-center font-bold block min-h-[44px] flex items-center justify-center">
            Explore All Portals →
          </Link>
          <Link onClick={() => setMobileNavOpen(false)} href="/" className="btn-secondary w-full py-3 text-center font-bold block min-h-[44px] flex items-center justify-center">
            🏠 Platform Home
          </Link>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-8 sm:py-10">
        {/* Welcome */}
        <div className="mb-8 sm:mb-10">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black mb-2 tracking-tight">
            Welcome back, <span className="gradient-text">{demoUser.full_name.split(" ")[0]}</span>
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm font-medium">
            Here&apos;s a live overview of the nationwide WAJOOD reunification telemetry
          </p>
        </div>

        {/* Stats Grid */}
        {loading ? (
          <div className="text-center py-16 text-slate-400 font-medium">Loading national metrics...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-8 sm:mb-10 w-full">
              {statCards.map((s) => (
                <div key={s.label} className="saas-card p-4 sm:p-5 flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-2xl">{s.icon}</span>
                    <div className="w-2 h-2 rounded-full opacity-70 shrink-0" style={{ background: s.color }} />
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono tracking-tight stat-number text-white truncate">
                    {s.value}
                  </div>
                  <div className="text-[11px] sm:text-xs font-semibold text-slate-400 mt-1 truncate">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Recent Cases */}
            <div className="saas-card overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-white/10 flex justify-between items-center bg-white/[0.01]">
                <h2 className="text-base sm:text-lg font-bold text-white">Recent National Case Records</h2>
                <Link href={getPortalPath(demoUser.role)} className="text-indigo-400 hover:text-indigo-300 text-xs sm:text-sm font-bold no-underline transition">
                  View All Feed →
                </Link>
              </div>

              {recentCases.length === 0 ? (
                <div className="p-10 text-center text-slate-500 text-sm">
                  No cases registered in telemetric logs yet. Be the first to report.
                </div>
              ) : (
                <div className="overflow-x-auto w-full">
                  <table className="data-table w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02]">
                        <th className="p-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Case #</th>
                        <th className="p-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Subject Name</th>
                        <th className="p-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                        <th className="p-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Priority</th>
                        <th className="p-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Location</th>
                        <th className="p-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Filed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {recentCases.map((c) => (
                        <tr key={c.id} className="hover:bg-white/[0.02] transition">
                          <td className="p-3.5 font-mono text-xs font-bold text-indigo-400">{c.case_number}</td>
                          <td className="p-3.5 text-xs sm:text-sm font-semibold text-slate-200">{c.person?.full_name || c.title || "Unknown"}</td>
                          <td className="p-3.5">
                            <span className="badge text-[10px] font-bold px-2 py-0.5 rounded-full uppercase" style={{
                              background: `${getStatusColor(c.status)}20`,
                              color: getStatusColor(c.status),
                            }}>
                              {getStatusLabel(c.status)}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span className={`badge badge-${c.priority?.toLowerCase() || "medium"} text-[10px] uppercase font-bold`}>{c.priority || "MEDIUM"}</span>
                          </td>
                          <td className="p-3.5 text-xs text-slate-400 truncate max-w-[150px]">
                            {c.last_seen_district || c.last_seen_province || c.last_seen_city || "—"}
                          </td>
                          <td className="p-3.5 text-xs text-slate-500 whitespace-nowrap">{timeAgo(c.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Footer ── */}
      <footer className="mt-16 py-10 px-4 sm:px-8 border-t border-white/10 bg-slate-950 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base sm:text-lg font-black gradient-text tracking-tight">WAJOOD</span>
            <span className="text-[9px] font-extrabold text-slate-400 tracking-[0.2em] uppercase">PAKISTAN</span>
            <span className="text-slate-600 ml-1 hidden xs:inline">• National Missing Persons Grid</span>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-5 text-slate-600 font-medium">
            <span>© {new Date().getFullYear()} WAJOOD Network. All rights reserved.</span>
            <span className="hidden sm:inline">•</span>
            <span>Conceived &amp; Developed by <span className="text-slate-400 font-semibold tracking-wide hover:text-indigo-400 transition">Junaid Ahmed</span></span>
          </div>
        </div>
      </footer>
    </div>
  );
}
