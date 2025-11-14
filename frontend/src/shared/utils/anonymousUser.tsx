const STORAGE_KEY = "anonymous_user_id";
const NUMERIC_ID_REGEX = /^\d+$/;

export function isValidAnonymousUserId(value: unknown): value is string {
  return typeof value === "string" && NUMERIC_ID_REGEX.test(value);
}

function getCrypto(): Crypto | undefined {
  if (typeof globalThis !== "object") {
    return undefined;
  }

  return (globalThis as { crypto?: Crypto }).crypto;
}

function randomDigits(length: number, cryptoObj?: Crypto): string {
  if (cryptoObj?.getRandomValues) {
    const buffer = new Uint32Array(length);
    cryptoObj.getRandomValues(buffer);
    return Array.from(buffer, (value) => String(value % 10)).join("");
  }

  let digits = "";
  for (let i = 0; i < length; i += 1) {
    digits += Math.floor(Math.random() * 10).toString();
  }
  return digits;
}

function generateAnonymousId() {
  const cryptoObj = getCrypto();
  const timestampPart = Date.now().toString(); // millisecond precision keeps order
  const randomPart = randomDigits(6, cryptoObj); // add randomness for concurrency
  return `${timestampPart}${randomPart}`;
}

function readSessionValue(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const existingSession = sessionStorage.getItem(STORAGE_KEY);
    if (isValidAnonymousUserId(existingSession)) {
      return existingSession;
    }
    if (existingSession) {
      sessionStorage.removeItem(STORAGE_KEY);
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
    if (isValidAnonymousUserId(legacy)) {
      return legacy;
    }
    if (legacy) {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeSessionValue(id: string) {
  if (typeof window === "undefined" || !isValidAnonymousUserId(id)) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore storage errors */
  }
}

export function persistAnonymousUserId(id: string): void {
  if (!isValidAnonymousUserId(id)) {
    resetAnonymousUserId();
    return;
  }
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
