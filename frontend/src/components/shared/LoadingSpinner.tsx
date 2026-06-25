"use client";

import React from "react";

interface LoadingSpinnerProps {
  text?: string;
  size?: "sm" | "md" | "lg";
}

export default function LoadingSpinner({ text = "Loading records...", size = "md" }: LoadingSpinnerProps) {
  const spinnerClass =
    size === "sm" ? "w-5 h-5 border-2" : size === "lg" ? "w-10 h-10 border-4" : "w-8 h-8 border-3";

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3.5 w-full">
      <div
        className={`${spinnerClass} rounded-full border-slate-800 border-t-emerald-400 animate-spin shadow-lg shadow-emerald-500/10`}
      />
      {text && <span className="text-xs font-mono text-slate-400 animate-pulse tracking-wide">{text}</span>}
    </div>
  );
}
