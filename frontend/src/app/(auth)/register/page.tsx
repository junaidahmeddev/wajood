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
  phone: z.string().regex(/^\+92\d{10}$/, { message: "Format: +923001234567" }),
  cnic: z.string().regex(/^\d{5}-\d{7}-\d{1}$/, { message: "Format: 12345-1234567-1" }),
  role: z.string(),
  organization_id: z.string().optional(),
  province: z.string().min(1, { message: "Province is required" }),
  district: z.string().min(1, { message: "District is required" }),
}).refine((data) => data.password === data.confirm, {
  message: "Passwords do not match",
  path: ["confirm"],
}).superRefine((data, ctx) => {
  const requiresOrg = ["NGO_WORKER", "OFFICER", "DOCTOR", "GOVT_OFFICIAL", "FORENSICS"].includes(data.role);
  if (requiresOrg && (!data.organization_id || data.organization_id.trim() === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Organization is required",
      path: ["organization_id"],
    });
  }
});

type RegisterFields = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const FALLBACK_ORGS = [
    { id: "org-edhi", name: "Edhi Foundation", type: "ngo" },
    { id: "org-chhipa", name: "Chhipa Welfare", type: "ngo" },
    { id: "org-fia", name: "FIA Missing Persons Cell", type: "law_enforcement" },
    { id: "org-jinnah", name: "Jinnah Hospital Karachi", type: "hospital" },
    { id: "org-ndma", name: "NDMA Pakistan", type: "government" },
    { id: "org-pfsa", name: "PFSA Lahore", type: "forensics" },
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

  const selectedRole = watch("role");
  const getOrgTypeForRole = (role: string) => {
    switch (role) {
      case "NGO_WORKER":
        return "ngo";
      case "OFFICER":
        return "law_enforcement";
      case "DOCTOR":
        return "hospital";
      case "GOVT_OFFICIAL":
        return "government";
      case "FORENSICS":
        return "forensics";
      default:
        return "";
    }
  };
  const targetType = getOrgTypeForRole(selectedRole);
  const filteredOrgs = orgs.filter((o) => (o.type || "").toLowerCase() === targetType.toLowerCase());

  async function onSubmit(data: RegisterFields) {
    setError("");
    setLoading(true);
    try {
      const { confirm, ...payload } = data;
      if (payload.organization_id === "") {
        delete payload.organization_id;
      }
      const res = await api.register({
        ...payload,
        role: payload.role as UserRole,
      });
      toast.success("Account created! Redirecting to login... ✅");
      setTimeout(() => {
        router.push("/login");
      }, 1000);
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
                <div style={{ position: "relative" }}>
                  <input id="reg-password" type={showPassword ? "text" : "password"} className="form-input" placeholder="Min 6 characters"
                    style={{ paddingRight: 40 }}
                    {...register("password")} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 4 }}>
                    {showPassword ? (
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    ) : (
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
                {errors.password && <p style={{ color: "#f87171", fontSize: "0.7rem", marginTop: 2 }}>{errors.password.message}</p>}
              </div>
              <div>
                <label className="form-label" htmlFor="reg-confirm">Confirm Password *</label>
                <div style={{ position: "relative" }}>
                  <input id="reg-confirm" type={showConfirm ? "text" : "password"} className="form-input" placeholder="Re-enter password"
                    style={{ paddingRight: 40 }}
                    {...register("confirm")} />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 4 }}>
                    {showConfirm ? (
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    ) : (
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
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
                <label className="form-label" htmlFor="reg-phone">Phone *</label>
                <input id="reg-phone" className="form-input" placeholder="+923001234567"
                  {...register("phone")} />
                {errors.phone && <p style={{ color: "#f87171", fontSize: "0.7rem", marginTop: 2 }}>{errors.phone.message}</p>}
              </div>
              <div>
                <label className="form-label" htmlFor="reg-cnic">CNIC *</label>
                <input id="reg-cnic" className="form-input" placeholder="12345-1234567-1"
                  {...register("cnic")} />
                {errors.cnic && <p style={{ color: "#f87171", fontSize: "0.7rem", marginTop: 2 }}>{errors.cnic.message}</p>}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <div>
                <label className="form-label" htmlFor="reg-province">Province *</label>
                <select id="reg-province" className="form-select" {...register("province")} onChange={(e) => {
                  setValue("province", e.target.value, { shouldValidate: true });
                  setValue("district", "", { shouldValidate: true });
                }}>
                  <option value="">Select province</option>
                  {PAKISTAN_PROVINCES.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                </select>
                {errors.province && <p style={{ color: "#f87171", fontSize: "0.7rem", marginTop: 2 }}>{errors.province.message}</p>}
              </div>
              <div>
                <label className="form-label" htmlFor="reg-district">District *</label>
                <select id="reg-district" className="form-select" {...register("district")} onChange={(e) => {
                  setValue("district", e.target.value, { shouldValidate: true });
                }}>
                  <option value="">Select district</option>
                  {selectedProvince?.districts.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                {errors.district && <p style={{ color: "#f87171", fontSize: "0.7rem", marginTop: 2 }}>{errors.district.message}</p>}
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading} id="register-submit"
              style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
              {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
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
