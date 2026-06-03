const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3001").replace(/\/$/, "");

const TOKEN_KEY = "stayfinder_admin_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function request(path, { method = "GET", body, auth = true, signal } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (auth) {
    headers["x-admin-token"] = getToken();
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (error) {
    throw new ApiError(
      `Không kết nối được tới backend (${BASE_URL}). Kiểm tra server đang chạy.`,
      0,
      error?.message,
    );
  }

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || `Lỗi ${response.status}`;
    throw new ApiError(message, response.status, payload);
  }

  return payload;
}

export const api = {
  base: BASE_URL,

  health: () => request("/health", { auth: false }),

  // Public meta (dùng cho dashboard chỉ số)
  filtersMeta: () => request("/filters/meta", { auth: false }),
  landmarksPublic: () => request("/landmarks", { auth: false }),

  // Verify token bằng cách gọi endpoint admin nhẹ
  verifyToken: () => request("/admin/jobs?limit=1"),

  // Places
  listPlaces: (params = {}) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        search.set(key, value);
      }
    });
    const qs = search.toString();
    return request(`/admin/places${qs ? `?${qs}` : ""}`);
  },
  getPlace: (id) => request(`/admin/places/${encodeURIComponent(id)}`),
  createPlace: (body) => request("/admin/places", { method: "POST", body }),
  updatePlace: (id, body) => request(`/admin/places/${encodeURIComponent(id)}`, { method: "PATCH", body }),
  deletePlace: (id) => request(`/admin/places/${encodeURIComponent(id)}`, { method: "DELETE" }),

  // Landmarks
  listLandmarks: () => request("/admin/landmarks"),
  createLandmark: (body) => request("/admin/landmarks", { method: "POST", body }),
  updateLandmark: (id, body) => request(`/admin/landmarks/${encodeURIComponent(id)}`, { method: "PATCH", body }),
  deleteLandmark: (id) => request(`/admin/landmarks/${encodeURIComponent(id)}`, { method: "DELETE" }),

  // Local context notes
  listNotes: (params = {}) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        search.set(key, value);
      }
    });
    const qs = search.toString();
    return request(`/admin/local-context-notes${qs ? `?${qs}` : ""}`);
  },
  createNote: (body) => request("/admin/local-context-notes", { method: "POST", body }),
  updateNote: (id, body) => request(`/admin/local-context-notes/${encodeURIComponent(id)}`, { method: "PATCH", body }),
  deleteNote: (id) => request(`/admin/local-context-notes/${encodeURIComponent(id)}`, { method: "DELETE" }),

  // Jobs
  listJobs: (limit = 20) => request(`/admin/jobs?limit=${limit}`),

  // AI config
  getAiConfig: () => request("/admin/ai-config"),
  updateAiConfig: (config) => request("/admin/ai-config", { method: "PUT", body: { config } }),
  testAiConnection: (query) => request("/admin/ai-config/test", { method: "POST", body: { query } }),

  // Users
  listUsers: (params = {}) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        search.set(key, value);
      }
    });
    const qs = search.toString();
    return request(`/admin/users${qs ? `?${qs}` : ""}`);
  },
  getUser: (id) => request(`/admin/users/${encodeURIComponent(id)}`),
  updateUser: (id, body) => request(`/admin/users/${encodeURIComponent(id)}`, { method: "PATCH", body }),
  deleteUser: (id) => request(`/admin/users/${encodeURIComponent(id)}`, { method: "DELETE" }),
  revokeUserSessions: (id) =>
    request(`/admin/users/${encodeURIComponent(id)}/revoke-sessions`, { method: "POST" }),
};
