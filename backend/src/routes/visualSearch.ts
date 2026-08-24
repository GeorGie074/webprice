/**
 * visualSearch.ts — POST /api/visual-search
 *
 * Accepts a base64-encoded product image, identifies the product via Gemini Flash,
 * then searches the local database for matching products.
 *
 * Request body (JSON):
 *   { image: string (base64), mimeType?: string }
 *
 * Response:
 *   { identification: ProductIdentification | null, products: Product[], searchKeyword: string }
 */
import express from "express";
import { identifyProductFromImage } from "../utils/geminiVision.js";
import Product from "../models/Product.js";

const router = express.Router();

// GET /api/visual-search/models — list all models available for this API key
router.get("/models", async (_req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY ?? "";
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const data = await resp.json() as { models?: { name: string; supportedGenerationMethods?: string[] }[]; error?: unknown };
    if (data.error) return res.json({ error: data.error });
    const models = (data.models ?? []).map((m) => ({
      name: m.name,
      supportsGenerate: m.supportedGenerationMethods?.includes("generateContent"),
    }));
    console.log("[VisualSearch] Available models:", models);
    return res.json({ models });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/", async (req, res) => {
  const { image, mimeType = "image/jpeg" } = req.body as {
    image?: string;
    mimeType?: string;
  };

  if (!image) {
    return res.status(400).json({ error: "image (base64) is required" });
  }

  // ── 1. Identify product with Gemini Vision ──────────────────────────────────
  let identification;
  try {
    identification = await identifyProductFromImage(image, mimeType);
  } catch (err) {
    const msg = (err as Error).message;
    console.error("[VisualSearch] Gemini error:", msg);
    // Surface the real error to the frontend for easier debugging
    return res.status(502).json({
      error: `Gemini API error: ${msg}`,
      identification: null,
      products: [],
      searchKeyword: "",
    });
  }

  if (!identification) {
    return res.status(422).json({
      error: "ไม่สามารถระบุสินค้าจากรูปภาพได้ กรุณาลองใช้รูปที่ชัดกว่านี้",
      identification: null,
      products: [],
      searchKeyword: "",
    });
  }

  // ── 2. Build search query from identification ───────────────────────────────
  // Priority: model > brand+model > each keyword individually
  const searchTerms: string[] = [];

  if (identification.model)
    searchTerms.push(identification.model);
  if (identification.brand && identification.model)
    searchTerms.push(`${identification.brand} ${identification.model}`);
  identification.keywords.forEach((kw) => {
    if (kw && !searchTerms.includes(kw)) searchTerms.push(kw);
  });
  if (identification.brand)
    searchTerms.push(identification.brand);

  // OR-based regex search across all terms
  const orClauses = searchTerms.flatMap((term) => [
    { name:   { $regex: term, $options: "i" } },
    { nameTh: { $regex: term, $options: "i" } },
    { brand:  { $regex: term, $options: "i" } },
    { tags:   { $regex: term, $options: "i" } },
  ]);

  // ── 3. Query DB ─────────────────────────────────────────────────────────────
  const products = await Product.find({
    hidden: { $ne: true },
    $or: orClauses,
  })
    .limit(12)
    .lean();

  // Best keyword for "search all platforms" fallback link
  const searchKeyword =
    identification.model ||
    identification.keywords[0] ||
    `${identification.brand} ${identification.name}`;

  console.log(
    `[VisualSearch] "${identification.brand} ${identification.model}" → ${products.length} DB results`
  );

  return res.json({ identification, products, searchKeyword });
});

export default router;
