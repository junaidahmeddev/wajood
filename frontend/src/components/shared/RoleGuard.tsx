"use client";

import { ReactNode, useEffect, useState } from "react";
import { useAuthStore } from "@/store";
import { UserRole } from "@/types";

interface RoleGuardProps {
  allowedRoles: (UserRole | string)[];
  children: ReactNode;
  fallback?: ReactNode;
}

export default function RoleGuard({ allowedRoles, children, fallback = null }: RoleGuardProps) {
  const { user, loadFromStorage } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    loadFromStorage();
    setMounted(true);
  }, [loadFromStorage]);

  if (!mounted) {
    return null;
  }

  const roleMap: Record<string, UserRole> = {
    ngo: "NGO_WORKER",
    law_enforcement: "OFFICER",
    hospital: "DOCTOR",
    media: "JOURNALIST",
    government: "GOVT_OFFICIAL",
    volunteer: "VOLUNTEER",
    forensics: "FORENSICS",
    public: "PUBLIC",
  };

  // Admin bypass or matches allowed list
  const isAllowed = user && (
    user.role === "ADMIN" ||
    allowedRoles.some((r) => r === user.role || r.toUpperCase() === user.role || roleMap[r.toLowerCase()] === user.role)
  );

  if (!isAllowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
