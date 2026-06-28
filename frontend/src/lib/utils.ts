/* ═══════════════════════════════════════════════
   WAJOOD — Utility Functions & Pakistan Data
   ═══════════════════════════════════════════════ */

import { CaseStatus, CasePriority, Province } from "@/types";

// ─── Pakistan Provinces & Districts ───
export const PAKISTAN_PROVINCES: Province[] = [
  {
    name: "Punjab",
    districts: ["Lahore", "Rawalpindi", "Faisalabad", "Multan", "Gujranwala", "Sialkot", "Bahawalpur", "Sargodha", "Sheikhupura", "Rahim Yar Khan", "Jhang", "Dera Ghazi Khan", "Gujrat", "Sahiwal", "Kasur", "Okara", "Mianwali", "Chiniot", "Hafizabad", "Jhelum", "Attock", "Vehari", "Khanewal", "Muzaffargarh", "Rajanpur", "Lodhran", "Pakpattan", "Bahawalnagar", "Narowal", "Chakwal", "Toba Tek Singh", "Nankana Sahib", "Mandi Bahauddin", "Bhakkar", "Khushab", "Layyah"],
  },
  {
    name: "Sindh",
    districts: ["Karachi", "Hyderabad", "Sukkur", "Larkana", "Nawabshah", "Mirpur Khas", "Thatta", "Badin", "Dadu", "Jacobabad", "Shikarpur", "Khairpur", "Sanghar", "Umerkot", "Ghotki", "Tharparkar", "Kashmore", "Kambar Shahdadkot", "Tando Allahyar", "Tando Muhammad Khan", "Jamshoro", "Matiari", "Sujawal"],
  },
  {
    name: "Khyber Pakhtunkhwa",
    districts: ["Peshawar", "Mardan", "Abbottabad", "Swat", "Mansehra", "Haripur", "Nowshera", "Charsadda", "Kohat", "Bannu", "Dera Ismail Khan", "Swabi", "Dir Lower", "Dir Upper", "Malakand", "Buner", "Shangla", "Battagram", "Hangu", "Karak", "Lakki Marwat", "Tank", "Chitral", "Torghar", "Kolai-Pallas"],
  },
  {
    name: "Balochistan",
    districts: ["Quetta", "Gwadar", "Turbat", "Khuzdar", "Hub", "Zhob", "Sibi", "Chaman", "Pishin", "Loralai", "Kalat", "Mastung", "Nushki", "Panjgur", "Washuk", "Awaran", "Kech", "Lasbela", "Bolan", "Jaffarabad", "Nasirabad", "Dera Bugti", "Kohlu", "Ziarat", "Harnai", "Musakhel", "Sherani", "Barkhan"],
  },
  {
    name: "Islamabad Capital Territory",
    districts: ["Islamabad"],
  },
  {
    name: "Azad Jammu & Kashmir",
    districts: ["Muzaffarabad", "Mirpur", "Bhimber", "Kotli", "Rawalakot", "Bagh", "Haveli", "Sudhanoti", "Neelum", "Jhelum Valley"],
  },
  {
    name: "Gilgit-Baltistan",
    districts: ["Gilgit", "Skardu", "Diamer", "Astore", "Ghanche", "Shigar", "Kharmang", "Hunza", "Nagar", "Ghizer"],
  },
];

// Flat list of all cities for dropdowns (sorted alphabetically)
export const ALL_CITIES = PAKISTAN_PROVINCES
  .flatMap(p => p.districts)
  .sort((a, b) => a.localeCompare(b));

// ─── Status Colors & Labels ───
export function getStatusColor(status: CaseStatus): string {
  const colors: Record<CaseStatus, string> = {
    open: "#6366f1",
    active: "#3b82f6",
    under_investigation: "#f59e0b",
    matched: "#8b5cf6",
    resolved: "#10b981",
    closed: "#6b7280",
  };
  return colors[status] || "#6b7280";
}

export function getStatusLabel(status: CaseStatus): string {
  const labels: Record<CaseStatus, string> = {
    open: "Open / کھلا ہوا",
    active: "Active / فعال",
    under_investigation: "Under Investigation / زیرِ تفتیش",
    matched: "Matched / مماثلت",
    resolved: "Resolved / حل شدہ",
    closed: "Closed / بند",
  };
  return labels[status] || status;
}

export function getPriorityColor(priority: CasePriority): string {
  const colors: Record<CasePriority, string> = {
    low: "#6b7280",
    medium: "#3b82f6",
    high: "#f59e0b",
    critical: "#ef4444",
  };
  return colors[priority] || "#6b7280";
}

export function getPriorityLabel(priority: CasePriority): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

// ─── Date Formatting ───
export function formatDate(dateStr: string): string {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(dateStr: string): string {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(dateStr);
}

// ─── Misc Helpers ───
export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function truncate(str: string, length: number): string {
  if (!str) return "";
  return str.length > length ? str.slice(0, length) + "…" : str;
}
