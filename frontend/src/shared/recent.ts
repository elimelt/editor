export type RecentFile = { owner: string; repo: string; branch: string; path: string; at: number };
export type PinnedRepo = { owner: string; repo: string; at: number };

const RECENT_KEY = 'recent_files_v1';
const PINNED_KEY = 'pinned_repos_v1';

export function getRecentFiles(): RecentFile[] {
  try {
    const raw = sessionStorage.getItem(RECENT_KEY) || localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as RecentFile[];
  } catch {
    return [];
  }
}

export function addRecentFile(file: Omit<RecentFile, 'at'>) {
  const list = getRecentFiles().filter((f) => !(f.owner === file.owner && f.repo === file.repo && f.path === file.path && f.branch === file.branch));
  list.unshift({ ...file, at: Date.now() });
  const trimmed = list.slice(0, 30);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(trimmed)); } catch {}
}

export function getPinnedRepos(): PinnedRepo[] {
  try {
    const raw = localStorage.getItem(PINNED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as PinnedRepo[];
  } catch {
    return [];
  }
}

export function togglePinnedRepo(owner: string, repo: string) {
  const list = getPinnedRepos();
  const found = list.findIndex((r) => r.owner === owner && r.repo === repo);
  if (found >= 0) list.splice(found, 1);
  else list.unshift({ owner, repo, at: Date.now() });
  try { localStorage.setItem(PINNED_KEY, JSON.stringify(list.slice(0, 50))); } catch {}
}


