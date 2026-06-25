"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import PortalLayout from "@/components/shared/PortalLayout";
import api from "@/lib/api";
import { Case, MatchResult } from "@/types";
import StatusBadge from "@/components/shared/StatusBadge";
import MatchCard from "@/components/shared/MatchCard";
import CityFilter from "@/components/shared/CityFilter";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/shared/Toast";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import EmptyState from "@/components/shared/EmptyState";

const firSchema = z.object({
  fir_number: z.string().min(2, "FIR number must be specified"),
  police_station: z.string().min(3, "Police station must be specified"),
  status: z.string(),
  notes: z.string().optional(),
});

type FirFields = z.infer<typeof firSchema>;

// Global Match Queue Triage Desk Sub-Component
function GlobalMatchQueueDesk({ onToast }: { onToast: (msg: string) => void }) {
  const queryClient = useQueryClient();
  
  const { data: queue = [], isLoading } = useQuery({
    queryKey: ["globalMatchQueue"],
    queryFn: async () => {
      const res: any = await api.getMatchQueue();
      return Array.isArray(res) ? res : [];
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => api.confirmMatch(id),
    onSuccess: () => {
      onToast("✅ Match CONFIRMED! Case and found person record status automatically transitioned to MATCHED.");
      queryClient.invalidateQueries({ queryKey: ["globalMatchQueue"] });
      queryClient.invalidateQueries({ queryKey: ["leCases"] });
      queryClient.invalidateQueries({ queryKey: ["caseMatches"] });
    },
    onError: (err: any) => alert("Confirmation error: " + err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.rejectMatch(id),
    onSuccess: () => {
      onToast("❌ Match REJECTED. False positive candidate removed from active triage queue.");
      queryClient.invalidateQueries({ queryKey: ["globalMatchQueue"] });
    },
    onError: (err: any) => alert("Rejection error: " + err.message),
  });

  if (isLoading) {
    return <LoadingSpinner text="Synchronizing National Biometric Telemetry Queue..." />;
  }

  if (queue.length === 0) {
    return (
      <EmptyState title="Forensics Triage Desk Clear" icon="🎉" description="No pending AI biometric reunifications awaiting verification." />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-blue-950/40 p-4 rounded-xl border border-blue-500/30 shadow-lg">
        <div>
          <h4 className="text-sm font-bold text-blue-200">Centralized Forensics Verification Queue</h4>
          <p className="text-[11px] text-slate-400 mt-0.5">Review side-by-side biometric embeddings prior to issuing legal custody release orders.</p>
        </div>
        <span className="px-3.5 py-1 bg-blue-600 text-white rounded-full text-xs font-black shadow-md">
          {queue.length} PENDING
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {queue.map((m: any) => (
          <MatchCard
            key={m.id}
            match={m}
            onConfirm={(mid) => confirmMutation.mutate(mid)}
            onReject={(mid) => rejectMutation.mutate(mid)}
          />
        ))}
      </div>
    </div>
  );
}

export default function LawEnforcementPortal() {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"cases" | "match-queue">("cases");
  const [toastMessage, setToastMessage] = useState("");

  // Advanced search states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [updating, setUpdating] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 5000);
  };

  // Fetch cases with advanced search params
  const { data: casesList = [], isLoading: isLoadingCases } = useQuery({
    queryKey: ["leCases", searchTerm, filterCity, filterStatus],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (searchTerm) params.search = searchTerm;
      if (filterCity) params.city = filterCity;
      if (filterStatus) params.status = filterStatus;
      const res = await api.getCases(params);
      return Array.isArray(res) ? res : [];
    },
  });

  // Fetch AI Match results for the selected case folder
  const { data: matchResults = [], isLoading: isLoadingMatches } = useQuery({
    queryKey: ["caseMatches", selectedCase?.id],
    queryFn: async () => {
      if (!selectedCase) return [];
      const res = await api.getMatchResults(selectedCase.id);
      return Array.isArray(res) ? res : [];
    },
    enabled: !selectedCase,
  });

  const { register, handleSubmit, setValue, watch } = useForm<FirFields>({
    resolver: zodResolver(firSchema),
  });

  useEffect(() => {
    if (selectedCase) {
      setValue("fir_number", selectedCase.fir_number || "");
      setValue("police_station", selectedCase.police_station || "");
      setValue("status", selectedCase.status);
      setValue("notes", "");
    }
  }, [selectedCase, setValue]);

  // Form submit handler to link FIR / Update Case
  const handleUpdateRecord = async (fields: FirFields) => {
    if (!selectedCase) return;
    setUpdating(true);
    try {
      await api.updateCase(selectedCase.id, {
        fir_number: fields.fir_number,
        police_station: fields.police_station,
      });

      if (fields.status !== selectedCase.status) {
        await api.updateCaseStatus(selectedCase.id, fields.status, fields.notes);
      }

      showToast("✅ Official investigation logs and FIR records saved successfully.");
      queryClient.invalidateQueries({ queryKey: ["leCases"] });
      
      const updatedCase = await api.getCase(selectedCase.id);
      if (updatedCase) {
        setSelectedCase((updatedCase as any).case || updatedCase);
      }
    } catch (err: any) {
      alert("Failed to update investigation records: " + err.message);
    } finally {
      setUpdating(false);
    }
  };

  // Manual AI Match trigger for folder
  const handleTriggerMatching = async () => {
    if (!selectedCase) return;
    try {
      await api.runMatching(selectedCase.id);
      showToast("⚡ AI biometric matching engine triggered for folder. Re-querying results list.");
      queryClient.invalidateQueries({ queryKey: ["caseMatches", selectedCase.id] });
    } catch (err: any) {
      alert("AI matching request: " + err.message);
    }
  };

  const handleConfirmMatch = async (matchId: string) => {
    try {
      await api.confirmMatch(matchId);
      showToast("✅ Biometric match CONFIRMED! Case status updated to MATCHED.");
      queryClient.invalidateQueries({ queryKey: ["caseMatches", selectedCase?.id] });
      queryClient.invalidateQueries({ queryKey: ["leCases"] });
      queryClient.invalidateQueries({ queryKey: ["globalMatchQueue"] });
    } catch (err: any) {
      alert("Match confirmation failure: " + err.message);
    }
  };

  const handleRejectMatch = async (matchId: string) => {
    try {
      await api.rejectMatch(matchId);
      showToast("❌ Match REJECTED and removed from folder.");
      queryClient.invalidateQueries({ queryKey: ["caseMatches", selectedCase?.id] });
      queryClient.invalidateQueries({ queryKey: ["globalMatchQueue"] });
    } catch (err: any) {
      alert("Match rejection failure: " + err.message);
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <PortalLayout
      portalName="Law Enforcement Officer Panel"
      portalIcon="🛡️"
      portalColor="#3b82f6"
      allowedRoles={["law_enforcement"]}
    >
      <div className="space-y-6">
        
        {/* Top Navigation Switcher */}
        <div className="flex border-b border-white/10 gap-2 pb-1 overflow-x-auto">
          <button
            onClick={() => { setActiveTab("cases"); setToastMessage(""); }}
            className={`py-3 px-6 rounded-t-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === "cases"
                ? "bg-blue-500/10 border-b-2 border-blue-500 text-blue-400 shadow-lg"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            📂 Investigation Folders &amp; FIR Linkage
          </button>
          <button
            onClick={() => { setActiveTab("match-queue"); setToastMessage(""); }}
            className={`py-3 px-6 rounded-t-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === "match-queue"
                ? "bg-blue-500/10 border-b-2 border-blue-500 text-blue-400 shadow-lg"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            <span>⚡ Centralized Match Queue</span>
          </button>
        </div>

        {/* Toast Notification Banner */}
        {toastMessage && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/80 via-slate-900 to-emerald-950/80 border border-blue-500/40 text-white text-sm font-bold shadow-2xl animate-fade-in flex items-center justify-between">
            <span>{toastMessage}</span>
            <button onClick={() => setToastMessage("")} className="text-slate-400 hover:text-white text-xs ml-4">✕</button>
          </div>
        )}

        {/* ─── TAB 1: Match Queue ─── */}
        {activeTab === "match-queue" && (
          <GlobalMatchQueueDesk onToast={showToast} />
        )}

        {/* ─── TAB 2: Investigation Folders ─── */}
        {activeTab === "cases" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-2">
            
            {/* Left Side Panel: Search and Cases List */}
            <div className="lg:col-span-1 space-y-6">
              <div className="glass-card p-6 border-white/10 space-y-4 shadow-lg bg-slate-950/40">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <span>🔍 Advanced Search &amp; Jurisdiction Filter</span>
                </h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="form-label" htmlFor="le-search-q">Case Reference or Name</label>
                    <input
                      id="le-search-q"
                      type="text"
                      placeholder="e.g. WJD, Zainab, Ali..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="form-input text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <CityFilter value={filterCity} onChange={(c) => setFilterCity(c)} label="Cross-District Search" />
                  </div>

                  <div>
                    <label className="form-label" htmlFor="le-status-filter">Status Filter</label>
                    <select
                      id="le-status-filter"
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="form-select text-xs font-semibold w-full"
                    >
                      <option value="">All Statuses</option>
                      <option value="MISSING">Missing</option>
                      <option value="IN_PROCESS">In Process</option>
                      <option value="MATCHED">Matched</option>
                      <option value="FOUND_ALIVE">Found Alive</option>
                      <option value="DECEASED">Deceased</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Cases Feed List */}
              <div className="glass-card p-6 max-h-[60vh] overflow-y-auto space-y-4 border-white/10 shadow-lg bg-slate-950/40">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Folders</h3>
                  <span className="text-[10px] bg-blue-500/10 text-blue-400 font-mono font-bold px-2.5 py-0.5 rounded-full border border-blue-500/20">
                    {casesList.length} total
                  </span>
                </div>

                {isLoadingCases ? (
                  <LoadingSpinner size="sm" text="Querying police registry..." />
                ) : casesList.length === 0 ? (
                  <EmptyState title="No Folders" icon="📂" description="No active investigation files matching criteria." />
                ) : (
                  <div className="space-y-2">
                    {casesList.map((c: Case) => {
                      const isSelected = selectedCase?.id === c.id;
                      return (
                        <div
                          key={c.id}
                          onClick={() => setSelectedCase(c)}
                          className={`p-3.5 rounded-xl border text-left cursor-pointer transition flex flex-col gap-1.5 ${
                            isSelected
                              ? "bg-blue-600/15 border-blue-500 text-white shadow-lg glow-blue"
                              : "bg-white/[0.01] border-white/5 hover:bg-white/[0.04] hover:border-white/10"
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-[11px] font-mono text-blue-400 font-bold">{c.case_number}</span>
                            <StatusBadge status={c.status} />
                          </div>
                          <h4 className="text-xs font-bold text-slate-200">{c.person?.full_name || "Unknown"}</h4>
                          <p className="text-[10px] text-slate-400">
                            📍 {c.last_seen_city} | Logged: {formatDate(c.created_at)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Side Panel: Investigation Folder Details */}
            <div className="lg:col-span-2 space-y-8">
              {selectedCase ? (
                <div className="space-y-8">
                  
                  {/* Folder Header */}
                  <div className="glass-card p-8 border-blue-500/30 relative overflow-hidden bg-slate-950/80 shadow-2xl" id="printable-le-report">
                    <div className="flex justify-between items-start flex-wrap gap-4 border-b border-white/10 pb-5 mb-6">
                      <div>
                        <span className="text-[10px] text-blue-400 font-mono font-bold uppercase tracking-widest">
                          ★ Official Law Enforcement Forensics File ★
                        </span>
                        <h2 className="text-2xl font-black text-white mt-1">{selectedCase.person?.full_name}</h2>
                        <p className="text-xs text-slate-400 mt-1 font-mono">Reference: {selectedCase.case_number}</p>
                      </div>
                      
                      <div className="flex gap-3">
                        <button
                          onClick={handleExportPDF}
                          className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200 transition"
                        >
                          Export PDF 📄
                        </button>
                        <button
                          onClick={handleTriggerMatching}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition shadow-lg shadow-blue-500/20 flex items-center gap-1.5"
                        >
                          <span>⚡</span>
                          <span>Run Biometric Scan</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs leading-relaxed text-slate-300">
                      <div className="space-y-2.5 bg-white/[0.02] p-4 rounded-xl border border-white/5">
                        <h4 className="font-bold text-blue-400 text-xs uppercase tracking-wider mb-2 border-b border-white/10 pb-1.5">
                          1. Citizen Forensics Dossier
                        </h4>
                        <div><strong className="text-slate-400">CNIC Number:</strong> <span className="font-mono text-white ml-1">{selectedCase.person?.cnic || "Unregistered"}</span></div>
                        <div><strong className="text-slate-400">Age Range:</strong> <span className="text-white ml-1">{selectedCase.person?.age_min} - {selectedCase.person?.age_max} yrs ({selectedCase.person?.gender})</span></div>
                        <div><strong className="text-slate-400">Physical Characteristics:</strong> <span className="text-slate-200 ml-1">{selectedCase.person?.physical_description || "N/A"}</span></div>
                        <div><strong className="text-slate-400">Distinguishing Scars/Marks:</strong> <span className="text-slate-200 ml-1">{selectedCase.person?.distinguishing_marks || "None logged"}</span></div>
                      </div>

                      <div className="space-y-2.5 bg-white/[0.02] p-4 rounded-xl border border-white/5">
                        <h4 className="font-bold text-blue-400 text-xs uppercase tracking-wider mb-2 border-b border-white/10 pb-1.5">
                          2. Jurisdiction &amp; Last Known Telemetry
                        </h4>
                        <div><strong className="text-slate-400">Target Province/City:</strong> <span className="text-white ml-1">{selectedCase.last_seen_city}</span></div>
                        <div><strong className="text-slate-400">Specific Area Last Seen:</strong> <span className="text-white ml-1">{selectedCase.last_seen_location}</span></div>
                        <div><strong className="text-slate-400">Verified Informant Phone:</strong> <span className="font-mono text-emerald-400 ml-1">{selectedCase.person?.cnic ? "+92 300-8472910" : "Secured DB Record"}</span></div>
                      </div>
                    </div>
                  </div>

                  {/* FIR Linkage Form */}
                  <div className="glass-card p-8 border-white/10 bg-slate-950/60 shadow-xl">
                    <h3 className="text-base font-bold text-slate-100 mb-6 border-b border-white/10 pb-3 flex items-center gap-2">
                      <span>✍️ Link Police Station FIR &amp; Update Log</span>
                    </h3>

                    <form onSubmit={handleSubmit(handleUpdateRecord)} className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="form-label" htmlFor="le-fir-input">Official FIR Registration #</label>
                          <input
                            id="le-fir-input"
                            placeholder="e.g. FIR-2026/04/LHR"
                            className="form-input text-xs font-mono font-bold"
                            {...register("fir_number")}
                          />
                        </div>
                        <div>
                          <label className="form-label" htmlFor="le-ps-input">Police Station Name</label>
                          <input
                            id="le-ps-input"
                            placeholder="e.g. Gulberg PS, Lahore"
                            className="form-input text-xs font-semibold"
                            {...register("police_station")}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="form-label" htmlFor="le-status-select">Official Case Status</label>
                          <select id="le-status-select" className="form-select text-xs font-bold w-full" {...register("status")}>
                            <option value="MISSING">Missing</option>
                            <option value="IN_PROCESS">In Process</option>
                            <option value="UNDER_INVESTIGATION">Under Investigation</option>
                            <option value="MATCHED">Matched (Reunification Pending)</option>
                            <option value="RESOLVED">Resolved (Case Closed)</option>
                            <option value="CLOSED">Closed (Unresolved)</option>
                          </select>
                        </div>
                        <div>
                          <label className="form-label" htmlFor="le-notes-input">Forensics Investigation Notes</label>
                          <textarea
                            id="le-notes-input"
                            placeholder="Justify status transition, attach officer notes..."
                            className="form-input text-xs min-h-[50px]"
                            {...register("notes")}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-4 border-t border-white/10">
                        <button
                          type="submit"
                          disabled={updating}
                          className="px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/25 transition"
                        >
                          {updating ? "Committing records..." : "Save Investigation Logs ✓"}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Folder-Specific Matches */}
                  <div className="space-y-4 pt-2">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-bold text-slate-300">🤖 Folder Biometric Comparisons</h3>
                      <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 font-bold px-2.5 py-0.5 rounded-full border border-blue-500/20">
                        {matchResults.length} matches
                      </span>
                    </div>

                    {isLoadingMatches ? (
                      <div className="text-center py-8 text-slate-500 text-xs">Querying biometric database...</div>
                    ) : matchResults.length === 0 ? (
                      <div className="glass-card p-10 text-center text-slate-500 text-xs">
                        No specific biometric comparisons logged for this folder. Switch to the Centralized Match Queue tab to review all pending national candidates.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {matchResults.map((m: MatchResult) => (
                          <MatchCard
                            key={m.id}
                            match={m}
                            onConfirm={handleConfirmMatch}
                            onReject={handleRejectMatch}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              ) : (
                <div className="glass-card p-20 text-center text-slate-500 font-medium text-sm border-blue-500/20">
                  📂 Select an investigation folder from the left directory to inspect CNIC dossiers, link FIR files, or run AI Face recognition checks.
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </PortalLayout>
  );
}
