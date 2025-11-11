import {
  fetchUserIdentity,
  type UserIdentityKind,
  type UserIdentityResponse,
} from "../api/identity";
import {
  getAnonymousUserId,
  peekAnonymousUserId,
  persistAnonymousUserId,
} from "./utils/anonymousUser";

type StoredIdentity = {
  user_id: string;
  kind: UserIdentityKind;
  registered_user_id: number | null;
};

const IDENTITY_STORAGE_KEY = "user_identity";

let cachedIdentity: StoredIdentity | null = readStoredIdentity();
let inFlight: Promise<void> | null = null;

function readStoredIdentity(): StoredIdentity | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = sessionStorage.getItem(IDENTITY_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as Partial<StoredIdentity>;
    if (!parsed || typeof parsed.user_id !== "string") {
      return null;
    }

    if (parsed.kind !== "anonymous" && parsed.kind !== "registered") {
      return null;
    }

    return {
      user_id: parsed.user_id,
      kind: parsed.kind,
      registered_user_id:
        typeof parsed.registered_user_id === "number"
          ? parsed.registered_user_id
          : null,
    };
  } catch {
    return null;
  }
}

function persistIdentity(identity: StoredIdentity): void {
  cachedIdentity = identity;
  if (typeof window === "undefined") {
    return;
  }

  try {
    sessionStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(identity));
  } catch {
    /* ignore storage errors */
  }
}

function normalizeIdentity(identity: UserIdentityResponse): StoredIdentity {
  return {
    user_id: identity.user_id,
    kind: identity.kind,
    registered_user_id:
      typeof identity.registered_user_id === "number"
        ? identity.registered_user_id
        : null,
  };
}

export function getCachedUserIdentity(): StoredIdentity | null {
  if (!cachedIdentity) {
    cachedIdentity = readStoredIdentity();
  }
  return cachedIdentity;
}

export function clearCachedUserIdentity(): void {
  cachedIdentity = null;
  if (typeof window === "undefined") {
    return;
  }

  try {
    sessionStorage.removeItem(IDENTITY_STORAGE_KEY);
  } catch {
    /* ignore storage errors */
  }
}

export function getCanonicalUserId(authUserId?: number | string | null): string {
  const identity = getCachedUserIdentity();

  if (identity?.kind === "registered") {
    return identity.user_id;
  }

  if (!authUserId && identity?.kind === "anonymous") {
    return identity.user_id;
  }

  if (typeof authUserId === "number") {
    const storedIdentity: StoredIdentity = {
      user_id: String(authUserId),
      kind: "registered",
      registered_user_id: authUserId,
    };
    persistIdentity(storedIdentity);
    return storedIdentity.user_id;
  }

  if (typeof authUserId === "string" && authUserId.trim().length > 0) {
    const trimmedId = authUserId.trim();
    const numericValue = Number(trimmedId);
    const storedIdentity: StoredIdentity = {
      user_id: trimmedId,
      kind: "registered",
      registered_user_id: Number.isFinite(numericValue) ? numericValue : null,
    };
    persistIdentity(storedIdentity);
    return storedIdentity.user_id;
  }

  const storedAnon = peekAnonymousUserId();
  if (storedAnon) {
    const storedIdentity: StoredIdentity = {
      user_id: storedAnon,
      kind: "anonymous",
      registered_user_id: null,
    };
    persistIdentity(storedIdentity);
    return storedAnon;
  }

  const generated = getAnonymousUserId();
  const storedIdentity: StoredIdentity = {
    user_id: generated,
    kind: "anonymous",
    registered_user_id: null,
  };
  persistIdentity(storedIdentity);
  return generated;
}

export async function syncUserIdentity(accessToken?: string | null): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  if (inFlight) {
    return inFlight;
  }

  inFlight = (async () => {
    try {
      const candidateId =
        cachedIdentity?.kind === "anonymous"
          ? cachedIdentity.user_id
          : peekAnonymousUserId();
      const identity = await fetchUserIdentity(accessToken, candidateId);
      const normalizedIdentity = normalizeIdentity(identity);
      persistIdentity(normalizedIdentity);
      if (identity.kind === "anonymous") {
        persistAnonymousUserId(identity.user_id);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to synchronize user identity", error);
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
