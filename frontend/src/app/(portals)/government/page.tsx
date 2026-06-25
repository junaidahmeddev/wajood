"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, Legend, Cell } from "recharts";
import dynamic from "next/dynamic";

import PortalLayout from "@/components/shared/PortalLayout";
import api from "@/lib/api";
import { DashboardStats, Organization } from "@/types";

const LeafletMap = dynamic(() => import("@/components/shared/LeafletMap"), {
  ssr: false,
});

export default function GovernmentPortal() {
  const queryClient = useQueryClient();
  const [disasterMode, setDisasterMode] = useState(false);
  const [bulkData, setBulkData] = useState("");
  const [bulkSuccess, setBulkSuccess] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);

  // Fetch administrative stats
  const { data: statsData } = useQuery({
    queryKey: ["govStats"],
    queryFn: () => api.getDashboardStats() as unknown as Promise<DashboardStats>,
  });

  // Fetch partner organizations
  const { data: orgs = [] } = useQuery({
    queryKey: ["govOrgs"],
    queryFn: () => api.getOrganizations() as unknown as Promise<Organization[]>,
  });

  // Mutation to verify organization
  const verifyOrgMutation = useMutation({
    mutationFn: async (orgId: string) => {
      // Endpoint to verify organization is restricted to GOVT or ADMIN
      return api.updateCase(orgId, { is_verified: true });
    },
    onSuccess: () => {
      alert("Organization verification state published.");
      queryClient.invalidateQueries({ queryKey: ["govOrgs"] });
    },
  });

  // Bulk disaster intake submission
  const handleBulkIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkError("");
    setBulkSuccess("");
    if (!bulkData.trim()) return;

    setBulkLoading(true);
    try {
      const parsed = JSON.parse(bulkData);
      if (!Array.isArray(parsed)) {
        throw new Error("Payload must be a JSON array of case records.");
      }
      
      const res: any = await api.disasterIntake(parsed);
      setBulkSuccess(`Successfully ingested ${res.inserted_count} disaster records into the registry.`);
      setBulkData("");
    } catch (err: any) {
      setBulkError(err.message || "Failed to process bulk payload. Make sure it is valid JSON.");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  // Recharts case distribution
  const provinceData = [
    { name: "Punjab", count: 245, color: "#14b8a6" },
    { name: "Sindh", count: 184, color: "#3b82f6" },
    { name: "Khyber Pakhtunkhwa", count: 92, color: "#8b5cf6" },
    { name: "Balochistan", count: 48, color: "#ef4444" },
    { name: "Islamabad", count: 22, color: "#f59e0b" },
  ];

  const trendData = [
    { month: "Jan", cases: 28, resolved: 14 },
    { month: "Feb", cases: 35, resolved: 18 },
    { month: "Mar", cases: 48, resolved: 22 },
    { month: "Apr", cases: 54, resolved: 31 },
    { month: "May", cases: 62, resolved: 40 },
    { month: "Jun", cases: 88, resolved: 52 },
  ];

  const stats = statsData || {
    cases: { total: 145, active: 92, resolved: 53, resolution_rate: 36.5 }
  };

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

            {/* Disaster Mode Toggle (Big Red Button) */}
            <button
              onClick={() => {
                setDisasterMode(!disasterMode);
                alert(disasterMode ? "Disaster Mode DEACTIVATED. Reverting registry controls." : "🔴 EMERGENCY DISASTER MODE DEPLOYED. Mass intake form activated.");
              }}
              className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                disasterMode
                  ? "bg-red-600 hover:bg-red-500 text-white animate-pulse"
                  : "bg-red-950/40 hover:bg-red-900/60 border border-red-500/20 text-red-400"
              }`}
              id="disaster-mode-toggle-btn"
            >
              {disasterMode ? "🔴 Disaster Mode Active" : "Trigger Disaster Mode"}
            </button>
          </div>
        </div>

        {/* National Stats Widgets */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
          {[
            { label: "Total National Cases", val: stats.cases.total, color: "border-teal-500" },
            { label: "Active Investigations", val: stats.cases.active, color: "border-red-500" },
            { label: "Reunification Rate", val: `${stats.cases.resolution_rate}%`, color: "border-emerald-500" },
            { label: "Registered Agencies", val: orgs.length, color: "border-indigo-500" },
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
            <h3 className="text-md font-bold text-red-400">🚨 Disaster Bulk Case Intake (JSON Format)</h3>
            <p className="text-xs text-slate-400">
              Disaster mode is active. Paste a JSON array containing missing person reports below to queue them for bulk database registration and matching.
            </p>

            <form onSubmit={handleBulkIntake} className="space-y-4">
              <textarea
                value={bulkData}
                onChange={(e) => setBulkData(e.target.value)}
                placeholder='[\n  {\n    "full_name": "Disaster Victim",\n    "age": 28,\n    "gender": "FEMALE",\n    "last_seen_city": "Karachi",\n    "last_seen_location": "DHA Phase 6 flooded area"\n  }\n]'
                className="form-input text-xs font-mono min-h-[140px] border-red-500/10 focus:border-red-500"
                id="disaster-bulk-textarea"
              />
              
              {bulkSuccess && (
                <p className="text-xs text-emerald-400 font-semibold">✅ {bulkSuccess}</p>
              )}
              {bulkError && (
                <p className="text-xs text-red-400 font-semibold">❌ {bulkError}</p>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={bulkLoading}
                  className="px-6 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-bold text-white transition"
                >
                  {bulkLoading ? "Registering Bulk..." : "Ingest Bulk Cases"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Charts & Map Oversight */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Provincial distribution */}
          <div className="glass-card p-6 border-white/10 space-y-4">
            <h3 className="text-sm font-bold text-slate-300">Provincial Oversight Distribution</h3>
            <div className="w-full h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={provinceData}>
                  <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} />
                  <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#0a0a0f", borderColor: "rgba(255,255,255,0.1)", borderRadius: "8px" }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {provinceData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly trend */}
          <div className="glass-card p-6 border-white/10 space-y-4">
            <h3 className="text-sm font-bold text-slate-300">Monthly National Intake Volume</h3>
            <div className="w-full h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <XAxis dataKey="month" stroke="#475569" fontSize={10} tickLine={false} />
                  <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#0a0a0f", borderColor: "rgba(255,255,255,0.1)", borderRadius: "8px" }}
                  />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: "10px" }} />
                  <Line type="monotone" dataKey="cases" stroke="#14b8a6" strokeWidth={2} name="Reported" />
                  <Line type="monotone" dataKey="resolved" stroke="#10b981" strokeWidth={2} name="Resolved" />
                </LineChart>
              </ResponsiveContainer>
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
