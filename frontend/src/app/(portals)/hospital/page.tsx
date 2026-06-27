"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import PortalLayout from "@/components/shared/PortalLayout";
import api from "@/lib/api";
import { Person, Gender, Notification } from "@/types";
import StatusBadge from "@/components/shared/StatusBadge";
import PhotoUpload from "@/components/shared/PhotoUpload";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/shared/Toast";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import EmptyState from "@/components/shared/EmptyState";

// Schema for unidentified patient registration
const patientSchema = z.object({
  approximate_age: z.coerce.number().min(0).max(120),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "UNKNOWN"]),
  found_location: z.string().min(4, "Admitted area is required"),
  found_city: z.string().min(2, "City is required"),
  found_date: z.string().min(1, "Admission date is required"),
  physical_description: z.string().min(5, "Physical description is required"),
  is_alive: z.boolean().default(true),
  notes: z.string().optional(),
  hospital_name: z.string().min(2, "Hospital name or morgue facility is required"),
  morgue_id: z.string().optional(),
});

type PatientFields = z.infer<typeof patientSchema>;

export default function HospitalPortal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"board" | "register" | "morgue" | "alerts">("board");
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);

  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Query patient admissions list
  const { data: patientList = [], isLoading } = useQuery({
    queryKey: ["hospitalPatients"],
    queryFn: async () => {
      const res = await api.getPersons();
      return Array.isArray(res) ? res : [];
    },
  });
  const deceasedPatients = patientList.filter((p: Person) => p.is_alive === false);

  // Query hospital match notifications
  const { data: matchNotifications = [] } = useQuery({
    queryKey: ["hospitalAlerts"],
    queryFn: async () => {
      const res = await api.getNotifications(false);
      const list = Array.isArray(res) ? res : [];
      return list.filter((n: Notification) => n.title.includes("MATCH") || n.message.includes("match"));
    },
    refetchInterval: 12000,
  });

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<PatientFields>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      gender: "UNKNOWN",
      is_alive: true,
      hospital_name: "Jinnah Hospital Karachi",
    },
  });

  // Register patient mutation
  const registerPatientMutation = useMutation({
    mutationFn: async (fields: PatientFields) => {
      const formData = new FormData();
      formData.append("approximate_age", fields.approximate_age.toString());
      formData.append("gender", fields.gender);
      formData.append("found_location", fields.found_location);
      formData.append("found_city", fields.found_city);
      formData.append("found_date", fields.found_date);
      formData.append("physical_description", fields.physical_description);
      formData.append("is_alive", fields.is_alive.toString());
      formData.append("hospital_name", fields.hospital_name);
      if (fields.notes) formData.append("notes", fields.notes);
      if (fields.morgue_id) formData.append("morgue_id", fields.morgue_id);
      if (selectedPhoto) {
        formData.append("photo", selectedPhoto);
      }
      return api.createPerson(formData);
    },
    onSuccess: () => {
      const msg = "Unidentified patient successfully logged. Face recognition matching triggered.";
      setFormSuccess(msg);
      toast.success(msg);
      reset();
      setSelectedPhoto(null);
      queryClient.invalidateQueries({ queryKey: ["hospitalPatients"] });
      setActiveTab("board");
    },
    onError: (err: any) => {
      const errMsg = err.message || "Failed to admit patient.";
      setFormError(errMsg);
      toast.error(errMsg);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return api.updatePerson(id, { status });
    },
    onSuccess: () => {
      toast.success("Patient status successfully updated!");
      queryClient.invalidateQueries({ queryKey: ["hospitalPatients"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to update status"),
  });

  const [editingStatus, setEditingStatus] = useState<Record<string, string>>({});

  const onSubmit = (data: PatientFields) => {
    setFormError("");
    setFormSuccess("");
    registerPatientMutation.mutate(data);
  };

  return (
    <PortalLayout
      portalName="Hospital / Morgue Official"
      portalIcon="🏥"
      portalColor="#f59e0b"
      allowedRoles={["hospital"]}
    >
      <div className="space-y-8">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-white/5 gap-4 overflow-x-auto">
          {(["board", "register", "morgue", "alerts"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setFormSuccess(""); setFormError(""); }}
              className={`py-3 px-3 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
                activeTab === tab
                  ? "border-amber-500 text-amber-400 bg-amber-500/10"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              {tab === "board" ? "📋 Patient Status Board" : tab === "register" ? "📝 Register Patient" : tab === "morgue" ? "💀 Morgue Records" : "🔔 Match Notifications"}
            </button>
          ))}
        </div>

        {formSuccess && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold">
            ✅ {formSuccess}
          </div>
        )}

        {/* Board View Table */}
        {activeTab === "board" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-md font-bold text-slate-200">🏥 Centralized Patient Status Board</h3>
              <span className="text-xs font-mono bg-amber-500/10 text-amber-400 px-3 py-1 rounded-full border border-amber-500/20">
                {patientList.length} registered
              </span>
            </div>

            {isLoading ? (
              <LoadingSpinner size="sm" text="Querying hospital telemetry..." />
            ) : patientList.length === 0 ? (
              <EmptyState title="No Patients Registered" icon="🏥" description="No patient files found in this medical center." />
            ) : (
              <div className="glass-card overflow-x-auto shadow-xl border border-white/10 bg-slate-950/60">
                <table className="w-full text-left border-collapse text-xs text-slate-300">
                  <thead>
                    <tr className="bg-white/[0.03] border-b border-white/10 text-slate-400">
                      <th className="p-4 font-extrabold uppercase">ID</th>
                      <th className="p-4 font-extrabold uppercase">Age</th>
                      <th className="p-4 font-extrabold uppercase">Gender</th>
                      <th className="p-4 font-extrabold uppercase">Status</th>
                      <th className="p-4 font-extrabold uppercase">Match Status</th>
                      <th className="p-4 font-extrabold uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {patientList.map((p: Person) => {
                      const hasMatch = (p as any).match_status === "MATCHED" || matchNotifications.some((n: any) => n.message.includes(p.id));
                      const currentVal = editingStatus[p.id] || p.status || "UNIDENTIFIED";

                      return (
                        <tr key={p.id} className="hover:bg-white/[0.02] transition">
                          <td className="p-4 font-mono font-bold text-amber-400">{p.id.slice(0, 8)}</td>
                          <td className="p-4 font-semibold">{p.age_min || "?"} yrs</td>
                          <td className="p-4 font-semibold">{p.gender}</td>
                          <td className="p-4">
                            <StatusBadge status={p.status || "UNIDENTIFIED"} />
                          </td>
                          <td className="p-4">
                            {hasMatch ? (
                              <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold uppercase text-[10px] flex items-center gap-1 w-max">
                                🟢 Match Found
                              </span>
                            ) : (
                              <span className="text-slate-500 font-mono text-[11px]">No Match</span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <select
                                value={currentVal}
                                onChange={(e) => setEditingStatus({ ...editingStatus, [p.id]: e.target.value })}
                                className="form-select py-1 px-2 text-xs font-bold bg-slate-900 border-white/10 rounded-lg min-h-[36px]"
                              >
                                <option value="UNIDENTIFIED">UNIDENTIFIED</option>
                                <option value="MATCHED">MATCHED</option>
                                <option value="RETURNED">RETURNED</option>
                                <option value="DECEASED">DECEASED</option>
                              </select>
                              <button
                                onClick={() => updateStatusMutation.mutate({ id: p.id, status: currentVal })}
                                disabled={updateStatusMutation.isPending}
                                className="py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition shadow min-h-[36px]"
                              >
                                Save
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Register Tab */}
        {activeTab === "register" && (
          <div className="glass-card p-8 max-w-3xl mx-auto">
            <h3 className="text-lg font-bold text-amber-500 mb-6">Register Unidentified Admission</h3>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {formError && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold">
                  ❌ {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="form-label" htmlFor="h-patient-age">Estimated Age *</label>
                  <input id="h-patient-age" type="number" className="form-input" {...register("approximate_age")} />
                  {errors.approximate_age && <p className="text-xs text-red-400 mt-1">{errors.approximate_age.message}</p>}
                </div>
                <div>
                  <label className="form-label" htmlFor="h-patient-gender">Gender *</label>
                  <select id="h-patient-gender" className="form-select" {...register("gender")}>
                    <option value="UNKNOWN">Select gender</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="form-label" htmlFor="h-patient-date">Admission Date *</label>
                  <input id="h-patient-date" type="date" className="form-input" {...register("found_date")} />
                  {errors.found_date && <p className="text-xs text-red-400 mt-1">{errors.found_date.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label" htmlFor="h-patient-city">City *</label>
                  <select id="h-patient-city" className="form-select" {...register("found_city")}>
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
                <div>
                  <label className="form-label" htmlFor="h-patient-loc">Admission Area / Precinct *</label>
                  <input id="h-patient-loc" className="form-input" placeholder="e.g. G-9 Street" {...register("found_location")} />
                  {errors.found_location && <p className="text-xs text-red-400 mt-1">{errors.found_location.message}</p>}
                </div>
              </div>

              <div>
                <label className="form-label" htmlFor="h-patient-desc">Physical Condition & Description *</label>
                <textarea
                  id="h-patient-desc"
                  className="form-input min-h-[80px]"
                  placeholder="Identify skin tone, height, birthmarks, tattoos, clothing details..."
                  {...register("physical_description")}
                />
                {errors.physical_description && <p className="text-xs text-red-400 mt-1">{errors.physical_description.message}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                <div>
                  <label className="form-label" htmlFor="h-patient-cond">Condition *</label>
                  <select
                    id="h-patient-cond"
                    className="form-select font-bold"
                    value={watch("is_alive") ? "ALIVE" : "DECEASED"}
                    onChange={(e) => setValue("is_alive", e.target.value === "ALIVE")}
                  >
                    <option value="ALIVE">Alive</option>
                    <option value="DECEASED">Deceased</option>
                  </select>
                </div>
                <div>
                  <label className="form-label" htmlFor="h-patient-facility">Hospital Name *</label>
                  <input id="h-patient-facility" className="form-input font-semibold bg-white/5" readOnly {...register("hospital_name")} />
                </div>
                {!watch("is_alive") && (
                  <div>
                    <label className="form-label" htmlFor="h-patient-morgue">Morgue ID</label>
                    <input id="h-patient-morgue" className="form-input font-mono" placeholder="Bed #4" {...register("morgue_id")} />
                  </div>
                )}
              </div>

              <div>
                <PhotoUpload onFileChange={(file) => setSelectedPhoto(file)} label="Upload Admission Photo (Critical for Biometric Scans)" />
              </div>

              <div className="flex gap-3 justify-end pt-6 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setActiveTab("board")}
                  className="px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-semibold text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registerPatientMutation.isPending}
                  className="btn-primary px-6 py-2.5 flex items-center gap-2"
                  style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
                >
                  {registerPatientMutation.isPending && (
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  <span>{registerPatientMutation.isPending ? "Submitting..." : "Log Patient"}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Morgue records list */}
        {activeTab === "morgue" && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-200">Deceased Cold Storage Registry</h3>
            {deceasedPatients.length === 0 ? (
              <EmptyState title="No Morgue Records" icon="💀" description="No deceased individuals registered in cold storage." />
            ) : (
              <div className="glass-card overflow-hidden">
                <table className="w-full text-left border-collapse text-xs text-slate-300">
                  <thead>
                    <tr className="bg-white/[0.02] border-b border-white/5">
                      <th className="p-4 font-bold uppercase text-slate-400">Record ID</th>
                      <th className="p-4 font-bold uppercase text-slate-400">Description</th>
                      <th className="p-4 font-bold uppercase text-slate-400">Morgue Bed</th>
                      <th className="p-4 font-bold uppercase text-slate-400">Admit Date</th>
                      <th className="p-4 font-bold uppercase text-slate-400">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {deceasedPatients.map((p: Person) => (
                      <tr key={p.id} className="hover:bg-white/[0.01]">
                        <td className="p-4 font-mono font-semibold text-amber-500">{p.id.slice(0, 8)}...</td>
                        <td className="p-4">{p.physical_description}</td>
                        <td className="p-4 font-mono">{p.morgue_id || "Cold Vault"}</td>
                        <td className="p-4">{formatDate(p.found_date || "")}</td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 font-bold uppercase text-[10px]">
                            DECEASED
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Match alerts panel */}
        {activeTab === "alerts" && (
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-md font-bold text-slate-200">Hospital Match Alert Stream</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Real-time match updates generated by the AI comparison worker for patients registered in this clinic.
            </p>

            {matchNotifications.length === 0 ? (
              <EmptyState title="No Alerts" icon="🔔" description="No active biometric matches logged for this facility." />
            ) : (
              <div className="space-y-3">
                {matchNotifications.map((notif: Notification) => (
                  <div key={notif.id} className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.02] flex items-start gap-3">
                    <span className="text-lg">🤝</span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">{notif.title}</h4>
                      <p className="text-xs text-slate-400 mt-1 leading-normal">{notif.message}</p>
                    </div>
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
