"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store";
import { getPortalPath } from "@/lib/auth";

/* ═══════════════════════════════════════════════
   WAJOOD — Landing Page
   Premium hero + stats + portals + CTA
   ═══════════════════════════════════════════════ */

const STATS = [
  { label: "Cases Filed", value: "12,847", icon: "📋" },
  { label: "People Reunited", value: "3,216", icon: "🤝" },
  { label: "Active Volunteers", value: "8,500+", icon: "🙋" },
  { label: "Partner Orgs", value: "340+", icon: "🏢" },
];

const PORTALS = [
  { title: "Public Citizen", desc: "Report a missing person", icon: "👤", color: "#6366f1", href: "/public" },
  { title: "NGO Worker", desc: "Register found persons & view AI matches", icon: "🏢", color: "#10b981", href: "/ngo" },
  { title: "Law Enforcement", desc: "Confirm matches & manage cases", icon: "👮", color: "#3b82f6", href: "/law-enforcement" },
  { title: "Hospital/Morgue", desc: "Register unidentified patients", icon: "🏥", color: "#f59e0b", href: "/hospital" },
  { title: "Volunteer", desc: "Report sightings on map", icon: "🙋", color: "#8b5cf6", href: "/volunteer" },
  { title: "Media", desc: "View anonymized statistics", icon: "📰", color: "#ec4899", href: "/media" },
  { title: "Government/NDMA", desc: "National dashboard & disaster mode", icon: "🏛️", color: "#14b8a6", href: "/government" },
  { title: "Forensics", desc: "DNA matching & biometric records", icon: "🔬", color: "#f97316", href: "/forensics" },
  { title: "Admin", desc: "Full system administration", icon: "⚙️", color: "#ef4444", href: "/admin" },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Report", desc: "File a missing person report with detailed information and photos." },
  { step: "02", title: "AI Matching", desc: "Our AI engine cross-references against found/unidentified persons nationwide." },
  { step: "03", title: "Coordinate", desc: "Multi-stakeholder coordination through role-based portals." },
  { step: "04", title: "Reunite", desc: "Verified matches lead to reunification with tamper-proof audit trails." },
];

export default function LandingPage() {
  const { loadFromStorage } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    loadFromStorage();
    setMounted(true);
  }, [loadFromStorage]);

  return (
    <div className="page-enter min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden relative w-full">
      <div className="mesh-gradient fixed inset-0 pointer-events-none" />

      {/* ── Navigation ── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 min-h-[64px] sm:h-20 flex items-center py-2 px-3 sm:px-6 md:px-8">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-1.5 no-underline shrink-0">
            <span className="text-xl sm:text-3xl font-black gradient-text tracking-tighter">
              WAJOOD
            </span>
            <span className="hidden sm:inline-block text-[10px] sm:text-xs font-bold text-slate-400 tracking-widest uppercase bg-white/5 px-2 py-0.5 rounded border border-white/10">
              Pakistan
            </span>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <Link href="/dashboard" className="btn-secondary px-2.5 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm min-h-[38px] sm:min-h-[44px] flex items-center justify-center font-bold whitespace-nowrap">
              <span>📊 <span className="hidden xs:inline">Dashboard</span></span>
            </Link>
            <Link href="/public" className="btn-primary px-3 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm min-h-[38px] sm:min-h-[44px] flex items-center justify-center font-bold whitespace-nowrap">
              <span>🚀 <span className="inline sm:hidden">Portals</span><span className="hidden sm:inline">Explore Portals</span></span>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="pt-28 sm:pt-36 pb-16 sm:pb-24 px-4 sm:px-6 md:px-8 max-w-5xl mx-auto flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-1.5 mb-6 text-xs sm:text-sm text-indigo-300 font-medium">
          <span className="pulse-dot shrink-0" /> Operational Across All 4 Provinces &amp; AJK
        </div>

        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.15] mb-6 max-w-4xl text-white">
          Find the <span className="gradient-text">Missing</span>
          <br />
          Reunite the <span className="gradient-text">Found</span>
        </h1>

        <p className="text-sm sm:text-base md:text-lg text-slate-300 max-w-2xl leading-relaxed mb-8 font-medium">
          Pakistan&apos;s first unified AI biometric platform connecting families, law enforcement,
          hospitals, NGOs, and citizen volunteers with real-time telemetric matching.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full max-w-md sm:max-w-none justify-center">
          <Link href="/public" className="btn-primary min-h-[48px] px-8 py-3.5 text-sm sm:text-base font-bold flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <span>Report Missing Person →</span>
          </Link>
          <Link href="/dashboard" className="btn-secondary min-h-[48px] px-8 py-3.5 text-sm sm:text-base font-bold flex items-center justify-center">
            Search National Database
          </Link>
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <section className="px-4 sm:px-6 md:px-8 pb-20 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 w-full">
          {STATS.map((s) => (
            <div key={s.label} className="saas-card p-4 sm:p-6 text-center flex flex-col items-center justify-center">
              <span className="text-2xl sm:text-3xl mb-2">{s.icon}</span>
              <span className="text-2xl sm:text-4xl font-extrabold gradient-text stat-number tracking-tight">{s.value}</span>
              <span className="text-xs sm:text-sm font-semibold text-slate-400 mt-1">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 md:px-8 border-t border-white/10 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-4xl font-extrabold mb-3 tracking-tight">
            How <span className="gradient-text">WAJOOD</span> Works
          </h2>
          <p className="text-sm sm:text-base text-slate-400">
            A nationwide tamper-proof audit workflow from report to reunification
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 w-full">
          {HOW_IT_WORKS.map((item) => (
            <div key={item.step} className="saas-card p-6 flex flex-col justify-between">
              <div>
                <div className="text-4xl sm:text-5xl font-black bg-gradient-to-br from-indigo-400 to-purple-600 bg-clip-text text-transparent mb-4 opacity-40 font-mono">
                  {item.step}
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-2 text-white">{item.title}</h3>
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Portals Grid ── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 md:px-8 border-t border-white/10 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-4xl font-extrabold mb-3 tracking-tight">
            🎯 Explore WAJOOD — <span className="gradient-text">Click Any Portal</span>
          </h2>
          <p className="text-sm sm:text-base text-slate-400">
            Purpose-built telemetric interfaces for every evaluation role without login barriers
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full">
          {PORTALS.map((p) => (
            <Link key={p.title} href={p.href} className="no-underline text-inherit block group">
              <div className="saas-card p-6 h-full flex flex-col justify-between group-hover:border-indigo-500/50 transition-all duration-300">
                <div>
                  <div className="text-3xl sm:text-4xl mb-4">{p.icon}</div>
                  <h3 className="text-lg sm:text-xl font-bold text-white group-hover:text-indigo-400 transition mb-2">{p.title}</h3>
                  <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">{p.desc}</p>
                </div>
                <div className="mt-6 text-xs sm:text-sm font-bold text-indigo-400 flex items-center gap-1.5 group-hover:translate-x-1 transition-transform">
                  Open Portal →
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section className="py-20 sm:py-28 px-4 text-center border-t border-white/10 max-w-4xl mx-auto">
        <h2 className="text-3xl sm:text-5xl font-extrabold mb-4 tracking-tight">
          Every Second <span className="gradient-text">Matters</span>
        </h2>
        <p className="text-sm sm:text-base md:text-lg text-slate-300 max-w-xl mx-auto leading-relaxed mb-8">
          Join thousands of Pakistani citizens, volunteers, and rescue officers bringing missing persons home.
        </p>
        <Link href="/public" className="btn-primary min-h-[52px] px-10 py-4 text-base font-bold inline-flex items-center justify-center shadow-xl shadow-indigo-500/25">
          <span>Explore Citizen Portal Now →</span>
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="py-10 px-4 border-t border-white/10 text-center text-xs sm:text-sm text-slate-500">
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="text-xl font-black gradient-text">WAJOOD</span>
          <span>• National Reunification Grid</span>
        </div>
        <p>© {new Date().getFullYear()} WAJOOD Pakistan. Built for SSUET FYP 2026 Evaluation.</p>
      </footer>
    </div>
  );
}
