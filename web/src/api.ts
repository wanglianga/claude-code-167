const TOKEN_KEY = 'museum_staff_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}
export function setToken(t: string) {
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);
}

async function req<T>(path: string, options: RequestInit = {}, staff = false): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (staff && getToken()) headers['x-token'] = getToken();
  const res = await fetch(path, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || `请求失败(${res.status})`);
  return data as T;
}

export const api = {
  get: <T>(path: string, staff = false) => req<T>(path, {}, staff),
  post: <T>(path: string, body?: unknown, staff = false) =>
    req<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }, staff),
};
