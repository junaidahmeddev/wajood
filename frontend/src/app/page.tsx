"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store";

/* ═══════════════════════════════════════════════
   WAJOOD — Landing Page
   Premium hero + stats + portals + CTA
   ═══════════════════════════════════════════════ */

const STATS = [
  { label: "Cases Filed", value: "12,847", icon: "📋", color: "#3b82f6" },
  { label: "People Reunited", value: "3,216", icon: "🤝", color: "#10b981" },
  { label: "Active Volunteers", value: "8,500+", icon: "🙋", color: "#8b5cf6" },
  { label: "Partner Orgs", value: "340+", icon: "🏢", color: "#f97316" },
];

const PORTALS = [
  { title: "Public Citizen", desc: "Report a missing person", icon: "👤", color: "#6366f1", href: "/login" },
  { title: "NGO Worker", desc: "Register found persons", icon: "🏢", color: "#10b981", href: "/login" },
  { title: "Law Enforcement", desc: "Confirm matches and manage cases", icon: "👮", color: "#3b82f6", href: "/login" },
  { title: "Hospital/Morgue", desc: "Register unidentified patients", icon: "🏥", color: "#f59e0b", href: "/login" },
  { title: "Volunteer", desc: "Report sightings on map", icon: "🙋", color: "#8b5cf6", href: "/login" },
  { title: "Media", desc: "View anonymized statistics", icon: "📰", color: "#ec4899", href: "/login" },
  { title: "Government/NDMA", desc: "National dashboard and disaster mode", icon: "🏛️", color: "#14b8a6", href: "/login" },
  { title: "Forensics", desc: "DNA matching and biometric records", icon: "🔬", color: "#f97316", href: "/login" },
  { title: "Admin", desc: "Full system administration", icon: "⚙️", color: "#ef4444", href: "/login" },
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    loadFromStorage();
    setMounted(true);
    // Smooth scroll behavior
    document.documentElement.style.scrollBehavior = "smooth";
  }, [loadFromStorage]);

  return (
    <div className="page-enter min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden relative w-full font-sans">
      <style jsx global>{`
        body { margin: 0; padding: 0; }
        .saas-card { transition: all 0.2s ease; cursor: pointer; }
        a, button { cursor: pointer; transition: all 0.2s ease; }
        a:focus-visible, button:focus-visible { outline: 2px solid #6366f1; outline-offset: 2px; }
      `}</style>
      <div className="mesh-gradient fixed inset-0 pointer-events-none" />

      {/* ── Navigation ── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-[#e5e7eb]/20 h-[72px] flex items-center w-full">
        <div className="max-w-[1200px] w-full mx-auto px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5 no-underline shrink-0 group h-full">
            <span className="text-xl sm:text-3xl font-black gradient-text tracking-tighter">
              WAJOOD
            </span>
            <span className="text-[9px] sm:text-xs font-extrabold text-slate-400 tracking-[0.2em] uppercase opacity-90 group-hover:text-indigo-400 transition-colors mt-1">
              PAKISTAN
            </span>
          </Link>

          {/* Desktop Nav Buttons */}
          <div className="hidden md:flex items-center gap-4 shrink-0 h-full">
            <Link href="/login" className="btn-secondary px-5 py-2 text-sm min-h-[40px] flex items-center justify-center font-bold border border-white/20 text-slate-200 hover:text-white">
              Login
            </Link>
            <Link href="/register" className="btn-primary px-5 py-2 text-sm min-h-[40px] flex items-center justify-center font-bold">
              Register
            </Link>
          </div>

          {/* Mobile Menu Trigger Button */}
          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="md:hidden p-2 rounded-lg text-slate-200 hover:text-white flex items-center justify-center"
            aria-label="Open Menu"
          >
            {mobileNavOpen ? (
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile Dropdown Drawer Menu Box */}
      {mobileNavOpen && (
        <div className="md:hidden fixed inset-x-0 top-[72px] z-40 bg-slate-900/95 border-b border-white/10 p-5 shadow-2xl backdrop-blur-2xl animate-fadeIn flex flex-col gap-3">
          <Link onClick={() => setMobileNavOpen(false)} href="/login" className="btn-secondary w-full py-3 text-center font-bold block flex items-center justify-center border border-white/20 text-slate-200">
            Login
          </Link>
          <Link onClick={() => setMobileNavOpen(false)} href="/register" className="btn-primary w-full py-3 text-center font-bold block flex items-center justify-center">
            Register
          </Link>
        </div>
      )}

      {/* Page Content Wrapper (Padding for fixed nav) */}
      <div className="pt-[72px] w-full max-w-[1200px] mx-auto px-6">
        
        {/* ── Hero Section ── */}
        <section className="pt-[100px] pb-[80px] flex flex-col items-center text-center w-full">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-1.5 mb-6 text-xs sm:text-sm text-indigo-300 font-medium">
            <span className="pulse-dot shrink-0" /> Operational Across All 4 Provinces &amp; AJK
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.15] mb-4 w-full text-white flex flex-col items-center justify-center">
            <span>Find the <span className="gradient-text">Missing</span></span>
            <span>Reunite the <span className="gradient-text">Found</span></span>
          </h1>

          <h2 className="text-xl sm:text-2xl font-bold text-slate-300 mb-6 font-serif" dir="rtl">
            پاکستان کا متحدہ پلیٹ فارم برائے گمشدہ افراد
          </h2>

          <p className="text-sm sm:text-base md:text-lg text-slate-300 max-w-[560px] mx-auto leading-[1.6] mb-8 font-medium">
            Pakistan&apos;s first unified AI biometric platform connecting families, law enforcement,
            hospitals, NGOs, and citizen volunteers with real-time telemetric matching.
          </p>

          <div className="flex flex-col sm:flex-row gap-[12px] w-full sm:w-auto justify-center items-center">
            <Link href="/public" className="btn-primary h-[48px] px-8 text-sm sm:text-base font-bold flex items-center justify-center shadow-lg shadow-indigo-500/25 w-full sm:w-auto gap-2">
              Report Missing Person <span>→</span>
            </Link>
            <Link href="/dashboard" className="btn-secondary h-[48px] px-8 text-sm sm:text-base font-bold flex items-center justify-center w-full sm:w-auto border border-white/20">
              Search National Database
            </Link>
          </div>
        </section>

        {/* ── Stats Bar ── */}
        <section className="pb-20 w-full">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 w-full">
            {STATS.map((s) => (
              <div key={s.label} className="saas-card bg-slate-900/50 rounded-xl flex flex-col items-center justify-center py-[24px] px-4 w-full h-full" style={{ borderTop: `3px solid ${s.color}` }}>
                <span className="text-3xl mb-3 flex items-center justify-center h-10 w-10">{s.icon}</span>
                <span className="text-[36px] font-bold gradient-text stat-number tracking-tight leading-none mb-1">{s.value}</span>
                <span className="text-[13px] font-semibold text-slate-400 text-center">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── How It Works ── */}
        <section className="py-[80px] border-t border-white/10 w-full">
          <div className="text-center w-full mb-16">
            <h2 className="text-[32px] font-[700] mb-3 tracking-tight flex items-center justify-center gap-2">
              How <span className="gradient-text">WAJOOD</span> Works
            </h2>
            <p className="text-sm sm:text-base text-slate-400">
              A nationwide tamper-proof audit workflow from report to reunification
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-6 w-full relative items-start">
            {/* Desktop connecting line */}
            <div className="hidden md:block absolute top-[20px] left-[10%] right-[10%] h-[2px] bg-white/10 -z-10" />

            {HOW_IT_WORKS.map((item, idx) => (
              <div key={item.step} className="saas-card bg-slate-900/50 border border-white/10 rounded-xl p-[20px] flex flex-col items-center text-center w-full md:w-1/4 h-full relative">
                {/* Mobile connecting arrow */}
                {idx !== HOW_IT_WORKS.length - 1 && (
                  <div className="md:hidden absolute -bottom-[20px] left-1/2 -translate-x-1/2 text-white/20">↓</div>
                )}
                
                <div className="w-[40px] h-[40px] rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm mb-5 border-2 border-slate-700 mx-auto z-10 shrink-0">
                  {item.step}
                </div>
                <h3 className="text-[16px] font-bold mb-2 text-white">{item.title}</h3>
                <p className="text-slate-300 text-[14px] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Portals Grid ── */}
        <section className="py-[80px] border-t border-white/10 w-full">
          <div className="text-center w-full mb-16">
            <h2 className="text-[32px] font-[700] mb-3 tracking-tight flex items-center justify-center gap-2">
              🎯 Explore WAJOOD — <span className="gradient-text">Click Any Portal</span>
            </h2>
            <p className="text-sm sm:text-base text-slate-400">
              Purpose-built telemetric interfaces for every evaluation role without login barriers
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
            {PORTALS.map((p) => (
              <Link key={p.title} href={p.href} className="no-underline text-inherit block group h-full">
                <div className="saas-card bg-slate-900/50 border border-white/10 rounded-xl p-[24px] h-full flex flex-col hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] group-hover:border-indigo-500/50 transition-all duration-200">
                  <div className="flex-1 flex flex-col">
                    <div className="w-[48px] h-[48px] rounded-full flex items-center justify-center mb-5 shrink-0" style={{ backgroundColor: p.color + '20', color: p.color }}>
                      <span className="text-2xl">{p.icon}</span>
                    </div>
                    <h3 className="text-[15px] font-[600] text-white group-hover:text-indigo-400 transition mb-2">{p.title}</h3>
                    <p className="text-slate-400 text-[13px] leading-[1.5]">{p.desc}</p>
                  </div>
                  <div className="mt-auto pt-6 text-[14px] font-[500] text-indigo-400 flex items-center gap-1.5 group-hover:translate-x-1 transition-transform">
                    Open Portal →
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* ── CTA Section ── */}
      <section className="py-[60px] md:py-[100px] px-6 w-full bg-slate-900/80 border-t border-white/10 relative overflow-hidden flex flex-col items-center text-center">
        <h2 className="text-[32px] md:text-[48px] font-extrabold mb-4 tracking-tight w-full">
          Every Second <span className="gradient-text">Matters</span>
        </h2>
        <p className="text-sm sm:text-base md:text-lg text-slate-300 max-w-xl mx-auto leading-relaxed mb-8">
          Join thousands of Pakistani citizens, volunteers, and rescue officers bringing missing persons home.
        </p>
        <Link href="/public" className="btn-secondary min-w-[220px] px-[28px] py-[14px] text-base font-bold inline-flex items-center justify-center border-2 border-white/20 bg-transparent text-white hover:bg-white hover:text-slate-900">
          <span>Explore Citizen Portal Now</span>
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="py-10 border-t border-white/10 bg-slate-950 text-slate-400 w-full">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[48px] mb-10">
            <div className="flex flex-col items-start text-left lg:col-span-1">
              <div className="flex items-baseline gap-1.5 mb-4">
                <span className="text-lg font-black gradient-text tracking-tight text-white">WAJOOD</span>
                <span className="text-[9px] font-extrabold text-slate-500 tracking-[0.2em] uppercase">PAKISTAN</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                National Missing Persons Grid. A unified biometric platform for rapid response and reunification.
              </p>
            </div>
            
            <div className="flex flex-col gap-3">
              <Link href="/public" className="text-sm text-slate-400 hover:opacity-70 transition-opacity">Public Portal</Link>
              <Link href="/ngo" className="text-sm text-slate-400 hover:opacity-70 transition-opacity">NGOs</Link>
              <Link href="/volunteer" className="text-sm text-slate-400 hover:opacity-70 transition-opacity">Volunteers</Link>
            </div>
            <div className="flex flex-col gap-3">
              <Link href="/law-enforcement" className="text-sm text-slate-400 hover:opacity-70 transition-opacity">Police</Link>
              <Link href="/hospital" className="text-sm text-slate-400 hover:opacity-70 transition-opacity">Hospitals</Link>
              <Link href="/forensics" className="text-sm text-slate-400 hover:opacity-70 transition-opacity">Forensics</Link>
            </div>
            <div className="flex flex-col gap-3">
              <Link href="/government" className="text-sm text-slate-400 hover:opacity-70 transition-opacity">NDMA</Link>
              <Link href="/media" className="text-sm text-slate-400 hover:opacity-70 transition-opacity">Media</Link>
              <Link href="/admin" className="text-sm text-slate-400 hover:opacity-70 transition-opacity">Admin</Link>
            </div>
          </div>
          
          <div className="border-t border-white/10 pt-[20px] flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
            <p>
              © {new Date().getFullYear()} WAJOOD Network. All rights reserved.
            </p>
            <p>
              Conceived &amp; Developed by <span className="font-semibold text-slate-300">Junaid Ahmed</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
