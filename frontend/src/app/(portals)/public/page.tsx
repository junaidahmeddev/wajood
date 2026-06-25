"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import dynamic from "next/dynamic";

import PortalLayout from "@/components/shared/PortalLayout";
import api from "@/lib/api";
import { Case } from "@/types";
import SearchBar from "@/components/shared/SearchBar";
import CityFilter from "@/components/shared/CityFilter";
import CaseTimeline from "@/components/shared/CaseTimeline";
import { useToast } from "@/components/shared/Toast";
import PhotoUpload from "@/components/shared/PhotoUpload";

const LeafletMap = dynamic(() => import("@/components/shared/LeafletMap"), {
  ssr: false,
});

const reportSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  age: z.coerce.number().min(0, "Age must be positive").max(120, "Age must be under 120"),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "UNKNOWN"]),
  cnic: z.string().optional(),
  last_seen_location: z.string().min(4, "Last seen description is required"),
  last_seen_date: z.string().min(1, "Last seen date is required"),
  last_seen_city: z.string().min(2, "City is required"),
  physical_description: z.string().optional(),
  clothing_description: z.string().optional(),
  distinguishing_marks: z.string().optional(),
  contact_name: z.string().min(2, "Contact name is required"),
  contact_phone: z.string().min(8, "Contact phone must be valid"),
});

type ReportFields = z.infer<typeof reportSchema>;

export default function PublicPortal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [showReportForm, setShowReportForm] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);

  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingCase, setTrackingCase] = useState<Case | null>(null);
  const [trackingTimeline, setTrackingTimeline] = useState<any[]>([]);
  const [trackingError, setTrackingError] = useState("");
  const [isTrackingLoading, setIsTrackingLoading] = useState(false);

  const [mapCase, setMapCase] = useState<Case | null>(null);

  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const createCaseMutation = useMutation({
    mutationFn: async (fields: ReportFields) => {
      const formData = new FormData();
      formData.append("full_name", fields.full_name);
      formData.append("age", fields.age.toString());
      formData.append("gender", fields.gender);
      if (fields.cnic) formData.append("cnic", fields.cnic);
      if (fields.last_seen_location) formData.append("last_seen_location", fields.last_seen_location);
      if (fields.last_seen_date) formData.append("last_seen_date", fields.last_seen_date);
      if (fields.last_seen_city) formData.append("last_seen_city", fields.last_seen_city);
      if (fields.physical_description) formData.append("physical_description", fields.physical_description);
      if (fields.clothing_description) formData.append("clothing_description", fields.clothing_description);
      if (fields.distinguishing_marks) formData.append("distinguishing_marks", fields.distinguishing_marks);
      if (fields.contact_name) formData.append("contact_name", fields.contact_name);
      if (fields.contact_phone) formData.append("contact_phone", fields.contact_phone);
      if (selectedPhoto) formData.append("photo", selectedPhoto);
      
      return api.createCase(formData);
    },
    onSuccess: (data: any) => {
      const msg = `Report filed successfully! Reference Number: ${data.case_number}. AI facial matching initialized.`;
      setFormSuccess(msg);
      toast.success(msg);
      reset();
      setSelectedPhoto(null);
      setShowReportForm(false);
    },
    onError: (err: any) => {
      const errMsg = err.message || "Failed to submit official report.";
      setFormError(errMsg);
      toast.error(errMsg);
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ReportFields>({
    resolver: zodResolver(reportSchema),
    defaultValues: { gender: "UNKNOWN" },
  });

  const onSubmit = (data: ReportFields) => {
    setFormError("");
    setFormSuccess("");
    createCaseMutation.mutate(data);
  };

  const handleTrackCase = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrackingError("");
    setTrackingCase(null);
    setTrackingTimeline([]);
    if (!trackingNumber.trim()) return;

    setIsTrackingLoading(true);
    try {
      const listRes: any = await api.getCases({ search: trackingNumber.trim() });
      const foundList = Array.isArray(listRes) ? listRes : [];
      const matched = foundList.find((c: Case) => c.case_number === trackingNumber.trim());

      if (!matched) {
        setTrackingError("No official record found matching this tracking code.");
        return;
      }

      setTrackingCase(matched);
      const timelineRes: any = await api.getCaseTimeline(matched.id);
      setTrackingTimeline(Array.isArray(timelineRes) ? timelineRes : []);
    } catch {
      setTrackingError("Failed to retrieve tracking folder telemetry.");
    } finally {
      setIsTrackingLoading(false);
    }
  };

  return (
    <PortalLayout
      portalName="Public Citizen"
      portalIcon="👤"
      portalColor="#10b981"
      allowedRoles={[]}
    >
      <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 flex flex-col gap-12 pt-6">
        
        {/* ─── Hero Section ─── */}
        <section className="py-[48px] w-full border-b border-white/10">
          <div className="flex flex-col items-center justify-center text-center space-y-6">
            <h2 className="text-sm font-semibold text-emerald-400 tracking-wider uppercase">National Missing Registry</h2>
            
            <div className="flex flex-col md:flex-row items-center justify-between w-full max-w-4xl gap-4 md:gap-12 text-white bg-slate-900/50 p-6 rounded-2xl border border-white/5">
              <div className="text-left flex-1 border-b md:border-b-0 md:border-r border-white/10 pb-4 md:pb-0 pr-0 md:pr-8">
                <h1 className="text-2xl sm:text-3xl font-black mb-1">WAJOOD</h1>
                <p className="text-slate-400 text-xs sm:text-sm">Search the national registry or report a missing person</p>
              </div>
              <div className="text-right flex-1" dir="rtl">
                <h1 className="text-3xl sm:text-4xl font-black text-emerald-400 mb-1 font-serif">وجود</h1>
                <p className="text-slate-400 text-xs sm:text-sm font-serif">پاکستان کا قومی ریکارڈ برائے گمشدہ افراد</p>
              </div>
            </div>

            <div className="w-full max-w-3xl pt-4">
              <SearchBar
                onSearchSubmit={(q) => setSearchTerm(q)}
                placeholder="Search by name, CNIC, or case ID..."
              />
            </div>
          </div>
        </section>

        {/* ─── Stats Row ─── */}
        <section className="w-full">
          <div className="grid grid-cols-3 gap-3 md:gap-6">
            {[
              { label: "Total Missing", val: "12,847", color: "from-red-500/20 to-rose-950/20", border: "border-red-500/30", textColor: "text-red-400" },
              { label: "Found / Resolved", val: "3,216", color: "from-emerald-500/20 to-teal-950/20", border: "border-emerald-500/30", textColor: "text-emerald-400" },
              { label: "AI Matches", val: "847", color: "from-amber-500/20 to-yellow-950/20", border: "border-amber-500/30", textColor: "text-amber-400" },
            ].map((box) => (
              <div key={box.label} className={`saas-card p-[20px] bg-gradient-to-br ${box.color} border ${box.border} relative overflow-hidden h-full flex flex-col justify-between`}>
                <div className="absolute top-4 right-4 flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase hidden sm:block">Live</span>
                </div>
                <div className={`text-xl sm:text-3xl lg:text-4xl font-extrabold ${box.textColor} mt-4 mb-2 font-mono`}>{box.val}</div>
                <div className="text-[10px] sm:text-xs font-bold text-slate-300">{box.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Action Controls Bar ─── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 py-[48px] border-b border-white/10 w-full">
          <button
            onClick={() => { setShowReportForm(!showReportForm); setTrackingCase(null); }}
            className={`w-full sm:w-auto h-[48px] px-8 rounded-lg font-bold text-sm shadow-lg flex items-center justify-center transition shrink-0 ${showReportForm ? "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-white/10" : "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-500/20"}`}
          >
            {showReportForm ? "Return to Active Feed" : "Report Missing Person"}
          </button>

          <div className="w-full sm:w-64">
            <CityFilter value={filterCity} onChange={(c) => setFilterCity(c)} />
          </div>
        </div>

        {/* Success Banner */}
        {formSuccess && (
          <div className="w-full p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm font-bold animate-fadeIn">
            ✅ {formSuccess}
          </div>
        )}

        {/* Sighting Map Modal */}
        {mapCase && (
          <div className="w-full bg-slate-900 border border-emerald-500/40 p-6 rounded-xl space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center">
              <h3 className="text-md font-bold text-emerald-400">📍 Geo-Telemetry Sighting Map</h3>
              <button
                onClick={() => setMapCase(null)}
                className="px-4 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-slate-300"
              >
                Close Map ✕
              </button>
            </div>
            <LeafletMap markerTitle={`Last Seen: Verified Location`} />
          </div>
        )}

        {/* ─── View Switcher: Report Form vs Main Feed ─── */}
        {showReportForm ? (
          <div className="bg-slate-900 border border-slate-700 p-[24px] sm:p-[48px] rounded-[12px] w-full">
            <div className="pb-6 mb-6 border-b border-white/10">
              <h2 className="text-2xl font-bold text-white">Report Missing Person</h2>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {formError && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold">
                  ❌ {formError}
                </div>
              )}

              {/* Section 1 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-300">Full Name *</label>
                  <input className={`h-[40px] px-3 rounded-[8px] bg-slate-950 border ${errors.full_name ? 'border-red-500' : 'border-slate-700'} focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm text-white`} placeholder="Enter full name" {...register("full_name")} />
                  {errors.full_name && <p className="text-xs text-red-400">{errors.full_name.message}</p>}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-300">Age *</label>
                  <input type="number" className={`h-[40px] px-3 rounded-[8px] bg-slate-950 border ${errors.age ? 'border-red-500' : 'border-slate-700'} focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm text-white`} placeholder="Years" {...register("age")} />
                  {errors.age && <p className="text-xs text-red-400">{errors.age.message}</p>}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-300">Gender *</label>
                  <select className="h-[40px] px-3 rounded-[8px] bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm text-white" {...register("gender")}>
                    <option value="UNKNOWN">Select gender</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-300">CNIC Number (Optional)</label>
                  <input className="h-[40px] px-3 rounded-[8px] bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm text-white font-mono" placeholder="42201-XXXXXXX-X" {...register("cnic")} />
                </div>
              </div>

              {/* Section 2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-white/5">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-300">Last Seen City *</label>
                  <select className={`h-[40px] px-3 rounded-[8px] bg-slate-950 border ${errors.last_seen_city ? 'border-red-500' : 'border-slate-700'} focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm text-white`} {...register("last_seen_city")}>
                    <option value="">Select City</option>
                    <option value="Karachi">Karachi</option>
                    <option value="Lahore">Lahore</option>
                    <option value="Islamabad">Islamabad</option>
                  </select>
                  {errors.last_seen_city && <p className="text-xs text-red-400">{errors.last_seen_city.message}</p>}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-300">Specific Location *</label>
                  <input className={`h-[40px] px-3 rounded-[8px] bg-slate-950 border ${errors.last_seen_location ? 'border-red-500' : 'border-slate-700'} focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm text-white`} placeholder="Market, bus stop..." {...register("last_seen_location")} />
                  {errors.last_seen_location && <p className="text-xs text-red-400">{errors.last_seen_location.message}</p>}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-300">Last Seen Date &amp; Time *</label>
                  <input type="datetime-local" className={`h-[40px] px-3 rounded-[8px] bg-slate-950 border ${errors.last_seen_date ? 'border-red-500' : 'border-slate-700'} focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm text-white`} {...register("last_seen_date")} />
                  {errors.last_seen_date && <p className="text-xs text-red-400">{errors.last_seen_date.message}</p>}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-300">Photo Upload</label>
                  <PhotoUpload onFileChange={(file) => setSelectedPhoto(file)} />
                </div>
              </div>

              {/* Section 3 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-white/5">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-300">Your Full Name *</label>
                  <input className={`h-[40px] px-3 rounded-[8px] bg-slate-950 border ${errors.contact_name ? 'border-red-500' : 'border-slate-700'} focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm text-white`} placeholder="Guardian Name" {...register("contact_name")} />
                  {errors.contact_name && <p className="text-xs text-red-400">{errors.contact_name.message}</p>}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-300">Your Phone Number *</label>
                  <input className={`h-[40px] px-3 rounded-[8px] bg-slate-950 border ${errors.contact_phone ? 'border-red-500' : 'border-slate-700'} focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm text-white font-mono`} placeholder="03XX-XXXXXXX" {...register("contact_phone")} />
                  {errors.contact_phone && <p className="text-xs text-red-400">{errors.contact_phone.message}</p>}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowReportForm(false)}
                  className="w-full sm:w-auto h-[40px] px-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-bold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createCaseMutation.isPending}
                  className="w-full sm:w-auto h-[40px] px-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg transition"
                >
                  {createCaseMutation.isPending ? "Submitting..." : "Submit Report"}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Main Citizen Portal Layout */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full pb-[48px]">
            
            {/* ─── Track My Case Sidebar ─── */}
            <div className="lg:col-span-1 w-full flex flex-col gap-6">
              <div className="bg-slate-900 border border-slate-700 rounded-[12px] p-[24px]">
                <h3 className="text-lg font-bold text-white mb-4">Track Your Case</h3>
                
                <form onSubmit={handleTrackCase} className="flex flex-col md:flex-row lg:flex-col gap-3">
                  <input
                    type="text"
                    placeholder="WJD-2026-0042"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    className="flex-1 h-[44px] px-4 rounded-lg bg-slate-950 border border-slate-700 focus:border-emerald-500 outline-none text-sm text-white font-mono uppercase"
                  />
                  <button
                    type="submit"
                    disabled={isTrackingLoading}
                    className="w-full md:w-auto lg:w-full h-[44px] px-6 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition"
                  >
                    {isTrackingLoading ? "Tracking..." : "Track"}
                  </button>
                </form>

                {trackingError && (
                  <p className="text-xs text-red-400 mt-3 font-bold">
                    {trackingError}
                  </p>
                )}
              </div>

              {/* Loaded Case Tracker Folder */}
              {trackingCase && (
                <div className="bg-slate-900 border border-emerald-500/40 rounded-[12px] p-[24px] animate-fadeIn">
                  <div className="flex justify-between items-center pb-3 border-b border-white/10">
                    <span className="text-xs font-mono font-bold text-emerald-400">{trackingCase.case_number}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-400 uppercase">{trackingCase.status}</span>
                  </div>

                  <div className="space-y-2 text-xs text-slate-300 mt-4">
                    <div><span className="text-slate-500 font-bold">Subject Name:</span> {trackingCase.person?.full_name}</div>
                    <div><span className="text-slate-500 font-bold">Last Seen City:</span> {trackingCase.last_seen_city || "N/A"}</div>
                    <div><span className="text-slate-500 font-bold">Reported On:</span> {new Date(trackingCase.created_at).toLocaleDateString()}</div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-white/10">
                    <h4 className="text-xs font-bold text-white mb-3">Investigation Logs</h4>
                    <CaseTimeline events={trackingTimeline} />
                  </div>
                </div>
              )}
            </div>

            {/* ─── Recent Cases Feed Grid ─── */}
            <div className="lg:col-span-2 w-full flex flex-col gap-6">
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <h2 className="text-xl font-bold text-white">Registry Feed</h2>
                <span className="text-xs font-mono text-slate-400">
                  Showing 3 demo cases
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                {/* Demo Card 1 */}
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                       <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                         <svg className="w-6 h-6 text-slate-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                       </div>
                       <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/20 uppercase tracking-wide">Missing</span>
                    </div>
                    <h3 className="text-sm font-bold text-white">Muhammad Ali, Age 34</h3>
                    <div className="text-xs text-slate-400 mt-1">Last Seen: Karachi — 3 days ago</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-1">Case ID: WJD-2026-0042</div>
                  </div>
                  <button onClick={() => setMapCase({} as any)} className="mt-4 w-full h-[36px] rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition">View Details</button>
                </div>

                {/* Demo Card 2 */}
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                       <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                         <svg className="w-6 h-6 text-slate-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                       </div>
                       <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/20 uppercase tracking-wide">Missing</span>
                    </div>
                    <h3 className="text-sm font-bold text-white">Zainab Bibi, Age 8</h3>
                    <div className="text-xs text-slate-400 mt-1">Last Seen: Lahore — 1 week ago</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-1">Case ID: WJD-2026-0089</div>
                  </div>
                  <button onClick={() => setMapCase({} as any)} className="mt-4 w-full h-[36px] rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition">View Details</button>
                </div>

                {/* Demo Card 3 */}
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                       <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                         <svg className="w-6 h-6 text-slate-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                       </div>
                       <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 uppercase tracking-wide">Found</span>
                    </div>
                    <h3 className="text-sm font-bold text-white">Unknown Male, Age ~45</h3>
                    <div className="text-xs text-slate-400 mt-1">Found At: PIMS Hospital, Islamabad</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-1">Case ID: WJD-2026-0102</div>
                  </div>
                  <button onClick={() => setMapCase({} as any)} className="mt-4 w-full h-[36px] rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition">View Details</button>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </PortalLayout>
  );
}
