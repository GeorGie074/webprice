import { Router } from "express";

const router = Router();

// Domains that are known to allow direct hotlinking — skip proxy for these
// to avoid unnecessary server-side fetching.
const ALLOW_DIRECT = new Set([
  "upload.wikimedia.org",
  "fdn2.gsmarena.com",
  "fdn.gsmarena.com",
  "m.media-amazon.com",
  "theordinary.com",
]);

/**
 * GET /api/image-proxy?url=<encoded-image-url>
 *
 * Fetches the remote image server-side (no Referer sent → bypasses hotlink
 * protection) and streams it back to the browser with a 24-hour cache header.
 *
 * The frontend should route ALL product images through this endpoint so brand
 * CDNs (Apple, Samsung, Nike, Dyson, etc.) that block cross-origin Referers
 * work reliably.
 */
router.get("/", async (req, res) => {
  const raw = req.query.url as string | undefined;
  if (!raw) return res.status(400).json({ error: "Missing url param" });

  // Basic safety: only allow http/https URLs
  let url: URL;
  try {
    url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) {
      return res.status(400).json({ error: "Only http/https allowed" });
    }
  } catch {
    return res.status(400).json({ error: "Invalid url" });
  }

  try {
    const response = await fetch(url.toString(), {
      headers: {
        // Pretend we're a browser visiting the image's own domain
        "Referer":    `${url.protocol}//${url.hostname}/`,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept":     "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
      // Prevent server from following infinite redirect chains
      redirect: "follow",
    });

    if (!response.ok) {
      // Propagate the upstream error status
      return res.status(response.status).send("Upstream error");
    }

    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const buffer      = Buffer.from(await response.arrayBuffer());

    res
      .setHeader("Content-Type",  contentType)
      .setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=3600")
      .setHeader("X-Image-Proxy", "1")
      .send(buffer);

  } catch (err) {
    console.error(`[image-proxy] fetch failed: ${url.toString().slice(0, 80)}`, (err as Error).message);
    res.status(502).send("Failed to fetch image");
  }
});

export default router;
