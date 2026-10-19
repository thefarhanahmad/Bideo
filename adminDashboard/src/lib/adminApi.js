import { API_URL } from "../config";

/**
 * Shared admin API client: adds the admin token, parses JSON and throws an
 * Error carrying the server message (and HTTP status) on failure.
 * Pass an AbortController signal to cancel outdated requests.
 */
export async function adminFetch(path, { method = "GET", body, signal } = {}) {
  const token = localStorage.getItem("admin_token");
  const headers = { Authorization: `Bearer ${token}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    signal,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const fallback = res.status === 401 ? "Your session has expired. Please log in again." : `Request failed (${res.status})`;
    const error = new Error((data && data.message) || fallback);
    error.status = res.status;
    throw error;
  }
  return data;
}

export const isAbortError = (err) => err && err.name === "AbortError";

export const resolveMediaUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};
