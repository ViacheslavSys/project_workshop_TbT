const DEFAULT_ORIGIN = "http://localhost";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export const API_BASE = (() => {
  const configured = (import.meta as any)?.env?.VITE_API_URL;
  if (configured) {
    return String(configured).replace(/\/+$/, "");
  }
  if (import.meta.env?.DEV) {
    return "/api";
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
})();

export function buildUrl(
  path: string,
  params?: Record<string, string | number | undefined | null>,
) {
  const sanitizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = API_BASE.replace(/\/+$/, "");
  const raw = `${base}${sanitizedPath}` || sanitizedPath;
  const url = /^https?:\/\//i.test(raw)
    ? new URL(raw)
    : new URL(
      raw,
      typeof window !== "undefined" ? window.location.origin : DEFAULT_ORIGIN,
    );

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      url.searchParams.set(key, String(value));
    });
  }

  return url.toString();
}

export async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail: string | undefined;
    try {
      const data = await res.json();
      detail = data?.detail ?? data?.message;
    } catch {
      /* ignore json parse errors */
    }
    throw new ApiError(
      detail || `Request failed with status ${res.status}`,
      res.status,
    );
  }

  if (res.status === 204) {
    return null as T;
  }

  return res.json() as Promise<T>;
}
