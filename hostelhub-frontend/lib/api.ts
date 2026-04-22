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
// Non-httpOnly cookie so Next.js middleware (Edge runtime) can read auth state.
// The token is already exposed to JS via localStorage, so this does not widen
// the XSS surface. Production should move to httpOnly cookies + server routes.
const AUTH_COOKIE = "hh_auth";
const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60; // matches JWT access lifetime

function setAuthCookie(value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_COOKIE}=${value}; path=/; max-age=${AUTH_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
}

function clearAuthCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

export const tokenStorage = {
  getAccess: () => (typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null),
  getRefresh: () => (typeof window !== "undefined" ? localStorage.getItem(REFRESH_KEY) : null),
  setTokens: (access: string, refresh: string) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(TOKEN_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    setAuthCookie("1");
  },
  clear: () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    clearAuthCookie();
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
    api.post<OTPVerifyResponse>(
      "/auth/otp/verify/",
      { phone, code },
      { skipAuth: true, headers: { "X-HMS-Registration-Role": role } }
    ),

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

export interface RoomVariantMedia {
  id: number;
  type: "PHOTO" | "VIDEO";
  file: string;
  thumbnail: string | null;
  medium: string | null;
  caption: string | null;
  duration_seconds: number | null;
  display_order: number;
  created_at: string;
}

export interface Amenity {
  id: number;
  name: string;
  icon: string;
}

export interface HostelMedia {
  id: number;
  type: "PHOTO" | "VIDEO";
  file: string;
  thumbnail: string | null;
  medium: string | null;
  caption: string | null;
  display_order: number;
  created_at: string;
}

export interface Room {
  id: string;
  variant: string;
  label: string;
  locked_k: number | null;
  status: "AVAILABLE" | "PARTIALLY_BOOKED" | "FULL" | "UNAVAILABLE";
}

export interface RoomVariant {
  id: string;
  hostel: string;
  name: string;
  description: string;
  total_price: string;
  min_occupancy: number;
  max_occupancy: number;
  features: string[];
  rooms: Room[];
  media: RoomVariantMedia[];
  created_at: string;
}

export interface Hostel {
  id: string;
  owner?: string;
  name: string;
  slug?: string;
  description: string;
  address_text: string;
  latitude: string | null;
  longitude: string | null;
  gender_policy: "MALE" | "FEMALE" | "MIXED";
  owner_contact_phone: string;
  owner_contact_whatsapp: string | null;
  status?: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  rejection_reason?: string;
  created_by_super_admin?: boolean;
  amenities: Amenity[];
  media: HostelMedia[];
  variants: RoomVariant[];
  photo_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateHostelPayload {
  name: string;
  description: string;
  address_text: string;
  latitude: string | null;
  longitude: string | null;
  gender_policy: "MALE" | "FEMALE" | "MIXED";
  owner_contact_phone: string;
  owner_contact_whatsapp: string | null;
  amenity_ids: number[];
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const adminHostelsApi = {
  list: () =>
    api
      .get<PaginatedResponse<Hostel> | Hostel[]>("/admin/hostels/")
      .then((res) => (Array.isArray(res) ? res : res.results)),
  get: (id: string) => api.get<Hostel>(`/admin/hostels/${id}/`),
  create: (data: CreateHostelPayload) => api.post<Hostel>("/admin/hostels/", data),
  update: (id: string, data: Partial<CreateHostelPayload>) => api.patch<Hostel>(`/admin/hostels/${id}/`, data),
  submitForReview: (hostelId: string) => api.post<{ message: string }>(`/admin/hostels/${hostelId}/submit/`, {}),
  uploadMedia: (hostelId: string, file: File, caption?: string, onUploadProgress?: (progressEvent: any) => void) => {
    const formData = new FormData();
    formData.append("file", file);
    if (caption) formData.append("caption", caption);
    const token = tokenStorage.getAccess();
    return new Promise<HostelMedia>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/admin/hostels/${hostelId}/media/`, true);
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      if (onUploadProgress) {
        xhr.upload.onprogress = (e) => onUploadProgress(e);
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.response));
        } else {
          reject(new Error(JSON.parse(xhr.response)?.error || "Upload failed"));
        }
      };
      xhr.onerror = () => reject(new Error("Network Error"));
      xhr.send(formData);
    });
  },
  deleteMedia: (hostelId: string, mediaId: number) => api.delete<void>(`/admin/hostels/${hostelId}/media/${mediaId}/`),
  reorderMedia: (hostelId: string, order: number[]) => api.patch<{ message: string }>(`/admin/hostels/${hostelId}/media-reorder/`, { order }),
  createVariant: (hostelId: string, data: Partial<RoomVariant>) => api.post<RoomVariant>(`/admin/hostels/${hostelId}/variants/`, data),
  getAmenities: () =>
    api
      .get<PaginatedResponse<Amenity> | Amenity[]>("/amenities/")
      .then((res) => (Array.isArray(res) ? res : res.results)),
};

export const adminVariantsApi = {
  createRoomsBulk: (variantId: string, labels: string[]) => api.post<{ message: string }>(`/admin/variants/${variantId}/rooms/bulk/`, { labels }),
  uploadMedia: (variantId: string, file: File, caption?: string, onUploadProgress?: (progressEvent: any) => void) => {
    const formData = new FormData();
    formData.append("file", file);
    if (caption) formData.append("caption", caption);
    const token = tokenStorage.getAccess();
    return new Promise<RoomVariantMedia>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/admin/variants/${variantId}/media/`, true);
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      if (onUploadProgress) {
        xhr.upload.onprogress = (e) => onUploadProgress(e);
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.response));
        } else {
          reject(new Error(JSON.parse(xhr.response)?.error || "Upload failed"));
        }
      };
      xhr.onerror = () => reject(new Error("Network Error"));
      xhr.send(formData);
    });
  },
  deleteMedia: (variantId: string, mediaId: number) => api.delete<void>(`/admin/variants/${variantId}/media/${mediaId}/`),
};

// Super Admin APIs
export const superAdminApi = {
  getPendingHostels: () => api.get<Hostel[]>("/superadmin/hostels/?status=PENDING"),
  getAllHostels: () => api.get<Hostel[]>("/superadmin/hostels/?status=ALL"),
  approveHostel: (id: string) => api.post<{message: string}>(`/superadmin/hostels/${id}/approve/`),
  rejectHostel: (id: string, reason: string) => api.post<{message: string}>(`/superadmin/hostels/${id}/reject/`, { reason }),
  reassignHostel: (id: string, phone: string) => api.post<{message: string}>(`/superadmin/hostels/${id}/reassign/`, { phone }),
  createOnBehalf: (data: {
    name: string;
    address_text?: string;
    description?: string;
    gender_policy?: string;
    owner_contact_phone?: string;
    owner_contact_whatsapp?: string;
    latitude?: number;
    longitude?: number;
    amenity_ids?: number[];
  }) => api.post<Hostel>(`/superadmin/hostels/create-on-behalf/`, data),
  getUsers: () => api.get<any>("/admin-users/").then(res => res.results || res),
  deactivateUser: (id: string) => api.delete<void>(`/admin-users/${id}/`),
  getAuditLogs: () => api.get<any>("/audit/").then(res => res.results || res),
};

// Public APIs
export const publicHostelsApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? new URLSearchParams(params).toString() : "";
    return api.get<{count: number, next: string | null, previous: string | null, results: Hostel[]}>(`/hostels/${qs ? `?${qs}` : ''}`);
  },
  get: (slug: string) => api.get<Hostel>(`/hostels/${slug}/`),
};

// ─── Bookings + payments (M4) ────────────────────────────────────────────────

export type BookingStatus =
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "CHECKED_OUT"
  | "CANCELLED"
  | "EXPIRED"
  | "REFUNDED";

export type PaymentStatus = "INITIATED" | "SUCCESS" | "FAILED" | "REFUNDED";

export interface PaymentBrief {
  id: string;
  paystack_reference: string;
  amount: string;
  status: PaymentStatus;
  channel: string;
  verified_at: string | null;
}

export interface BookingHostelBrief {
  id: string;
  name: string;
  slug: string;
  address_text: string;
  latitude: string | null;
  longitude: string | null;
  owner_contact_phone: string;
}

export interface BookingVariantBrief {
  id: string;
  name: string;
  total_price: string;
  min_occupancy: number;
  max_occupancy: number;
}

export interface BookingRoomBrief {
  id: string;
  label: string;
  locked_k: number | null;
  status: "AVAILABLE" | "PARTIALLY_BOOKED" | "FULL" | "UNAVAILABLE";
}

export interface BookingStudentBrief {
  id: string;
  phone: string;
  first_name: string;
  last_name: string;
}

export interface Booking {
  id: string;
  status: BookingStatus;
  chosen_occupancy_at_booking: number;
  price_paid: string;
  reservation_expires_at: string | null;
  created_at: string;
  updated_at: string;
  student: BookingStudentBrief;
  hostel: BookingHostelBrief;
  variant: BookingVariantBrief;
  room: BookingRoomBrief;
  payments: PaymentBrief[];
  latest_payment: PaymentBrief | null;
}

export interface BookingCreateResponse {
  booking: Booking;
  authorization_url: string;
  payment_reference: string;
}

export interface Payment {
  id: string;
  booking_id: string;
  paystack_reference: string;
  amount: string;
  currency: string;
  channel: string;
  status: PaymentStatus;
  verified_at: string | null;
  refunded_at: string | null;
  refund_reason: string;
  created_at: string;
}

export const bookingsApi = {
  create: (payload: { room_id: string; chosen_occupancy: number }) =>
    api.post<BookingCreateResponse>("/bookings/", payload),
  list: (params?: Record<string, string>) => {
    const qs = params ? new URLSearchParams(params).toString() : "";
    return api.get<Booking[]>(`/bookings/${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => api.get<Booking>(`/bookings/${id}/`),
  cancel: (id: string, reason?: string) =>
    api.post<Booking>(`/bookings/${id}/cancel/`, { reason: reason ?? "" }),
  checkIn: (id: string) => api.post<Booking>(`/bookings/${id}/check-in/`, {}),
  checkOut: (id: string) => api.post<Booking>(`/bookings/${id}/check-out/`, {}),
};

export const paymentsApi = {
  get: (id: string) => api.get<Payment>(`/payments/${id}/`),
  refund: (id: string, reason: string, amount?: string) =>
    api.post<Payment>(`/payments/${id}/refund/`, { reason, amount }),
};
