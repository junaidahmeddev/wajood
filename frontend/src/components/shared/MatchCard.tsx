"use client";

import { MatchResult } from "@/types";

interface MatchCardProps {
  match: MatchResult;
  onConfirm?: (matchId: string) => void;
  onReject?: (matchId: string) => void;
}

export default function MatchCard({ match, onConfirm, onReject }: MatchCardProps) {
  const { id, confidence_score, status, missing_person, matched_person, found_person } = match;
  
  // Backends might populate matched_person or found_person depending on endpoint.
  const fp = found_person || matched_person;
  const mp = missing_person;

  const scorePercent = Math.min(100, Math.max(0, Math.round(confidence_score * 100)));

  let confidenceColor = "bg-red-500";
  let confidenceText = "Low Match";
  if (confidence_score >= 0.85) {
    confidenceColor = "bg-emerald-500";
    confidenceText = "High Confidence AI Match";
  } else if (confidence_score >= 0.75) {
    confidenceColor = "bg-amber-500";
    confidenceText = "Moderate Match";
  }

  const getFullPhotoUrl = (url?: string) => {
    if (!url) return null;
    return url.startsWith("http") ? url : `http://localhost:8000${url}`;
  };

  return (
    <div className="glass-card p-6 border border-white/5 bg-white/[0.01]">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <span className="text-xs font-semibold text-indigo-400 font-mono">Match ID: {id}</span>
          <h4 className="text-sm font-bold text-slate-300 mt-1">{confidenceText} ({scorePercent}%)</h4>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
          status === "CONFIRMED" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
          status === "REJECTED" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
          "bg-amber-500/10 text-amber-400 border border-amber-500/20"
        }`}>
          {status}
        </span>
      </div>

      {/* Side-by-Side Photos */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Missing Person Profile */}
        <div className="bg-slate-950/40 p-3 rounded-lg border border-white/5 flex flex-col items-center">
          <span className="text-[10px] uppercase font-mono text-rose-400 font-semibold mb-2">🔍 Missing Person</span>
          <div className="w-full h-36 bg-slate-900 rounded overflow-hidden flex items-center justify-center mb-3">
            {mp?.photo_url ? (
              <img src={getFullPhotoUrl(mp.photo_url)!} alt="Missing" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl opacity-20">👤</span>
            )}
          </div>
          <div className="text-center w-full">
            <h5 className="text-xs font-bold text-slate-200 line-clamp-1">{mp?.full_name || "Unknown"}</h5>
            <p className="text-[10px] text-slate-400 mt-1">Age: {(mp as any)?.age || `${mp?.age_min || "?"} - ${mp?.age_max || "?"}`} | {mp?.gender}</p>
            <p className="text-[10px] text-indigo-400 mt-0.5 line-clamp-1">📍 {(mp as any)?.last_seen_city || mp?.city || "Pakistan"} | {(mp as any)?.last_seen_location || "Area N/A"}</p>
          </div>
        </div>

        {/* Found Person Profile */}
        <div className="bg-slate-950/40 p-3 rounded-lg border border-white/5 flex flex-col items-center">
          <span className="text-[10px] uppercase font-mono text-emerald-400 font-semibold mb-2">🟢 Found Remains / Patient</span>
          <div className="w-full h-36 bg-slate-900 rounded overflow-hidden flex items-center justify-center mb-3">
            {fp?.photo_url ? (
              <img src={getFullPhotoUrl(fp.photo_url)!} alt="Found" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl opacity-20">👤</span>
            )}
          </div>
          <div className="text-center w-full">
            <h5 className="text-xs font-bold text-slate-200 line-clamp-1">{fp?.full_name || fp?.physical_description || "Unidentified"}</h5>
            <p className="text-[10px] text-slate-400 mt-1">Approx. Age: {(fp as any)?.approximate_age || fp?.age_min || "N/A"} | {fp?.gender}</p>
            <p className="text-[10px] text-emerald-400 mt-0.5 line-clamp-1">📍 {fp?.found_city || fp?.city || "Pakistan"} | {fp?.found_location || "Area N/A"}</p>
          </div>
        </div>
      </div>

      {/* Confidence Score Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-slate-400 mb-2 font-mono">
          <span>Match Confidence</span>
          <span>{scorePercent}%</span>
        </div>
        <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-white/5">
          <div className={`h-full ${confidenceColor} transition-all duration-500`} style={{ width: `${scorePercent}%` }} />
        </div>
      </div>

      {/* Officer Confirmation Controls */}
      {status === "PENDING" && (onConfirm || onReject) && (
        <div className="flex gap-3 justify-end border-t border-white/5 pt-4">
          {onReject && (
            <button
              onClick={() => onReject(id)}
              className="px-4 py-2 rounded-lg bg-red-950/30 hover:bg-red-900/50 border border-red-500/20 text-xs font-semibold text-red-400 transition"
            >
              Reject Match ❌
            </button>
          )}
          {onConfirm && (
            <button
              onClick={() => onConfirm(id)}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition"
            >
              Confirm Match ✓
            </button>
          )}
        </div>
      )}
    </div>
  );
}
