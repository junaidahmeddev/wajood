"use client";

import React from "react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: string;
}

export default function EmptyState({
  title = "No cases found",
  description = "There are currently no records matching your search query or active category.",
  icon = "📂",
}: EmptyStateProps) {
  return (
    <div className="glass-card p-14 text-center border-white/5 bg-slate-950/40 flex flex-col items-center justify-center gap-3 w-full my-4 rounded-2xl">
      <span className="text-4xl mb-1 opacity-80 animate-bounce">{icon}</span>
      <h4 className="text-sm font-bold text-slate-200">{title}</h4>
      {description && <p className="text-xs text-slate-500 max-w-sm leading-relaxed">{description}</p>}
    </div>
  );
}
