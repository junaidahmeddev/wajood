"use client";

import { PAKISTAN_PROVINCES } from "@/lib/utils";

interface CityFilterProps {
  value: string;
  onChange: (city: string) => void;
  label?: string;
}

export default function CityFilter({ value, onChange, label = "Filter by Pakistani City" }: CityFilterProps) {
  // Extract all unique districts/cities alphabetically
  const allCities = Array.from(
    new Set(PAKISTAN_PROVINCES.flatMap((p) => p.districts))
  ).sort();

  return (
    <div className="w-full">
      {label && <label className="block text-xs font-semibold text-slate-400 mb-1.5">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="form-select w-full rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition p-2.5 text-sm text-slate-200"
        id="city-filter-dropdown"
      >
        <option value="">All Pakistan Cities</option>
        {allCities.map((city) => (
          <option key={city} value={city} className="bg-slate-950 text-slate-200">
            {city}
          </option>
        ))}
      </select>
    </div>
  );
}
