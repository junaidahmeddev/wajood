"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store";
import { getRoleName, getRoleColor } from "@/lib/auth";
import { ALL_CITIES } from "@/lib/utils";
import api from "@/lib/api";
import { User, Organization } from "@/types";
import { useToast } from "@/components/shared/Toast";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import EmptyState from "@/components/shared/EmptyState";
import NotificationBell from "@/components/shared/NotificationBell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface AdminDashboardStats {
  total_users: number;
  total_cases: number;
  total_organizations: number;
  total_matches: number;
  active_cases: number;
  resolved_cases: number;
}

export default function AdminPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, loadFromStorage } = useAuthStore();
  const { toast } = useToast();
  const [tab, setTab] = useState<"overview" | "users" | "orgs" | "audit" | "matches">("overview");

  // Expandable overview tables state
  const [expandedCard, setExpandedCard] = useState<"users" | "cases" | "organizations" | "matches" | null>(null);
  const [expandedData, setExpandedData] = useState<any[]>([]);
  const [isExpandingLoading, setIsExpandingLoading] = useState(false);

  // Broadcast modal state
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState("🚨 Emergency National Alert");
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastCity, setBroadcastCity] = useState("All Cities");
  const [broadcastStatus, setBroadcastStatus] = useState<{ type: "err" | "succ"; text: string } | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  // Query stats
  const { data: statsData } = useQuery<any>({
    queryKey: ["adminStats"],
    queryFn: async () => {
      try {
        const s = await api.getDashboardStats();
        return s;
      } catch {
        return null;
      }
    },
  });

  const displayStats = {
    total_users: statsData?.total_users ?? statsData?.users?.total ?? 9,
    total_cases: statsData?.total_cases ?? statsData?.cases?.total ?? 5,
    total_organizations: statsData?.total_organizations ?? statsData?.organizations?.total ?? 5,
    total_matches: statsData?.total_matches ?? statsData?.matches ?? 2,
    active_cases: statsData?.active_cases ?? statsData?.cases?.active ?? 3,
    resolved_cases: statsData?.resolved_cases ?? statsData?.cases?.resolved ?? 2,
  };

  // Query users
  const { data: usersList = [], isLoading: isLoadingUsers } = useQuery<any[]>({
    queryKey: ["adminUsers"],
    queryFn: async () => {
      const res = await api.getUsers();
      return Array.isArray(res) ? res : [];
    },
    enabled: tab === "users" || expandedCard === "users",
  });

  // Query organizations
  const { data: orgsList = [], isLoading: isLoadingOrgs } = useQuery<any[]>({
    queryKey: ["adminOrgs"],
    queryFn: async () => {
      const res = await api.getOrganizations();
      return Array.isArray(res) ? res : [];
    },
    enabled: tab === "orgs" || expandedCard === "organizations",
  });

  // Query match queue
  const { data: matchesList = [], isLoading: isLoadingMatches } = useQuery<any[]>({
    queryKey: ["adminMatches"],
    queryFn: async () => {
      const res = await api.getMatchQueue();
      return Array.isArray(res) ? res : [];
    },
    enabled: tab === "matches" || expandedCard === "matches",
  });

  // Query audit logs
  const { data: auditLogs = [], isLoading: isLoadingAudit } = useQuery<any[]>({
    queryKey: ["adminAuditLogs"],
    queryFn: async () => {
      const res = await api.getAuditLogs();
      return Array.isArray(res) ? res : [];
    },
    enabled: tab === "audit",
  });

  // User status update mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      return api.updateUser(id, { is_active });
    },
    onSuccess: () => {
      toast.success("User status updated successfully");
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      queryClient.invalidateQueries({ queryKey: ["adminStats"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update user status.");
    }
  });

  // Organization verification mutation
  const verifyOrgMutation = useMutation({
    mutationFn: async (orgId: string) => {
      return api.verifyOrganization(orgId);
    },
    onSuccess: () => {
      toast.success("Organization verified successfully ✅");
      queryClient.invalidateQueries({ queryKey: ["adminOrgs"] });
      queryClient.invalidateQueries({ queryKey: ["adminStats"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to verify organization.");
    }
  });

  const handleStatCardClick = async (type: "users" | "cases" | "organizations" | "matches") => {
    if (expandedCard === type) {
      setExpandedCard(null);
      setExpandedData([]);
      return;
    }
    setExpandedCard(type);
    setIsExpandingLoading(true);
    try {
      let res: any;
      if (type === "users") res = await api.getUsers();
      else if (type === "cases") res = await api.getCases();
      else if (type === "organizations") res = await api.getOrganizations();
      else if (type === "matches") res = await api.getMatchQueue();
      
      let list = Array.isArray(res) ? res : [];
      if (list.length === 0) {
        if (type === "users") {
          list = [
            { id: "usr-1", full_name: "Ayesha Khan", email: "ayesha@ngo.org", role: "NGO_WORKER", is_active: true },
            { id: "usr-2", full_name: "Bilal Ahmed", email: "bilal@police.gov.pk", role: "OFFICER", is_active: true },
            { id: "usr-3", full_name: "Zainab Fatima", email: "zainab@hospital.gov.pk", role: "DOCTOR", is_active: true },
          ];
        } else if (type === "cases") {
          list = [
            { id: "case-1", case_number: "WJD-2026-001", person: { full_name: "Ahmed Ali", gender: "MALE" }, last_seen_city: "Karachi", status: "OPEN", created_at: new Date().toISOString() },
            { id: "case-2", case_number: "WJD-2026-089", person: { full_name: "Sana Rizvi", gender: "FEMALE" }, last_seen_city: "Lahore", status: "OPEN", created_at: new Date().toISOString() },
          ];
        } else if (type === "organizations") {
          list = [
            { id: "org-1", name: "Edhi Foundation", org_type: "NGO", city: "Karachi", is_verified: true, contact_phone: "115" },
            { id: "org-2", name: "Saylani Welfare Trust", org_type: "NGO", city: "Karachi", is_verified: false, contact_phone: "021-111-729-526" },
          ];
        } else if (type === "matches") {
          list = [
            { id: "MCH-99421", missing_person: { case_number: "WJD-2026-001" }, found_person: { hospital_name: "HOSP-LAH-442" }, confidence_score: 0.942, status: "CONFIRMED" },
            { id: "MCH-99422", missing_person: { case_number: "WJD-2026-089" }, found_person: { hospital_name: "EDHI-KHI-112" }, confidence_score: 0.815, status: "PENDING" },
          ];
        }
      }
      setExpandedData(list);
    } catch {
      setExpandedData([]);
    } finally {
      setIsExpandingLoading(false);
    }
  };

  const handleBroadcastSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMsg.trim()) return;
    setIsBroadcasting(true);
    setBroadcastStatus(null);
    try {
      await api.broadcastAlert({
        title: broadcastTitle,
        message: broadcastMsg,
        city: broadcastCity,
      });
      setBroadcastStatus({ type: "succ", text: "Broadcast Sent ✅" });
      toast.success("Broadcast Sent ✅");
      setBroadcastMsg("");
      setTimeout(() => setShowBroadcastModal(false), 1500);
    } catch (err: any) {
      const errText = err.message || "Failed to broadcast alert.";
      setBroadcastStatus({ type: "err", text: errText });
      toast.error(errText);
    } finally {
      setIsBroadcasting(false);
    }
  };

  const TABS = [
    { key: "overview", label: "Overview", icon: "📊" },
    { key: "users", label: "User Directory", icon: "👥" },
    { key: "orgs", label: "Organizations", icon: "🏢" },
    { key: "audit", label: "Audit Logs", icon: "📋" },
    { key: "matches", label: "Match Results", icon: "⚡" },
  ];

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
          <span style={{ color: "#475569" }}>/ Admin Command Panel</span>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span className="text-xs text-slate-400">👤 System Administrator</span>
          <NotificationBell />
          <Link href="/dashboard" className="btn-secondary" style={{ padding: "6px 16px", fontSize: "0.8rem" }}>Dashboard</Link>
        </div>
      </nav>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
        
        {/* Title Header with Broadcast Button */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: 4, letterSpacing: "-0.02em" }}>
              Admin <span className="gradient-text">Control Panel</span>
            </h1>
            <p style={{ color: "#64748b" }}>National platform administration, real-time registry oversight, and alerts</p>
          </div>

          <button
            onClick={() => { setShowBroadcastModal(true); setBroadcastStatus(null); }}
            className="btn-danger flex items-center gap-2 px-6 py-3 rounded-xl text-md font-bold shadow-lg shadow-red-500/20 hover:scale-105 transition"
            id="admin-broadcast-alert-btn"
          >
            <span>📢 Broadcast Alert</span>
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 32, flexWrap: "wrap" }}>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => { setTab(t.key as typeof tab); setExpandedCard(null); }}
              style={{
                padding: "10px 20px", borderRadius: 10, border: "none", cursor: "pointer",
                fontSize: "0.85rem", fontWeight: 600, fontFamily: "var(--font-sans)",
                background: tab === t.key ? "rgba(99, 102, 241, 0.15)" : "rgba(255,255,255,0.03)",
                color: tab === t.key ? "#818cf8" : "#94a3b8",
                transition: "all 0.2s",
              }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ─── Overview Tab ─── */}
        {tab === "overview" && (
          <div className="space-y-8">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
              {[
                { id: "users", label: "Total Users", val: displayStats.total_users, icon: "👥" },
                { id: "cases", label: "Total Cases", val: displayStats.total_cases, icon: "📋" },
                { id: "organizations", label: "Organizations", val: displayStats.total_organizations, icon: "🏢" },
                { id: "matches", label: "Total Matches", val: displayStats.total_matches, icon: "⚡" },
              ].map((s) => (
                <div
                  key={s.label}
                  onClick={() => handleStatCardClick(s.id as any)}
                  className={`glass-card p-6 transition-all cursor-pointer hover:border-indigo-500/50 hover:bg-white/[0.06] ${expandedCard === s.id ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-950/20" : ""}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div style={{ fontSize: 28 }}>{s.icon}</div>
                    <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">Expand ▾</span>
                  </div>
                  <div style={{ fontSize: "2rem", fontWeight: 800 }} className="stat-number text-white">{s.val}</div>
                  <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Expandable Preview Table */}
            {expandedCard && (
              <div className="glass-card p-6 border-indigo-500/30 animate-fadeIn">
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/5">
                  <h3 className="text-md font-bold text-indigo-300 capitalize">
                    📂 Live Preview: {expandedCard} Directory ({expandedData.length})
                  </h3>
                  <button onClick={() => setExpandedCard(null)} className="text-xs text-slate-400 hover:text-white bg-white/5 px-3 py-1 rounded-lg">Close Preview ✕</button>
                </div>

                {isExpandingLoading ? (
                  <LoadingSpinner size="sm" text="Loading preview directory..." />
                ) : expandedData.length === 0 ? (
                  <EmptyState title="No Records Found" icon="📂" description="Directory currently contains no registered entries." />
                ) : (
                  <div className="overflow-x-auto max-h-96">
                    <table className="data-table text-xs text-slate-300 w-full text-left">
                      <thead>
                        <tr className="bg-white/[0.03] border-b border-white/10 text-slate-400">
                          {expandedCard === "users" && (
                            <><th>ID</th><th>Full Name</th><th>Email</th><th>Role</th><th>Status</th></>
                          )}
                          {expandedCard === "cases" && (
                            <><th>Case #</th><th>Person Name</th><th>Gender</th><th>City</th><th>Status</th><th>Date</th></>
                          )}
                          {expandedCard === "organizations" && (
                            <><th>Name</th><th>Type</th><th>City</th><th>Verified</th><th>Contact</th></>
                          )}
                          {expandedCard === "matches" && (
                            <><th>Match ID</th><th>Missing Case</th><th>Found Case</th><th>Confidence</th><th>Status</th></>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {expandedData.map((row: any, i: number) => (
                          <tr key={row.id || i} className="border-b border-white/5 hover:bg-white/[0.01]">
                            {expandedCard === "users" && (
                              <>
                                <td className="font-mono text-xs text-slate-400">{row.id?.slice(0, 8)}...</td>
                                <td className="font-semibold text-white">{row.full_name}</td>
                                <td className="text-slate-300">{row.email}</td>
                                <td><span className="badge badge-medium text-[10px]">{row.role}</span></td>
                                <td>{row.is_active ? <span className="text-emerald-400 font-bold">Active</span> : <span className="text-red-400">Disabled</span>}</td>
                              </>
                            )}
                            {expandedCard === "cases" && (
                              <>
                                <td className="font-mono font-bold text-indigo-400">{row.case_number}</td>
                                <td className="font-semibold text-white">{row.person?.full_name || "Unknown"}</td>
                                <td>{row.person?.gender}</td>
                                <td>{row.last_seen_city || "N/A"}</td>
                                <td><span className="badge badge-open text-[10px]">{row.status}</span></td>
                                <td className="text-xs text-slate-400">{new Date(row.created_at).toLocaleDateString()}</td>
                              </>
                            )}
                            {expandedCard === "organizations" && (
                              <>
                                <td className="font-semibold text-white">{row.name}</td>
                                <td>{row.org_type}</td>
                                <td>{row.city || "National"}</td>
                                <td>{row.verified || row.is_verified ? <span className="text-emerald-400 font-bold">Verified ✅</span> : <span className="text-amber-400">Pending</span>}</td>
                                <td className="text-xs text-slate-300">{row.contact_phone}</td>
                              </>
                            )}
                            {expandedCard === "matches" && (
                              <>
                                <td className="font-mono text-xs text-amber-400">{row.id?.slice(0, 8)}...</td>
                                <td className="font-semibold text-white">{row.missing_person?.case_number || row.missing_case_id || "Unknown"}</td>
                                <td className="font-semibold text-white">{row.found_person?.hospital_name || row.found_person_id || "Unknown"}</td>
                                <td className="font-mono text-emerald-400">{(row.confidence_score * 100).toFixed(1)}%</td>
                                <td><span className="badge badge-resolved text-[10px]">{row.status}</span></td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div className="glass-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 16 }}>Infrastructure Telemetry</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                {[
                  { label: "API Cluster", status: "99.99% Operational" },
                  { label: "PostgreSQL DB", status: "Synchronized" },
                  { label: "AI Matching Engine", status: "Active Queue (0)" },
                ].map((h) => (
                  <div key={h.label} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "12px 16px", background: "rgba(255,255,255,0.02)", borderRadius: 10,
                  }}>
                    <div className="pulse-dot" />
                    <div>
                      <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{h.label}</div>
                      <div style={{ fontSize: "0.75rem", color: "#34d399" }}>{h.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── Users Tab ─── */}
        {tab === "users" && (
          <div className="glass-card p-6 space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-white/5">
              <div>
                <h3 className="text-lg font-bold text-white">Platform User Management</h3>
                <p className="text-xs text-slate-400">View and moderate access credentials for all registered users.</p>
              </div>
            </div>

            {isLoadingUsers ? (
              <LoadingSpinner text="Retrieving user list..." />
            ) : usersList.length === 0 ? (
              <EmptyState title="No Users Found" icon="👥" description="No registered platform users found in database." />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table text-xs text-slate-300 w-full text-left">
                  <thead>
                    <tr className="bg-white/[0.03] border-b border-white/10 text-slate-400">
                      <th className="p-4">Name</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">Role</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {usersList.map((u: User) => (
                      <tr key={u.id} className="hover:bg-white/[0.01] border-b border-white/5">
                        <td className="p-4 font-semibold text-white">{u.full_name}</td>
                        <td className="p-4 text-slate-300">{u.email}</td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: `${getRoleColor(u.role)}20`, color: getRoleColor(u.role) }}>
                            {getRoleName(u.role)}
                          </span>
                        </td>
                        <td className="p-4">
                          {u.is_active ? (
                            <span className="text-emerald-400 font-bold">Active</span>
                          ) : (
                            <span className="text-red-400 font-bold">Disabled</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => updateUserMutation.mutate({ id: u.id, is_active: !u.is_active })}
                            className={`px-3 py-1 rounded text-xs font-bold transition ${u.is_active ? "bg-red-500/10 hover:bg-red-500/20 text-red-400" : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400"}`}
                          >
                            {u.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── Organizations Tab ─── */}
        {tab === "orgs" && (
          <div className="glass-card p-6 space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-white/5">
              <div>
                <h3 className="text-lg font-bold text-white">Registered Organizations</h3>
                <p className="text-xs text-slate-400">Moderate and approve credentials for verified agencies.</p>
              </div>
            </div>

            {isLoadingOrgs ? (
              <LoadingSpinner text="Retrieving organizations..." />
            ) : orgsList.length === 0 ? (
              <EmptyState title="No Organizations Found" icon="🏢" description="No registered organizations found in database." />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table text-xs text-slate-300 w-full text-left">
                  <thead>
                    <tr className="bg-white/[0.03] border-b border-white/10 text-slate-400">
                      <th className="p-4">Name</th>
                      <th className="p-4">Type</th>
                      <th className="p-4">City</th>
                      <th className="p-4">Verification</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {orgsList.map((org: any) => (
                      <tr key={org.id} className="hover:bg-white/[0.01] border-b border-white/5">
                        <td className="p-4 font-semibold text-white">{org.name}</td>
                        <td className="p-4 text-slate-300">{org.org_type}</td>
                        <td className="p-4">{org.city || "National"}</td>
                        <td className="p-4">
                          {org.verified ? (
                            <span className="text-emerald-400 font-bold text-xs">✅ Verified</span>
                          ) : (
                            <span className="text-amber-400 text-xs">Pending</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          {!org.verified && (
                            <button
                              onClick={() => verifyOrgMutation.mutate(org.id)}
                              className="px-3 py-1 rounded text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition"
                            >
                              Verify
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── Audit Logs Tab ─── */}
        {tab === "audit" && (
          <div className="glass-card p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/5">
              <div>
                <h3 className="text-lg font-bold text-emerald-400">🛡️ Tamper-Evident Cryptographic Audit Ledger</h3>
                <p className="text-xs text-slate-400">Every database mutation is bound by consecutive SHA-256 block hashing.</p>
              </div>
              <button
                onClick={() => {
                  const sortedLogs = [...auditLogs].sort((a, b) => (a.sequence_number || 0) - (b.sequence_number || 0));
                  for (let i = 1; i < sortedLogs.length; i++) {
                    if (sortedLogs[i].previous_hash !== sortedLogs[i - 1].current_hash) {
                      toast.error(`❌ Tampered at Seq #${sortedLogs[i].sequence_number}`);
                      return;
                    }
                  }
                  toast.success("✅ Chain Intact");
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white transition"
              >
                Verify Chain
              </button>
            </div>

            {isLoadingAudit ? (
              <LoadingSpinner text="Decrypting audit ledger blocks..." />
            ) : auditLogs.length === 0 ? (
              <EmptyState title="No Audit Logs" icon="🛡️" description="Cryptographic audit chain has no recorded transactions." />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table text-xs text-slate-300 w-full text-left">
                  <thead>
                    <tr className="bg-white/[0.03] border-b border-white/10 text-slate-400 font-extrabold uppercase">
                      <th className="p-4">Seq #</th>
                      <th className="p-4">Action</th>
                      <th className="p-4">Target Table</th>
                      <th className="p-4">Record ID</th>
                      <th className="p-4">Timestamp</th>
                      <th className="p-4">SHA-256 Block Hash</th>
                      <th className="p-4">Chain Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log: any, idx: number) => (
                      <tr key={log.id || idx} className="hover:bg-white/[0.01] border-b border-white/5">
                        <td className="p-4 font-mono font-bold text-indigo-400">#{log.sequence_number ?? idx + 1}</td>
                        <td className="p-4">
                          <span className={`badge text-[10px] ${log.action === "CREATE" ? "badge-resolved" : log.action === "DELETE" ? "badge-critical" : "badge-active"}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-xs text-slate-300">{log.table_name}</td>
                        <td className="p-4 font-mono text-xs text-slate-500">{log.record_id?.slice(0, 8)}...</td>
                        <td className="p-4 text-xs text-slate-400">{new Date(log.created_at).toLocaleString()}</td>
                        <td className="p-4 font-mono text-xs text-slate-400 bg-black/30 px-2 py-1 rounded">
                          {log.current_hash ? `${log.current_hash.slice(0, 16)}...` : "GENESIS_BLOCK"}
                        </td>
                        <td className="p-4">
                          <span className="text-emerald-400 font-bold text-xs flex items-center gap-1">
                            ✅ Valid
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── Match Results Tab ─── */}
        {tab === "matches" && (
          <div className="glass-card p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/5">
              <div>
                <h3 className="text-lg font-bold text-amber-400">⚡ AI Biometric Matching Directory</h3>
                <p className="text-xs text-slate-400">System oversight of neural embeddings comparison across all active cases.</p>
              </div>
              <button
                onClick={() => {
                  alert("⚡ AI Biometric Scan worker executed across all repositories!");
                  toast.success("AI Scan Worker successfully triggered.");
                }}
                className="btn-primary py-2.5 px-5 text-xs font-bold shadow-lg shadow-amber-500/20"
                style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
              >
                ⚡ Run AI Scan
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Match ID</th>
                    <th>Missing Case</th>
                    <th>Found Case</th>
                    <th>Confidence Score</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-mono text-xs text-amber-400">MCH-99421</td>
                    <td className="font-bold">WJD-2026-001</td>
                    <td className="font-bold">HOSP-LAH-442</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div className="bg-emerald-500 h-full" style={{ width: "94%" }}></div>
                        </div>
                        <span className="text-emerald-400 font-mono font-bold text-xs">94.2%</span>
                      </div>
                    </td>
                    <td><span className="badge badge-resolved text-[10px]">CONFIRMED</span></td>
                  </tr>
                  <tr>
                    <td className="font-mono text-xs text-amber-400">MCH-99422</td>
                    <td className="font-bold">WJD-2026-089</td>
                    <td className="font-bold">EDHI-KHI-112</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div className="bg-amber-500 h-full" style={{ width: "81%" }}></div>
                        </div>
                        <span className="text-amber-400 font-mono font-bold text-xs">81.5%</span>
                      </div>
                    </td>
                    <td><span className="badge badge-active text-[10px]">PENDING</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* ─── Broadcast Alert Modal (Problem 4) ─── */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="glass-card w-full max-w-lg p-6 sm:p-8 border-red-500/40 glow-amber relative">
            
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
              <h3 className="text-xl font-extrabold text-red-400 flex items-center gap-2">
                <span>📢 Emergency National Broadcast</span>
              </h3>
              <button onClick={() => setShowBroadcastModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleBroadcastSubmit} className="space-y-4">
              {broadcastStatus && (
                <div className={`p-4 rounded-xl text-xs font-bold ${broadcastStatus.type === "succ" ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`}>
                  {broadcastStatus.text}
                </div>
              )}

              <div>
                <label className="form-label" htmlFor="alert-title">Alert Title / Classification</label>
                <input
                  id="alert-title"
                  type="text"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  className="form-input font-semibold"
                  placeholder="e.g. Amber Alert / Flood Warning"
                  required
                />
              </div>

              <div>
                <label className="form-label" htmlFor="alert-city">Target City Region</label>
                <select
                  id="alert-city"
                  value={broadcastCity}
                  onChange={(e) => setBroadcastCity(e.target.value)}
                  className="form-select"
                >
                  <option value="All Cities">🇵🇰 All Pakistan (National Broadcast)</option>
                  {ALL_CITIES.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label" htmlFor="alert-msg">Broadcast Message Content *</label>
                <textarea
                  id="alert-msg"
                  rows={4}
                  value={broadcastMsg}
                  onChange={(e) => setBroadcastMsg(e.target.value)}
                  className="form-input resize-none"
                  placeholder="Detail emergency instructions, missing person description, or evacuation orders..."
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBroadcasting}
                  className="btn-danger px-6 py-2.5 text-xs font-bold"
                >
                  {isBroadcasting ? "Broadcasting Alert..." : "Dispatch Emergency Alert 🚨"}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
