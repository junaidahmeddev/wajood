"use client";

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const norm = (status || "").toUpperCase();

  let color = "text-gray-400 bg-gray-400/10 border-gray-400/20";
  let label = status || "نامعلوم Unknown";

  if (norm === "MISSING" || norm === "OPEN") {
    color = "text-red-400 bg-red-400/10 border-red-400/20";
    label = "گمشدہ Missing";
  } else if (norm === "FOUND" || norm === "FOUND_ALIVE") {
    color = "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
    label = "زندہ ملا Found Alive";
  } else if (norm === "RESOLVED") {
    color = "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
    label = "حل شدہ Resolved";
  } else if (norm === "MATCHED") {
    color = "text-amber-400 bg-amber-400/10 border-amber-400/20";
    label = "میچ ہوا Matched";
  } else if (norm === "IN_PROCESS" || norm === "UNDER_INVESTIGATION" || norm === "ACTIVE") {
    color = "text-indigo-400 bg-indigo-400/10 border-indigo-400/20";
    label = "زیر تفتیش In Process";
  } else if (norm === "DECEASED") {
    color = "text-rose-600 bg-rose-500/10 border-rose-500/20";
    label = "وفات Deceased";
  } else if (norm === "CLOSED") {
    color = "text-slate-400 bg-slate-400/10 border-slate-400/20";
    label = "بند Closed";
  } else if (norm === "UNIDENTIFIED") {
    color = "text-purple-400 bg-purple-400/10 border-purple-400/20";
    label = "نامعلوم Unidentified";
  } else if (norm === "RETURNED") {
    color = "text-teal-400 bg-teal-400/10 border-teal-400/20";
    label = "واپس Returned";
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border font-sans tracking-wide whitespace-nowrap ${color}`}>
      {label}
    </span>
  );
}
