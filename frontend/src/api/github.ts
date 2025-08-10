import { fetchWithRetry } from '@/shared/fetchWithRetry';

export type GitHubContentResponse = {
  sha: string;
  content: string;
};

export type GitHubUser = { login: string };

const API_BASE = (import.meta as any).env?.VITE_API_BASE || '/api';

export function readAccessTokenFromHashOrSession(): string | null {
  const hash = window.location.hash || '';
  const match = hash.match(/access_token=([^&]+)/);
  if (match) {
    const token = decodeURIComponent(match[1]);
    sessionStorage.setItem('gh_access_token', token);
    history.replaceState(null, '', window.location.pathname + window.location.search);
    return token;
  }
  const fromSession = sessionStorage.getItem('gh_access_token');
  return fromSession || null;
}

export function clearToken() {
  sessionStorage.removeItem('gh_access_token');
}

async function githubFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = sessionStorage.getItem('gh_access_token');
  if (!token) throw new Error('Missing access token');
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `token ${token}`);
  headers.set('Accept', 'application/vnd.github+json');
  return fetchWithRetry(`https://api.github.com${path}`, {
    ...options,
    headers,
    // Secondary rate limits can be transient
    // Let fetchWithRetry handle simple retry-on-403/429
    retries: 1,
  } as any);
}

export async function getMe(): Promise<GitHubUser> {
  const res = await githubFetch('/user');
  if (!res.ok) throw await errorFromResponse(res);
  return res.json();
}

export async function getFile(owner: string, repo: string, path: string, branch: string): Promise<GitHubContentResponse> {
  const res = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`);
  if (!res.ok) throw await errorFromResponse(res);
  return res.json();
}

export async function putFile(
  owner: string,
  repo: string,
  path: string,
  branch: string,
  message: string,
  contentBase64: string,
  sha: string,
) {
  const body = { message, content: contentBase64, branch, sha };
  const res = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await errorFromResponse(res);
  return res.json();
}

export function loginRedirect() {
  window.location.href = `${API_BASE}/auth/login`;
}

export function toBase64Unicode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

export function fromBase64Unicode(b64: string): string {
  return decodeURIComponent(escape(atob(b64)));
}

export class HttpError extends Error {
  status: number;
  statusText: string;
  body: string | object | null;
  constructor(status: number, statusText: string, body: string | object | null) {
    super(`${status} ${statusText}`);
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

async function errorFromResponse(res: Response): Promise<HttpError> {
  const ct = res.headers.get('content-type') || '';
  let body: string | object | null = null;
  try {
    if (ct.includes('application/json')) body = await res.json();
    else body = await res.text();
  } catch {
    body = null;
  }
  return new HttpError(res.status, res.statusText, body);
}


