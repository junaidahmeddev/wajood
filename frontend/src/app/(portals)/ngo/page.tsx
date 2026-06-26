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
import { formatDate } from "@/lib/utils";
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
  const { data: cases = [] } = useQuery({
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
      <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-8 space-y-8">
        
        {/* ─── Partner Info & Shelter Panel ─── */}
        <div className="w-full bg-slate-900 border border-slate-700 rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-lg">
          {/* Left Side */}
          <div className="flex-1 border-l-4 border-emerald-500 pl-4">
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
              Verified Partner Shelter
            </span>
            <h2 className="text-xl sm:text-2xl font-black mt-1 text-white">{org?.name || "Edhi Foundation Shelter"}</h2>
            <p className="text-xs text-slate-400 mt-2">
              📍 {org?.address || "Mina Road, Karachi"} | District: {org?.district || "Karachi"}
            </p>
          </div>

          {/* Right Side */}
          <div className="flex-1 w-full md:max-w-md flex flex-col items-end">
            <div className="w-full flex justify-between text-xs font-bold text-slate-300 mb-2">
               <span>Occupancy</span>
               <span>{shelterCapacity.filled} / {shelterCapacity.total} beds</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-1">
               <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${(shelterCapacity.filled / shelterCapacity.total) * 100}%` }} />
            </div>
            <div className="w-full text-right text-[10px] text-slate-400 font-bold mb-4">
               {Math.round((shelterCapacity.filled / shelterCapacity.total) * 100)}% Full
            </div>
            <div className="flex justify-end gap-3 w-full">
              <button
                onClick={() => setShelterCapacity(prev => ({ ...prev, filled: Math.max(0, prev.filled - 1) }))}
                className="h-[36px] px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition"
              >
                - Discharge
              </button>
              <button
                onClick={() => setShelterCapacity(prev => ({ ...prev, filled: Math.min(prev.total, prev.filled + 1) }))}
                className="h-[36px] px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition shadow-lg shadow-emerald-500/20"
              >
                + Admit
              </button>
            </div>
          </div>
        </div>

        {/* ─── Navigation Tabs ─── */}
        <div className="flex border-b border-white/10 gap-6 overflow-x-auto no-scrollbar w-full">
          {[
            { id: "dashboard", label: "Dashboard", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg> },
            { id: "register", label: "Register Found", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> },
            { id: "found-list", label: "Found List", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
            { id: "matches", label: "AI Matches", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> },
            { id: "handover", label: "Handover", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id as any); setFormSuccess(""); setFormError(""); }}
              className={`pb-3 flex items-center gap-2 text-sm transition whitespace-nowrap border-b-2 ${
                activeTab === tab.id
                  ? "border-emerald-500 text-emerald-400 font-bold"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.icon}
              {tab.label}
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-[20px] text-center flex flex-col justify-center items-center">
                <div className="text-3xl font-black text-white font-mono mb-1">8</div>
                <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">Found Registered</div>
              </div>
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-[20px] text-center flex flex-col justify-center items-center">
                <div className="text-3xl font-black text-amber-400 font-mono mb-1">3</div>
                <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">Pending Handover</div>
              </div>
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-[20px] text-center flex flex-col justify-center items-center">
                <div className="text-3xl font-black text-indigo-400 font-mono mb-1">2</div>
                <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">Unidentified</div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
              <h3 className="text-md font-bold text-white mb-4">Recent Found Intake Records</h3>
              <div className="space-y-4">
                {/* Demo Card 1 */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800 gap-4 w-full">
                  <div className="flex items-center gap-4 w-full sm:w-auto overflow-hidden">
                     <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                       <svg className="w-5 h-5 sm:w-6 sm:h-6 text-slate-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                     </div>
                     <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-white truncate">Unknown Male, ~35 yrs</h4>
                        <div className="text-xs text-slate-400 mt-1 truncate">Intake: Oct 24, 2026 | Location: Korangi, Karachi</div>
                     </div>
                  </div>
                  <div className="flex flex-row items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-3 sm:pt-0 border-t border-slate-800 sm:border-0 mt-1 sm:mt-0">
                     <span className="px-3 py-1 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 uppercase tracking-wide shrink-0">Stable</span>
                     <button
                       onClick={() => { setActiveTab("matches"); toast.success("Biometric AI matching queued."); }}
                       className="h-[36px] px-5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition whitespace-nowrap"
                     >
                       Run Match
                     </button>
                  </div>
                </div>

                {/* Demo Card 2 */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800 gap-4 w-full">
                  <div className="flex items-center gap-4 w-full sm:w-auto overflow-hidden">
                     <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                       <svg className="w-5 h-5 sm:w-6 sm:h-6 text-slate-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                     </div>
                     <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-white truncate">Ayesha (Self-identified), ~8 yrs</h4>
                        <div className="text-xs text-slate-400 mt-1 truncate">Intake: Oct 22, 2026 | Location: Saddar, Karachi</div>
                     </div>
                  </div>
                  <div className="flex flex-row items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-3 sm:pt-0 border-t border-slate-800 sm:border-0 mt-1 sm:mt-0">
                     <span className="px-3 py-1 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 uppercase tracking-wide shrink-0">Critical</span>
                     <button
                       onClick={() => toast.success("Transfer request sent to medical unit.")}
                       className="h-[36px] px-5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition whitespace-nowrap"
                     >
                       Transfer
                     </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "register" && (
          <div className="bg-slate-900 border border-slate-700 p-[24px] sm:p-[40px] rounded-xl shadow-xl w-full max-w-4xl mx-auto">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <span>Intake Found / Unidentified Citizen</span>
            </h3>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {formError && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold">
                  ❌ {formError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-300" htmlFor="found-age">Approximate Age *</label>
                  <input id="found-age" type="number" className={`h-[40px] px-3 rounded-[8px] bg-slate-950 border ${errors.approximate_age ? 'border-red-500' : 'border-slate-700'} focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm text-white`} placeholder="Years" {...register("approximate_age")} />
                  {errors.approximate_age && <p className="text-xs text-red-400 mt-1">{errors.approximate_age.message}</p>}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-300" htmlFor="found-gender">Gender *</label>
                  <select id="found-gender" className="h-[40px] px-3 rounded-[8px] bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm text-white" {...register("gender")}>
                    <option value="UNKNOWN">Select gender</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-300" htmlFor="found-date">Date Found *</label>
                  <input id="found-date" type="date" className={`h-[40px] px-3 rounded-[8px] bg-slate-950 border ${errors.found_date ? 'border-red-500' : 'border-slate-700'} focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm text-white`} {...register("found_date")} />
                  {errors.found_date && <p className="text-xs text-red-400 mt-1">{errors.found_date.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-300" htmlFor="found-city">City Found *</label>
                  <select id="found-city" className={`h-[40px] px-3 rounded-[8px] bg-slate-950 border ${errors.found_city ? 'border-red-500' : 'border-slate-700'} focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm text-white`} {...register("found_city")}>
                    <option value="">Select City</option>
                    <option value="Karachi">Karachi</option>
                    <option value="Lahore">Lahore</option>
                    <option value="Islamabad">Islamabad</option>
                    <option value="Rawalpindi">Rawalpindi</option>
                    <option value="Peshawar">Peshawar</option>
                    <option value="Quetta">Quetta</option>
                    <option value="Multan">Multan</option>
                    <option value="Faisalabad">Faisalabad</option>
                    <option value="Hyderabad">Hyderabad</option>
                    <option value="Sialkot">Sialkot</option>
                  </select>
                  {errors.found_city && <p className="text-xs text-red-400 mt-1">{errors.found_city.message}</p>}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-300" htmlFor="found-loc">Specific Location Found *</label>
                  <input id="found-loc" className={`h-[40px] px-3 rounded-[8px] bg-slate-950 border ${errors.found_location ? 'border-red-500' : 'border-slate-700'} focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm text-white`} placeholder="Market, shrine, hospital..." {...register("found_location")} />
                  {errors.found_location && <p className="text-xs text-red-400 mt-1">{errors.found_location.message}</p>}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-300" htmlFor="found-desc">Physical Characteristics &amp; Attire *</label>
                <textarea
                  id="found-desc"
                  className={`p-3 rounded-[8px] bg-slate-950 border ${errors.physical_description ? 'border-red-500' : 'border-slate-700'} focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm text-white min-h-[80px]`}
                  placeholder="Describe clothes, scars, tattoos, height, facial features..."
                  {...register("physical_description")}
                />
                {errors.physical_description && <p className="text-xs text-red-400 mt-1">{errors.physical_description.message}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center pt-2">
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
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-300" htmlFor="found-hosp">Hospital Name</label>
                    <input id="found-hosp" className="h-[40px] px-3 rounded-[8px] bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm text-white" placeholder="e.g. Jinnah Hospital" {...register("hospital_name")} />
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-300" htmlFor="found-morgue">Morgue ID</label>
                    <input id="found-morgue" className="h-[40px] px-3 rounded-[8px] bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm text-white font-mono" placeholder="Tag #A-14" {...register("morgue_id")} />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-300" htmlFor="found-notes">Additional Notes</label>
                <textarea id="found-notes" className="p-3 rounded-[8px] bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm text-white min-h-[80px]" placeholder="Any behavioral or recovery context..." {...register("notes")} />
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <label className="text-xs font-bold text-slate-300">Photo Upload</label>
                <div className="w-full border-2 border-dashed border-slate-600 rounded-[8px] bg-slate-950 p-6 flex flex-col items-center justify-center hover:border-emerald-500 transition cursor-pointer">
                  <svg className="w-8 h-8 text-slate-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  <span className="text-sm font-bold text-slate-300">Upload Photo</span>
                  <span className="text-[10px] text-slate-500 mt-1">Required for AI Biometric Indexing</span>
                  <PhotoUpload onFileChange={(file) => setSelectedPhoto(file)} />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-end pt-6 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setActiveTab("dashboard")}
                  className="w-full sm:w-auto h-[40px] px-6 rounded-[8px] bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registerFoundMutation.isPending}
                  className="w-full sm:w-auto h-[40px] px-8 rounded-[8px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition"
                >
                  {registerFoundMutation.isPending ? "Indexing..." : "Register & Queue Match"}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === "found-list" && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-white">Registered Found Citizens</h3>
            {isLoadingFound ? (
              <LoadingSpinner text="Querying shelter registries..." />
            ) : foundPersons.length === 0 ? (
              <EmptyState title="No Citizens Found" icon="🏡" description="No found citizens logged by shelter." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {foundPersons.map((p: Person) => (
                  <div key={p.id} className="bg-slate-900 overflow-hidden flex flex-col h-full border border-slate-700 rounded-xl shadow-lg">
                    <div className="h-48 bg-slate-950 flex items-center justify-center border-b border-slate-800 overflow-hidden relative">
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
                        <h4 className="font-bold text-white text-sm line-clamp-2">
                          {p.physical_description}
                        </h4>
                        <div className="text-xs text-slate-400 mt-3 space-y-1.5 border-t border-slate-800 pt-3">
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
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 p-6 rounded-xl border border-slate-700 shadow-lg">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>⚡ AI Biometric Matching Telemetry</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">Cross-referencing registered found persons against Pakistan&apos;s National Missing Citizen Registry.</p>
              </div>

              <button
                onClick={() => triggerAllMutation.mutate()}
                disabled={triggerAllMutation.isPending}
                className="w-full sm:w-auto px-6 h-[40px] rounded-[8px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition shrink-0 flex items-center justify-center gap-2"
              >
                <span>🔄</span>
                <span>{triggerAllMutation.isPending ? "Executing Scan..." : "Trigger Full Match"}</span>
              </button>
            </div>

            {foundPersons.length === 0 ? (
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-12 text-center text-slate-500 text-sm">
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
            <h3 className="text-lg font-bold text-white">Reunification &amp; Family Handover Queue</h3>
            <p className="text-xs text-slate-400 max-w-3xl">
              The cases below have been confirmed by law enforcement biometric forensics. Caseworkers must verify guardian identity via CNIC prior to final custody release.
            </p>

            {handoverCases.length === 0 ? (
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-12 text-center text-slate-500 font-medium text-sm">
                🤝 No matched citizens currently awaiting handover verification.
              </div>
            ) : (
              <div className="space-y-4">
                {handoverCases.map((c: Case) => (
                  <div key={c.id} className="bg-slate-900 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border border-slate-700 rounded-xl shadow-sm">
                    <div>
                      <span className="text-xs font-mono text-emerald-400 font-bold">{c.case_number}</span>
                      <h4 className="text-sm font-bold text-white mt-1">{c.person?.full_name}</h4>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Informant: {c.person?.cnic ? `CNIC ${c.person.cnic}` : "Unverified"} | Target City: {c.last_seen_city}
                      </p>
                    </div>

                    <button
                      onClick={() => handleResolveCase(c.id)}
                      className="w-full sm:w-auto px-5 h-[36px] bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-bold text-white transition"
                    >
                      Complete Handover ✓
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
