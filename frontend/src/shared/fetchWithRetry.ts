export type FetchOptions = RequestInit & { timeoutMs?: number; retries?: number };

export async function fetchWithRetry(url: string, options: FetchOptions = {}): Promise<Response> {
  const { timeoutMs = 15000, retries = 1, ...init } = options;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (res.status === 429 || res.status === 403) {
      const retryAfter = parseInt(res.headers.get('retry-after') || '0', 10);
      if (retries > 0) {
        const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000;
        await new Promise((r) => setTimeout(r, delay));
        return fetchWithRetry(url, { ...options, retries: retries - 1 });
      }
    }
    return res;
  } finally {
    clearTimeout(id);
  }
}


