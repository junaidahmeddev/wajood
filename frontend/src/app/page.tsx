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
  const { user, loadFromStorage } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    loadFromStorage();
    setMounted(true);
  }, [loadFromStorage]);

  return (
    <div className="page-enter">
      <div className="mesh-gradient" />

      {/* ── Navigation ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        background: "rgba(10, 10, 15, 0.8)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{
          maxWidth: 1280, margin: "0 auto", padding: "0 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between", height: 72,
        }}>
          <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }} className="gradient-text">
              WAJOOD
            </span>
            <span style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Pakistan
            </span>
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link href="/dashboard" className="btn-secondary" style={{ padding: "8px 20px", fontSize: "0.85rem" }}>
              Dashboard
            </Link>
            <Link href="/public" className="btn-primary" style={{ padding: "8px 20px", fontSize: "0.85rem" }}>
              <span>Explore Portals</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", textAlign: "center",
        padding: "120px 24px 80px",
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(99, 102, 241, 0.1)", border: "1px solid rgba(99, 102, 241, 0.2)",
          borderRadius: 20, padding: "6px 16px", marginBottom: 32, fontSize: "0.85rem", color: "#818cf8",
        }}>
          <span className="pulse-dot" /> Live Platform — Operational Across All Provinces
        </div>

        <h1 style={{
          fontSize: "clamp(2.5rem, 6vw, 4.5rem)", fontWeight: 800,
          lineHeight: 1.1, letterSpacing: "-0.03em", maxWidth: 800, marginBottom: 24,
        }}>
          Find the{" "}
          <span className="gradient-text">Missing</span>
          <br />
          Reunite the{" "}
          <span className="gradient-text">Found</span>
        </h1>

        <p style={{
          fontSize: "clamp(1rem, 2vw, 1.25rem)", color: "#94a3b8",
          maxWidth: 600, lineHeight: 1.7, marginBottom: 48,
        }}>
          Pakistan&apos;s first unified platform connecting families, law enforcement,
          hospitals, NGOs, and volunteers through AI-powered matching and
          multi-stakeholder coordination.
        </p>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
          <Link href="/public" className="btn-primary" style={{ padding: "16px 40px", fontSize: "1.05rem" }}>
            <span>Report Missing Person →</span>
          </Link>
          <Link href="/dashboard" className="btn-secondary" style={{ padding: "16px 40px", fontSize: "1.05rem" }}>
            Search Database
          </Link>
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <section style={{ padding: "0 24px 80px" }}>
        <div style={{
          maxWidth: 1100, margin: "0 auto",
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20,
        }}>
          {STATS.map((s) => (
            <div key={s.label} className="glass-card" style={{ padding: 24, textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.02em" }} className="gradient-text stat-number">{s.value}</div>
              <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section style={{ padding: "80px 24px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: "2.5rem", fontWeight: 800, marginBottom: 16, letterSpacing: "-0.02em" }}>
            How <span className="gradient-text">WAJOOD</span> Works
          </h2>
          <p style={{ textAlign: "center", color: "#64748b", maxWidth: 500, margin: "0 auto 60px", fontSize: "1.05rem" }}>
            A streamlined process from report to reunification
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24 }}>
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} className="glass-card" style={{ padding: 32 }}>
                <div style={{
                  fontSize: "3rem", fontWeight: 900, lineHeight: 1,
                  background: "linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.1))",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  marginBottom: 16,
                }}>{item.step}</div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 8 }}>{item.title}</h3>
                <p style={{ color: "#94a3b8", fontSize: "0.9rem", lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Portals Grid ── */}
      <section style={{ padding: "80px 24px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: "2.5rem", fontWeight: 800, marginBottom: 16, letterSpacing: "-0.02em" }}>
            🎯 Explore WAJOOD — <span className="gradient-text">Click Any Portal</span>
          </h2>
          <p style={{ textAlign: "center", color: "#64748b", maxWidth: 500, margin: "0 auto 60px", fontSize: "1.05rem" }}>
            Purpose-built interfaces for every evaluation role without login barriers
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PORTALS.map((p) => (
              <Link key={p.title} href={p.href} style={{ textDecoration: "none", color: "inherit" }}>
                <div className="glass-card p-6 h-full flex flex-col justify-between hover:border-emerald-500/50 hover:bg-emerald-500/[0.02] transition duration-300 group">
                  <div>
                    <div style={{ fontSize: 36, marginBottom: 16 }}>{p.icon}</div>
                    <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition mb-2">{p.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{p.desc}</p>
                  </div>
                  <div className="mt-6 text-sm font-bold text-emerald-400 flex items-center gap-2 group-hover:translate-x-1 transition">
                    Open Portal →
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section style={{
        padding: "100px 24px", textAlign: "center",
        borderTop: "1px solid rgba(255,255,255,0.04)",
      }}>
        <h2 style={{ fontSize: "2.5rem", fontWeight: 800, marginBottom: 16, letterSpacing: "-0.02em" }}>
          Every Second <span className="gradient-text">Matters</span>
        </h2>
        <p style={{ color: "#94a3b8", maxWidth: 500, margin: "0 auto 40px", fontSize: "1.1rem", lineHeight: 1.7 }}>
          Join thousands of Pakistanis working together to bring missing persons home.
        </p>
        <Link href="/register" className="btn-primary" style={{ padding: "18px 48px", fontSize: "1.1rem" }}>
          <span>Join WAJOOD Today →</span>
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        padding: "40px 24px", borderTop: "1px solid rgba(255,255,255,0.06)",
        textAlign: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }} className="gradient-text">WAJOOD</span>
        </div>
        <p style={{ color: "#475569", fontSize: "0.8rem" }}>
          © {new Date().getFullYear()} WAJOOD — Pakistan&apos;s Unified Missing Persons Platform.
          Built with purpose.
        </p>
      </footer>
    </div>
  );
}
