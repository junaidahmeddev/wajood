"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface ToastItem {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface ToastContextType {
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    info: (msg: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: "success" | "error" | "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg: string) => addToast(msg, "success"),
    error: (msg: string) => addToast(msg, "error"),
    info: (msg: string) => addToast(msg, "info"),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Floating Toast Notification Stack */}
      <div className="fixed top-6 right-6 z-[100] flex flex-col gap-2.5 max-w-md pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            onClick={() => removeToast(t.id)}
            className={`pointer-events-auto p-4 rounded-xl border shadow-2xl text-xs font-bold transition-all duration-300 flex items-center justify-between gap-3 cursor-pointer animate-fade-in ${
              t.type === "success"
                ? "bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-900/95 border-emerald-500/50 text-emerald-100 shadow-emerald-950/50"
                : t.type === "error"
                ? "bg-gradient-to-r from-rose-950 via-slate-900 to-rose-900/95 border-rose-500/50 text-rose-100 shadow-rose-950/50"
                : "bg-gradient-to-r from-blue-950 via-slate-900 to-blue-900/95 border-blue-500/50 text-blue-100 shadow-blue-950/50"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-base flex-shrink-0">
                {t.type === "success" ? "✅" : t.type === "error" ? "❌" : "ℹ️"}
              </span>
              <span className="leading-relaxed">{t.message}</span>
            </div>
            <span className="text-slate-400 hover:text-white ml-2 text-xs font-mono">✕</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      toast: {
        success: (msg: string) => console.log("SUCCESS:", msg),
        error: (msg: string) => console.error("ERROR:", msg),
        info: (msg: string) => console.log("INFO:", msg),
      },
    };
  }
  return context;
}
