const KEY = "webprice_recent_searches";
const MAX  = 6;

export function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(query: string): void {
  const q = query.trim();
  if (!q) return;
  const prev  = getRecentSearches().filter((s) => s.toLowerCase() !== q.toLowerCase());
  const next  = [q, ...prev].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function clearRecentSearches(): void {
  localStorage.removeItem(KEY);
}

export function removeRecentSearch(query: string): void {
  const next = getRecentSearches().filter((s) => s !== query);
  localStorage.setItem(KEY, JSON.stringify(next));
}
