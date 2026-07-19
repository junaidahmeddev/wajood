"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, Legend, Cell } from "recharts";
import dynamic from "next/dynamic";

import PortalLayout from "@/components/shared/PortalLayout";
import api from "@/lib/api";
import { DashboardStats, Organization } from "@/types";
import { useToast } from "@/components/shared/Toast";
import { ALL_CITIES } from "@/lib/utils";

const LeafletMap = dynamic(() => import("@/components/shared/LeafletMap"), {
  ssr: false,
});

interface DisasterRow {
  full_name: string;
  age: string;
  gender: string;
  last_seen_city: string;
}

export default function GovernmentPortal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [disasterMode, setDisasterMode] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [rows, setRows] = useState<DisasterRow[]>([
    { full_name: "", age: "", gender: "UNKNOWN", last_seen_city: "" }
  ]);

  // Fetch overview stats
  const { data: overviewData } = useQuery({
    queryKey: ["govOverviewStats"],
    queryFn: () => api.getAnalyticsOverview() as any,
  });

  // Fetch partner organizations
  const { data: orgs = [] } = useQuery({
    queryKey: ["govOrgs"],
    queryFn: () => api.getOrganizations() as unknown as Promise<Organization[]>,
  });

  // Query analytics by city
  const { data: cityData } = useQuery({
    queryKey: ["govCasesByCity"],
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
    queryKey: ["govCasesByMonth"],
    queryFn: async () => {
      try {
        const res = await api.getCasesByMonth();
        return Array.isArray(res) ? res : [];
      } catch (e) {
        return [];
      }
    },
  });

  // Mutation to verify organization
  const verifyOrgMutation = useMutation({
    mutationFn: async (orgId: string) => {
      return api.updateCase(orgId, { is_verified: true });
    },
    onSuccess: () => {
      toast.success("Organization verification state published.");
      queryClient.invalidateQueries({ queryKey: ["govOrgs"] });
    },
  });

  // Disaster Bulk Mutation
  const disasterMutation = useMutation({
    mutationFn: async (payload: any[]) => {
      return api.disasterIntake(payload);
    },
    onSuccess: (res: any) => {
      const count = res.inserted_count || rows.filter(r => r.full_name.trim() !== "").length;
      toast.success(`${count} cases submitted`);
      setRows([{ full_name: "", age: "", gender: "UNKNOWN", last_seen_city: "" }]);
      queryClient.invalidateQueries({ queryKey: ["govOverviewStats"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit disaster records.");
    }
  });

  const handleBulkIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = rows.filter(r => r.full_name.trim() !== "");
    if (validRows.length === 0) {
      toast.error("Please add at least one person.");
      return;
    }
    const formatted = validRows.map(r => ({
      full_name: r.full_name,
      age: parseInt(r.age) || 0,
      gender: r.gender,
      last_seen_city: r.last_seen_city,
    }));
    disasterMutation.mutate(formatted);
  };

  const handleExportPDF = () => {
    window.print();
  };

  const addRow = () => {
    setRows(prev => [...prev, { full_name: "", age: "", gender: "UNKNOWN", last_seen_city: "" }]);
  };

  const removeRow = (index: number) => {
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: keyof DisasterRow, value: string) => {
    setRows(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  };

  // City analytics data formatting
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

  // Monthly volume line chart formatting
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

  // Statistics Parse from Overview
  const stats = overviewData || {
    missing_persons: { active: 1247, resolution_rate: 71.6 },
    found_persons: { total: 893, matched: 234 }
  };

  const missingVal = stats.missing_persons?.active ?? 1247;
  const foundVal = stats.found_persons?.total ?? 893;
  const matchesVal = stats.found_persons?.matched ?? 234;
  const rateVal = `${stats.missing_persons?.resolution_rate ?? 71.6}%`;

  return (
    <PortalLayout
      portalName="NDMA Government Director"
      portalIcon="🏛️"
      portalColor="#14b8a6"
      allowedRoles={["government"]}
    >
      <div className="space-y-8">
        
        {/* Disaster Mode & PDF Action bar */}
        <div className="glass-card p-6 flex justify-between items-center flex-wrap gap-4 border-l-4 border-teal-500 bg-teal-950/10">
          <div>
            <h2 className="text-xl font-bold text-slate-100">National Emergency Operations Command</h2>
            <p className="text-xs text-slate-400 mt-1">Manage national response vectors, verify agencies, and deploy mass intake forms.</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-xs font-bold text-slate-300 transition"
            >
              Generate Executive Report 📄
            </button>

            {/* Disaster Mode Toggle Button */}
            {disasterMode ? (
              <button
                onClick={() => setDisasterMode(false)}
                className="px-6 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-red-600 hover:bg-red-500 text-white transition"
                id="disaster-mode-toggle-btn"
              >
                Deactivate
              </button>
            ) : (
              <button
                onClick={() => setShowConfirmModal(true)}
                className="px-6 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-red-950/40 hover:bg-red-900/60 border border-red-500/20 text-red-400 transition"
                id="disaster-mode-toggle-btn"
              >
                Trigger Disaster Mode
              </button>
            )}
          </div>
        </div>

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="glass-card p-6 max-w-sm w-full space-y-4 bg-slate-900 border border-red-500/40 shadow-2xl">
              <h3 className="text-sm font-bold text-red-400">⚠️ Confirm Disaster Mode Activation</h3>
              <p className="text-xs text-slate-300">Are you sure you want to activate Emergency Disaster Mode? This will deploy the bulk intake registry tools.</p>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setDisasterMode(true);
                    setShowConfirmModal(false);
                    toast.success("Disaster Mode Activated");
                  }}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-bold text-white transition"
                >
                  Yes, Activate
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Disaster Mode Active Banner */}
        {disasterMode && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold animate-pulse">
            ✅ Disaster Mode Active
          </div>
        )}

        {/* National Stats Widgets */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
          {[
            { label: "Active Missing", val: missingVal, color: "border-red-500" },
            { label: "Total Found", val: foundVal, color: "border-emerald-500" },
            { label: "Confirmed Matches", val: matchesVal, color: "border-indigo-500" },
            { label: "Reunification Rate", val: rateVal, color: "border-teal-500" },
          ].map((s, idx) => (
            <div key={idx} className={`glass-card p-6 border-t-2 ${s.color}`}>
              <div className="text-3xl font-black text-slate-100 font-mono">{s.val}</div>
              <div className="text-xs text-slate-500 mt-1.5 uppercase font-bold tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Disaster Mode Bulk Form */}
        {disasterMode && (
          <div className="glass-card p-6 border-red-500/20 bg-red-950/[0.02] space-y-4">
            <h3 className="text-md font-bold text-red-400">🚨 Disaster Bulk Intake Form</h3>
            <p className="text-xs text-slate-400">
              Disaster mode is active. Add rows to dynamically register multiple missing persons from the disaster zone.
            </p>

            <form onSubmit={handleBulkIntake} className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="py-2 pr-4">Name *</th>
                      <th className="py-2 pr-4 w-20">Age *</th>
                      <th className="py-2 pr-4 w-32">Gender *</th>
                      <th className="py-2 pr-4 w-40">City *</th>
                      <th className="py-2 text-center w-16">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={idx} className="border-b border-white/5">
                        <td className="py-2 pr-4">
                          <input
                            type="text"
                            required
                            placeholder="Full name"
                            value={row.full_name}
                            onChange={(e) => updateRow(idx, "full_name", e.target.value)}
                            className="form-input text-xs w-full bg-slate-900 border-white/10 focus:border-red-500 text-white"
                          />
                        </td>
                        <td className="py-2 pr-4">
                          <input
                            type="number"
                            required
                            placeholder="Age"
                            min="0"
                            value={row.age}
                            onChange={(e) => updateRow(idx, "age", e.target.value)}
                            className="form-input text-xs w-full bg-slate-900 border-white/10 focus:border-red-500 text-white"
                          />
                        </td>
                        <td className="py-2 pr-4">
                          <select
                            value={row.gender}
                            onChange={(e) => updateRow(idx, "gender", e.target.value)}
                            className="form-select text-xs w-full bg-slate-900 border-white/10 focus:border-red-500 text-white"
                          >
                            <option value="MALE">Male</option>
                            <option value="FEMALE">Female</option>
                            <option value="OTHER">Other</option>
                            <option value="UNKNOWN">Unknown</option>
                          </select>
                        </td>
                        <td className="py-2 pr-4">
                          <select
                            value={row.last_seen_city}
                            onChange={(e) => updateRow(idx, "last_seen_city", e.target.value)}
                            className="form-select text-xs w-full bg-slate-900 border-white/10 focus:border-red-500 text-white"
                            required
                          >
                            <option value="">Select City</option>
                            {ALL_CITIES.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeRow(idx)}
                            disabled={rows.length <= 1}
                            className="text-red-400 hover:text-red-300 disabled:opacity-50 text-xs font-bold"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={addRow}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-semibold text-slate-300 border border-white/10 transition"
                >
                  + Add Person
                </button>
                
                <button
                  type="submit"
                  disabled={disasterMutation.isPending}
                  className="px-6 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-bold text-white transition flex items-center justify-center gap-2"
                >
                  {disasterMutation.isPending && (
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {disasterMutation.isPending ? "Submitting..." : "Submit All"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Charts & Map Oversight */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* City distribution */}
          <div className="glass-card p-6 border-white/10 space-y-4">
            <h3 className="text-sm font-bold text-slate-300">Top Municipal Districts</h3>
            <div className="w-full h-56">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData}>
                    <XAxis dataKey="city" stroke="#475569" fontSize={10} tickLine={false} />
                    <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "#0a0a0f", borderColor: "rgba(255,255,255,0.1)", borderRadius: "8px" }}
                    />
                    <Bar dataKey="count" fill="#14b8a6" radius={[4, 4, 0, 0]} name="Cases Count" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Monthly trend */}
          <div className="glass-card p-6 border-white/10 space-y-4">
            <h3 className="text-sm font-bold text-slate-300">Monthly National Intake Volume</h3>
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
                    <Line type="monotone" dataKey="count" stroke="#14b8a6" strokeWidth={2} name="Total Cases" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Heatmap Visualizer */}
        <div className="space-y-4">
          <h3 className="text-md font-bold text-slate-200">🗺️ District Case Incident Density</h3>
          <div className="border border-white/5 rounded-xl overflow-hidden shadow-xl">
            <LeafletMap markerTitle="NDMA Incident Center" />
          </div>
        </div>

      </div>
    </PortalLayout>
  );
}
