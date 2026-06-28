"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuthStore } from "@/store";

import PortalLayout from "@/components/shared/PortalLayout";
import api from "@/lib/api";
import { Case } from "@/types";
import { useToast } from "@/components/shared/Toast";
import PhotoUpload from "@/components/shared/PhotoUpload";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import CityFilter from "@/components/shared/CityFilter";
import CaseTimeline from "@/components/shared/CaseTimeline";
import { getStatusColor, getStatusLabel, formatDate, ALL_CITIES } from "@/lib/utils";

// Schema validation using Zod
const reportSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  age: z.coerce.number().min(0, "Age must be positive").max(120, "Age must be under 120"),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "UNKNOWN"]),
  cnic: z.string().optional().or(z.literal("")),
  last_seen_city: z.string().min(2, "City is required"),
  last_seen_location: z.string().min(4, "Last seen description is required"),
  last_seen_date: z.string().min(1, "Last seen date is required"),
  physical_description: z.string().min(4, "Physical description is required"),
  clothing_description: z.string().min(4, "Clothing description is required"),
  distinguishing_marks: z.string().optional().or(z.literal("")),
  contact_name: z.string().min(2, "Contact name is required"),
  contact_phone: z.string().min(8, "Contact phone must be valid"),
});

type ReportFields = z.infer<typeof reportSchema>;

export default function PublicPortal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<"report" | "track" | "feed" | "my-cases">("report");
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  
  // Tracking states
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingCase, setTrackingCase] = useState<Case | null>(null);
  const [trackingTimeline, setTrackingTimeline] = useState<any[]>([]);
  const [trackingError, setTrackingError] = useState("");
  const [isTrackingLoading, setIsTrackingLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Form feedback states
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [submittedCaseId, setSubmittedCaseId] = useState("");

  // Feed filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCity, setFilterCity] = useState("");

  // Fetch Cases Feed
  const { data: casesFeed = [], isLoading: isFeedLoading } = useQuery({
    queryKey: ["publicCasesFeed"],
    queryFn: async () => {
      try {
        const res = await api.getCases();
        return Array.isArray(res) ? res : [];
      } catch (err) {
        return [];
      }
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
      setSubmittedCaseId(data.case_number);
      toast.success("Case reported successfully!");
      reset();
      setSelectedPhoto(null);
      queryClient.invalidateQueries({ queryKey: ["publicCasesFeed"] });
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
    if (!selectedPhoto) {
      setFormError("Photo upload is required to submit a case.");
      toast.error("Photo upload is required.");
      return;
    }
    createCaseMutation.mutate(data);
  };

  const handleTrackCase = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrackingError("");
    setTrackingCase(null);
    setTrackingTimeline([]);
    setHasSearched(true);
    if (!trackingNumber.trim()) return;

    setIsTrackingLoading(true);
    try {
      const trackingCode = trackingNumber.trim();
      const matchedRes: any = await api.trackCase(trackingCode);
      
      if (!matchedRes) {
        return; // Empty state will be handled by UI
      }

      setTrackingCase(matchedRes);
      const timelineRes: any = await api.trackCaseTimeline(trackingCode);
      setTrackingTimeline(Array.isArray(timelineRes) ? timelineRes : []);
    } catch {
      toast.error("Failed to retrieve tracking folder telemetry. Please try again later.");
    } finally {
      setIsTrackingLoading(false);
    }
  };

  // Filter client-side for dynamic feedback
  const filteredFeed = casesFeed.filter((c: any) => {
    const matchesSearch = !searchTerm || 
      c.person?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.case_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCity = !filterCity || 
      c.last_seen_city?.toLowerCase() === filterCity.toLowerCase();
    return matchesSearch && matchesCity;
  });

  // Filter authenticated user cases
  const myCases = casesFeed.filter((c: any) => c.reported_by === user?.id);

  // Helper to resolve absolute URLs for photo display
  const getPhotoUrl = (url?: string) => {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    return `${API_BASE}${url}`;
  };

  // Timeline Step logic Helper
  const getTimelineSteps = (c: Case) => {
    const status = c.status?.toUpperCase() || "MISSING";
    const creationEvent = trackingTimeline.find((e: any) => e.event_type?.toUpperCase() === "CREATION");
    const sightingEvents = trackingTimeline.filter((e: any) => e.event_type?.toUpperCase() === "SIGHTING");
    const matchEvent = trackingTimeline.find((e: any) => 
      e.event_type?.toUpperCase() === "STATUS_UPDATE" && 
      ["MATCHED", "FOUND_ALIVE", "RESOLVED"].some(s => e.title?.toUpperCase().includes(s))
    );
    
    const isResolved = ["FOUND_ALIVE", "DECEASED", "RESOLVED"].includes(status);
    const isMatched = isResolved || status === "MATCHED";
    const isInProcess = isMatched || status === "IN_PROCESS" || status === "REPORTED" || status === "MISSING";

    return [
      {
        title: "Case Created",
        desc: "Case successfully logged onto the nationwide biometric blockchain database.",
        state: "completed",
        timestamp: creationEvent ? new Date(creationEvent.timestamp).toLocaleString() : new Date(c.created_at).toLocaleString()
      },
      {
        title: "AI Facial Matching Running",
        desc: "Facial matching telemetry scanning national hospital, NGO, and morgue records.",
        state: isMatched ? "completed" : (isInProcess ? "current" : "pending"),
        timestamp: isMatched && matchEvent ? new Date(matchEvent.timestamp).toLocaleString() : (isInProcess ? "In Progress" : null)
      },
      {
        title: "Sighting Reported",
        desc: sightingEvents.length > 0 ? `Witness sighting logs added to timeline (${sightingEvents.length} reports).` : "Witness sighting or telemetric location logs added to case timeline.",
        state: (sightingEvents.length > 0 || isMatched) ? "completed" : (isInProcess ? "current" : "pending"),
        timestamp: sightingEvents.length > 0 ? new Date(sightingEvents[sightingEvents.length - 1].timestamp).toLocaleString() : null
      },
      {
        title: "Match Found",
        desc: "AI biometric verification successful. Case successfully resolved or closed.",
        state: isResolved ? "completed" : (isMatched ? "current" : "pending"),
        timestamp: matchEvent ? new Date(matchEvent.timestamp).toLocaleString() : null
      },
    ];
  };

  return (
    <PortalLayout
      portalName="Public Citizen"
      portalIcon="👤"
      portalColor="#10b981"
      allowedRoles={[]}
    >
      <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 flex flex-col gap-8 pt-6">
        
        {/* Header Header Header */}
        <div className="flex flex-col md:flex-row items-center justify-between w-full gap-4 text-white bg-slate-900/50 p-6 rounded-2xl border border-white/5">
          <div className="text-left flex-1">
            <h1 className="text-2xl sm:text-3xl font-black mb-1">Citizen Portal</h1>
            <p className="text-slate-400 text-xs sm:text-sm">Manage missing person reports and track real-time cases.</p>
          </div>
          <div className="text-right flex-1" dir="rtl">
            <h1 className="text-3xl sm:text-4xl font-black text-emerald-400 mb-1 font-serif">شہری پورٹل</h1>
            <p className="text-slate-400 text-xs sm:text-sm font-serif">گمشدہ افراد کی تلاش اور رپورٹنگ</p>
          </div>
        </div>

        {/* Tab Buttons System */}
        <div className="flex border-b border-white/10 gap-2 overflow-x-auto scrollbar-none pb-px w-full">
          {[
            { id: "report", label: "Report" },
            { id: "track", label: "Track Case" },
            { id: "feed", label: "Cases Feed" },
            { id: "my-cases", label: "My Cases" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setFormError("");
                setFormSuccess("");
                setSubmittedCaseId("");
              }}
              className={`h-[48px] px-6 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-emerald-500 text-emerald-400 bg-white/[0.02]"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Renderers */}
        <div className="w-full min-h-[400px]">
          
          {/* ────────────────── REPORT TAB ────────────────── */}
          {activeTab === "report" && (
            <div className="bg-slate-900 border border-slate-700 p-6 sm:p-8 rounded-[12px] w-full">
              {submittedCaseId ? (
                <div className="flex flex-col items-center justify-center py-10 text-center animate-fadeIn">
                  <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center text-3xl mb-6 border border-emerald-500/30">✓</div>
                  <h2 className="text-2xl font-bold text-white mb-2">Your report has been submitted.</h2>
                  <p className="text-slate-400 mb-8 max-w-md">Thank you for taking this step.</p>
                  
                  <div className="bg-slate-950 border border-emerald-500/30 p-6 rounded-xl w-full max-w-lg mb-8">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Generated Case ID</p>
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-2xl font-mono font-bold text-emerald-400">{submittedCaseId}</span>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(submittedCaseId);
                          toast.success("Copied to clipboard!");
                        }}
                        className="text-slate-400 hover:text-white p-2 bg-white/5 rounded-lg transition-colors"
                        title="Copy to clipboard"
                      >
                        📋
                      </button>
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-left max-w-lg w-full mb-8 space-y-4">
                    <h3 className="font-bold text-white mb-2">What's Next?</h3>
                    <ul className="text-sm text-slate-300 space-y-3 list-disc pl-5">
                      <li>Your case has been added to the AI biometric registry.</li>
                      <li>We will notify you via the notification bell on the top right when a match is found.</li>
                      <li>You can monitor progress anytime using the <strong>Track Case</strong> tab with your Case ID.</li>
                      <li>Please keep this ID safe for any future communication with authorities.</li>
                    </ul>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4">
                    <button 
                      onClick={() => {
                        setActiveTab("track");
                        setTrackingNumber(submittedCaseId);
                      }}
                      className="btn-primary px-8 py-3 text-sm font-bold rounded-lg flex items-center justify-center"
                    >
                      Go to Track Case
                    </button>
                    <button 
                      onClick={() => setSubmittedCaseId("")}
                      className="btn-secondary px-8 py-3 text-sm font-bold rounded-lg border border-white/20 text-slate-300 hover:text-white hover:bg-white/5 flex items-center justify-center"
                    >
                      Report Another
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="pb-4 mb-6 border-b border-white/10">
                    <h2 className="text-xl font-bold text-white">Report Missing Person</h2>
                    <p className="text-xs text-slate-400">Please provide accurate biometric information and a clear profile photo.</p>
                  </div>

                  {formError && (
                    <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-bold animate-fadeIn">
                      ❌ {formError}
                    </div>
                  )}

                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                
                {/* Profile Information */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                    {errors.gender && <p className="text-xs text-red-400">{errors.gender.message}</p>}
                  </div>
                </div>

                {/* Telemetry and Location */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-white/5">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-300">Last Seen City *</label>
                    <select className={`h-[40px] px-3 rounded-[8px] bg-slate-950 border ${errors.last_seen_city ? 'border-red-500' : 'border-slate-700'} focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm text-white`} {...register("last_seen_city")}>
                      <option value="">Select City</option>
                      {ALL_CITIES.map(city => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                    {errors.last_seen_city && <p className="text-xs text-red-400">{errors.last_seen_city.message}</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-300">Specific Location *</label>
                    <input className={`h-[40px] px-3 rounded-[8px] bg-slate-950 border ${errors.last_seen_location ? 'border-red-500' : 'border-slate-700'} focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm text-white`} placeholder="e.g., Tariq Road, Near Market" {...register("last_seen_location")} />
                    {errors.last_seen_location && <p className="text-xs text-red-400">{errors.last_seen_location.message}</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-300">Last Seen Date &amp; Time *</label>
                    <input type="datetime-local" className={`h-[40px] px-3 rounded-[8px] bg-slate-950 border ${errors.last_seen_date ? 'border-red-500' : 'border-slate-700'} focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm text-white`} {...register("last_seen_date")} />
                    {errors.last_seen_date && <p className="text-xs text-red-400">{errors.last_seen_date.message}</p>}
                  </div>
                </div>

                {/* Additional Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-white/5">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-300">CNIC Number (Optional)</label>
                    <input className="h-[40px] px-3 rounded-[8px] bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm text-white font-mono" placeholder="42201-XXXXXXX-X" {...register("cnic")} />
                  </div>
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <label className="text-xs font-bold text-slate-300">Distinguishing Marks (Optional)</label>
                    <input className="h-[40px] px-3 rounded-[8px] bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm text-white" placeholder="e.g., mole on left cheek, scars..." {...register("distinguishing_marks")} />
                  </div>
                </div>

                {/* Descriptions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-white/5">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-300">Physical Description *</label>
                    <textarea rows={3} className={`p-3 rounded-[8px] bg-slate-950 border ${errors.physical_description ? 'border-red-500' : 'border-slate-700'} focus:border-emerald-500 outline-none text-sm text-white resize-none`} placeholder="Height, hair color, build..." {...register("physical_description")} />
                    {errors.physical_description && <p className="text-xs text-red-400">{errors.physical_description.message}</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-300">Clothing Description *</label>
                    <textarea rows={3} className={`p-3 rounded-[8px] bg-slate-950 border ${errors.clothing_description ? 'border-red-500' : 'border-slate-700'} focus:border-emerald-500 outline-none text-sm text-white resize-none`} placeholder="Color of shirt, type of shoes..." {...register("clothing_description")} />
                    {errors.clothing_description && <p className="text-xs text-red-400">{errors.clothing_description.message}</p>}
                  </div>
                </div>

                {/* Photo Upload */}
                <div className="pt-6 border-t border-white/5">
                  <div className="flex flex-col gap-2 max-w-md">
                    <label className="text-xs font-bold text-slate-300">Profile Photo Upload * (Required)</label>
                    <PhotoUpload onFileChange={(file) => setSelectedPhoto(file)} />
                    {selectedPhoto && <p className="text-xs text-emerald-400">✓ {selectedPhoto.name} selected</p>}
                  </div>
                </div>

                {/* Contact Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-white/5">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-300">Guardian/Contact Name *</label>
                    <input className={`h-[40px] px-3 rounded-[8px] bg-slate-950 border ${errors.contact_name ? 'border-red-500' : 'border-slate-700'} focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm text-white`} placeholder="Guardian Name" {...register("contact_name")} />
                    {errors.contact_name && <p className="text-xs text-red-400">{errors.contact_name.message}</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-300">Contact Phone Number *</label>
                    <input className={`h-[40px] px-3 rounded-[8px] bg-slate-950 border ${errors.contact_phone ? 'border-red-500' : 'border-slate-700'} focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm text-white font-mono`} placeholder="03XX-XXXXXXX" {...register("contact_phone")} />
                    {errors.contact_phone && <p className="text-xs text-red-400">{errors.contact_phone.message}</p>}
                  </div>
                </div>

                {/* Submit Panel */}
                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-white/10">
                  <button
                    type="submit"
                    disabled={createCaseMutation.isPending}
                    className="w-full sm:w-auto h-[44px] px-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {createCaseMutation.isPending && (
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {createCaseMutation.isPending ? "Registering Case..." : "Create Case"}
                  </button>
                </div>
              </form>
                </>
              )}
            </div>
          )}

          {/* ────────────────── TRACK CASE TAB ────────────────── */}
          {activeTab === "track" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10 w-full items-start">
              
              {/* Tracker Query Sidebar */}
              <div className="lg:col-span-1 flex flex-col gap-6 sticky top-24">
                <div className="bg-slate-900 border border-slate-700 rounded-[12px] p-6 lg:p-8">
                  <h3 className="text-lg font-bold text-white mb-2">Search Tracking Registry</h3>
                  <p className="text-xs text-slate-400 mb-4">Enter case reference number, CNIC, or full name to query state telemetry.</p>
                  
                  <form onSubmit={handleTrackCase} className="flex flex-col gap-3">
                    <input
                      type="text"
                      placeholder="e.g., WJD-2026-X1Y2Z"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      className="h-[44px] px-4 rounded-lg bg-slate-950 border border-slate-700 focus:border-emerald-500 outline-none text-sm text-white font-mono uppercase"
                    />
                    <button
                      type="submit"
                      disabled={isTrackingLoading}
                      className="h-[44px] px-6 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition flex items-center justify-center gap-2"
                    >
                      {isTrackingLoading && (
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      {isTrackingLoading ? "Searching Grid..." : "Track Case"}
                    </button>
                  </form>

                </div>
              </div>

              {/* Milestones and Telemetry Display */}
              <div className="lg:col-span-2 flex flex-col gap-6">
                {isTrackingLoading ? (
                  <div className="bg-slate-900 border border-slate-700 rounded-[12px] p-10 flex flex-col items-center justify-center min-h-[400px]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                  </div>
                ) : trackingCase ? (
                  <div className="bg-slate-900 border border-slate-700 rounded-[12px] p-8 lg:p-10 animate-fadeIn">
                    
                    {/* Case ID and badge */}
                    <div className="flex justify-between items-center pb-3 border-b border-white/10 mb-6">
                      <div className="flex flex-col">
                        <span className="text-xs font-mono font-bold text-slate-400">Tracking Code</span>
                        <span className="text-md font-bold text-white font-mono">{trackingCase.case_number}</span>
                      </div>
                      <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                        trackingCase.status === "FOUND_ALIVE" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" :
                        trackingCase.status === "MATCHED" ? "bg-amber-500/20 text-amber-400 border border-amber-500/20" :
                        trackingCase.status === "IN_PROCESS" ? "bg-blue-500/20 text-blue-400 border border-blue-500/20" :
                        "bg-red-500/20 text-red-400 border border-red-500/20"
                      }`}>
                        {getStatusLabel(trackingCase.status)}
                      </span>
                    </div>

                    {/* Meta info columns */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-xs sm:text-sm text-slate-300 mb-10 bg-slate-950 p-6 rounded-xl border border-slate-800 shadow-inner">
                      <div className="flex flex-col gap-1.5 justify-center">
                        <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Subject</span>
                        <span className="text-sm font-bold text-white">{(trackingCase as any).full_name || trackingCase.title || "Not Provided"}</span>
                      </div>
                      <div className="flex flex-col gap-1.5 justify-center">
                        <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Age</span>
                        <span className="text-sm font-bold text-white">{(trackingCase as any).age ? `${(trackingCase as any).age} Years` : "Not Provided"}</span>
                      </div>
                      <div className="flex flex-col gap-1.5 justify-center">
                        <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">City</span>
                        <span className="text-sm font-bold text-white">{trackingCase.last_seen_city || "—"}</span>
                      </div>
                      <div className="flex flex-col gap-1.5 justify-center">
                        <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Reported On</span>
                        <span className="text-sm font-bold text-white">{formatDate(trackingCase.created_at)}</span>
                      </div>
                    </div>

                    {/* Timeline Milestones */}
                    <h4 className="text-base font-bold text-white mt-4 mb-8">Vertical Investigation Milestones</h4>
                    
                    <div className="relative pl-6 border-l border-white/10 space-y-8 py-2">
                      {getTimelineSteps(trackingCase).map((step, idx) => (
                        <div key={idx} className="relative flex gap-5">
                          <div className={`absolute -left-[35px] top-0.5 w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                            step.state === 'completed'
                              ? "bg-emerald-600 border-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.5)]" 
                              : step.state === 'current'
                              ? "bg-indigo-600 border-indigo-400 text-white shadow-[0_0_15px_rgba(99,102,241,0.6)] animate-pulse"
                              : "bg-slate-950 border-slate-800 text-slate-600"
                          }`}>
                            {step.state === 'completed' ? "✓" : idx + 1}
                          </div>
                          <div className="w-full">
                            <div className="flex justify-between items-start w-full">
                              <h5 className={`text-sm font-bold leading-none mb-1 ${
                                step.state === 'completed' ? "text-emerald-400" : 
                                step.state === 'current' ? "text-indigo-400" : 
                                "text-slate-500"
                              }`}>{step.title}</h5>
                              {step.timestamp && (
                                <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                                  step.state === 'completed' ? "bg-emerald-500/10 text-emerald-500" :
                                  step.state === 'current' ? "bg-indigo-500/10 text-indigo-400 animate-pulse" :
                                  "bg-white/5 text-slate-500"
                                }`}>
                                  {step.timestamp}
                                </span>
                              )}
                            </div>
                            <p className={`text-[13px] max-w-md leading-relaxed ${
                              step.state === 'pending' ? "text-slate-600" : "text-slate-400"
                            }`}>{step.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Full Raw History Timeline if events exist */}
                    {trackingTimeline.length > 0 && (
                      <div className="pt-10 mt-10 border-t border-white/10">
                        <h4 className="text-base font-bold text-white mb-8">Detailed Action Timeline</h4>
                        {/* We use timeline directly inline here since it is already custom styled in components */}
                        <div className="relative pl-6 border-l border-white/10 space-y-6 py-2">
                          {trackingTimeline.map((event, idx) => (
                            <div key={idx} className="relative">
                              <div className="absolute -left-[35px] top-1 w-7 h-7 rounded-full border border-white/10 bg-slate-950 flex items-center justify-center text-xs">
                                📍
                              </div>
                              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                                <span className="text-[10px] font-mono text-slate-500">{new Date(event.timestamp || event.created_at).toLocaleString()}</span>
                                <h4 className="text-sm font-bold text-slate-200 mt-1">{event.title || "Timeline Update"}</h4>
                                <p className="text-xs text-slate-400 mt-1">{event.description || event.notes || ""}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                ) : (
                  hasSearched && (
                    <div className="bg-slate-900 border border-slate-700 rounded-[12px] p-10 flex flex-col items-center justify-center text-center text-slate-400 min-h-[300px]">
                      <span className="text-4xl mb-3">🔍</span>
                      <p className="text-md font-bold text-slate-300">No Case Found</p>
                      <p className="text-xs max-w-sm mt-1">We couldn&apos;t find any records matching the provided tracking reference.</p>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* ────────────────── CASES FEED TAB ────────────────── */}
          {activeTab === "feed" && (
            <div className="flex flex-col gap-6">
              
              {/* Filter controls */}
              <div className="flex flex-col sm:flex-row gap-4 bg-slate-900 border border-slate-700 p-4 rounded-xl w-full">
                <input
                  type="text"
                  placeholder="Filter by name or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 h-[40px] px-3.5 rounded-lg bg-slate-950 border border-slate-700 focus:border-indigo-500 outline-none text-sm text-white"
                />
                <div className="w-full sm:w-64">
                  <CityFilter value={filterCity} onChange={(c) => setFilterCity(c)} />
                </div>
              </div>

              {/* Feed Grid */}
              {isFeedLoading ? (
                <div className="flex items-center justify-center py-20 w-full bg-slate-900 border border-slate-700 rounded-xl min-h-[300px]">
                  <LoadingSpinner text="Connecting telemetry network..." />
                </div>
              ) : filteredFeed.length === 0 ? (
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-10 flex flex-col items-center justify-center text-center text-slate-400 min-h-[300px] w-full">
                  <span className="text-3xl mb-2 opacity-50">📭</span>
                  <p className="text-sm font-semibold">No cases found</p>
                  <p className="text-xs">There are currently no active records matching the selected filters.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                  {filteredFeed.map((c: any) => (
                    <div key={c.id} className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden flex flex-col hover:border-emerald-500/40 transition duration-200">
                      
                      {/* Card Image area with absolute badge */}
                      <div className="relative h-48 w-full bg-slate-950">
                        {c.photo_url ? (
                          <img
                            src={getPhotoUrl(c.photo_url) || ""}
                            alt={c.person?.full_name || c.full_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-1 bg-slate-950">
                            <span className="text-4xl opacity-50">👤</span>
                            <span className="text-[10px] uppercase font-bold tracking-wider">No Photo Provided</span>
                          </div>
                        )}
                        <span className={`absolute top-4 right-4 px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider shadow-md ${
                          c.status === "FOUND_ALIVE" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/20" :
                          c.status === "MATCHED" ? "bg-amber-500/20 text-amber-400 border-amber-500/20" :
                          c.status === "IN_PROCESS" ? "bg-blue-500/20 text-blue-400 border-blue-500/20" :
                          "bg-red-500/20 text-red-400 border-red-500/20"
                        }`}>
                          {getStatusLabel(c.status)}
                        </span>
                      </div>

                      {/* Card Body */}
                      <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                        <div>
                          <h3 className="text-md font-bold text-white mb-1 truncate">
                            {c.person?.full_name || c.full_name}
                          </h3>
                          <div className="text-xs text-slate-400 space-y-1 mt-2">
                            <div><span className="text-slate-600 font-bold">Age:</span> {c.person?.age_min || c.person?.age || "?"} yrs</div>
                            <div><span className="text-slate-600 font-bold">City:</span> {c.last_seen_city || c.city || "Unknown"}</div>
                            <div><span className="text-slate-600 font-bold">Last Seen Date:</span> {formatDate(c.last_seen_date)}</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-white/5">
                          <span className="text-[10px] text-slate-500 font-mono">ID: {c.case_number}</span>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ────────────────── MY CASES TAB ────────────────── */}
          {activeTab === "my-cases" && (
            <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden w-full">
              <div className="p-6 border-b border-white/10">
                <h3 className="text-lg font-bold text-white">Your Reported Cases</h3>
                <p className="text-xs text-slate-400">A historical ledger of cases submitted by your profile.</p>
              </div>

              {isFeedLoading ? (
                <div className="text-center py-20 text-slate-400 font-medium w-full">Loading your files...</div>
              ) : myCases.length === 0 ? (
                <div className="p-10 text-center text-slate-500 text-sm w-full">
                  You have not reported any cases yet.
                </div>
              ) : (
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/[0.02] text-xs font-bold text-slate-400 uppercase tracking-wider">
                        <th className="p-4">Case #</th>
                        <th className="p-4">Name</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Date Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-sm text-slate-300">
                      {myCases.map((c: any) => (
                        <tr key={c.id} className="hover:bg-white/[0.01] transition">
                          <td className="p-4 font-mono text-xs font-bold text-indigo-400">{c.case_number}</td>
                          <td className="p-4 font-semibold text-white">{c.person?.full_name || c.full_name}</td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider" style={{
                              borderColor: `${getStatusColor(c.status)}20`,
                              backgroundColor: `${getStatusColor(c.status)}20`,
                              color: getStatusColor(c.status),
                            }}>
                              {getStatusLabel(c.status)}
                            </span>
                          </td>
                          <td className="p-4 text-xs text-slate-500">{formatDate(c.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </PortalLayout>
  );
}
