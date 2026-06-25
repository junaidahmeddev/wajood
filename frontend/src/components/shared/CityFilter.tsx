"use client";

import { PAKISTAN_PROVINCES } from "@/lib/utils";

interface CityFilterProps {
  value: string;
  onChange: (city: string) => void;
  label?: string;
}

export default function CityFilter({ value, onChange, label = "Filter by City" }: CityFilterProps) {
  // Extract all unique districts/cities alphabetically
  const allCities = Array.from(
    new Set(PAKISTAN_PROVINCES.flatMap((p) => p.districts))
  ).sort();

  return (
    <div className="w-full">
      {label && <label className="block text-[13px] font-semibold text-slate-400 mb-1.5">{label}</label>}
      <div className="relative w-full">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="form-select w-full h-[40px] rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition px-3 py-0 text-sm text-slate-200 appearance-none pr-10"
          id="city-filter-dropdown"
        >
          <option value="">All Pakistan Cities</option>
          {allCities.map((city) => (
            <option key={city} value={city} className="bg-slate-950 text-slate-200">
              {city}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </div>
      </div>
    </div>
  );
}
