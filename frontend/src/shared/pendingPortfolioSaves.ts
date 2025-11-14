import { savePortfolioToDb } from "../api/portfolios";
import { isValidAnonymousUserId } from "./utils/anonymousUser";

export type PendingPortfolioSave = {
  sessionUserId: string;
  portfolioName: string;
  createdAt: number;
};

const STORAGE_KEY = "pending_portfolio_saves_v1";
const MAX_QUEUE_SIZE = 5;
let flushInProgress = false;
let rerunRequested = false;
let lastKnownToken: string | null = null;

function isPendingEntry(value: unknown): value is PendingPortfolioSave {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PendingPortfolioSave>;
  const normalizedId =
    typeof candidate.sessionUserId === "string"
      ? candidate.sessionUserId.trim()
      : "";
  const normalizedName =
    typeof candidate.portfolioName === "string"
      ? candidate.portfolioName.trim()
      : "";
  if (!isValidAnonymousUserId(normalizedId) || !normalizedName) {
    return false;
  }

  candidate.sessionUserId = normalizedId;
  candidate.portfolioName = normalizedName;

  return (
    typeof candidate.createdAt === "number" &&
    Number.isFinite(candidate.createdAt)
  );
}

function readQueue(): PendingPortfolioSave[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue = window.sessionStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isPendingEntry);
  } catch {
    return [];
  }
}

function writeQueue(queue: PendingPortfolioSave[]): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (!queue.length) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    /* ignore storage errors */
  }
}

export function enqueuePendingPortfolioSave(entry: PendingPortfolioSave): void {
  const normalizedUserId = entry.sessionUserId.trim();
  const normalizedName = entry.portfolioName.trim();
  if (!isValidAnonymousUserId(normalizedUserId) || !normalizedName) {
    return;
  }

  const queue = readQueue();
  queue.push({
    sessionUserId: normalizedUserId,
    portfolioName: normalizedName,
    createdAt: entry.createdAt,
  });

  const trimmedQueue =
    queue.length > MAX_QUEUE_SIZE
      ? queue.slice(queue.length - MAX_QUEUE_SIZE)
      : queue;

  writeQueue(trimmedQueue);
}

function shiftPendingPortfolioSave(): PendingPortfolioSave | null {
  const queue = readQueue();
  if (!queue.length) {
    return null;
  }

  const entry = queue.shift() ?? null;
  writeQueue(queue);
  return entry;
}

function prependPendingPortfolioSave(entry: PendingPortfolioSave): void {
  const queue = readQueue();
  queue.unshift(entry);
  const trimmed =
    queue.length > MAX_QUEUE_SIZE ? queue.slice(0, MAX_QUEUE_SIZE) : queue;
  writeQueue(trimmed);
}

async function runFlushCycle(token: string): Promise<number> {
  let processed = 0;
  for (;;) {
    const entry = shiftPendingPortfolioSave();
    if (!entry) {
      break;
    }

    try {
      await savePortfolioToDb(token, {
        userId: entry.sessionUserId,
        portfolioName: entry.portfolioName,
      });
      processed += 1;
    } catch (error) {
      prependPendingPortfolioSave(entry);
      throw error;
    }
  }

  return processed;
}

export async function flushPendingPortfolioSaves(
  token: string | null | undefined,
): Promise<number> {
  if (typeof window === "undefined" || !token) {
    return 0;
  }

  lastKnownToken = token;

  if (flushInProgress) {
    rerunRequested = true;
    return 0;
  }

  let processedTotal = 0;
  let shouldContinue = true;
  let nextToken = token;

  while (shouldContinue) {
    flushInProgress = true;
    try {
      processedTotal += await runFlushCycle(nextToken);
    } catch (error) {
      flushInProgress = false;
      rerunRequested = false;
      throw error;
    }

    flushInProgress = false;

    if (rerunRequested) {
      rerunRequested = false;
      nextToken = lastKnownToken ?? nextToken;
    } else {
      shouldContinue = false;
    }
  }

  return processedTotal;
}
