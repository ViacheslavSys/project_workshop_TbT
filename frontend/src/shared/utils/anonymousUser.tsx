const STORAGE_KEY = "anonymous_user_id";

function generateAnonymousId() {
  const cryptoObj =
    typeof globalThis === "object"
      ? (globalThis as { crypto?: Crypto }).crypto
      : undefined;

  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    const hex = Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    return `anon_${hex}`;
  }

  if (typeof cryptoObj?.randomUUID === "function") {
    return `anon_${cryptoObj.randomUUID().replace(/-/g, "")}`;
  }

  let fallback = "";
  for (let i = 0; i < 32; i += 1) {
    fallback += Math.floor(Math.random() * 16).toString(16);
  }
  return `anon_${fallback}`;
}

function readSessionValue(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const existingSession = sessionStorage.getItem(STORAGE_KEY);
    if (existingSession && typeof existingSession === "string") {
      return existingSession;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function readLegacyValue(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const legacy = localStorage.getItem(STORAGE_KEY);
    return typeof legacy === "string" ? legacy : null;
  } catch {
    return null;
  }
}

function writeSessionValue(id: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore storage errors */
  }
}

export function persistAnonymousUserId(id: string): void {
  writeSessionValue(id);
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function peekAnonymousUserId(): string | null {
  return readSessionValue() ?? readLegacyValue();
}

export function getAnonymousUserId(): string {
  try {
    const sessionValue = readSessionValue();
    if (sessionValue) {
      return sessionValue;
    }

    const legacyValue = readLegacyValue();
    if (legacyValue) {
      persistAnonymousUserId(legacyValue);
      return legacyValue;
    }

    const id = generateAnonymousId();
    writeSessionValue(id);
    return id;
  } catch {
    // Fallback when storage is unavailable (server-side render, private mode, etc.)
    return generateAnonymousId();
  }
}

export function resetAnonymousUserId(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore storage errors */
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore storage errors */
  }
}
