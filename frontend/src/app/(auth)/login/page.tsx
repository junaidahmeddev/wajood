"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import api from "@/lib/api";
import { useAuthStore } from "@/store";
import { getPortalPath } from "@/lib/auth";

// Schema validation using Zod
const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

type LoginFields = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFields>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginFields) {
    setError("");
    setLoading(true);
    try {
      const res = await api.login(data.email, data.password);
      setAuth(res.user, res.access_token);
      router.push(getPortalPath(res.user.role));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-enter" style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, position: "relative",
    }}>
      <div className="mesh-gradient" />

      <div style={{ width: "100%", maxWidth: 440 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em" }} className="gradient-text">
              WAJOOD
            </span>
          </Link>
          <p style={{ color: "#64748b", fontSize: "0.9rem", marginTop: 8 }}>
            Sign in to your account
          </p>
        </div>

        {/* Card */}
        <div className="glass-card" style={{ padding: 36 }}>
          <form onSubmit={handleSubmit(onSubmit)} id="login-form">
            {error && (
              <div style={{
                background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)",
                borderRadius: 10, padding: "12px 16px", marginBottom: 20,
                color: "#f87171", fontSize: "0.85rem",
              }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label className="form-label" htmlFor="login-email">Email Address</label>
              <input
                id="login-email"
                type="email"
                className="form-input"
                placeholder="you@example.com"
                {...register("email")}
              />
              {errors.email && (
                <p style={{ color: "#f87171", fontSize: "0.75rem", marginTop: 4 }}>
                  {errors.email.message}
                </p>
              )}
            </div>

            <div style={{ marginBottom: 24 }}>
              <label className="form-label" htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                className="form-input"
                placeholder="Enter your password"
                {...register("password")}
              />
              {errors.password && (
                <p style={{ color: "#f87171", fontSize: "0.75rem", marginTop: 4 }}>
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              id="login-submit"
              style={{ width: "100%", display: "flex", justifyContent: "center" }}
            >
              <span>{loading ? "Signing in..." : "Sign In"}</span>
            </button>
          </form>

          <div style={{
            marginTop: 24, textAlign: "center", fontSize: "0.85rem", color: "#64748b",
          }}>
            Don&apos;t have an account?{" "}
            <Link href="/register" style={{ color: "#818cf8", textDecoration: "none", fontWeight: 600 }}>
              Create one
            </Link>
          </div>
        </div>

        {/* Demo credentials */}
        <div className="glass-card" style={{ marginTop: 16, padding: "16px 20px", textAlign: "center" }}>
          <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: 4 }}>Demo Admin Account</p>
          <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
            <strong>admin@wajood.pk</strong> / <strong>admin123</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
