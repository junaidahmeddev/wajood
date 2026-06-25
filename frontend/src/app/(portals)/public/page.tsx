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
import CaseCard from "@/components/shared/CaseCard";
import PhotoUpload from "@/components/shared/PhotoUpload";
import CaseTimeline from "@/components/shared/CaseTimeline";
import { useToast } from "@/components/shared/Toast";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import EmptyState from "@/components/shared/EmptyState";

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

  // Filter & Feed state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [showReportForm, setShowReportForm] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);

  // Status tracking state
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingCase, setTrackingCase] = useState<Case | null>(null);
  const [trackingTimeline, setTrackingTimeline] = useState<any[]>([]);
  const [trackingError, setTrackingError] = useState("");
  const [isTrackingLoading, setIsTrackingLoading] = useState(false);

  // Sighting map state
  const [mapCase, setMapCase] = useState<Case | null>(null);

  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Fetch live stats
  const { data: stats } = useQuery({
    queryKey: ["publicStats"],
    queryFn: () => api.getDashboardStats(),
  });

  // Fetch missing persons list
  const { data: casesList = [], isLoading } = useQuery({
    queryKey: ["publicCases", searchTerm, filterCity],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (searchTerm) params.search = searchTerm;
      if (filterCity) params.city = filterCity;
      const res: any = await api.getCases(params);
      return Array.isArray(res) ? res : [];
    },
  });

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
      queryClient.invalidateQueries({ queryKey: ["publicCases"] });
      queryClient.invalidateQueries({ queryKey: ["publicStats"] });
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
      portalName="Public Citizen Registry"
      portalIcon="🇵🇰"
      portalColor="#10b981"
      allowedRoles={[]}
    >
      <div className="space-y-16 py-4">
        
        {/* ─── Hero Section ─── */}
        <div className="text-center max-w-4xl mx-auto space-y-6 px-4">
          <div className="inline-block px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-2">
            National Missing Registry
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white">
            WAJOOD <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-green-500 bg-clip-text text-transparent">وجود</span>
          </h1>

          <div className="space-y-3 max-w-2xl mx-auto">
            <p className="text-slate-200 text-lg sm:text-xl font-bold tracking-tight">
              Pakistan&apos;s National Registry for Missing &amp; Found Persons
            </p>
            <p className="text-emerald-400 text-xl sm:text-2xl font-extrabold font-serif leading-relaxed" dir="rtl">
              پاکستان کا قومی ریکارڈ برائے گمشدہ و بازیاب افراد
            </p>
          </div>

          <div className="pt-6 max-w-2xl mx-auto">
            <SearchBar
              onSearchSubmit={(q) => setSearchTerm(q)}
              placeholder="Search registry by missing person name, CNIC, or Case ID (e.g. WJD-)..."
            />
          </div>
        </div>

        {/* ─── 3 Stat Boxes ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto w-full">
          {[
            { label: "Total Missing Reported", val: (stats as any)?.active_cases ?? (stats as any)?.total_cases ?? 0, icon: "🚨", color: "from-red-500/20 to-rose-950/20", border: "border-red-500/30", textColor: "text-red-400" },
            { label: "Found / Resolved", val: (stats as any)?.resolved_cases ?? 0, icon: "🛡️", color: "from-emerald-500/20 to-teal-950/20", border: "border-emerald-500/30", textColor: "text-emerald-400" },
            { label: "AI Biometric Matches", val: (stats as any)?.total_matches ?? 0, icon: "⚡", color: "from-amber-500/20 to-yellow-950/20", border: "border-amber-500/30", textColor: "text-amber-400" },
          ].map((box) => (
            <div key={box.label} className={`saas-card p-5 sm:p-6 bg-gradient-to-br ${box.color} border ${box.border} relative overflow-hidden shadow-xl transition duration-300`}>
              <div className="flex justify-between items-start mb-3">
                <span className="text-2xl sm:text-3xl">{box.icon}</span>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Live Metrics</span>
              </div>
              <div className={`text-3xl sm:text-4xl font-extrabold ${box.textColor} mb-1 font-mono`}>{box.val}</div>
              <div className="text-xs font-bold text-slate-300">{box.label}</div>
            </div>
          ))}
        </div>

        {/* ─── Action Controls Bar ─── */}
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 border-y border-white/10 py-4 sm:py-6 saas-card px-4 sm:px-6">
          <button
            onClick={() => { setShowReportForm(!showReportForm); setTrackingCase(null); }}
            className={`w-full sm:w-auto min-h-[48px] px-6 py-3.5 rounded-xl font-bold text-xs sm:text-sm shadow-lg flex items-center justify-center gap-2.5 transition shrink-0 ${showReportForm ? "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-white/10" : "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-500/20"}`}
            id="public-toggle-report-btn"
          >
            <span className="text-lg shrink-0">{showReportForm ? "📂" : "🚨"}</span>
            <span className="truncate">{showReportForm ? "Return to Active Feed" : "Report Missing Person (قومی گمشدہ رپورٹ)"}</span>
          </button>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <CityFilter value={filterCity} onChange={(c) => setFilterCity(c)} />
          </div>
        </div>

        {/* Success Banner */}
        {formSuccess && (
          <div className="max-w-4xl mx-auto p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm font-bold shadow-lg shadow-emerald-500/5 animate-fadeIn">
            ✅ {formSuccess}
          </div>
        )}

        {/* Sighting Map Modal */}
        {mapCase && (
          <div className="max-w-4xl mx-auto glass-card p-6 border-emerald-500/40 glow-emerald space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center">
              <h3 className="text-md font-bold text-emerald-400">📍 Geo-Telemetry Sighting Map: {mapCase.person?.full_name}</h3>
              <button
                onClick={() => setMapCase(null)}
                className="px-4 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-slate-300"
              >
                Close Map ✕
              </button>
            </div>
            <LeafletMap markerTitle={`Last Seen: ${mapCase.last_seen_location || "Verified Location"}`} />
          </div>
        )}

        {/* ─── View Switcher: Report Form vs Main Feed ─── */}
        {showReportForm ? (
          <div className="glass-card p-8 sm:p-10 max-w-4xl mx-auto border-emerald-500/30 shadow-2xl bg-slate-950/80">
            <div className="border-b border-white/10 pb-6 mb-8">
              <h2 className="text-2xl font-black text-white flex items-center gap-3">
                <span>📝 File Official Disappearance Report</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">Please provide accurate biographical and last seen information. False reporting is subject to penalty.</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
              {formError && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold">
                  ❌ {formError}
                </div>
              )}

              {/* Section 1 */}
              <div className="space-y-4">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-emerald-400">1. Missing Person Demographics</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="form-label" htmlFor="mp-name">Full Name *</label>
                    <input id="mp-name" className="form-input font-semibold" placeholder="Enter full name" {...register("full_name")} />
                    {errors.full_name && <p className="text-xs text-red-400 mt-1">{errors.full_name.message}</p>}
                  </div>
                  <div>
                    <label className="form-label" htmlFor="mp-age">Age *</label>
                    <input id="mp-age" type="number" className="form-input font-semibold" placeholder="Years" {...register("age")} />
                    {errors.age && <p className="text-xs text-red-400 mt-1">{errors.age.message}</p>}
                  </div>
                  <div>
                    <label className="form-label" htmlFor="mp-gender">Gender *</label>
                    <select id="mp-gender" className="form-select font-semibold" {...register("gender")}>
                      <option value="UNKNOWN">Select gender</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="form-label" htmlFor="mp-cnic">CNIC Number (Optional)</label>
                    <input id="mp-cnic" className="form-input font-mono" placeholder="42201-XXXXXXX-X" {...register("cnic")} />
                  </div>
                  <div>
                    <PhotoUpload onFileChange={(file) => setSelectedPhoto(file)} />
                  </div>
                </div>
              </div>

              {/* Section 2 */}
              <div className="space-y-4 pt-6 border-t border-white/5">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-emerald-400">2. Last Seen Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="form-label" htmlFor="mp-city">City Province *</label>
                    <select id="mp-city" className="form-select font-semibold" {...register("last_seen_city")}>
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
                    {errors.last_seen_city && <p className="text-xs text-red-400 mt-1">{errors.last_seen_city.message}</p>}
                  </div>
                  <div>
                    <label className="form-label" htmlFor="mp-loc">Specific Location Description *</label>
                    <input id="mp-loc" className="form-input font-semibold" placeholder="Market, bus stop, intersection..." {...register("last_seen_location")} />
                    {errors.last_seen_location && <p className="text-xs text-red-400 mt-1">{errors.last_seen_location.message}</p>}
                  </div>
                  <div>
                    <label className="form-label" htmlFor="mp-date">Last Seen Date &amp; Time *</label>
                    <input id="mp-date" type="datetime-local" className="form-input font-mono text-xs" {...register("last_seen_date")} />
                    {errors.last_seen_date && <p className="text-xs text-red-400 mt-1">{errors.last_seen_date.message}</p>}
                  </div>
                </div>
              </div>

              {/* Section 3 */}
              <div className="space-y-4 pt-6 border-t border-white/5">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-emerald-400">3. Physical Characteristics</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="form-label" htmlFor="mp-marks">Distinguishing Marks</label>
                    <textarea id="mp-marks" className="form-input min-h-[80px]" placeholder="Scar, birthmark, glasses..." {...register("distinguishing_marks")} />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="mp-clothing">Clothing Description</label>
                    <textarea id="mp-clothing" className="form-input min-h-[80px]" placeholder="Kurta color, jacket..." {...register("clothing_description")} />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="mp-phys">General Build &amp; Height</label>
                    <textarea id="mp-phys" className="form-input min-h-[80px]" placeholder="e.g. 5'8, slim build" {...register("physical_description")} />
                  </div>
                </div>
              </div>

              {/* Section 4 */}
              <div className="space-y-4 pt-6 border-t border-white/5">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-emerald-400">4. Informant Contact Verification</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label" htmlFor="mp-contact-name">Your Full Name *</label>
                    <input id="mp-contact-name" className="form-input font-semibold" placeholder="Guardian / Relative Name" {...register("contact_name")} />
                    {errors.contact_name && <p className="text-xs text-red-400 mt-1">{errors.contact_name.message}</p>}
                  </div>
                  <div>
                    <label className="form-label" htmlFor="mp-contact-phone">Your Phone Number *</label>
                    <input id="mp-contact-phone" className="form-input font-mono" placeholder="03XX-XXXXXXX" {...register("contact_phone")} />
                    {errors.contact_phone && <p className="text-xs text-red-400 mt-1">{errors.contact_phone.message}</p>}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-8 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowReportForm(false)}
                  className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createCaseMutation.isPending}
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition"
                >
                  {createCaseMutation.isPending ? "Submitting Official Report..." : "Submit National Missing Report 🚨"}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Main Citizen Portal Layout */
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
            
            {/* ─── Track My Case Sidebar ─── */}
            <div className="space-y-6 lg:col-span-1 w-full">
              <div className="saas-card p-6 border-emerald-500/30 bg-gradient-to-b from-emerald-950/20 to-black/40 shadow-xl">
                <h3 className="text-lg font-extrabold text-emerald-400 mb-2 flex items-center gap-2">
                  <span>🔍 Track My Case</span>
                </h3>
                <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                  Enter your official WAJOOD tracking reference below to monitor field officer updates and forensic AI investigations.
                </p>

                <form onSubmit={handleTrackCase} className="space-y-3">
                  <input
                    type="text"
                    placeholder="WJD-2026-XXXXX"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    className="form-input font-mono text-center text-sm tracking-widest text-emerald-300 bg-black/50 border-emerald-500/30 focus:border-emerald-400 font-bold uppercase min-h-[44px]"
                  />
                  <button
                    type="submit"
                    disabled={isTrackingLoading}
                    className="w-full min-h-[44px] py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center"
                  >
                    {isTrackingLoading ? "Decrypting Folder..." : "Track Live Status"}
                  </button>
                </form>

                {trackingError && (
                  <p className="text-xs text-red-400 mt-4 font-bold text-center">
                    ❌ {trackingError}
                  </p>
                )}
              </div>

              {/* Loaded Case Tracker Folder */}
              {trackingCase && (
                <div className="saas-card p-6 border-emerald-500/40 space-y-4 animate-fadeIn bg-black/60">
                  <div className="flex justify-between items-center pb-3 border-b border-white/10">
                    <span className="text-xs font-mono font-bold text-emerald-400">{trackingCase.case_number}</span>
                    <span className="badge badge-medium text-[10px] uppercase">{trackingCase.status}</span>
                  </div>

                  <div className="space-y-2 text-xs text-slate-300">
                    <div><span className="text-slate-500 font-bold">Subject Name:</span> {trackingCase.person?.full_name}</div>
                    <div><span className="text-slate-500 font-bold">Last Seen City:</span> {trackingCase.last_seen_city || "N/A"}</div>
                    <div><span className="text-slate-500 font-bold">Reported On:</span> {new Date(trackingCase.created_at).toLocaleDateString()}</div>
                  </div>

                  <div className="pt-3 border-t border-white/10">
                    <h4 className="text-xs font-bold text-emerald-400 mb-3">📍 Timeline Investigation Logs</h4>
                    <CaseTimeline events={trackingTimeline} />
                  </div>
                </div>
              )}
            </div>

            {/* ─── Recent Cases Feed Grid ─── */}
            <div className="lg:col-span-2 space-y-6 w-full">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border-b border-white/10 pb-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-white">Active National Registry Feed</h2>
                  <p className="text-xs text-slate-400">Real-time verified missing citizen broadcast cards</p>
                </div>
                <span className="text-xs font-mono px-3 py-1 bg-white/5 rounded-full text-slate-300 self-start sm:self-auto border border-white/10">
                  Showing {casesList.length} alerts
                </span>
              </div>

              {isLoading ? (
                <LoadingSpinner text="Synchronizing national missing database..." />
              ) : casesList.length === 0 ? (
                <EmptyState title="No cases found" icon="📂" description="No active missing citizen records matching specified search filters." />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 w-full">
                  {casesList.map((c: Case) => (
                    <CaseCard
                      key={c.id}
                      caseData={c}
                      onViewMap={(matchedCase) => setMapCase(matchedCase)}
                    />
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </PortalLayout>
  );
}
