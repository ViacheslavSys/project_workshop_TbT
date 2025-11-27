import { buildUrl, handleResponse } from "./http";
import type { PortfolioCalculationResponse } from "./chat";

export type PortfolioSummary = {
  id: number;
  portfolio_name: string;
  target_amount: number;
  initial_capital: number;
  risk_profile: string;
  created_at: string;
  updated_at?: string | null;
};

type PortfolioListResponse = {
  portfolios: PortfolioSummary[];
};

export type ClearCacheResponse = {
  message: string;
  deleted_keys_count?: number;
  user_id?: string;
};

export type PortfolioSaveResponse = {
  message: string;
  portfolio_id: number;
  portfolio_name: string;
};

type PortfolioSavePayload = {
  userId: string;
  portfolioName: string;
};

export async function fetchUserPortfolios(
  token: string,
): Promise<PortfolioSummary[]> {
  const res = await fetch(buildUrl("/portfolios/user"), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await handleResponse<PortfolioListResponse>(res);
  return Array.isArray(data.portfolios) ? data.portfolios : [];
}

export async function fetchPortfolioById(
  token: string,
  portfolioId: string | number,
): Promise<PortfolioCalculationResponse> {
  const res = await fetch(buildUrl(`/portfolios/${portfolioId}`), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<PortfolioCalculationResponse>(res);
}

export async function savePortfolioToDb(
  token: string,
  payload: PortfolioSavePayload,
): Promise<PortfolioSaveResponse> {
  const res = await fetch(buildUrl("/portfolios/save-to-db"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      user_id: payload.userId,
      portfolio_name: payload.portfolioName,
    }),
  });

  return handleResponse<PortfolioSaveResponse>(res);
}

export async function clearUserCache(token: string) {
  const res = await fetch(buildUrl("/portfolios/cache/clear"), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<ClearCacheResponse>(res);
}
