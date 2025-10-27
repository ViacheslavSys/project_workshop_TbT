const API_BASE =
  (import.meta as any)?.env?.VITE_API_URL?.replace(/\/+$/, "") ||
  "http://localhost:8000";

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

  const res = await fetch(`${API_BASE}/dialog/chat`, {
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

  const res = await fetch(`${API_BASE}/dialog/chat`, {
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
  const url = new URL(`${API_BASE}/risk-profile/questions`);
  if (userId) url.searchParams.set("user_id", userId);
  const res = await fetch(url.toString());
  return handleResponse<RiskQuestion[]>(res);
}

export async function submitRiskAnswers(
  userId: string,
  answers: RiskAnswerPayload[],
) {
  const url = new URL(`${API_BASE}/risk-profile/answers`);
  url.searchParams.set("user_id", userId);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(answers),
  });
  return handleResponse<RiskAnswersResponse>(res);
}

export async function clarifyRiskProfile(
  userId: string,
  clarifications: Array<{ code: string; answer: string }>,
) {
  const url = new URL(`${API_BASE}/risk-profile/clarify`);
  url.searchParams.set("user_id", userId);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(clarifications),
  });
  return handleResponse<RiskAnswersResponse>(res);
}

export async function fetchRiskResult(userId: string) {
  const url = new URL(`${API_BASE}/risk-profile/result`);
  url.searchParams.set("user_id", userId);
  const res = await fetch(url.toString());
  return handleResponse<RiskProfileResult>(res);
}

export function getAnonymousUserId() {
  const storageKey = "anon_user_id";
  try {
    const existing = window.localStorage.getItem(storageKey);
    if (existing) return existing;
    const generated = crypto.randomUUID();
    window.localStorage.setItem(storageKey, generated);
    return generated;
  } catch {
    return crypto.randomUUID();
  }
}

