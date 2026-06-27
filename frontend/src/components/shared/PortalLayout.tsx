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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const hasAccess = !allowedRoles.length || (user && (
    user.role === "ADMIN" ||
    allowedRoles.some((r) => r === user.role || r.toUpperCase() === user.role || roleMap[r.toLowerCase()] === user.role)
  ));

  const getDemoName = (pName: string) => {
    const lower = pName.toLowerCase();
    if (lower.includes("ngo") || lower.includes("shelter")) return { name: "Edhi Foundation Worker", role: "NGO Worker", initials: "EW" };
    if (lower.includes("police") || lower.includes("officer") || lower.includes("law")) return { name: "FIA Officer", role: "Law Enforcement", initials: "FO" };
    if (lower.includes("hospital") || lower.includes("morgue") || lower.includes("doctor")) return { name: "Dr. Ahmed", role: "Medical Examiner", initials: "DA" };
    if (lower.includes("media") || lower.includes("broadcast")) return { name: "ARY News", role: "Media Partner", initials: "AN" };
    if (lower.includes("government") || lower.includes("ndma")) return { name: "NDMA Official", role: "Govt Official", initials: "NO" };
    if (lower.includes("volunteer")) return { name: "Demo Volunteer", role: "Volunteer", initials: "DV" };
    if (lower.includes("forensics")) return { name: "PFSA Technician", role: "Forensic Scientist", initials: "PT" };
    return { name: "Demo Citizen", role: "Public Citizen", initials: "DC" };
  };

  const demoUser = getDemoName(portalName);

  return (
    <div className="page-enter flex flex-col min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden relative w-full max-w-full">
      <div className="mesh-gradient fixed inset-0 pointer-events-none" />

      {/* ─── STICKY PORTAL HEADER ─── */}
      <nav className="sticky top-0 inset-x-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 h-16 px-4 sm:px-6 w-full flex items-center justify-between">
        {/* Left: WAJOOD Logo */}
        <div className="flex items-center">
          <Link href="/" className="flex items-baseline gap-1.5 no-underline shrink-0 group">
            <span className="text-xl sm:text-2xl font-black gradient-text tracking-tighter">WAJOOD</span>
          </Link>
        </div>

        {/* Center: Portal Badge (Hidden on very small screens) */}
        <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
          <span className="text-base leading-none">{portalIcon}</span>
          <span className="text-xs font-bold" style={{ color: portalColor }}>{portalName} Portal</span>
        </div>

        {/* Right: User Chip & Nav Links */}
        <div className="hidden md:flex items-center gap-4 h-full">
          <nav className="flex items-center gap-4 text-xs font-bold text-slate-300">
             <Link href="/" className="hover:text-white transition">Home</Link>
             <Link href="/dashboard" className="hover:text-white transition">Dashboard</Link>
          </nav>
          <div className="w-px h-6 bg-white/10 mx-1" />
          <NotificationBell />
          <div className="flex items-center gap-2">
             <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-xs shrink-0">
               {demoUser.initials}
             </div>
             <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-slate-200 leading-tight">{demoUser.name}</span>
                <span className="text-[10px] text-slate-400 capitalize leading-tight">{demoUser.role}</span>
             </div>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem("wajood_token");
              localStorage.removeItem("wajood_user");
              router.push("/login");
            }}
            className="ml-2 px-3 py-1.5 text-xs font-bold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition"
          >
            Logout
          </button>
        </div>

        {/* Mobile Navbar Elements */}
        <div className="flex md:hidden items-center gap-3">
          <NotificationBell />
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-xs shrink-0">
            {demoUser.initials}
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg bg-white/5 text-slate-300 hover:text-white flex items-center justify-center border border-white/10"
            aria-label="Toggle Menu"
          >
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
      </nav>

      {/* ─── MOBILE DRAWER MENU ─── */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-16 z-40 bg-slate-900/95 border-b border-white/10 p-5 shadow-2xl backdrop-blur-2xl animate-fadeIn flex flex-col gap-3">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 mb-2">
            <span className="text-xl">{portalIcon}</span>
            <span className="text-sm font-bold truncate" style={{ color: portalColor }}>{portalName} Portal</span>
          </div>
          <Link onClick={() => setMobileMenuOpen(false)} href="/" className="w-full py-3 text-center font-bold block bg-white/5 rounded-xl border border-white/5 text-slate-200">
            Platform Home
          </Link>
          <Link onClick={() => setMobileMenuOpen(false)} href="/dashboard" className="w-full py-3 text-center font-bold block bg-white/5 rounded-xl border border-white/5 text-slate-200">
            National Dashboard
          </Link>
          <div className="mt-2 pt-4 border-t border-white/10 flex items-center justify-between">
             <div className="flex items-center gap-3">
               <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-slate-200 leading-tight">{demoUser.name}</span>
                  <span className="text-[10px] text-slate-400 capitalize leading-tight">{demoUser.role}</span>
               </div>
             </div>
             <button
               onClick={() => {
                 localStorage.removeItem("wajood_token");
                 localStorage.removeItem("wajood_user");
                 router.push("/login");
               }}
               className="px-3 py-1.5 text-xs font-bold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition"
             >
               Logout
             </button>
          </div>
        </div>
      )}

      {/* ─── MAIN CONTENT AREA ─── */}
      <main className="flex-1 w-full max-w-[1200px] mx-auto relative z-10">
        {children}

        {/* Subtle Universal Portal Footer */}
        <footer className="mt-16 pt-8 pb-12 border-t border-white/10 text-xs text-slate-500 w-full px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-black gradient-text tracking-tight text-white">WAJOOD</span>
              <span className="text-[9px] font-extrabold text-slate-400 tracking-[0.2em] uppercase">PAKISTAN</span>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-4 text-slate-600 font-medium text-[11px]">
              <span>© {new Date().getFullYear()} WAJOOD Network. All rights reserved.</span>
              <span className="hidden sm:inline">•</span>
              <span>Architected by <span className="text-slate-400 font-semibold transition">Junaid Ahmed</span></span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
