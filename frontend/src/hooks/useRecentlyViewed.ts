import { useCallback } from "react";

const KEY = "pc_recently_viewed";
const MAX = 10;

/** Read the stored list of recently-viewed product IDs (most-recent first). */
export function getRecentlyViewed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

/** Hook: push a product ID to the front of the recently-viewed list. */
export function useRecentlyViewed() {
  const track = useCallback((productId: string) => {
    const current = getRecentlyViewed().filter((id) => id !== productId);
    const updated = [productId, ...current].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(updated));
  }, []);

  return { track, getAll: getRecentlyViewed };
}
