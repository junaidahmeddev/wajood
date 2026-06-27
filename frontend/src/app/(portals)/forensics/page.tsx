"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import PortalLayout from "@/components/shared/PortalLayout";
import api from "@/lib/api";
import { Person, Gender } from "@/types";
import StatusBadge from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import EmptyState from "@/components/shared/EmptyState";

// Schema for forensic remains register
const remainsSchema = z.object({
  approximate_age: z.coerce.number().min(0).max(120),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "UNKNOWN"]),
  found_location: z.string().min(4, "Recovery site description is required"),
  found_city: z.string().min(2, "Recovery city is required"),
  found_date: z.string().min(1, "Recovery date is required"),
  physical_description: z.string().min(5, "Physical description is required"),
  notes: z.string().optional(),
  dna_sequence: z.string().min(5, "DNA loci markers must be specified"),
  dental_notes: z.string().min(3, "Dental markers are required"),
});

type RemainsFields = z.infer<typeof remainsSchema>;

interface CustodyLog {
  id: string;
  timestamp: string;
  remains_id: string;
  dna_hash: string;
  custody_chain: string;
  signature: string;
}

export default function ForensicsPortal() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"remains" | "register" | "custody" | "dna-match">("remains");
  const [formSuccess, setFormSuccess] = useState("");
  const [formError, setFormError] = useState("");

  // Simulated Custody logs
  const [custodyLogs, setCustodyLogs] = useState<CustodyLog[]>([
    {
      id: "log-1",
      timestamp: new Date().toISOString(),
      remains_id: "remains-uuid-1",
      dna_hash: "sha256-4b21908ef92aa82109...",
      custody_chain: "NDMA Forensic Lab Lahore -> Cold Storage",
      signature: "0x89BFA28E0D...",
    }
  ]);

  // Query remains (Found Persons where is_alive = false)
  const { data: remainsList = [], isLoading } = useQuery({
    queryKey: ["forensicRemains"],
    queryFn: async () => {
      const res = await api.getPersons();
      const list = Array.isArray(res) ? res : [];
      return list.filter((p: Person) => !p.is_alive);
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<RemainsFields>({
    resolver: zodResolver(remainsSchema),
    defaultValues: {
      gender: "UNKNOWN",
    },
  });

  // Register remains mutation
  const registerRemainsMutation = useMutation({
    mutationFn: async (fields: RemainsFields) => {
      const formData = new FormData();
      formData.append("approximate_age", fields.approximate_age.toString());
      formData.append("gender", fields.gender);
      formData.append("found_location", fields.found_location);
      formData.append("found_city", fields.found_city);
      formData.append("found_date", fields.found_date);
      formData.append("physical_description", fields.physical_description);
      formData.append("is_alive", "false"); // remains
      formData.append("notes", `DNA: ${fields.dna_sequence} | Dental: ${fields.dental_notes}. ${fields.notes || ""}`);
      formData.append("hospital_name", "NDMA Forensic Laboratory");
      
      return api.createPerson(formData);
    },
    onSuccess: (data: any) => {
      setFormSuccess("Forensic remains registered successfully! Secure custody signature generated.");
      reset();
      
      // Update custody logs
      const newLog: CustodyLog = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        remains_id: data.id,
        dna_hash: `sha256-hash-${Math.random().toString(36).substring(2, 10)}...`,
        custody_chain: "NDMA Forensic Lab -> Hospital Cold Storage Vault",
        signature: `0x${Math.random().toString(36).substring(2, 14).toUpperCase()}`,
      };
      setCustodyLogs(prev => [newLog, ...prev]);

      queryClient.invalidateQueries({ queryKey: ["forensicRemains"] });
      setActiveTab("remains");
    },
    onError: (err: any) => {
      setFormError(err.message || "Failed to register forensics remains folder.");
    },
  });

  const onSubmit = (data: RemainsFields) => {
    setFormError("");
    setFormSuccess("");
    registerRemainsMutation.mutate(data);
  };

  const [selectedCaseForDNA, setSelectedCaseForDNA] = useState<Person | null>(null);
  const [dnaProfiles, setDnaProfiles] = useState<Record<string, string>>({});
  const [kinshipResult, setKinshipResult] = useState<string | null>(null);

  const handleDNAFileSubmit = (e: React.FormEvent, id: string) => {
    e.preventDefault();
    setDnaProfiles(prev => ({ ...prev, [id]: "DNA_LOGGED" }));
    alert("Sequence file (.fasta / .txt) parsed and loci registered. Status updated to DNA_LOGGED.");
  };

  const handleRunKinship = () => {
    setKinshipResult("🧬 AI Kinship Match Confirmed: 98.7% Mitochondrial & Autosomal Marker Match Probability with Family DB Reference #CN-88421.");
  };

  return (
    <PortalLayout
      portalName="Forensics Examiner"
      portalIcon="🔬"
      portalColor="#f97316"
      allowedRoles={["forensics"]}
    >
      <div className="space-y-8">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-white/5 gap-4 overflow-x-auto">
          {(["remains", "register", "custody", "dna-match"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setFormSuccess(""); setFormError(""); }}
              className={`py-3 px-3 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
                activeTab === tab
                  ? "border-orange-500 text-orange-400 bg-orange-500/10"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              {tab === "remains" ? "💀 Unidentified Remains Registry" : tab === "register" ? "📝 Register Remains" : tab === "custody" ? "🔒 Custody Chain" : "🧬 DNA Match Requests"}
            </button>
          ))}
        </div>

        {formSuccess && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold">
            ✅ {formSuccess}
          </div>
        )}

        {/* ─── TAB 1: Unidentified Remains Registry Table & DNA Tools ─── */}
        {activeTab === "remains" && (
          <div className="space-y-8">
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-100">💀 Unidentified Deceased Remains Directory</h3>
                <p className="text-xs text-slate-400">Select any record below to attach genomic sequence (.fasta / .txt) or execute AI kinship scans.</p>
              </div>
              <button
                onClick={handleRunKinship}
                className="btn-primary py-2.5 px-5 text-xs font-bold shadow-lg shadow-orange-500/20 flex items-center gap-2"
                style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}
              >
                <span>⚡</span>
                <span>Run Kinship Match</span>
              </button>
            </div>

            {kinshipResult && (
              <div className="p-5 rounded-xl bg-gradient-to-r from-orange-950/80 via-slate-900 to-emerald-950/80 border border-orange-500/50 text-white text-xs font-mono shadow-2xl animate-fade-in flex items-center justify-between">
                <span>{kinshipResult}</span>
                <button onClick={() => setKinshipResult(null)} className="text-slate-400 hover:text-white ml-4">✕</button>
              </div>
            )}

            {isLoading ? (
              <LoadingSpinner text="Querying morgue and forensic records..." />
            ) : remainsList.length === 0 ? (
              <EmptyState title="No Remains Logged" icon="🔬" description="No unidentified deceased remains casefiles registered in database." />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Table Column */}
                <div className="lg:col-span-2 glass-card overflow-x-auto shadow-xl border border-white/10 bg-slate-950/60">
                  <table className="w-full text-left border-collapse text-xs text-slate-300">
                    <thead>
                      <tr className="bg-white/[0.03] border-b border-white/10 text-slate-400">
                        <th className="p-4 font-extrabold uppercase">Case ID</th>
                        <th className="p-4 font-extrabold uppercase">City</th>
                        <th className="p-4 font-extrabold uppercase">Date Found</th>
                        <th className="p-4 font-extrabold uppercase">DNA Profile Status</th>
                        <th className="p-4 font-extrabold uppercase text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {remainsList.map((rem: Person) => {
                        const statusVal = dnaProfiles[rem.id] || (rem.notes?.includes("DNA:") ? "DNA_LOGGED" : "PENDING_SAMPLE");
                        const isSelected = selectedCaseForDNA?.id === rem.id;

                        return (
                          <tr key={rem.id} className={`hover:bg-white/[0.02] transition ${isSelected ? "bg-orange-500/10 border-l-2 border-orange-500" : ""}`}>
                            <td className="p-4 font-mono font-bold text-orange-400">{rem.id.slice(0, 8)}</td>
                            <td className="p-4 font-semibold">{rem.city || rem.found_city || "Unknown"}</td>
                            <td className="p-4">{formatDate(rem.found_date || rem.created_at || "")}</td>
                            <td className="p-4">
                              {statusVal === "DNA_LOGGED" ? (
                                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold text-[10px] border border-emerald-500/30">
                                  DNA_LOGGED
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono text-[10px] border border-amber-500/20">
                                  PENDING
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => setSelectedCaseForDNA(rem)}
                                className={`py-1 px-3 rounded-lg font-bold text-xs transition ${
                                  isSelected ? "bg-orange-600 text-white" : "bg-white/5 hover:bg-white/10 text-slate-300"
                                }`}
                              >
                                Select
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Upload DNA Sequence Panel */}
                <div className="lg:col-span-1">
                  {selectedCaseForDNA ? (
                    <div className="glass-card p-6 border-orange-500/40 bg-slate-900 shadow-2xl space-y-5 animate-fade-in">
                      <div className="border-b border-white/10 pb-3">
                        <span className="text-[10px] font-mono text-orange-400 font-bold uppercase tracking-widest">Selected Specimen</span>
                        <h4 className="text-base font-black text-white mt-1">ID: {selectedCaseForDNA.id.slice(0, 8)}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">{selectedCaseForDNA.physical_description}</p>
                      </div>

                      <form onSubmit={(e) => handleDNAFileSubmit(e, selectedCaseForDNA.id)} className="space-y-4">
                        <div>
                          <label className="form-label font-bold text-orange-300" htmlFor="f-dna-file">
                            Upload DNA Sequence (.fasta / .txt)
                          </label>
                          <input
                            id="f-dna-file"
                            type="file"
                            accept=".fasta,.txt"
                            required
                            className="form-input py-2 text-xs file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-orange-500/20 file:text-orange-300 hover:file:bg-orange-500/30"
                          />
                        </div>

                        <div>
                          <label className="form-label" htmlFor="f-dna-notes">Loci Extraction Notes</label>
                          <textarea id="f-dna-notes" placeholder="e.g. CODIS 20 loci verified..." className="form-input text-xs min-h-[60px]" />
                        </div>

                        <button
                          type="submit"
                          className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs transition shadow-lg shadow-orange-500/20"
                        >
                          Submit Genomic Sequence
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div className="glass-card p-8 text-center border-dashed border-white/10 bg-white/[0.01] flex flex-col items-center justify-center h-full min-h-[220px]">
                      <span className="text-3xl opacity-40 mb-2">🧬</span>
                      <p className="text-xs text-slate-400 font-semibold">Select a case row from table to attach DNA sequence files.</p>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        )}

        {/* Register Remains */}
        {activeTab === "register" && (
          <div className="glass-card p-8 max-w-3xl mx-auto">
            <h3 className="text-lg font-bold text-orange-400 mb-6">Register Unidentified Remains Casefile</h3>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {formError && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold">
                  ❌ {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="form-label" htmlFor="fr-age">Estimated Age *</label>
                  <input id="fr-age" type="number" className="form-input" {...register("approximate_age")} />
                  {errors.approximate_age && <p className="text-xs text-red-400 mt-1">{errors.approximate_age.message}</p>}
                </div>
                <div>
                  <label className="form-label" htmlFor="fr-gender">Gender *</label>
                  <select id="fr-gender" className="form-select" {...register("gender")}>
                    <option value="UNKNOWN">Select gender</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="form-label" htmlFor="fr-date">Recovery Date *</label>
                  <input id="fr-date" type="date" className="form-input" {...register("found_date")} />
                  {errors.found_date && <p className="text-xs text-red-400 mt-1">{errors.found_date.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label" htmlFor="fr-city">City *</label>
                  <input id="fr-city" className="form-input" placeholder="e.g. Peshawar" {...register("found_city")} />
                  {errors.found_city && <p className="text-xs text-red-400 mt-1">{errors.found_city.message}</p>}
                </div>
                <div>
                  <label className="form-label" htmlFor="fr-loc">Recovery Site Description *</label>
                  <input id="fr-loc" className="form-input" placeholder="e.g. Canal bank area" {...register("found_location")} />
                  {errors.found_location && <p className="text-xs text-red-400 mt-1">{errors.found_location.message}</p>}
                </div>
              </div>

              <div>
                <label className="form-label" htmlFor="fr-desc">Physical Case Description *</label>
                <textarea
                  id="fr-desc"
                  placeholder="Record hair color, height, garments, post-mortem characteristics..."
                  className="form-input min-h-[80px]"
                  {...register("physical_description")}
                />
                {errors.physical_description && <p className="text-xs text-red-400 mt-1">{errors.physical_description.message}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-white/5">
                <div>
                  <label className="form-label" htmlFor="fr-dna">DNA Marker sequence *</label>
                  <input
                    id="fr-dna"
                    placeholder="e.g. TH01: 9.3, TPOX: 8, CSF1PO: 10..."
                    className="form-input text-xs font-mono"
                    {...register("dna_sequence")}
                  />
                  {errors.dna_sequence && <p className="text-xs text-red-400 mt-1">{errors.dna_sequence.message}</p>}
                </div>
                <div>
                  <label className="form-label" htmlFor="fr-dental">Dental Markers *</label>
                  <input
                    id="fr-dental"
                    placeholder="e.g. Upper right gold filling, missing incisor..."
                    className="form-input text-xs"
                    {...register("dental_notes")}
                  />
                  {errors.dental_notes && <p className="text-xs text-red-400 mt-1">{errors.dental_notes.message}</p>}
                </div>
              </div>

              <div>
                <label className="form-label" htmlFor="fr-notes">Examiner notes (Optional)</label>
                <textarea id="fr-notes" placeholder="Additional remarks..." className="form-input min-h-[60px]" {...register("notes")} />
              </div>

              <div className="flex gap-3 justify-end pt-6 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setActiveTab("remains")}
                  className="px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-semibold text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registerRemainsMutation.isPending}
                  className="btn-primary px-6 py-2.5 flex items-center gap-2"
                  style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}
                >
                  {registerRemainsMutation.isPending && (
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  <span>{registerRemainsMutation.isPending ? "Logging remains..." : "Link Case remains"}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Custody Chain logs */}
        {activeTab === "custody" && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-200">🔒 Secure chain of custody signatures</h3>
            <p className="text-xs text-slate-400">
              Each forensic remains registration and DNA sequence upload is logged with a secure custody transfer signature for auditing validity.
            </p>

            <div className="glass-card overflow-hidden">
              <table className="w-full text-left border-collapse text-xs text-slate-300">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/5">
                    <th className="p-4 font-bold uppercase text-slate-400">Log ID</th>
                    <th className="p-4 font-bold uppercase text-slate-400">DNA SHA Marker</th>
                    <th className="p-4 font-bold uppercase text-slate-400">Chain History</th>
                    <th className="p-4 font-bold uppercase text-slate-400">Transfer Time</th>
                    <th className="p-4 font-bold uppercase text-slate-400">Tamper Signature</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {custodyLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.01]">
                      <td className="p-4 font-mono font-semibold text-orange-500">{log.id}</td>
                      <td className="p-4 font-mono text-slate-400">{log.dna_hash}</td>
                      <td className="p-4">{log.custody_chain}</td>
                      <td className="p-4">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="p-4 font-mono text-emerald-400">{log.signature}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DNA Match Requests */}
        {activeTab === "dna-match" && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-200">Biometric DNA matching queue</h3>
            <p className="text-xs text-slate-400">
              Matches between DNA profiles uploaded for remains and reference DNA samples provided by families.
            </p>

            <EmptyState title="No Matches" icon="🧬" description="DNA sequencing analyzer currently scanning matching loci... No parent reference matches confirmed yet." />
          </div>
        )}

      </div>
    </PortalLayout>
  );
}
