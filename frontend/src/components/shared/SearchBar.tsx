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
    <div className="relative w-full mx-auto" ref={dropdownRef}>
      <form onSubmit={handleSubmit} className="relative flex items-center w-full h-[48px] bg-slate-900 border border-slate-700 hover:border-slate-500 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 rounded-[10px] overflow-hidden transition px-2">
        <div className="flex items-center justify-center pl-2 text-slate-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setShowDropdown(true)}
          placeholder={placeholder}
          className="flex-1 h-full bg-transparent border-none outline-none px-3 text-sm text-white placeholder-slate-400"
          id="global-search-bar"
        />
        {loading && (
          <span className="text-xs text-slate-500 animate-pulse mr-3">
            Matching...
          </span>
        )}
        <button type="submit" className="h-[36px] px-6 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition shrink-0">
          Search
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
