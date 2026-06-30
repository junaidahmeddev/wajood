"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import * as XLSX from "xlsx";

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

  const [activeTab, setActiveTab] = useState<"dashboard" | "register" | "found-list" | "matches">("dashboard");
  const [selectedFoundPerson, setSelectedFoundPerson] = useState<Person | null>(null);
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

  const exportToExcel = () => {
    if (!foundPersons || foundPersons.length === 0) return;

    // Build the data array
    const data = foundPersons.map((p: Person) => ({
      "ID": p.id,
      "Approximate Age": p.approximate_age || "-",
      "Gender": p.gender || "-",
      "City": p.found_city || "-",
      "Location": p.found_location || "-",
      "Status": p.is_alive ? "ALIVE" : "DECEASED",
      "Date Found": p.found_date ? formatDate(p.found_date) : "-",
      "Physical Description": p.physical_description || "-",
      "Notes": p.notes || "-"
    }));

    // Create a new workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([]);

    // Add main official header
    XLSX.utils.sheet_add_aoa(ws, [["Wajood — Official Found Citizen Registry"]], { origin: "A1" });
    
    // Add the JSON data starting at row 3 (A3)
    XLSX.utils.sheet_add_json(ws, data, { origin: "A3" });

    // Setting column widths for better formatting
    ws["!cols"] = [
      { wch: 36 }, // ID
      { wch: 15 }, // Age
      { wch: 10 }, // Gender
      { wch: 15 }, // City
      { wch: 25 }, // Location
      { wch: 12 }, // Status
      { wch: 15 }, // Date
      { wch: 40 }, // Description
      { wch: 30 }  // Notes
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Found Citizens");
    const dateStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `Wajood_Registry_${dateStr}.xlsx`);
  };

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

  const { data: overviewStats, isLoading: isLoadingStats, refetch: refetchStats } = useQuery({
    queryKey: ["analyticsOverview"],
    queryFn: async () => {
      try {
        const res: any = await api.getAnalyticsOverview();
        return res;
      } catch (e) {
        return { total_found: 0, matched: 0, unidentified: 0, returned: 0 };
      }
    },
  });

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
      const msg = "✅ Found Person Registered!";
      setFormSuccess(msg);
      toast.success(msg);
      reset();
      setSelectedPhoto(null);
      queryClient.invalidateQueries({ queryKey: ["ngoFoundPersons"] });
      
      if (createdRes?.id) {
        // Run AI matching asynchronously in background for the new record
        api.runMatching(createdRes.id).catch(() => {});
      }
      
      // Auto-switch to Found List tab
      setActiveTab("found-list");
      
      // Force Dashboard Stats to Update
      refetchStats();
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
          {(["dashboard", "register", "found-list", "matches"] as const).map((tab) => (
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
            <div className="flex justify-between items-end">
              <h3 className="text-xl font-bold text-white">Dashboard Overview</h3>
              <button 
                onClick={() => refetchStats()} 
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded flex items-center gap-2 transition"
              >
                <span>🔄</span> Refresh Stats
              </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-card p-6 text-center space-y-2 border-emerald-500/20">
                <span className="text-3xl opacity-80">🤝</span>
                <div className="text-3xl font-black text-white font-mono">{isLoadingStats ? "-" : (overviewStats?.found_persons?.total || 0)}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Total Found</div>
              </div>
              <div className="glass-card p-6 text-center space-y-2 border-teal-500/20">
                <span className="text-3xl opacity-80">⚡</span>
                <div className="text-3xl font-black text-teal-400 font-mono">{isLoadingStats ? "-" : (overviewStats?.found_persons?.matched || 0)}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">AI Matched</div>
              </div>
              <div className="glass-card p-6 text-center space-y-2 border-slate-500/30">
                <span className="text-3xl opacity-80">❓</span>
                <div className="text-3xl font-black text-slate-300 font-mono">{isLoadingStats ? "-" : (overviewStats?.found_persons?.unidentified || 0)}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Unidentified</div>
              </div>
              <div className="glass-card p-6 text-center space-y-2 border-blue-500/20">
                <span className="text-3xl opacity-80">🏡</span>
                <div className="text-3xl font-black text-blue-400 font-mono">{isLoadingStats ? "-" : (overviewStats?.found_persons?.returned || 0)}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Returned Home</div>
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
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider bg-slate-500/20 text-slate-300 border-slate-500/30">
                        {p.status || "UNIDENTIFIED"}
                      </span>
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-xl font-black text-white">Registered Found Citizens</h3>
              <button
                onClick={exportToExcel}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-emerald-500/20 transition flex items-center gap-2"
              >
                <span>📊</span> Export to Excel
              </button>
            </div>
            {isLoadingFound ? (
              <LoadingSpinner text="Querying shelter registries..." />
            ) : foundPersons.length === 0 ? (
              <EmptyState title="No Citizens Found" icon="🏡" description="No found citizens logged by shelter." />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-900/50">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/80 text-slate-400 text-xs uppercase font-bold border-b border-white/10">
                    <tr>
                      <th className="px-4 py-3">Photo</th>
                      <th className="px-4 py-3">ID</th>
                      <th className="px-4 py-3">~Age</th>
                      <th className="px-4 py-3">Gender</th>
                      <th className="px-4 py-3">City</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Alive Status</th>
                      <th className="px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {foundPersons.map((p: Person) => (
                      <tr key={p.id} onClick={() => setSelectedFoundPerson(p)} className="hover:bg-white/[0.05] transition cursor-pointer group">
                        <td className="px-4 py-3">
                          <div className="w-[50px] h-[50px] bg-slate-800 rounded overflow-hidden flex items-center justify-center border border-white/10">
                            {p.photo_url ? (
                              <img 
                                src={p.photo_url.startsWith("http") ? p.photo_url : `http://localhost:8000${p.photo_url}`} 
                                alt="Found Person" 
                                className="w-full h-full object-cover" 
                              />
                            ) : (
                              <span className="text-xl opacity-50">👤</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{p.id.slice(0, 8)}</td>
                        <td className="px-4 py-3">{p.approximate_age || "-"}</td>
                        <td className="px-4 py-3">{p.gender || "-"}</td>
                        <td className="px-4 py-3">{p.found_city || p.city || "-"}</td>
                        <td className="px-4 py-3 truncate max-w-[150px]">{p.found_location}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${p.is_alive ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                            {p.is_alive ? "ALIVE" : "DECEASED"}
                          </span>
                        </td>
                        <td className="px-4 py-3">{formatDate(p.found_date || "")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

      {/* Citizen Detail View Modal */}
      {selectedFoundPerson && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-card w-full max-w-4xl max-h-[100vh] overflow-y-auto border-white/10 shadow-2xl relative printable-area report-container bg-slate-950">
            <button 
              onClick={() => setSelectedFoundPerson(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl z-10 no-print"
            >
              ✕
            </button>
            <div className="p-4 sm:p-6 print:p-0">
              {/* Print Only Official Header (Moved outside flex-row for perfect top alignment) */}
              <div className="hidden print:flex w-full flex-col items-center justify-center border-b-2 border-black pb-4 mb-6">
                <h1 className="text-3xl font-black uppercase tracking-widest text-black">Wajood</h1>
                <p className="text-sm font-bold text-gray-800 uppercase tracking-widest">Official Found Citizen Registry</p>
                <p className="text-xs text-gray-500 font-mono mt-2">Print Date: {new Date().toLocaleDateString()} | Record ID: {selectedFoundPerson.id.slice(0, 8)}</p>
              </div>

              <div className="flex flex-col md:flex-row print:flex-col print:items-center gap-6">
                {/* Left Side: Photo & Quick Status */}
                <div className="w-full md:w-1/3 print:w-full flex flex-col items-center md:border-r border-white/10 print:border-none pr-0 md:pr-8 print:pr-0">
                  <div className="w-48 h-48 bg-slate-900 print:bg-transparent rounded-xl overflow-hidden border-2 border-white/10 print:border-gray-300 mb-6 flex items-center justify-center">
                    {selectedFoundPerson.photo_url ? (
                      <img 
                        src={selectedFoundPerson.photo_url.startsWith("http") ? selectedFoundPerson.photo_url : `http://localhost:8000${selectedFoundPerson.photo_url}`} 
                        alt="Citizen" className="w-full h-full object-cover" 
                      />
                    ) : (
                      <span className="text-6xl opacity-20">👤</span>
                    )}
                  </div>
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-md mb-2 ${selectedFoundPerson.is_alive ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 print:border-black print:text-black print:bg-transparent" : "bg-red-500/20 text-red-400 border border-red-500/30 print:border-black print:text-black print:bg-transparent"}`}>
                    {selectedFoundPerson.is_alive ? "ALIVE / PATIENT" : "DECEASED / REMAINS"}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 print:text-black mt-2">ID: {selectedFoundPerson.id}</span>
                </div>
                
                {/* Right Side: Details Grid */}
                <div className="w-full md:w-2/3 print:w-full flex flex-col">
                  <div className="flex justify-between items-start mb-6 no-print">
                    <div>
                      <h2 className="text-2xl font-black text-white">Found Citizen Record</h2>
                      <p className="text-xs text-slate-400 uppercase tracking-widest mt-1">Official Registry Entry</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 no-print">
                      <button 
                        onClick={() => window.print()} 
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-indigo-500/20 transition flex items-center gap-2"
                      >
                        <span>🖨️</span> Print / PDF
                      </button>
                      <span className="text-[9px] text-slate-500 max-w-[150px] text-right">
                        * Turn off &apos;Headers and Footers&apos; in browser print settings for best results.
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm bg-slate-950/40 print:bg-transparent p-5 print:p-0 rounded-xl border border-white/5 print:border-none mb-6">
                    <div>
                      <span className="block text-[10px] text-slate-500 print:text-gray-600 uppercase tracking-wider font-bold mb-1">Age (Approx)</span>
                      <span className="text-slate-200 print:text-black font-semibold">{selectedFoundPerson.approximate_age || "Unknown"}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 print:text-gray-600 uppercase tracking-wider font-bold mb-1">Gender</span>
                      <span className="text-slate-200 print:text-black font-semibold">{selectedFoundPerson.gender || "Unknown"}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 print:text-gray-600 uppercase tracking-wider font-bold mb-1">City</span>
                      <span className="text-slate-200 print:text-black font-semibold">{selectedFoundPerson.found_city || selectedFoundPerson.city || "N/A"}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 print:text-gray-600 uppercase tracking-wider font-bold mb-1">Specific Location</span>
                      <span className="text-slate-200 print:text-black font-semibold">{selectedFoundPerson.found_location || "N/A"}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 print:text-gray-600 uppercase tracking-wider font-bold mb-1">Date Found</span>
                      <span className="text-slate-200 print:text-black font-semibold">{formatDate(selectedFoundPerson.found_date || "")}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 print:text-gray-600 uppercase tracking-wider font-bold mb-1">{selectedFoundPerson.is_alive ? "Hospital" : "Morgue ID"}</span>
                      <span className="text-slate-200 print:text-black font-semibold">{selectedFoundPerson.is_alive ? (selectedFoundPerson.hospital_name || "N/A") : (selectedFoundPerson.morgue_id || "N/A")}</span>
                    </div>
                  </div>

                  {/* Bottom Section: Descriptions */}
                  <div className="space-y-3">
                    <div>
                      <span className="block text-xs text-indigo-400 print:text-black font-bold mb-1">Physical Description & Attire</span>
                      <div className="bg-slate-900/80 print:bg-transparent print:border-gray-300 print:text-black p-3 rounded-lg border border-white/10 text-slate-300 text-sm h-24 overflow-hidden whitespace-pre-wrap leading-relaxed">
                        {selectedFoundPerson.physical_description || "No description provided."}
                      </div>
                    </div>
                    {selectedFoundPerson.notes && (
                      <div>
                        <span className="block text-xs text-amber-400 print:text-black font-bold mb-1">Additional Notes</span>
                        <div className="bg-slate-900/80 print:bg-transparent print:border-gray-300 print:text-black p-3 rounded-lg border border-white/10 text-slate-300 text-sm h-16 overflow-hidden whitespace-pre-wrap leading-relaxed">
                          {selectedFoundPerson.notes}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
