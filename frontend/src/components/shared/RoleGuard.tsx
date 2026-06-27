"use client";

import { ReactNode, useEffect, useState } from "react";
import { useAuthStore } from "@/store";
import { UserRole } from "@/types";

import { useRouter } from "next/navigation";

interface RoleGuardProps {
  allowedRoles: (UserRole | string)[];
  children: ReactNode;
  fallback?: ReactNode;
}

export default function RoleGuard({ allowedRoles, children, fallback = null }: RoleGuardProps) {
  const { user, loadFromStorage } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadFromStorage();
    setMounted(true);
  }, [loadFromStorage]);

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

  useEffect(() => {
    if (mounted) {
      if (!user) {
        router.replace("/login");
      } else {
        const isAllowed = user.role === "ADMIN" || allowedRoles.some((r) => r === user.role || r.toUpperCase() === user.role || roleMap[r.toLowerCase()] === user.role);
        if (!isAllowed) {
          router.replace("/dashboard");
        }
      }
    }
  }, [mounted, user, router, allowedRoles]);

  if (!mounted || !user) {
    return null;
  }

  const isAllowed = user.role === "ADMIN" || allowedRoles.some((r) => r === user.role || r.toUpperCase() === user.role || roleMap[r.toLowerCase()] === user.role);

  if (!isAllowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
