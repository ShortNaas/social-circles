import { useAuth } from "@clerk/react";

export function useAuthFetch() {
  const { getToken } = useAuth();

  return async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = await getToken();
    const headers = new Headers(options.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { ...options, credentials: "include", headers });
  };
}
