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

const AUDIO_MIME_EXTENSIONS: Record<string, string> = {
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/ogg": "ogg",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
  "audio/mp4": "mp4",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
};

export async function sendChatAudio(
  userId: string,
  blob: Blob,
  filename?: string,
) {
  const form = new FormData();
  form.append("user_id", userId);

  const resolvedName =
    filename ||
    `voice-message.${AUDIO_MIME_EXTENSIONS[blob.type] ?? "wav"}`;

  form.append("audio_file", blob, resolvedName);

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

export type MonthlyPaymentDetail = {
  monthly_payment: number;
  future_capital: number;
  total_months: number;
  monthly_rate: number;
  annuity_factor: number;
};

export type PortfolioAssetAllocation = {
  name: string;
  type: string;
  ticker: string;
  quantity: number;
  price: number;
  weight: number;
  amount: number;
  expected_return?: number | null;
};

export type PortfolioComposition = {
  asset_type: string;
  target_weight: number;
  actual_weight: number;
  amount: number;
  assets: PortfolioAssetAllocation[];
};

export type PortfolioRecommendation = {
  target_amount: number;
  initial_capital: number;
  investment_term_months: number;
  annual_inflation_rate: number;
  future_value_with_inflation: number;
  risk_profile: string;
  time_horizon: string;
  smart_goal: string;
  total_investment: number;
  expected_portfolio_return: number;
  composition: PortfolioComposition[];
  monthly_payment_detail: MonthlyPaymentDetail;
};

export type PortfolioCalculationResponse = {
  target_amount: number;
  initial_capital: number;
  investment_term_months: number;
  annual_inflation_rate: number;
  future_value_with_inflation: number;
  recommendation?: PortfolioRecommendation | null;
};

export type PortfolioAnalysisResponse = {
  analysis: string;
};

export async function calculatePortfolio(userId: string) {
  const res = await fetch(buildUrl("/portfolios/calculate"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: userId }),
  });
  return handleResponse<PortfolioCalculationResponse>(res);
}

export async function fetchPortfolioAnalysis(userId: string) {
  const res = await fetch(buildUrl("/portfolios/analyze"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: userId }),
  });
  const data = await handleResponse<PortfolioAnalysisResponse>(res); // Исправлено с PortfolioAnalysisReponse на PortfolioAnalysisResponse
  return data.analysis;
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
export const analyzePortfolio = async (userId: string): Promise<PortfolioAnalysisResponse> => {
  const res = await fetch(buildUrl("/portfolios/analyze"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: userId }),
  });
  return handleResponse<PortfolioAnalysisResponse>(res);
};

