/* ═══════════════════════════════════════════════
   WAJOOD — API Client utilizing Axios
   ═══════════════════════════════════════════════ */

import axios from "axios";
import { TokenResponse } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Configure Axios Instance
export const apiClient = axios.create({
  baseURL: API_BASE,
});

// Request Interceptor to dynamically append JWT
apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("wajood_token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  // If sending FormData (multipart/form-data), let Axios/browser set the header and boundary automatically
  if (config.data instanceof FormData && config.headers) {
    if (typeof config.headers.set === "function") {
      config.headers.set("Content-Type", undefined);
    } else {
      config.headers["Content-Type"] = undefined;
      config.headers["content-type"] = undefined;
    }
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response Interceptor to format details
// Response Interceptor to format details or fallback to demo data for Vercel
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("wajood_token");
        localStorage.removeItem("wajood_user");
        const path = window.location.pathname;
        if (!path.includes("/login") && !path.includes("/register")) {
          window.location.href = "/login";
        }
      }
    }

    let message = "API Request failed";
    if (error.response?.data?.detail) {
      if (typeof error.response.data.detail === "string") {
        message = error.response.data.detail;
      } else if (Array.isArray(error.response.data.detail)) {
        message = error.response.data.detail[0]?.msg || message;
      }
    }

    return Promise.reject(new Error(message));
  }
);

class ApiService {
  // ─── Auth ───
  async login(email: string, password: string): Promise<TokenResponse> {
    const data = await apiClient.post<any, TokenResponse>("/api/auth/login", { email, password });
    if (typeof window !== "undefined") {
      localStorage.setItem("wajood_token", data.access_token);
      localStorage.setItem("wajood_user", JSON.stringify(data.user));
    }
    return data;
  }

  async register(userData: Record<string, unknown>): Promise<TokenResponse> {
    const data = await apiClient.post<any, TokenResponse>("/api/auth/register", userData);
    if (typeof window !== "undefined") {
      localStorage.setItem("wajood_token", data.access_token);
      localStorage.setItem("wajood_user", JSON.stringify(data.user));
    }
    return data;
  }

  async getProfile() {
    return apiClient.get("/api/auth/me");
  }

  async getUsers() {
    return apiClient.get("/api/auth/users");
  }

  // ─── Cases ───
  async getCases(params?: Record<string, string>) {
    return apiClient.get("/api/cases/", { params });
  }

  async trackCase(caseNumber: string) {
    return apiClient.get(`/api/cases/track/${caseNumber}`);
  }

  async trackCaseTimeline(caseNumber: string) {
    return apiClient.get(`/api/cases/track/${caseNumber}/timeline`);
  }

  async getCase(id: string) {
    return apiClient.get(`/api/cases/${id}`);
  }

  async createCase(data: Record<string, unknown> | FormData) {
    // If it's a FormData (contains photo file), it is passed directly
    return apiClient.post("/api/cases/", data);
  }

  async updateCase(id: string, data: Record<string, unknown>) {
    return apiClient.patch(`/api/cases/${id}`, data);
  }

  async updateCaseStatus(id: string, statusUpdate: string, notes?: string) {
    const formData = new FormData();
    formData.append("status_update", statusUpdate);
    if (notes) {
      formData.append("notes", notes);
    }
    return apiClient.patch(`/api/cases/${id}/status`, formData);
  }

  async addSighting(caseId: string, sightingData: any) {
    return apiClient.post(`/api/cases/${caseId}/sighting`, sightingData);
  }

  async getCaseTimeline(caseId: string) {
    return apiClient.get(`/api/cases/${caseId}/timeline`);
  }

  async disasterIntake(payload: any[]) {
    return apiClient.post("/api/cases/disaster-intake", payload);
  }

  // ─── Persons ───
  async getPersons(params?: Record<string, string>) {
    return apiClient.get("/api/persons/found", { params });
  }

  async getPerson(id: string) {
    return apiClient.get(`/api/persons/found/${id}`);
  }

  async createPerson(data: Record<string, unknown> | FormData) {
    return apiClient.post("/api/persons/found", data);
  }

  async updatePerson(id: string, data: any) {
    return apiClient.patch(`/api/persons/found/${id}`, data);
  }

  // ─── Matching ───
  async runMatching(caseId: string) {
    return apiClient.post(`/api/matching/trigger/${caseId}`);
  }

  async getMatchResults(caseId: string) {
    return apiClient.get(`/api/matching/results/${caseId}`);
  }

  async getMatchQueue() {
    return apiClient.get("/api/matching/queue");
  }

  async confirmMatch(matchId: string) {
    return apiClient.patch(`/api/matching/results/${matchId}/confirm`);
  }

  async rejectMatch(matchId: string) {
    return apiClient.patch(`/api/matching/results/${matchId}/reject`);
  }

  async runFaceSearch(photo: any) {
    return apiClient.post("/api/matching/search", photo);
  }

  // ─── Organizations ───
  async getOrganizations(params?: Record<string, string>) {
    return apiClient.get("/api/organizations/", { params });
  }

  // ─── Notifications ───
  async getNotifications(unreadOnly = false) {
    return apiClient.get(`/api/notifications/?unread_only=${unreadOnly}`);
  }

  async getUnreadCount() {
    return apiClient.get<{ unread_count: number }>("/api/notifications/unread-count");
  }

  async markNotificationRead(id: string) {
    return apiClient.patch(`/api/notifications/${id}/read`);
  }

  async markAllRead() {
    return apiClient.patch("/api/notifications/read-all");
  }

  async broadcastAlert(payload: { title: string; message: string; city?: string }) {
    return apiClient.post("/api/notifications/broadcast", payload);
  }

  // ─── Analytics ───
  async getDashboardStats() {
    return apiClient.get("/api/analytics/dashboard");
  }

  async getAnalyticsOverview() {
    return apiClient.get("/api/analytics/overview");
  }

  async getAuditLogs() {
    return apiClient.get("/api/analytics/audit-logs");
  }

  async getCasesByStatus() {
    return apiClient.get("/api/analytics/cases-by-status");
  }

  async getCasesByProvince() {
    return apiClient.get("/api/analytics/cases-by-province");
  }

  async getRecentCases(limit = 10) {
    return apiClient.get(`/api/analytics/recent-cases?limit=${limit}`);
  }
}

export const api = new ApiService();
export default api;
