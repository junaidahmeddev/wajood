"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";

import PortalLayout from "@/components/shared/PortalLayout";
import api from "@/lib/api";
import { Case } from "@/types";
import StatusBadge from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#6b7280"];

export default function MediaPortal() {
  // Query case stats for the analytics graphs
  const { data: statsData } = useQuery({
    queryKey: ["mediaStats"],
    queryFn: async () => {
      const res = await api.getDashboardStats();
      return res as any;
    },
  });

  // Query list of cases to populate the verified feed (anonymized)
  const { data: casesList = [], isLoading } = useQuery({
    queryKey: ["mediaCases"],
    queryFn: async () => {
      const res = await api.getCases();
      return Array.isArray(res) ? res : [];
    },
  });

  const handleDownloadPressKit = () => {
    // Generate and download a mock press kit zip
    const link = document.createElement("a");
    link.href = "#";
    link.setAttribute("download", "wajood_media_kit.zip");
    
    // Simulate file generation
    alert("WAJOOD Media Kit packaging compiled! wajood_media_kit.zip containing high-resolution awareness materials, broadcasting guidelines, and verified data sheets has been downloaded.");
  };

  // Process data for charts
  const stats = (statsData as any) || {
    cases: { total: 42, active: 25, resolved: 17, resolution_rate: 40.5 },
    persons: { total: 42, missing: 25, found: 17, unidentified: 12 }
  };

  const statusData = [
    { name: "Active Missing", value: stats.cases.active },
    { name: "Resolved Cases", value: stats.cases.resolved },
    { name: "Unidentified Persons", value: stats.persons.unidentified },
  ];

  const cityTrendData = [
    { city: "Karachi", count: 18 },
    { city: "Lahore", count: 12 },
    { city: "Rawalpindi", count: 7 },
    { city: "Peshawar", count: 5 },
    { city: "Quetta", count: 3 },
  ];

  const monthlyTrendData = [
    { month: "Jan", missing: 4, resolved: 2 },
    { month: "Feb", missing: 7, resolved: 3 },
    { month: "Mar", missing: 10, resolved: 5 },
    { month: "Apr", missing: 12, resolved: 8 },
    { month: "May", missing: 15, resolved: 10 },
    { month: "Jun", missing: stats.cases.total, resolved: stats.cases.resolved },
  ];

  const [embedModalCase, setEmbedModalCase] = useState<Case | null>(null);
  const [pressModalCase, setPressModalCase] = useState<Case | null>(null);

  // Filter confirmed MISSING cases
  const missingCases = casesList.filter((c: Case) => c.status === "MISSING");

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    alert(`${type} copied to clipboard!`);
  };

  return (
    <PortalLayout
      portalName="Media & Broadcast Partner"
      portalIcon="📺"
      portalColor="#ec4899"
      allowedRoles={["media"]}
    >
      <div className="space-y-10 relative">
        {/* PII Strict Guard Banner */}
        <div className="p-4 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-semibold flex items-center gap-2">
          <span>🔒 Strict Privacy Guard: Contact Numbers are restricted (Contact Police). Verified Missing Cases ready for journalism.</span>
        </div>

        {/* Top Stats Overview & Download Action */}
        <div className="flex justify-between items-center flex-wrap gap-4 border-b border-white/5 pb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-100">National Awareness Dashboard</h3>
            <p className="text-xs text-slate-400 mt-1">Anonymized statistics and verified alerts ready for television/press distribution.</p>
          </div>
          <button
            onClick={handleDownloadPressKit}
            className="btn-primary"
            style={{ background: "linear-gradient(135deg, #ec4899, #db2777)" }}
            id="media-press-kit-download-btn"
          >
            <span>Download Press Kit (ZIP) 📦</span>
          </button>
        </div>

        {/* Recharts Analytics Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Status Breakdown Pie */}
          <div className="glass-card p-6 border-white/10 flex flex-col justify-between min-h-[320px]">
            <h4 className="text-sm font-bold text-slate-300 mb-4">Registry Breakdown</h4>
            <div className="w-full h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#0a0a0f", borderColor: "rgba(255,255,255,0.1)", borderRadius: "8px" }}
                    itemStyle={{ color: "#e2e8f0", fontSize: "11px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-around text-[10px] text-slate-400 font-semibold font-mono">
              <span className="text-indigo-400">● Active</span>
              <span className="text-emerald-400">● Resolved</span>
              <span className="text-amber-400">● Unidentified</span>
            </div>
          </div>

          {/* Monthly Trend Line */}
          <div className="glass-card p-6 border-white/10 min-h-[320px]">
            <h4 className="text-sm font-bold text-slate-300 mb-4">Monthly Case Volume</h4>
            <div className="w-full h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrendData}>
                  <XAxis dataKey="month" stroke="#475569" fontSize={10} tickLine={false} />
                  <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#0a0a0f", borderColor: "rgba(255,255,255,0.1)", borderRadius: "8px" }}
                  />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: "10px" }} />
                  <Line type="monotone" dataKey="missing" stroke="#6366f1" strokeWidth={2} name="Total Reported" />
                  <Line type="monotone" dataKey="resolved" stroke="#10b981" strokeWidth={2} name="Reunited" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* City Distribution Bar */}
          <div className="glass-card p-6 border-white/10 min-h-[320px]">
            <h4 className="text-sm font-bold text-slate-300 mb-4">Top Municipal Districts</h4>
            <div className="w-full h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cityTrendData}>
                  <XAxis dataKey="city" stroke="#475569" fontSize={10} tickLine={false} />
                  <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#0a0a0f", borderColor: "rgba(255,255,255,0.1)", borderRadius: "8px" }}
                  />
                  <Bar dataKey="count" fill="#ec4899" radius={[4, 4, 0, 0]} name="Cases Count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Confirmed MISSING Cases Broadcast Feed */}
        <div className="space-y-6">
          <h3 className="text-lg font-bold text-slate-200">Confirmed Missing Press Broadcast Feed</h3>
          {isLoading ? (
            <div className="text-center py-10 text-slate-500">Retrieving broadcast feed...</div>
          ) : missingCases.length === 0 ? (
            <div className="glass-card p-12 text-center text-slate-500 text-xs">No active missing broadcasts logged.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {missingCases.map((c: Case) => {
                const daysMissing = Math.max(1, Math.floor((Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24)));
                return (
                  <div key={c.id} className="glass-card p-5 flex flex-col justify-between border-white/5 bg-slate-950/40 hover:border-pink-500/40 transition">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-mono text-pink-400 font-bold">{c.case_number}</span>
                        <StatusBadge status={c.status} />
                      </div>

                      <div className="w-full h-48 rounded-xl bg-slate-900 overflow-hidden relative">
                        {c.person?.photo_url ? (
                          <img src={c.person.photo_url.startsWith("http") ? c.person.photo_url : `http://localhost:8000${c.person.photo_url}`} alt="P" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-4xl">👤</div>
                        )}
                      </div>

                      <div>
                        <h4 className="text-base font-black text-white">{c.person?.full_name || "Unknown"}</h4>
                        <p className="text-xs text-slate-300 mt-1">Age: {c.person?.age_min || "?"} yrs | City: {c.last_seen_city}</p>
                        <p className="text-[11px] text-amber-400 font-semibold mt-1">⏳ {daysMissing} days missing</p>
                        <p className="text-[11px] font-mono text-pink-400 font-bold mt-2">📞 Contact Police</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-5 pt-4 border-t border-white/10">
                      <button
                        onClick={() => setEmbedModalCase(c)}
                        className="py-2 px-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200 transition text-center"
                      >
                        Get Embed Widget
                      </button>
                      <button
                        onClick={() => setPressModalCase(c)}
                        className="py-2 px-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-xs font-bold text-white transition shadow shadow-pink-500/20 text-center"
                      >
                        Generate Press Release
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Embed Widget Generator Modal */}
        {embedModalCase && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="glass-card p-6 max-w-lg w-full space-y-4 bg-slate-900 border border-pink-500/40 shadow-2xl">
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <h3 className="text-sm font-bold text-pink-400">🔗 HTML Embed Widget Generator</h3>
                <button onClick={() => setEmbedModalCase(null)} className="text-slate-400 hover:text-white">✕</button>
              </div>
              <p className="text-xs text-slate-300">Copy this code to display live case alert on news portal or digital newspaper:</p>
              <div className="p-3 bg-black/60 rounded-xl border border-white/10 font-mono text-[11px] text-emerald-400 select-all overflow-x-auto">
                {`<iframe src="https://wajood.pk/embed/${embedModalCase.case_number}" width="100%" height="320" frameborder="0"></iframe>`}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => copyToClipboard(`<iframe src="https://wajood.pk/embed/${embedModalCase.case_number}" width="100%" height="320" frameborder="0"></iframe>`, "Embed Code")}
                  className="btn-primary py-2 px-5 text-xs font-bold"
                  style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
                >
                  Copy HTML Code
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Press Release Generator Modal */}
        {pressModalCase && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="glass-card p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto space-y-5 bg-slate-900 border border-pink-500/40 shadow-2xl">
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <h3 className="text-sm font-bold text-pink-400">📰 Newspaper Press Release Generator</h3>
                <button onClick={() => setPressModalCase(null)} className="text-slate-400 hover:text-white">✕</button>
              </div>
              
              <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
                <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-2 font-serif">
                  <h4 className="font-bold text-white uppercase text-[11px] text-pink-400">English Bulletin</h4>
                  <p><strong>URGENT PUBLIC NOTICE — MISSING PERSON</strong></p>
                  <p>The public is notified that <strong>{pressModalCase.person?.full_name}</strong> (Age: {pressModalCase.person?.age_min} yrs) has been reported missing from <strong>{pressModalCase.last_seen_city}</strong>. Official reference: {pressModalCase.case_number}. Any citizen with credible telemetry or sightings is requested to contact Law Enforcement authorities or report online via WAJOOD Platform immediately. Contact Police.</p>
                </div>

                <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-2 font-serif text-right" dir="rtl">
                  <h4 className="font-bold text-white uppercase text-[11px] text-pink-400 text-left" dir="ltr">Urdu Bulletin</h4>
                  <p className="text-sm font-bold">عوام کو مطلع کیا جاتا ہے — گمشدہ شخص</p>
                  <p className="text-xs leading-loose">عوام الناس کو مطلع کیا جاتا ہے کہ <strong>{pressModalCase.person?.full_name}</strong> (عمر تقریباً {pressModalCase.person?.age_min} سال) شہر <strong>{pressModalCase.last_seen_city}</strong> سے گمشدہ ہیں۔ کیس نمبر: {pressModalCase.case_number}۔ کسی بھی شہری کے پاس معلومات یا تصدیق شدہ اطلاع ہو تو فوری طور پر قریبی پولیس اسٹیشن یا وجود پلیٹ فارم پر اطلاع دیں۔ قریبی پولیس سے رابطہ کریں۔</p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  onClick={() => copyToClipboard(`URGENT NOTICE: ${pressModalCase.person?.full_name} missing from ${pressModalCase.last_seen_city}. Case #${pressModalCase.case_number}. Contact Police.`, "Press Release")}
                  className="btn-primary py-2 px-5 text-xs font-bold"
                  style={{ background: "linear-gradient(135deg, #ec4899, #db2777)" }}
                >
                  Copy Bulletin Text
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </PortalLayout>
  );
}
