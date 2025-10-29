const API_BASE = (() => {
  const configured = (import.meta as any)?.env?.VITE_API_URL;
  if (configured) return String(configured).replace(/\/+$/, "");
  if (import.meta.env?.DEV) return "/api";
  if (typeof window !== "undefined") return window.location.origin;
  return "";
})();

function buildUrl(
  path: string,
  params?: Record<string, string | undefined>,
): string {
  const sanitizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = API_BASE.replace(/\/+$/, "");
  const raw = `${base}${sanitizedPath}` || sanitizedPath;
  const isAbsolute = /^https?:\/\//i.test(raw);
  const url = isAbsolute
    ? new URL(raw)
    : new URL(
        raw,
        typeof window !== "undefined" ? window.location.origin : "http://localhost",
      );

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.set(key, value);
    });
  }

  return url.toString();
}

type ChatBackendResponse = { response: string };

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail: string | undefined;
    try {
      const data = await res.json();
      detail = data?.detail || data?.message;
    } catch {
      /* ignore json parse errors */
    }
    throw new Error(detail || `Request failed with status ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function sendChatText(userId: string, message: string) {
  const form = new FormData();
  form.append("user_id", userId);
  form.append("message", message);

  const res = await fetch(buildUrl("/dialog/chat"), {
    method: "POST",
    body: form,
  });

  const data = await handleResponse<ChatBackendResponse>(res);
  return data.response;
}

export async function sendChatAudio(
  userId: string,
  blob: Blob,
  filename = "voice-message.webm",
) {
  const form = new FormData();
  form.append("user_id", userId);
  form.append(
    "audio_file",
    blob,
    filename.endsWith(".webm") ? filename : `${filename}.webm`,
  );

  const res = await fetch(buildUrl("/dialog/chat"), {
    method: "POST",
    body: form,
  });

  const data = await handleResponse<ChatBackendResponse>(res);
  return data.response;
}

export type RiskQuestion = {
  id: number;
  text: string;
  options: string[];
  hidden?: boolean;
};

export type RiskAnswerPayload = {
  question_id: number;
  answer: string;
};

export type RiskProfileResult = {
  profile: string;
  conservative_score: number;
  moderate_score: number;
  aggressive_score: number;
  investment_horizon?: string | null;
};

export type RiskClarifyingQuestion = {
  code: string;
  question: string;
  options: string[];
};

export type RiskAnswersResponse =
  | {
      stage: "clarification_needed";
      clarifying_questions: RiskClarifyingQuestion[];
      total_questions: number;
    }
  | {
      stage: "final";
      result: RiskProfileResult;
    };

export async function fetchRiskQuestions(userId?: string) {
  const res = await fetch(
    buildUrl("/risk-profile/questions", userId ? { user_id: userId } : undefined),
  );
  return handleResponse<RiskQuestion[]>(res);
}

export async function submitRiskAnswers(
  userId: string,
  answers: RiskAnswerPayload[],
) {
  const res = await fetch(
    buildUrl("/risk-profile/answers", { user_id: userId }),
    {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(answers),
    },
  );
  return handleResponse<RiskAnswersResponse>(res);
}

export async function clarifyRiskProfile(
  userId: string,
  clarifications: Array<{ code: string; answer: string }>,
) {
  const res = await fetch(
    buildUrl("/risk-profile/clarify", { user_id: userId }),
    {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(clarifications),
    },
  );
  return handleResponse<RiskAnswersResponse>(res);
}

export async function fetchRiskResult(userId: string) {
  const res = await fetch(buildUrl("/risk-profile/result", { user_id: userId }));
  return handleResponse<RiskProfileResult>(res);
}

let cachedAnonId: string | null = null;

export function getAnonymousUserId() {
  if (cachedAnonId) return cachedAnonId;
  try {
    cachedAnonId = crypto.randomUUID();
  } catch {
    cachedAnonId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  return cachedAnonId;
}
