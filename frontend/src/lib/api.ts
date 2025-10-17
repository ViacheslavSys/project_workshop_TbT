// Minimal API client to talk to backend FastAPI

const API_BASE = (import.meta as any)?.env?.VITE_API_URL || "http://localhost:8000";

export async function apiChatText(userId: string, message: string): Promise<string> {
  const form = new FormData();
  form.append("user_id", userId);
  form.append("message", message);
  const res = await fetch(`${API_BASE}/dialog/chat`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Chat error: ${res.status}`);
  const data = await res.json().catch(() => ({}));
  return String(data?.response ?? "");
}

export async function apiChatAudio(userId: string, file: File): Promise<string> {
  const form = new FormData();
  form.append("user_id", userId);
  form.append("audio_file", file, file.name || "audio.webm");
  const res = await fetch(`${API_BASE}/dialog/chat`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Audio chat error: ${res.status}`);
  const data = await res.json().catch(() => ({}));
  return String(data?.response ?? "");
}

export type BackendPortfolio = {
  id: number;
  investment_amount: number;
  risk_profile: string;
  time_horizon: number;
  expected_return?: number | null;
  portfolio_risk?: number | null;
  sharpe_ratio?: number | null;
  current_cycle_phase?: string | null;
  created_at: string;
};

export async function apiListPortfolios(userId: number): Promise<BackendPortfolio[]> {
  const url = new URL(`${API_BASE}/portfolios/`);
  url.searchParams.set("user_id", String(userId));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`List portfolios error: ${res.status}`);
  return res.json();
}

export async function apiCreatePortfolio(userId: number, body: { investment_amount: number; risk_profile: string; time_horizon: number; assets?: Array<{ asset_id: number; weight: number }>; }) {
  const url = new URL(`${API_BASE}/portfolios/`);
  url.searchParams.set("user_id", String(userId));
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Create portfolio error: ${res.status}`);
  return res.json();
}

