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
  const env = (import.meta as any)?.env ?? {};
  const configured = env.VITE_API_URL || env.VITE_API_BASE_URL;
  const basePath = env.VITE_API_PATH || "/api";

  const normalize = (value: string) => String(value).replace(/\/+$/, "");
  const asPath = (value: string) => (value.startsWith("/") ? value : `/${value}`);

  if (configured) {
    return normalize(configured);
  }

  const path = normalize(asPath(basePath || "/api"));

  if (import.meta.env?.DEV) {
    return path;
  }

  if (typeof window !== "undefined") {
    return `${window.location.origin}${path}`;
  }

  return path;
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
