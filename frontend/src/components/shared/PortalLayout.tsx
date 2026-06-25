"use client";

import { useEffect, useState, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store";
import { getRoleName, getRoleColor } from "@/lib/auth";
import { UserRole } from "@/types";
import NotificationBell from "./NotificationBell";

interface PortalLayoutProps {
  portalName: string;
  portalIcon: string;
  portalColor: string;
  allowedRoles: (UserRole | string)[];
  children: ReactNode;
}

export default function PortalLayout({ portalName, portalIcon, portalColor, allowedRoles, children }: PortalLayoutProps) {
  const router = useRouter();
  const { user, isAuthenticated, loadFromStorage } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    loadFromStorage();
    setMounted(true);
  }, [loadFromStorage]);

  const roleMap: Record<string, UserRole> = {
    ngo: "NGO_WORKER",
    law_enforcement: "OFFICER",
    hospital: "DOCTOR",
    media: "JOURNALIST",
    government: "GOVT_OFFICIAL",
    volunteer: "VOLUNTEER",
    forensics: "FORENSICS",
    public: "PUBLIC",
  };

  // Allow public access or role-based access
  const hasAccess = !allowedRoles.length || (user && (
    user.role === "ADMIN" ||
    allowedRoles.some((r) => r === user.role || r.toUpperCase() === user.role || roleMap[r.toLowerCase()] === user.role)
  ));

  const getDemoName = (pName: string) => {
    const lower = pName.toLowerCase();
    if (lower.includes("ngo") || lower.includes("shelter")) return { name: "Edhi Foundation Worker", role: "NGO Worker" };
    if (lower.includes("police") || lower.includes("officer") || lower.includes("law")) return { name: "FIA Officer", role: "Law Enforcement" };
    if (lower.includes("hospital") || lower.includes("morgue") || lower.includes("doctor")) return { name: "Dr. Ahmed (Jinnah Hospital)", role: "Medical Examiner" };
    if (lower.includes("media") || lower.includes("broadcast")) return { name: "ARY News Reporter", role: "Media Partner" };
    if (lower.includes("government") || lower.includes("ndma")) return { name: "NDMA Official", role: "Govt Official" };
    if (lower.includes("volunteer")) return { name: "Demo Volunteer", role: "Volunteer" };
    if (lower.includes("forensics")) return { name: "PFSA Lab Technician", role: "Forensic Scientist" };
    return { name: "Demo Citizen", role: "Public Citizen" };
  };

  const demoUser = getDemoName(portalName);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="page-enter flex flex-col min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden relative">
      {/* ─── STEP 4: FYP DEMO MODE BANNER ─── */}
      <div style={{ background: "#1d4ed8", color: "white", textAlign: "center", padding: "8px", fontSize: "14px", fontWeight: "bold", zIndex: 100, position: "relative" }}>
        🎓 FYP Demo Mode — WAJOOD: Pakistan&apos;s Missing Persons Platform | SSUET 2026 | All portals open for evaluation
      </div>

      <div className="flex flex-1 min-h-screen relative">
        <div className="mesh-gradient fixed inset-0 pointer-events-none" />

        {/* ─── DESKTOP SIDEBAR ─── */}
        <aside className="hidden md:flex w-64 bg-slate-900/90 backdrop-blur-2xl border-r border-white/10 flex-col justify-between p-6 sticky top-0 h-[calc(100vh-36px)] z-50 shadow-2xl">
          <div className="space-y-8">
            <div className="flex items-center gap-3 pb-4 border-b border-white/10">
              <Link href="/" className="text-2xl font-black gradient-text tracking-tighter">WAJOOD</Link>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
              <span className="text-2xl">{portalIcon}</span>
              <span className="text-sm font-bold truncate" style={{ color: portalColor }}>{portalName}</span>
            </div>

            <nav className="space-y-2 pt-2">
              <Link href="/" className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-slate-300 hover:bg-white/5 hover:text-white transition">
                🏠 Platform Home
              </Link>
              <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-slate-300 hover:bg-white/5 hover:text-white transition">
                📊 Dashboard Feed
              </Link>
            </nav>
          </div>

          <div className="space-y-4 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-bold text-slate-400">Alerts</span>
              <NotificationBell />
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <div className="truncate">
                  <p className="text-xs font-bold text-slate-200 truncate">{demoUser.name}</p>
                  <p className="text-[10px] text-slate-400 truncate capitalize">{demoUser.role}</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* ─── MOBILE TOP HEADER WITH HAMBURGER ─── */}
        <div className="md:hidden sticky top-0 inset-x-0 h-16 bg-slate-900/95 backdrop-blur-2xl border-b border-white/10 px-4 flex items-center justify-between z-50">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg bg-white/5 text-slate-300 hover:text-white text-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Toggle Menu"
            >
              ☰
            </button>
            <span className="text-xl font-black gradient-text">WAJOOD</span>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />
          </div>
        </div>

        {/* ─── MOBILE DRAWER MENU ─── */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex">
            <div className="w-72 bg-slate-900 border-r border-white/10 h-full p-6 flex flex-col justify-between animate-fadeIn">
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <span className="text-lg font-black gradient-text">WAJOOD Menu</span>
                  <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400 hover:text-white p-2 min-h-[44px]">✕</button>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                  <span className="text-xl">{portalIcon}</span>
                  <span className="text-xs font-bold truncate" style={{ color: portalColor }}>{portalName}</span>
                </div>
                <nav className="space-y-2">
                  <Link onClick={() => setMobileMenuOpen(false)} href="/" className="block p-3 rounded-xl text-xs font-bold text-slate-200 bg-white/5">🏠 Platform Home</Link>
                  <Link onClick={() => setMobileMenuOpen(false)} href="/dashboard" className="block p-3 rounded-xl text-xs font-bold text-slate-200 bg-white/5">📊 Dashboard Feed</Link>
                </nav>
              </div>
              <div className="pt-4 border-t border-white/10 text-xs text-slate-400">
                👤 {demoUser.name}
              </div>
            </div>
            <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
          </div>
        )}

        {/* ─── MAIN CONTENT AREA ─── */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full overflow-x-hidden relative z-10">
          {/* Portal Title Banner */}
          <div className="mb-8 p-6 rounded-2xl bg-white/[0.02] border border-white/10 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-2xl border border-white/10">
                {portalIcon}
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white">
                  {portalName} <span style={{ color: portalColor }}>Portal</span>
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">Unified Nationwide Reunification Telemetry</p>
              </div>
            </div>
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
