import { buildUrl, handleResponse } from "./http";

export type UserIdentityKind = "anonymous" | "registered";

export type UserIdentityResponse = {
  user_id: string;
  kind: UserIdentityKind;
  registered_user_id?: number | null;
};

export async function fetchUserIdentity(
  token?: string | null,
  currentId?: string | null,
): Promise<UserIdentityResponse> {
  const headers: HeadersInit = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = buildUrl(
    "/users/identity",
    currentId ? { current_id: currentId } : undefined,
  );

  const response = await fetch(url, {
    method: "GET",
    headers,
    credentials: "include",
  });

  return handleResponse<UserIdentityResponse>(response);
}
