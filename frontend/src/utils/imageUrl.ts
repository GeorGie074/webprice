/**
 * Wrap a product image URL through the backend image proxy.
 *
 * Why: Many brand CDNs (Apple, Samsung, Nike, Dyson, CeraVe, etc.) block
 * cross-origin image requests by checking the `Referer` header. When the
 * browser loads an image directly, it sends `Referer: http://localhost:5173`
 * which the CDN rejects. The backend proxy fetches the image server-side
 * with a Referer matching the image's own domain — bypassing the restriction.
 *
 * Domains in ALLOW_DIRECT skip the proxy (no hotlink protection) to avoid
 * unnecessary server round-trips.
 *
 * Usage:
 *   <img src={proxyImage(product.image)} alt={product.name} />
 */

const ALLOW_DIRECT = new Set([
  "upload.wikimedia.org",
  "fdn2.gsmarena.com",
  "fdn.gsmarena.com",
  "m.media-amazon.com",
  "theordinary.com",
  "localhost",
  "127.0.0.1",
]);

/** Returns the URL to use in an <img src={}> — proxied or direct. */
export function proxyImage(url: string | undefined | null): string {
  if (!url || url.trim() === "") return "/placeholder-product.svg";

  try {
    const parsed = new URL(url);
    if (ALLOW_DIRECT.has(parsed.hostname)) return url;
    // Local paths (/placeholder-product.svg, /images/...) never need proxying
    if (!parsed.hostname) return url;
  } catch {
    // Relative path or invalid URL — use as-is
    return url;
  }

  return `http://localhost:5000/api/image-proxy?url=${encodeURIComponent(url)}`;
}
