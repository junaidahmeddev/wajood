/* ═══════════════════════════════════════════════
   WAJOOD — Auth Utilities
   ═══════════════════════════════════════════════ */

import { User, UserRole } from "@/types";

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("wajood_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("wajood_token");
}

export function isAuthenticated(): boolean {
  return !!getStoredToken();
}

export function logout(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("wajood_token");
  localStorage.removeItem("wajood_user");
  window.location.href = "/login";
}

export function hasRole(user: User | null, roles: UserRole[]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}

export function isAdmin(user: User | null): boolean {
  return hasRole(user, ["ADMIN"]);
}

export function getRoleName(role: UserRole): string {
  const names: Record<UserRole, string> = {
    ADMIN: "System Administrator",
    PUBLIC: "Public User",
    NGO_WORKER: "NGO Representative",
    OFFICER: "Law Enforcement",
    DOCTOR: "Hospital Staff",
    VOLUNTEER: "Volunteer",
    JOURNALIST: "Media Personnel",
    GOVT_OFFICIAL: "Government Official",
    FORENSICS: "Forensics Expert",
  };
  return names[role] || role;
}

export function getRoleColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    ADMIN: "#ef4444",
    PUBLIC: "#6366f1",
    NGO_WORKER: "#10b981",
    OFFICER: "#3b82f6",
    DOCTOR: "#f59e0b",
    VOLUNTEER: "#8b5cf6",
    JOURNALIST: "#ec4899",
    GOVT_OFFICIAL: "#14b8a6",
    FORENSICS: "#f97316",
  };
  return colors[role] || "#6b7280";
}

export function getPortalPath(role: UserRole): string {
  const paths: Record<UserRole, string> = {
    ADMIN: "/admin",
    PUBLIC: "/public",
    NGO_WORKER: "/ngo",
    OFFICER: "/law-enforcement",
    DOCTOR: "/hospital",
    VOLUNTEER: "/volunteer",
    JOURNALIST: "/media",
    GOVT_OFFICIAL: "/government",
    FORENSICS: "/forensics",
  };
  return paths[role] || "/dashboard";
}
