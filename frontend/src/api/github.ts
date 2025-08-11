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
    retries: 1,
  } as any);
}

export async function getMe(): Promise<GitHubUser> {
  const res = await githubFetch('/user');
  if (!res.ok) throw await errorFromResponse(res);
  return res.json();
}

export type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  default_branch: string;
  private: boolean;
  fork: boolean;
  archived: boolean;
  owner: { login: string };
  description?: string | null;
  updated_at: string;
  permissions?: { push?: boolean };
};

export async function listEditableRepos(limit: number = 30): Promise<GitHubRepo[]> {
  const search = new URLSearchParams({
    per_page: '100',
    sort: 'updated',
    direction: 'desc',
    affiliation: 'owner,collaborator,organization_member',
    visibility: 'all',
  });
  const res = await githubFetch(`/user/repos?${search.toString()}`);
  if (!res.ok) throw await errorFromResponse(res);
  const repos = (await res.json()) as GitHubRepo[];
  const filtered = repos
    .filter((r) => !r.archived && (r.permissions?.push ?? false))
    .slice(0, Math.max(0, limit));
  return filtered;
}

export type GitHubSearchRepoItem = Pick<GitHubRepo, 'name' | 'full_name' | 'owner' | 'description' | 'default_branch'>;

export async function searchRepositories(query: string, limit: number = 10): Promise<GitHubSearchRepoItem[]> {
  const q = query.trim();
  if (!q) return [];
  const search = new URLSearchParams({
    q,
    per_page: String(Math.min(Math.max(limit, 1), 50)),
    sort: 'stars',
    order: 'desc',
  });
  const res = await githubFetch(`/search/repositories?${search.toString()}`);
  if (!res.ok) throw await errorFromResponse(res);
  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];
  return items.map((i: any) => ({
    name: i.name,
    full_name: i.full_name,
    owner: { login: i.owner?.login || '' },
    description: i.description,
    default_branch: i.default_branch || 'main',
  }));
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

export async function createFile(
  owner: string,
  repo: string,
  path: string,
  branch: string,
  message: string,
  contentBase64: string,
) {
  const body = { message, content: contentBase64, branch };
  const res = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await errorFromResponse(res);
  return res.json();
}

export async function deleteFile(
  owner: string,
  repo: string,
  path: string,
  branch: string,
  message: string,
  sha: string,
) {
  const body = { message, branch, sha };
  const res = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await errorFromResponse(res);
  return res.json();
}

export function loginRedirect() {
  const returnTo = window.location.search || '';
  const url = new URL(`${API_BASE}/auth/login`, window.location.origin);
  if (returnTo) url.searchParams.set('return_to', returnTo);
  window.location.href = url.toString();
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

export type GitHubDirEntry = {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
};

export async function listDirectory(owner: string, repo: string, path: string, branch: string): Promise<GitHubDirEntry[]> {
  const cleanPath = path.replace(/^\/+|\/+$/g, '');
  const qs = new URLSearchParams();
  if (branch) qs.set('ref', branch);
  const suffix = cleanPath ? `/${encodeURIComponent(cleanPath)}` : '';
  const res = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents${suffix}?${qs.toString()}`);
  if (!res.ok) throw await errorFromResponse(res);
  const data = await res.json();
  if (Array.isArray(data)) {
    return data as GitHubDirEntry[];
  }
  if (data && data.type === 'file') return [data as GitHubDirEntry];
  return [];
}


