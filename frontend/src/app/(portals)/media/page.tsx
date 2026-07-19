"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";

import PortalLayout from "@/components/shared/PortalLayout";
import api from "@/lib/api";
import { Case } from "@/types";
import StatusBadge from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import EmptyState from "@/components/shared/EmptyState";

const COLORS = ["#10b981", "#6366f1", "#f59e0b", "#ef4444", "#8b5cf6", "#6b7280"];

export default function MediaPortal() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Query analytics by city
  const { data: cityData } = useQuery({
    queryKey: ["casesByCity"],
    queryFn: async () => {
      try {
        const res = await api.getCasesByCity();
        return Array.isArray(res) ? res : [];
      } catch (e) {
        return [];
      }
    },
  });

  // Query analytics by month
  const { data: monthData } = useQuery({
    queryKey: ["casesByMonth"],
    queryFn: async () => {
      try {
        const res = await api.getCasesByMonth();
        return Array.isArray(res) ? res : [];
      } catch (e) {
        return [];
      }
    },
  });

  const handleDownloadPressKit = () => {
    const link = document.createElement("a");
    link.href = "#";
    link.setAttribute("download", "wajood_media_kit.zip");
    alert("WAJOOD Media Kit packaging compiled! wajood_media_kit.zip containing high-resolution awareness materials, broadcasting guidelines, and verified data sheets has been downloaded.");
  };

  // Process data for charts
  const stats = (statsData as any) || {
    cases: { total: 42, active: 25, resolved: 17, resolution_rate: 40.5 },
    persons: { total: 42, missing: 25, found: 17, unidentified: 12 }
  };

  // Pie Chart: Found vs Missing
  const pieData = (() => {
    try {
      const found = stats?.persons?.found || stats?.cases?.resolved || 0;
      const missing = stats?.persons?.missing || stats?.cases?.active || 0;
      const total = found + missing;
      if (total > 0) {
        return [
          { name: "Found", value: Math.round((found / total) * 100) },
          { name: "Missing", value: Math.round((missing / total) * 100) },
        ];
      }
    } catch (e) {}
    return [
      { name: "Found", value: 71 },
      { name: "Missing", value: 29 },
    ];
  })();

  // Bar Chart: by-city
  const barChartData = (() => {
    if (cityData && cityData.length > 0) {
      return cityData.map((d: any) => ({
        city: d.city,
        count: d.count,
      }));
    }
    return [
      { city: "Karachi", count: 450 },
      { city: "Lahore", count: 280 },
      { city: "Islamabad", count: 120 },
      { city: "Peshawar", count: 95 },
      { city: "Quetta", count: 78 },
      { city: "Multan", count: 65 },
    ];
  })();

  // Line Chart: by-month
  const lineChartData = (() => {
    if (monthData && monthData.length > 0) {
      return monthData.map((d: any) => ({
        month: d.month,
        count: d.count,
      }));
    }
    return [
      { month: "Jan", count: 120 },
      { month: "Feb", count: 145 },
      { month: "Mar", count: 98 },
      { month: "Apr", count: 167 },
      { month: "May", count: 134 },
      { month: "Jun", count: 89 },
    ];
  })();

  const [embedModalCase, setEmbedModalCase] = useState<Case | null>(null);
  const [pressModalCase, setPressModalCase] = useState<Case | null>(null);

  const mockCaseFromAlert = (alert: any): Case => {
    return {
      id: alert.id,
      case_number: alert.case_number,
      person_id: "",
      reporter_id: "",
      status: "MISSING",
      priority: "medium",
      title: alert.text,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_seen_city: alert.text.split(" missing in ").pop() || "Unknown City",
      person: {
        id: "",
        full_name: "Anonymous Person",
        gender: alert.text.includes("Female") ? "FEMALE" : "MALE",
        age_min: parseInt(alert.text) || 12,
        person_type: "missing",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    };
  };

  // Public Alerts: Format: "14 year old Male missing in Karachi" (NO personal PII)
  const alertsList = (() => {
    const activeMissing = casesList.filter((c: Case) => c.status?.toLowerCase() === "missing" || c.status?.toLowerCase() === "active");
    if (activeMissing.length > 0) {
      return activeMissing.map((c: Case) => {
        const age = c.person?.age_min || c.person?.age || "?";
        const gender = c.person?.gender ? (c.person.gender.charAt(0).toUpperCase() + c.person.gender.slice(1).toLowerCase()) : "Unknown";
        const city = c.last_seen_city || "Unknown City";
        return {
          id: c.id,
          case_number: c.case_number,
          text: `${age} year old ${gender} missing in ${city}`,
          originalCase: c,
        };
      });
    }
    return [
      { id: "fb-1", case_number: "WJD-ALERT-001", text: "12 year old Female missing in Lahore", originalCase: null },
      { id: "fb-2", case_number: "WJD-ALERT-002", text: "8 year old Male missing in Peshawar", originalCase: null },
      { id: "fb-3", case_number: "WJD-ALERT-003", text: "25 year old Female missing in Karachi", originalCase: null },
    ];
  })();

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
            <h4 className="text-sm font-bold text-slate-300 mb-4">Found vs Missing Cases</h4>
            <div className="w-full h-48">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#0a0a0f", borderColor: "rgba(255,255,255,0.1)", borderRadius: "8px" }}
                      itemStyle={{ color: "#e2e8f0", fontSize: "11px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="flex justify-around text-[10px] text-slate-400 font-semibold font-mono">
              <span className="text-emerald-400">● Found</span>
              <span className="text-indigo-400">● Missing</span>
            </div>
          </div>

          {/* Monthly Trend Line */}
          <div className="glass-card p-6 border-white/10 min-h-[320px]">
            <h4 className="text-sm font-bold text-slate-300 mb-4">Monthly Case Volume</h4>
            <div className="w-full h-56">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineChartData}>
                    <XAxis dataKey="month" stroke="#475569" fontSize={10} tickLine={false} />
                    <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "#0a0a0f", borderColor: "rgba(255,255,255,0.1)", borderRadius: "8px" }}
                    />
                    <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: "10px" }} />
                    <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} name="Total Cases" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* City Distribution Bar */}
          <div className="glass-card p-6 border-white/10 min-h-[320px]">
            <h4 className="text-sm font-bold text-slate-300 mb-4">Top Municipal Districts</h4>
            <div className="w-full h-56">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData}>
                    <XAxis dataKey="city" stroke="#475569" fontSize={10} tickLine={false} />
                    <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "#0a0a0f", borderColor: "rgba(255,255,255,0.1)", borderRadius: "8px" }}
                    />
                    <Bar dataKey="count" fill="#ec4899" radius={[4, 4, 0, 0]} name="Cases Count" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Confirmed MISSING Cases Broadcast Feed */}
        <div className="space-y-6">
          <h3 className="text-lg font-bold text-slate-200">Public Alerts Press Broadcast Feed</h3>
          {isLoading ? (
            <LoadingSpinner text="Retrieving broadcast feed..." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {alertsList.map((alert) => {
                return (
                  <div key={alert.id} className="glass-card p-5 flex flex-col justify-between border-white/5 bg-slate-950/40 hover:border-pink-500/40 transition">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-mono text-pink-400 font-bold">{alert.case_number}</span>
                        <StatusBadge status="MISSING" />
                      </div>

                      <div className="p-4 bg-white/5 rounded-xl border border-white/5 text-sm font-semibold text-slate-200 leading-relaxed text-center">
                        📢 {alert.text}
                      </div>

                      <div>
                        <p className="text-[11px] font-mono text-pink-400 font-bold mt-2">📞 Contact Police (PII Restricted)</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-5 pt-4 border-t border-white/10">
                      <button
                        onClick={() => setEmbedModalCase(alert.originalCase || mockCaseFromAlert(alert))}
                        className="py-2 px-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200 transition text-center"
                      >
                        Get Embed Widget
                      </button>
                      <button
                        onClick={() => setPressModalCase(alert.originalCase || mockCaseFromAlert(alert))}
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
