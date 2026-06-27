"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import api from "@/lib/api";
import { useAuthStore } from "@/store";
import { getPortalPath } from "@/lib/auth";
import { UserRole } from "@/types";
import { PAKISTAN_PROVINCES } from "@/lib/utils";
import { useToast } from "@/components/shared/Toast";

const ROLES: { value: UserRole; label: string }[] = [
  { value: "PUBLIC", label: "Public Citizen" },
  { value: "NGO_WORKER", label: "NGO Representative" },
  { value: "OFFICER", label: "Law Enforcement" },
  { value: "DOCTOR", label: "Hospital Staff" },
  { value: "VOLUNTEER", label: "Volunteer" },
  { value: "JOURNALIST", label: "Media Personnel" },
  { value: "GOVT_OFFICIAL", label: "Government Official" },
  { value: "FORENSICS", label: "Forensics Expert" },
];

// Zod schema
const registerSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  full_name: z.string().min(2, { message: "Name is too short" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  confirm: z.string().min(6, { message: "Confirmation is required" }),
  phone: z.string().optional(),
  cnic: z.string().optional(),
  role: z.string(),
  organization_id: z.string().optional(),
  province: z.string().optional(),
  district: z.string().optional(),
}).refine((data) => data.password === data.confirm, {
  message: "Passwords do not match",
  path: ["confirm"],
});

type RegisterFields = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const FALLBACK_ORGS = [
    { id: "org-edhi", name: "Edhi Foundation" },
    { id: "org-chhipa", name: "Chhipa Welfare" },
    { id: "org-fia", name: "FIA Missing Persons Cell" },
    { id: "org-jinnah", name: "Jinnah Hospital Karachi" },
    { id: "org-ndma", name: "NDMA Pakistan" },
    { id: "org-pfsa", name: "PFSA Lahore" },
  ];
  const [orgs, setOrgs] = useState<any[]>(FALLBACK_ORGS);

  useEffect(() => {
    api.getOrganizations().then((res: any) => {
      setOrgs(Array.isArray(res) && res.length > 0 ? res : FALLBACK_ORGS);
    }).catch(() => setOrgs(FALLBACK_ORGS));
  }, []);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<RegisterFields>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: "PUBLIC",
      organization_id: "",
      province: "",
      district: "",
    },
  });

  const watchedProvince = watch("province");
  const selectedProvince = PAKISTAN_PROVINCES.find((p) => p.name === watchedProvince);

  async function onSubmit(data: RegisterFields) {
    setError("");
    setLoading(true);
    try {
      const { confirm, ...payload } = data;
      const res = await api.register({
        ...payload,
        role: payload.role as UserRole,
      });
      toast.success("Account created! Please login");
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Registration failed";
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-enter" style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      padding: "40px 24px", position: "relative",
    }}>
      <div className="mesh-gradient" />

      <div style={{ width: "100%", maxWidth: 520 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em" }} className="gradient-text">
              WAJOOD
            </span>
          </Link>
          <p style={{ color: "#64748b", fontSize: "0.9rem", marginTop: 8 }}>
            Create your account
          </p>
        </div>

        <div className="glass-card" style={{ padding: 36 }}>
          <form onSubmit={handleSubmit(onSubmit)} id="register-form">
            {error && (
              <div style={{
                background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)",
                borderRadius: 10, padding: "12px 16px", marginBottom: 20,
                color: "#f87171", fontSize: "0.85rem",
              }}>
                {error}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label className="form-label" htmlFor="reg-name">Full Name *</label>
                <input id="reg-name" className="form-input" placeholder="Your full name"
                  {...register("full_name")} />
                {errors.full_name && <p style={{ color: "#f87171", fontSize: "0.7rem", marginTop: 2 }}>{errors.full_name.message}</p>}
              </div>
              <div>
                <label className="form-label" htmlFor="reg-email">Email *</label>
                <input id="reg-email" type="email" className="form-input" placeholder="you@example.com"
                  {...register("email")} />
                {errors.email && <p style={{ color: "#f87171", fontSize: "0.7rem", marginTop: 2 }}>{errors.email.message}</p>}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label className="form-label" htmlFor="reg-password">Password *</label>
                <input id="reg-password" type="password" className="form-input" placeholder="Min 6 characters"
                  {...register("password")} />
                {errors.password && <p style={{ color: "#f87171", fontSize: "0.7rem", marginTop: 2 }}>{errors.password.message}</p>}
              </div>
              <div>
                <label className="form-label" htmlFor="reg-confirm">Confirm Password *</label>
                <input id="reg-confirm" type="password" className="form-input" placeholder="Re-enter password"
                  {...register("confirm")} />
                {errors.confirm && <p style={{ color: "#f87171", fontSize: "0.7rem", marginTop: 2 }}>{errors.confirm.message}</p>}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label" htmlFor="reg-role">I am a *</label>
              <select id="reg-role" className="form-select" {...register("role")}>
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            {["NGO_WORKER", "OFFICER", "DOCTOR", "GOVT_OFFICIAL", "FORENSICS"].includes(watch("role")) && (
              <div style={{ marginBottom: 16 }}>
                <label className="form-label" htmlFor="reg-org">Organization *</label>
                <select id="reg-org" className="form-select" {...register("organization_id")}>
                  <option value="">Select an organization</option>
                  {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                {errors.organization_id && <p style={{ color: "#f87171", fontSize: "0.7rem", marginTop: 2 }}>{errors.organization_id.message}</p>}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label className="form-label" htmlFor="reg-phone">Phone</label>
                <input id="reg-phone" className="form-input" placeholder="+92 300 1234567"
                  {...register("phone")} />
              </div>
              <div>
                <label className="form-label" htmlFor="reg-cnic">CNIC</label>
                <input id="reg-cnic" className="form-input" placeholder="12345-1234567-1"
                  {...register("cnic")} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <div>
                <label className="form-label" htmlFor="reg-province">Province</label>
                <select id="reg-province" className="form-select" {...register("province")} onChange={(e) => {
                  setValue("province", e.target.value);
                  setValue("district", "");
                }}>
                  <option value="">Select province</option>
                  {PAKISTAN_PROVINCES.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="reg-district">District</label>
                <select id="reg-district" className="form-select" {...register("district")}>
                  <option value="">Select district</option>
                  {selectedProvince?.districts.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading} id="register-submit"
              style={{ width: "100%", display: "flex", justifyContent: "center" }}>
              <span>{loading ? "Creating Account..." : "Create Account"}</span>
            </button>
          </form>

          <div style={{ marginTop: 24, textAlign: "center", fontSize: "0.85rem", color: "#64748b" }}>
            Already have an account?{" "}
            <Link href="/login" style={{ color: "#818cf8", textDecoration: "none", fontWeight: 600 }}>
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
