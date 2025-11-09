const STORAGE_KEY = "anonymous_user_id";

function generateAnonymousId() {
  return (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : `anon_${Math.random().toString(36).slice(2, 10)}`;
}

export function getAnonymousUserId(): string {
  try {
    const existingSession = sessionStorage.getItem(STORAGE_KEY);
    if (existingSession && typeof existingSession === "string") {
      return existingSession;
    }

    const legacyLocal = (() => {
      try {
        return localStorage.getItem(STORAGE_KEY);
      } catch {
        return null;
      }
    })();

    const id = legacyLocal && typeof legacyLocal === "string" ? legacyLocal : generateAnonymousId();
    sessionStorage.setItem(STORAGE_KEY, id);

    if (legacyLocal) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore cleanup failures; they don't impact session behaviour
      }
    }

    return id;
  } catch {
    // Fallback when storage is unavailable (server-side render, private mode, etc.
    return generateAnonymousId();
  }
}
