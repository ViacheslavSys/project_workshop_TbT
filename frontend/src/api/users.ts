import { buildUrl, handleResponse } from "./http";

export type BackendUser = {
  id: number;
  username: string;
  email: string;
  last_name: string;
  first_name: string;
  middle_name?: string | null;
  birth_date: string;
  is_active: boolean;
  created_at: string;
  age: number;
};

export type RegisterUserPayload = {
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  birth_date: string;
};

export type LoginPayload = {
  username: string;
  password: string;
};

export type AuthResponse = {
  authenticated: boolean;
  user_id?: number | null;
  message?: string;
  access_token?: string | null;
  token_type?: string | null;
};

export async function registerUser(payload: RegisterUserPayload) {
  const res = await fetch(buildUrl("/users"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleResponse<BackendUser>(res);
}

export async function loginUser(payload: LoginPayload) {
  const res = await fetch(buildUrl("/users/login"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleResponse<AuthResponse>(res);
}

export async function fetchCurrentUser(token: string) {
  const res = await fetch(buildUrl("/users/me"), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<BackendUser>(res);
}
