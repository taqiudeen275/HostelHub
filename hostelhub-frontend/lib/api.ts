/**
 * API client for HostelHub backend.
 * - All requests are prefixed with NEXT_PUBLIC_API_URL
 * - JWT access token is attached to every request
 * - Auto-refreshes the access token on 401, then retries once
 * - Throws ApiError on non-2xx responses
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

// ─── Token storage helpers ──────────────────────────────────────────────────

const TOKEN_KEY = "hh_access";
const REFRESH_KEY = "hh_refresh";

export const tokenStorage = {
  getAccess: () => (typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null),
  getRefresh: () => (typeof window !== "undefined" ? localStorage.getItem(REFRESH_KEY) : null),
  setTokens: (access: string, refresh: string) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(TOKEN_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

// ─── Error type ─────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

// ─── Core fetch wrapper ──────────────────────────────────────────────────────

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  skipAuth?: boolean;
};

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  const refresh = tokenStorage.getRefresh();
  if (!refresh) return false;

  try {
    const res = await fetch(`${BASE_URL}/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) {
      tokenStorage.clear();
      return false;
    }
    const data = await res.json();
    tokenStorage.setTokens(data.access, data.refresh);
    return true;
  } catch {
    tokenStorage.clear();
    return false;
  }
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, skipAuth = false, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (!skipAuth) {
    const token = tokenStorage.getAccess();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...fetchOptions,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Handle 401 — try to refresh, then retry once
  if (res.status === 401 && !skipAuth) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = doRefresh().finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });
    }

    const refreshed = await refreshPromise;
    if (refreshed) {
      // Retry with new access token
      const newToken = tokenStorage.getAccess();
      const retryRes = await fetch(`${BASE_URL}${path}`, {
        ...fetchOptions,
        headers: {
          ...headers,
          Authorization: `Bearer ${newToken}`,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      if (!retryRes.ok) {
        const errData = await retryRes.json().catch(() => ({}));
        throw new ApiError(
          errData.error ?? "Request failed",
          retryRes.status,
          errData.detail
        );
      }
      if (retryRes.status === 204) return undefined as T;
      return retryRes.json() as Promise<T>;
    } else {
      // Refresh failed — user needs to log in again
      tokenStorage.clear();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("hh:auth:expired"));
      }
      throw new ApiError("Session expired. Please log in again.", 401);
    }
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new ApiError(
      errData.error ?? `HTTP ${res.status}`,
      res.status,
      errData.detail
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Typed API helpers ───────────────────────────────────────────────────────

export const api = {
  get: <T>(path: string, opts?: RequestOptions) =>
    apiRequest<T>(path, { method: "GET", ...opts }),

  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    apiRequest<T>(path, { method: "POST", body, ...opts }),

  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    apiRequest<T>(path, { method: "PATCH", body, ...opts }),

  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    apiRequest<T>(path, { method: "PUT", body, ...opts }),

  delete: <T>(path: string, opts?: RequestOptions) =>
    apiRequest<T>(path, { method: "DELETE", ...opts }),
};

// ─── Auth-specific API calls ──────────────────────────────────────────────

export type UserRole = "SUPER_ADMIN" | "HOSTEL_ADMIN" | "STUDENT";

export type PrivacyChoice = "NOBODY" | "ROOMMATES" | "HOSTELMATES";

export interface StudentProfile {
  program: string;
  level: string;
  gender: string;
  profile_photo: string | null;
  privacy_phone: PrivacyChoice;
  privacy_full_name: PrivacyChoice;
  privacy_photo: PrivacyChoice;
}

export interface HostelAdminProfile {
  business_name: string;
  whatsapp_number: string;
  is_tech_setup_required: boolean;
}

export interface User {
  id: string;
  phone: string;
  email: string | null;
  role: UserRole;
  first_name: string;
  last_name: string;
  full_name: string;
  is_active: boolean;
  is_verified: boolean;
  date_joined: string;
  student_profile: StudentProfile | null;
  hostel_admin_profile: HostelAdminProfile | null;
  is_onboarding_complete: boolean;
}

export interface TokenPair {
  access: string;
  refresh: string;
}

export interface OTPRequestResponse {
  message: string;
  phone: string;
  expires_in_seconds: number;
  resend_cooldown_seconds: number;
}

export interface OTPVerifyResponse {
  message: string;
  is_new_user: boolean;
  tokens: TokenPair;
  user: User;
}

export const authApi = {
  requestOtp: (phone: string) =>
    api.post<OTPRequestResponse>("/auth/otp/request/", { phone }, { skipAuth: true }),

  verifyOtp: (phone: string, code: string, role: UserRole) =>
    api.post<OTPVerifyResponse>("/auth/otp/verify/", { phone, code, role }, { skipAuth: true }),

  superAdminLogin: (email: string, password: string) =>
    api.post<OTPVerifyResponse>("/auth/superadmin/login/", { email, password }, { skipAuth: true }),

  me: () => api.get<User>("/auth/me/"),

  updateMe: (data: Partial<Pick<User, "first_name" | "last_name">>) =>
    api.patch<User>("/auth/me/", data),

  logout: (refresh: string) => api.post("/auth/logout/", { refresh }),

  updateStudentProfile: (data: Partial<StudentProfile>) =>
    api.patch<StudentProfile>("/me/student-profile/", data),

  updatePrivacy: (data: Partial<Pick<StudentProfile, "privacy_phone" | "privacy_full_name" | "privacy_photo">>) =>
    api.patch<Pick<StudentProfile, "privacy_phone" | "privacy_full_name" | "privacy_photo">>("/me/privacy/", data),

  updateAdminProfile: (data: Partial<HostelAdminProfile>) =>
    api.patch<HostelAdminProfile>("/me/admin-profile/", data),
};
