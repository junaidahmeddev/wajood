"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import dynamic from "next/dynamic";

import PortalLayout from "@/components/shared/PortalLayout";
import api from "@/lib/api";
import { Case } from "@/types";
import StatusBadge from "@/components/shared/StatusBadge";
import PhotoUpload from "@/components/shared/PhotoUpload";
import { formatDate } from "@/lib/utils";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import EmptyState from "@/components/shared/EmptyState";

import SearchBar from "@/components/shared/SearchBar";
import CityFilter from "@/components/shared/CityFilter";
import { useAuthStore } from "@/store";

const LeafletMap = dynamic(() => import("@/components/shared/LeafletMap"), {
  ssr: false,
});

// Zod schema for sighting reports
const sightingSchema = z.object({
  case_id: z.string().min(1, "Case must be selected"),
  location: z.string().min(4, "Detailed address is required"),
  city: z.string().min(2, "City is required"),
  sighting_date: z.string().min(1, "Date/time required"),
  description: z.string().min(5, "Physical description required"),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  phone: z.string().optional(),
});

type SightingFields = z.infer<typeof sightingSchema>;

interface FieldTask {
  id: string;
  title: string;
  description: string;
  target_city: string;
  status: "PENDING" | "ASSIGNED" | "COMPLETED";
}

export default function VolunteerPortal() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<"cases" | "map" | "sighting" | "history" | "tasks">("cases");
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCity, setFilterCity] = useState("");

  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Simulated Volunteer Field Tasks
  const [tasks, setTasks] = useState<FieldTask[]>([
    { id: "task-1", title: "Distribute Flyers in Saddar", description: "Distribute flyers for case WJD-2026-X12 in Saddar Commercial Markets.", target_city: "Rawalpindi", status: "PENDING" },
    { id: "task-2", title: "Inquire at Data Darbar Shelter", description: "Check with local volunteers and staff at shelter regarding recent amnesia admissions.", target_city: "Lahore", status: "PENDING" },
    { id: "task-3", title: "Search Phase 5 DHA Park Area", description: "Coordinate foot patrol around Phase 5 main park.", target_city: "Karachi", status: "ASSIGNED" },
  ]);

  // Query active missing cases for mapping and selection
  const { data: casesList = [], isLoading: isLoadingCases } = useQuery({
    queryKey: ["volunteerCases"],
    queryFn: async () => {
      const res = await api.getCases();
      return Array.isArray(res) ? res : [];
    },
  });

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<SightingFields>({
    resolver: zodResolver(sightingSchema),
    defaultValues: {
      confidence: "MEDIUM",
      phone: user?.phone || "+92 300 0000000",
    },
  });

  // Mutation to submit sighting
  const reportSightingMutation = useMutation({
    mutationFn: async (fields: SightingFields) => {
      const formData = new FormData();
      formData.append("location", fields.location);
      formData.append("city", fields.city);
      formData.append("sighting_date", fields.sighting_date);
      formData.append("description", fields.description);
      formData.append("confidence", fields.confidence);
      if (fields.phone) formData.append("phone", fields.phone);
      if (selectedPhoto) {
        formData.append("photo", selectedPhoto);
      }
      return api.addSighting(fields.case_id, formData);
    },
    onSuccess: () => {
      setFormSuccess("Sighting report successfully uploaded! Family and Officers have been alerted.");
      reset();
      setSelectedPhoto(null);
      setActiveTab("history");
    },
    onError: (err: any) => {
      setFormError(err.message || "Failed to submit sighting report.");
    },
  });

  const onSubmit = (data: SightingFields) => {
    setFormError("");
    setFormSuccess("");
    reportSightingMutation.mutate(data);
  };

  const handleTaskAction = (taskId: string, action: "accept" | "complete") => {
    setTasks(prev =>
      prev.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            status: action === "accept" ? "ASSIGNED" : "COMPLETED",
          };
        }
        return t;
      })
    );
    alert(`Task status updated successfully.`);
  };

  const filteredCases = casesList.filter((c: Case) => {
    const matchCity = !filterCity || c.last_seen_city?.toLowerCase() === filterCity.toLowerCase();
    const matchTerm = !searchTerm || c.person?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || c.case_number?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCity && matchTerm;
  });

  return (
    <PortalLayout
      portalName="Volunteer Responder"
      portalIcon="🤲"
      portalColor="#8b5cf6"
      allowedRoles={["volunteer"]}
    >
      <div className="space-y-8">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-white/5 gap-4 overflow-x-auto">
          {(["cases", "map", "sighting", "history", "tasks"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setFormSuccess(""); setFormError(""); }}
              className={`py-3 px-3 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
                activeTab === tab
                  ? "border-violet-500 text-violet-400 bg-violet-500/10"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              {tab === "cases" ? "🔍 Search Missing Persons" : tab === "map" ? "📍 Nearby Map" : tab === "sighting" ? "📝 Report Sighting" : tab === "history" ? "📜 History" : "📋 My Tasks"}
            </button>
          ))}
        </div>

        {formSuccess && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold">
            ✅ {formSuccess}
          </div>
        )}

        {/* ─── TAB 1: Search Missing Persons (Stripped PII) ─── */}
        {activeTab === "cases" && (
          <div className="space-y-6">
            <div className="glass-card p-6 border-violet-500/20 space-y-4">
              <div className="flex flex-wrap gap-4 items-center justify-between">
                <div className="flex-1 min-w-[200px]">
                  <SearchBar value={searchTerm} onChange={(q) => setSearchTerm(q)} placeholder="Search by name or case #" />
                </div>
                <div className="w-full sm:w-auto">
                  <CityFilter value={filterCity} onChange={(c) => setFilterCity(c)} />
                </div>
              </div>
            </div>

            {isLoadingCases ? (
              <LoadingSpinner text="Loading cases..." />
            ) : filteredCases.length === 0 ? (
              <EmptyState title="No Cases" icon="🔍" description="No active cases found matching search criteria." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCases.map((c: Case) => {
                  const daysMissing = Math.max(1, Math.floor((Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24)));
                  return (
                    <div key={c.id} className="glass-card p-5 flex flex-col justify-between border-white/5 hover:border-violet-500/40 transition">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-mono text-violet-400 font-bold">{c.case_number}</span>
                          <StatusBadge status={c.status} />
                        </div>

                        <div className="w-full h-44 rounded-xl bg-slate-900 overflow-hidden relative">
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
                        </div>

                        {c.person?.distinguishing_marks && (
                          <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 text-[11px] text-slate-300">
                            <span className="text-violet-400 font-bold">Marks:</span> {c.person.distinguishing_marks}
                          </div>
                        )}
                        {/* Notice: CNIC, Phone, Address explicitly stripped */}
                      </div>

                      <button
                        onClick={() => {
                          setValue("case_id", c.id);
                          setActiveTab("sighting");
                        }}
                        className="mt-4 w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs transition shadow-lg shadow-violet-600/20"
                      >
                        🚨 Report Sighting
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Map View */}
        {activeTab === "map" && (
          <div className="space-y-4">
            <h3 className="text-md font-bold text-slate-200">📍 Active Missing Persons Search Vectors</h3>
            <p className="text-xs text-slate-400">
              The Leaflet map markers indicate the last seen locations of active missing person cases in your region. Check markers for coordinates.
            </p>
            <div className="border border-white/5 rounded-xl overflow-hidden shadow-xl">
              <LeafletMap markerTitle="Active Volunteer Search Precinct" />
            </div>
          </div>
        )}

        {/* Report Sighting Tab */}
        {activeTab === "sighting" && (
          <div className="glass-card p-8 max-w-3xl mx-auto">
            <h3 className="text-lg font-bold text-violet-400 mb-6">Report a Sighting</h3>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {formError && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold">
                  ❌ {formError}
                </div>
              )}

              <div>
                <label className="form-label" htmlFor="sight-case">Select Target Case *</label>
                <select id="sight-case" className="form-select text-xs font-bold w-full" {...register("case_id")} required>
                  <option value="">Choose Case Folder</option>
                  {casesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.person?.full_name} ({c.case_number})
                    </option>
                  ))}
                </select>
                {errors.case_id && <p className="text-xs text-red-400 mt-1">{errors.case_id.message}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label" htmlFor="sight-loc">Sighting Location *</label>
                  <input id="sight-loc" placeholder="e.g. Golra Mor Bus Stop" className="form-input text-xs" {...register("location")} />
                  {errors.location && <p className="text-xs text-red-400 mt-1">{errors.location.message}</p>}
                </div>
                <div>
                  <label className="form-label" htmlFor="sight-city">City *</label>
                  <select id="sight-city" className="form-select text-xs font-bold" {...register("city")}>
                    <option value="Rawalpindi">Rawalpindi</option>
                    <option value="Islamabad">Islamabad</option>
                    <option value="Lahore">Lahore</option>
                    <option value="Karachi">Karachi</option>
                    <option value="Peshawar">Peshawar</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label" htmlFor="sight-date">Sighting Date/Time *</label>
                  <input id="sight-date" type="datetime-local" className="form-input text-xs font-mono" {...register("sighting_date")} />
                  {errors.sighting_date && <p className="text-xs text-red-400 mt-1">{errors.sighting_date.message}</p>}
                </div>
                <div>
                  <label className="form-label" htmlFor="sight-conf">Confidence Level *</label>
                  <select id="sight-conf" className="form-select text-xs font-bold" {...register("confidence")}>
                    <option value="HIGH">High (Certain)</option>
                    <option value="MEDIUM">Medium (Probable)</option>
                    <option value="LOW">Low (Unsure)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label" htmlFor="sight-desc">Physical Description of Person Seen *</label>
                <textarea
                  id="sight-desc"
                  placeholder="Detail clothes worn, physical state, direction they were heading..."
                  className="form-input text-xs min-h-[80px]"
                  {...register("description")}
                />
                {errors.description && <p className="text-xs text-red-400 mt-1">{errors.description.message}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="form-label" htmlFor="sight-phone">Volunteer Phone *</label>
                  <input id="sight-phone" className="form-input text-xs font-mono" readOnly {...register("phone")} />
                </div>
                <div>
                  <PhotoUpload onFileChange={(file) => setSelectedPhoto(file)} label="Upload Sighting Image (Optional)" />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-6 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setActiveTab("cases")}
                  className="px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-semibold text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reportSightingMutation.isPending}
                  className="btn-primary px-6 py-2.5 flex items-center gap-2"
                  style={{ background: "linear-gradient(135deg, #8b5cf6, #7c3aed)" }}
                >
                  {reportSightingMutation.isPending && (
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  <span>{reportSightingMutation.isPending ? "Submitting..." : "Submit Sighting"}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-200">Sighting Submission Logs</h3>
            <div className="glass-card p-6">
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
                Logged Sightings History
              </div>
              
              <div className="divide-y divide-white/5">
                <div className="py-4">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-200">Rawalpindi Saddar Bazaar Area</h4>
                      <p className="text-xs text-slate-400 mt-1 leading-normal">
                        Spotted a matching child near the bakery. Re-directed local guards, notified police patrol unit immediately.
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 font-bold uppercase text-[10px] border border-violet-500/20">
                      Sighting Alerted
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono mt-2 block">Logged: June 21, 2026</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tasks Tab */}
        {activeTab === "tasks" && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-200">Active Volunteer Tasks</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Find field tasks assigned in your district. Accept tasks to notify coordination staff, and mark completed when finished.
            </p>

            <div className="space-y-4">
              {tasks.map((task) => (
                <div key={task.id} className="glass-card p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.01]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        task.status === "COMPLETED" ? "bg-emerald-500" :
                        task.status === "ASSIGNED" ? "bg-amber-500" : "bg-indigo-500"
                      }`} />
                      <h4 className="text-sm font-bold text-slate-200">{task.title}</h4>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">{task.description}</p>
                    <span className="text-[10px] text-violet-400 font-mono mt-1 block">City: {task.target_city}</span>
                  </div>

                  <div className="flex gap-2">
                    {task.status === "PENDING" && (
                      <button
                        onClick={() => handleTaskAction(task.id, "accept")}
                        className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-bold transition"
                      >
                        Accept Task
                      </button>
                    )}
                    {task.status === "ASSIGNED" && (
                      <button
                        onClick={() => handleTaskAction(task.id, "complete")}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition"
                      >
                        Mark Completed ✓
                      </button>
                    )}
                    {task.status === "COMPLETED" && (
                      <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold">
                        Task Completed
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </PortalLayout>
  );
}
