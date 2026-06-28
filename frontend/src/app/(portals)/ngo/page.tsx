"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import PortalLayout from "@/components/shared/PortalLayout";
import api from "@/lib/api";
import { Case, Person, Organization } from "@/types";
import { useAuthStore } from "@/store";
import StatusBadge from "@/components/shared/StatusBadge";
import PhotoUpload from "@/components/shared/PhotoUpload";
import MatchCard from "@/components/shared/MatchCard";
import { formatDate, ALL_CITIES } from "@/lib/utils";
import { useToast } from "@/components/shared/Toast";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import EmptyState from "@/components/shared/EmptyState";

// Schema for found person registration
const foundPersonSchema = z.object({
  approximate_age: z.coerce.number().min(0).max(120),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "UNKNOWN"]),
  found_location: z.string().min(4, "Found location is required"),
  found_city: z.string().min(2, "Found city is required"),
  found_date: z.string().min(1, "Found date is required"),
  physical_description: z.string().min(5, "Physical description is required"),
  is_alive: z.boolean().default(true),
  notes: z.string().optional(),
  hospital_name: z.string().optional(),
  morgue_id: z.string().optional(),
});

type FoundPersonFields = z.infer<typeof foundPersonSchema>;

// Sub-component to load matches for a specific found person
function FoundPersonMatchSection({ person }: { person: Person }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: matches = [], isLoading } = useQuery({
    queryKey: ["matches", person.id],
    queryFn: async () => {
      const res = await api.getMatchResults(person.id);
      return Array.isArray(res) ? res : [];
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (matchId: string) => api.confirmMatch(matchId),
    onSuccess: () => {
      toast.success("Match CONFIRMED! Law enforcement and family notification dispatched.");
      queryClient.invalidateQueries({ queryKey: ["matches", person.id] });
      queryClient.invalidateQueries({ queryKey: ["ngoActiveCases"] });
    },
    onError: (err: any) => toast.error("Failed to confirm match: " + err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: (matchId: string) => api.rejectMatch(matchId),
    onSuccess: () => {
      toast.info("Match rejected.");
      queryClient.invalidateQueries({ queryKey: ["matches", person.id] });
    },
  });

  if (matches.length === 0 && !isLoading) return null;

  return (
    <div className="glass-card p-6 border-emerald-500/20 bg-slate-950/60 space-y-4 shadow-xl">
      <div className="flex justify-between items-center border-b border-white/10 pb-3">
        <div>
          <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest font-bold">Registered Remains / Subject</span>
          <h4 className="font-bold text-slate-100 text-base">{person.physical_description}</h4>
          <p className="text-xs text-slate-400 mt-0.5">Found at: {person.found_location}, {person.found_city}</p>
        </div>
        <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-bold">
          {matches.length} AI Candidates
        </span>
      </div>

      {isLoading ? (
        <LoadingSpinner text="Running biometric comparisons..." />
      ) : matches.length === 0 ? (
        <EmptyState title="No Candidates" icon="🤖" description="No AI matches logged for this subject." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {matches.map((m: any) => (
            <MatchCard
              key={m.id}
              match={m}
              onConfirm={(mid) => confirmMutation.mutate(mid)}
              onReject={(mid) => rejectMutation.mutate(mid)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function NgoPortal() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"dashboard" | "register" | "found-list" | "matches" | "handover">("dashboard");
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  
  const [shelterCapacity, setShelterCapacity] = useState({ filled: 32, total: 50 });
  const [org, setOrg] = useState<Organization | null>(null);
  const [formSuccess, setFormSuccess] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (user?.organization_id) {
      api.getOrganizations().then((res) => {
        const list = Array.isArray(res) ? res : [];
        const matchingOrg = list.find((o) => o.id === user.organization_id);
        if (matchingOrg) setOrg(matchingOrg);
      }).catch(console.error);
    }
  }, [user]);

  // Fetch active missing persons for comparison count
  const { data: cases = [], isLoading: isLoadingCases } = useQuery({
    queryKey: ["ngoActiveCases"],
    queryFn: async () => {
      const res = await api.getCases();
      return Array.isArray(res) ? res : [];
    },
  });

  // Fetch registered found persons by this organization
  const { data: foundPersons = [], isLoading: isLoadingFound } = useQuery({
    queryKey: ["ngoFoundPersons", user?.organization_id],
    queryFn: async () => {
      const res = await api.getPersons();
      return Array.isArray(res) ? res : [];
    },
  });

  const handoverCases = cases.filter((c: Case) => c.status.toLowerCase() === "matched");

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FoundPersonFields>({
    resolver: zodResolver(foundPersonSchema),
    defaultValues: { gender: "UNKNOWN", is_alive: true },
  });

  // Trigger manual AI match across all records
  const triggerAllMutation = useMutation({
    mutationFn: async () => {
      const missingList: any = await api.getCases();
      const mList = Array.isArray(missingList) ? missingList : [];
      await Promise.all(mList.map((c: any) => api.runMatching(c.id).catch(() => {})));
      await Promise.all(foundPersons.map((fp: any) => api.runMatching(fp.id).catch(() => {})));
    },
    onSuccess: () => {
      toast.success("⚡ AI Biometric Matching Engine executed across all missing and found registries!");
      queryClient.invalidateQueries({ queryKey: ["matches"] });
    },
  });

  const registerFoundMutation = useMutation({
    mutationFn: async (fields: FoundPersonFields) => {
      const formData = new FormData();
      formData.append("approximate_age", fields.approximate_age.toString());
      formData.append("gender", fields.gender);
      formData.append("found_location", fields.found_location);
      formData.append("found_city", fields.found_city);
      formData.append("found_date", fields.found_date);
      formData.append("physical_description", fields.physical_description);
      formData.append("is_alive", fields.is_alive.toString());
      if (fields.notes) formData.append("notes", fields.notes);
      if (fields.hospital_name) formData.append("hospital_name", fields.hospital_name);
      if (fields.morgue_id) formData.append("morgue_id", fields.morgue_id);
      if (user?.organization_id) formData.append("organization_id", user.organization_id);
      if (selectedPhoto) formData.append("photo", selectedPhoto);
      
      return api.createPerson(formData);
    },
    onSuccess: async (createdRes: any) => {
      const msg = "Found person registered successfully! AI Biometric indexing & comparison queued.";
      setFormSuccess(msg);
      toast.success(msg);
      reset();
      setSelectedPhoto(null);
      queryClient.invalidateQueries({ queryKey: ["ngoFoundPersons"] });
      
      // Automatically trigger matching for all MISSING cases
      api.getCases().then((list: any) => {
        if (Array.isArray(list)) {
          list.forEach((c: any) => api.runMatching(c.id).catch(() => {}));
        }
      });
      if (createdRes?.id) {
        api.runMatching(createdRes.id).catch(() => {});
      }
      setActiveTab("matches");
    },
    onError: (err: any) => {
      const errMsg = err.message || "Failed to register found person.";
      setFormError(errMsg);
      toast.error(errMsg);
    },
  });

  const onSubmit = (data: FoundPersonFields) => {
    setFormError("");
    setFormSuccess("");
    registerFoundMutation.mutate(data);
  };

  const handleResolveCase = async (caseId: string) => {
    try {
      await api.updateCaseStatus(caseId, "RESOLVED", "Reunification completed via NGO family handover.");
      alert("Case marked as RESOLVED! Notification dispatched.");
      queryClient.invalidateQueries({ queryKey: ["ngoActiveCases"] });
    } catch (err: any) {
      alert("Failed to update status: " + err.message);
    }
  };

  return (
    <PortalLayout
      portalName="NGO Caseworker Panel"
      portalIcon="🏛️"
      portalColor="#10b981"
      allowedRoles={["ngo"]}
    >
      <div className="space-y-8">
        {/* Partner Info & Shelter Panel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 glass-card p-6 border-l-4 border-emerald-500 bg-emerald-950/10 shadow-lg">
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
              Verified Partner Shelter
            </span>
            <h2 className="text-2xl font-black mt-1 text-white">{org?.name || "Edhi Foundation Shelter"}</h2>
            <p className="text-xs text-slate-400 mt-2">
              📍 {org?.address || "Mina Road, Karachi"} | District: {org?.district || "Karachi"}
            </p>
          </div>

          <div className="glass-card p-6 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Shelter Occupancy</h4>
              <div className="text-2xl font-black text-slate-100 font-mono">
                {shelterCapacity.filled} / {shelterCapacity.total} beds filled
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShelterCapacity(prev => ({ ...prev, filled: Math.max(0, prev.filled - 1) }))}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 flex-1 transition"
              >
                - Discharge
              </button>
              <button
                onClick={() => setShelterCapacity(prev => ({ ...prev, filled: Math.min(prev.total, prev.filled + 1) }))}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex-1 transition"
              >
                + Admit
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/10 gap-2 overflow-x-auto pb-1">
          {(["dashboard", "register", "found-list", "matches", "handover"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setFormSuccess(""); setFormError(""); }}
              className={`py-3 px-5 rounded-t-xl text-xs font-bold transition whitespace-nowrap ${
                activeTab === tab
                  ? "bg-emerald-500/10 border-b-2 border-emerald-500 text-emerald-400 shadow-lg"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              {tab === "matches" ? "⚡ AI Biometric Matches" : tab.replace("-", " ")}
            </button>
          ))}
        </div>

        {formSuccess && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm font-bold shadow-lg">
            ✅ {formSuccess}
          </div>
        )}

        {/* ─── Tab Contents ─── */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="glass-card p-6 text-center space-y-2 border-emerald-500/20">
                <span className="text-4xl">🤝</span>
                <div className="text-4xl font-black text-white font-mono">{foundPersons.length}</div>
                <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">Found Registered</div>
              </div>
              <div className="glass-card p-6 text-center space-y-2 border-amber-500/20">
                <span className="text-4xl">🔔</span>
                <div className="text-4xl font-black text-amber-400 font-mono">{handoverCases.length}</div>
                <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">Pending Family Handover</div>
              </div>
              <div className="glass-card p-6 text-center space-y-2 border-indigo-500/20">
                <span className="text-4xl">⏳</span>
                <div className="text-4xl font-black text-indigo-400 font-mono">
                  {foundPersons.filter((p: any) => p.status === "UNIDENTIFIED").length}
                </div>
                <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">Unidentified Patients</div>
              </div>
            </div>

            <div className="glass-card p-6">
              <h3 className="text-md font-bold text-slate-200 mb-4">Recent Found Intake Records</h3>
              {isLoadingFound ? (
                <LoadingSpinner size="sm" text="Synchronizing shelter records..." />
              ) : foundPersons.length === 0 ? (
                <EmptyState title="No Records" icon="🏡" description="No found persons registered yet." />
              ) : (
                <div className="divide-y divide-white/5">
                  {foundPersons.slice(0, 5).map((p: Person) => (
                    <div key={p.id} className="py-4 flex justify-between items-center flex-wrap gap-4">
                      <div>
                        <h4 className="text-sm font-bold text-slate-200">{p.physical_description}</h4>
                        <p className="text-xs text-slate-400 mt-1">
                          Location: {p.found_location}, {p.city} | Found: {formatDate(p.found_date || "")}
                        </p>
                      </div>
                      <StatusBadge status="UNIDENTIFIED" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "register" && (
          <div className="glass-card p-8 sm:p-10 max-w-3xl mx-auto border-emerald-500/30 shadow-2xl bg-slate-950/90">
            <h3 className="text-xl font-black text-white mb-6 flex items-center gap-2">
              <span>📝 Intake Found / Unidentified Citizen</span>
            </h3>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {formError && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold">
                  ❌ {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="form-label" htmlFor="found-age">Approximate Age *</label>
                  <input id="found-age" type="number" className="form-input font-semibold" placeholder="Years" {...register("approximate_age")} />
                  {errors.approximate_age && <p className="text-xs text-red-400 mt-1">{errors.approximate_age.message}</p>}
                </div>
                <div>
                  <label className="form-label" htmlFor="found-gender">Gender *</label>
                  <select id="found-gender" className="form-select font-semibold" {...register("gender")}>
                    <option value="UNKNOWN">Select gender</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="form-label" htmlFor="found-date">Date Found *</label>
                  <input id="found-date" type="date" className="form-input font-mono text-xs" {...register("found_date")} />
                  {errors.found_date && <p className="text-xs text-red-400 mt-1">{errors.found_date.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label" htmlFor="found-city">City Found *</label>
                  <select id="found-city" className="form-select font-semibold" {...register("found_city")}>
                    <option value="">Select City</option>
                    {ALL_CITIES.map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                  {errors.found_city && <p className="text-xs text-red-400 mt-1">{errors.found_city.message}</p>}
                </div>
                <div>
                  <label className="form-label" htmlFor="found-loc">Specific Location Found *</label>
                  <input id="found-loc" className="form-input font-semibold" placeholder="Market, shrine, hospital..." {...register("found_location")} />
                  {errors.found_location && <p className="text-xs text-red-400 mt-1">{errors.found_location.message}</p>}
                </div>
              </div>

              <div>
                <label className="form-label" htmlFor="found-desc">Physical Characteristics &amp; Attire *</label>
                <textarea
                  id="found-desc"
                  className="form-input min-h-[80px]"
                  placeholder="Describe clothes, scars, tattoos, height, facial features..."
                  {...register("physical_description")}
                />
                {errors.physical_description && <p className="text-xs text-red-400 mt-1">{errors.physical_description.message}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center pt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="found-alive"
                    {...register("is_alive")}
                    className="w-4 h-4 text-emerald-600 bg-slate-900 border-white/10 rounded"
                  />
                  <label htmlFor="found-alive" className="text-xs text-slate-200 font-bold cursor-pointer">
                    Is person alive?
                  </label>
                </div>
                {watch("is_alive") ? (
                  <div>
                    <label className="form-label" htmlFor="found-hosp">Hospital Name</label>
                    <input id="found-hosp" className="form-input" placeholder="e.g. Jinnah Hospital" {...register("hospital_name")} />
                  </div>
                ) : (
                  <div>
                    <label className="form-label" htmlFor="found-morgue">Morgue ID</label>
                    <input id="found-morgue" className="form-input font-mono" placeholder="Tag #A-14" {...register("morgue_id")} />
                  </div>
                )}
              </div>

              <div>
                <label className="form-label" htmlFor="found-notes">Additional Notes</label>
                <textarea id="found-notes" className="form-input min-h-[80px]" placeholder="Any behavioral or recovery context..." {...register("notes")} />
              </div>

              <div className="pt-2">
                <PhotoUpload onFileChange={(file) => setSelectedPhoto(file)} label="Capture Found Person Photo (Required for AI Biometric Indexing)" />
              </div>

              <div className="flex gap-4 justify-end pt-6 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setActiveTab("dashboard")}
                  className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registerFoundMutation.isPending}
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2"
                >
                  {registerFoundMutation.isPending && (
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {registerFoundMutation.isPending ? "Indexing Biometrics..." : "Register & Queue AI Match ⚡"}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === "found-list" && (
          <div className="space-y-6">
            <h3 className="text-xl font-black text-white">Registered Found Citizens</h3>
            {isLoadingFound ? (
              <LoadingSpinner text="Querying shelter registries..." />
            ) : foundPersons.length === 0 ? (
              <EmptyState title="No Citizens Found" icon="🏡" description="No found citizens logged by shelter." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {foundPersons.map((p: Person) => (
                  <div key={p.id} className="glass-card overflow-hidden flex flex-col h-full bg-white/[0.01] border-white/10 shadow-lg">
                    <div className="h-48 bg-slate-950 flex items-center justify-center border-b border-white/10 overflow-hidden relative">
                      {p.photo_url ? (
                        <img
                          src={p.photo_url.startsWith("http") ? p.photo_url : `http://localhost:8000${p.photo_url}`}
                          alt="Found"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-5xl opacity-20">👤</span>
                      )}
                      <div className="absolute top-3 right-3">
                        <StatusBadge status={p.is_alive ? "UNIDENTIFIED" : "DECEASED"} />
                      </div>
                    </div>
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="font-bold text-slate-100 text-sm line-clamp-2">
                          {p.physical_description}
                        </h4>
                        <div className="text-xs text-slate-400 mt-3 space-y-1.5 border-t border-white/5 pt-3">
                          <div><strong className="text-slate-300">Location:</strong> {p.found_location}, {p.city}</div>
                          <div><strong className="text-slate-300">Intake Date:</strong> {formatDate(p.found_date || "")}</div>
                          {p.hospital_name && <div><strong className="text-slate-300">Hospital:</strong> {p.hospital_name}</div>}
                          {p.morgue_id && <div><strong className="text-slate-300">Morgue ID:</strong> {p.morgue_id}</div>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── NEW: AI Biometric Matches Tab ─── */}
        {activeTab === "matches" && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-black p-6 rounded-2xl border border-emerald-500/30 shadow-xl">
              <div>
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <span>⚡ AI Biometric Matching Telemetry</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">Cross-referencing registered found persons against Pakistan&apos;s National Missing Citizen Registry.</p>
              </div>

              <button
                onClick={() => triggerAllMutation.mutate()}
                disabled={triggerAllMutation.isPending}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition shrink-0 flex items-center gap-2"
              >
                {triggerAllMutation.isPending ? (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <span>🔄</span>
                )}
                <span>{triggerAllMutation.isPending ? "Executing National Scan..." : "Trigger AI Match for All Records"}</span>
              </button>
            </div>

            {foundPersons.length === 0 ? (
              <div className="glass-card p-12 text-center text-slate-500 text-sm">
                📂 No found persons registered yet. Register an intake subject in the Register tab to queue biometric comparison.
              </div>
            ) : (
              <div className="space-y-6">
                {foundPersons.map((fp: any) => (
                  <FoundPersonMatchSection key={fp.id} person={fp} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "handover" && (
          <div className="space-y-6">
            <h3 className="text-xl font-black text-white">Reunification &amp; Family Handover Queue</h3>
            <p className="text-xs text-slate-400 max-w-3xl">
              The cases below have been confirmed by law enforcement biometric forensics. Caseworkers must verify guardian identity via CNIC prior to final custody release.
            </p>

            {isLoadingCases ? (
              <LoadingSpinner text="Fetching handover queue..." />
            ) : handoverCases.length === 0 ? (
              <EmptyState title="No Handovers" icon="🤝" description="No matched citizens currently awaiting handover verification." />
            ) : (
              <div className="space-y-4">
                {handoverCases.map((c: Case) => (
                  <div key={c.id} className="glass-card p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-emerald-500/20">
                    <div>
                      <span className="text-xs font-mono text-emerald-400 font-bold">{c.case_number}</span>
                      <h4 className="text-base font-bold text-white mt-1">{c.person?.full_name}</h4>
                      <p className="text-xs text-slate-400 mt-1">
                        Informant: {c.person?.cnic ? `CNIC ${c.person.cnic}` : "Unverified"} | Target City: {c.last_seen_city}
                      </p>
                    </div>

                    <button
                      onClick={() => handleResolveCase(c.id)}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white shadow-md transition"
                    >
                      Complete Handover Reunification ✓
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
