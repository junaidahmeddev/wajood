"use client";

import { useState, useEffect, useRef, ChangeEvent } from "react";
import api from "@/lib/api";
import { Case } from "@/types";

interface SearchBarProps {
  onSearchSubmit?: (query: string) => void;
  onSelectCase?: (c: Case) => void;
  placeholder?: string;
  value?: string;
  onChange?: (q: string) => void;
}

export default function SearchBar({ onSearchSubmit, onSelectCase, placeholder = "Search by name, marks or case number...", value, onChange }: SearchBarProps) {
  const [internalQuery, setInternalQuery] = useState("");
  const query = value !== undefined ? value : internalQuery;
  const setQuery = (q: string) => {
    setInternalQuery(q);
    if (onChange) onChange(q);
  };
  const [suggestions, setSuggestions] = useState<Case[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced search for suggestions
  useEffect(() => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        // Query the list endpoint
        const res = await api.getCases({ search: query, per_page: "5" });
        // The endpoint list_cases returns list[MissingPersonResponse] directly
        const caseList = Array.isArray(res) ? res : ((res as any).cases || []);
        setSuggestions(caseList);
      } catch (e) {
        console.error("Suggestions fetch error:", e);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside to close dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setShowDropdown(true);
  };

  const handleSuggestionClick = (c: Case) => {
    setQuery(c.person?.full_name || c.case_number);
    setSuggestions([]);
    setShowDropdown(false);
    if (onSelectCase) onSelectCase(c);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowDropdown(false);
    if (onSearchSubmit) onSearchSubmit(query);
  };

  return (
    <div className="relative w-full max-w-xl mx-auto" ref={dropdownRef}>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5 w-full">
        <div className="relative flex-1 w-full">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={() => setShowDropdown(true)}
            placeholder={placeholder}
            className="form-input pl-11 w-full min-h-[44px]"
            id="global-search-bar"
          />
          {loading && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-500 animate-pulse">
              Matching...
            </span>
          )}
        </div>
        <button type="submit" className="btn-primary min-h-[44px] px-6 py-2.5 w-full sm:w-auto shrink-0 flex items-center justify-center font-bold">
          <span>Search</span>
        </button>
      </form>

      {/* Autocomplete Dropdown Overlay */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 mt-2 bg-slate-950/90 border border-white/10 rounded-xl shadow-2xl z-50 divide-y divide-white/5 backdrop-blur-xl max-h-60 overflow-y-auto">
          {suggestions.map((c) => (
            <div
              key={c.id}
              onClick={() => handleSuggestionClick(c)}
              className="p-3 hover:bg-white/[0.04] transition cursor-pointer flex items-center justify-between"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-slate-200">{c.person?.full_name || "Unknown Person"}</span>
                <span className="text-[10px] text-slate-500 font-mono">Case: {c.case_number}</span>
              </div>
              <span className="text-[10px] text-indigo-400 font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 uppercase tracking-wide">
                {c.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
