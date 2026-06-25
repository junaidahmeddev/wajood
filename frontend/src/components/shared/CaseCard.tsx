"use client";

import { Case } from "@/types";
import StatusBadge from "./StatusBadge";
import { formatDate } from "@/lib/utils";

interface CaseCardProps {
  caseData: Case;
  onViewMap?: (c: Case) => void;
  onViewDetails?: (c: Case) => void;
}

export default function CaseCard({ caseData, onViewMap, onViewDetails }: CaseCardProps) {
  const { person, case_number, status, last_seen_location, last_seen_date, created_at } = caseData;
  const name = person?.full_name || "Unknown";
  const photo = person?.photo_url;
  
  // Calculate days missing
  let daysMissingText = "Date unknown";
  if (last_seen_date) {
    const elapsedMs = new Date().getTime() - new Date(last_seen_date).getTime();
    const days = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
    if (days < 0) {
      daysMissingText = "Future date reported";
    } else if (days === 0) {
      daysMissingText = "Missing since today";
    } else if (days === 1) {
      daysMissingText = "Missing for 1 day";
    } else {
      daysMissingText = `Missing for ${days} days`;
    }
  }

  return (
    <div className="saas-card flex flex-col h-full overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-indigo-500/40 w-full">
      {/* Visual Header / Photo */}
      <div className="relative h-48 bg-white/[0.01] border-b border-white/5 flex items-center justify-center overflow-hidden shrink-0">
        {photo ? (
          <img
            src={photo.startsWith("http") ? photo : `http://localhost:8000${photo}`}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 opacity-30">
            <span className="text-5xl">👤</span>
            <span className="text-xs uppercase tracking-wider font-mono">No Image</span>
          </div>
        )}
        
        {/* Status Badge Positioned on Top Right */}
        <div className="absolute top-3 right-3 z-10">
          <StatusBadge status={status} />
        </div>

        {/* Days missing overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-6">
          <span className="text-xs text-red-400 font-semibold tracking-wide uppercase">
            ⚠️ {daysMissingText}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-mono text-indigo-400 font-semibold">
              {case_number}
            </span>
          </div>
          <h3 className="text-lg font-bold text-slate-100 line-clamp-1 mb-3">
            {name}
          </h3>

          <div className="space-y-2 text-xs text-slate-400">
            <div>
              <span className="font-semibold text-slate-300">Age: </span>
              {person?.age_min !== undefined && person?.age_max !== undefined ? (
                `${person.age_min} - ${person.age_max} years`
              ) : person?.age_min !== undefined ? (
                `${person.age_min} years`
              ) : (
                "Not specified"
              )}
            </div>
            <div className="line-clamp-2">
              <span className="font-semibold text-slate-300">Last Seen: </span>
              {last_seen_location || "Not specified"}
            </div>
            {person?.distinguishing_marks && (
              <div className="line-clamp-1">
                <span className="font-semibold text-slate-300">Marks: </span>
                {person.distinguishing_marks}
              </div>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="mt-5 pt-4 border-t border-white/5 flex gap-2.5 items-center justify-end">
          {onViewMap && (
            <button
              onClick={() => onViewMap(caseData)}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-200 font-bold transition flex items-center justify-center flex-1 border border-white/5"
            >
              📍 Sighting Map
            </button>
          )}
          {onViewDetails && (
            <button
              onClick={() => onViewDetails(caseData)}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-bold transition flex items-center justify-center flex-1 shadow-md"
            >
              Details →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
