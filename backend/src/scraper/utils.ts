/**
 * Shared scraper utilities.
 */

/**
 * Normalize a URL that may come in several forms:
 *   "//cdn.lazada.co.th/..."   → "https://cdn.lazada.co.th/..."
 *   "https://..."              → "https://..."   (unchanged)
 *   "http://..."               → "http://..."    (unchanged)
 *   ""  / null / undefined     → fallback        (default "")
 *
 * Prevents the double-prefix bug: `https:${url}` when url already
 * starts with "https://" would produce "https:https://...".
 */
export function normalizeUrl(raw: string | undefined | null, fallback = ""): string {
  if (!raw) return fallback;
  if (raw.startsWith("//"))   return `https:${raw}`;
  if (raw.startsWith("http")) return raw;
  return `https://${raw}`;
}
