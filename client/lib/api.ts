export function createAuthHeaders(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function authenticatedFetch(
  url: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = {
    ...createAuthHeaders(token),
    ...(options.headers || {}),
  };

  return fetch(url, {
    ...options,
    headers,
  });
}
