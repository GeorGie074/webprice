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
import { identifyProductWithGroq } from "../utils/groqVision.js";
import Product from "../models/Product.js";

const router = express.Router();

// GET /api/visual-search/models — list Gemini models for this API key
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
    return res.json({ models });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/visual-search/groq-models — list Groq models to find vision-capable ones
router.get("/groq-models", async (_req, res) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.json({ error: "GROQ_API_KEY not set" });
  try {
    const resp = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await resp.json() as { data?: { id: string; object: string }[]; error?: unknown };
    if (!resp.ok || data.error) return res.json({ error: data.error });
    // Filter likely vision models
    const all = (data.data ?? []).map((m) => m.id).sort();
    const vision = all.filter((id) =>
      id.includes("vision") || id.includes("llava") || id.includes("scout") ||
      id.includes("maverick") || id.includes("llama-4") || id.includes("3.2")
    );
    return res.json({ vision, all });
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

  // ── 1. Identify product — Groq first, Gemini as fallback ───────────────────
  let identification;
  try {
    // Try Groq first (faster, more reliable free tier)
    const groqResult = await identifyProductWithGroq(image, mimeType).catch((err) => {
      console.warn("[VisualSearch] Groq failed, falling back to Gemini:", (err as Error).message.slice(0, 100));
      return null; // null = trigger Gemini fallback
    });

    if (groqResult !== null) {
      // Groq returned a result (even undefined-identification is fine here)
      identification = groqResult;
    } else {
      // Groq skipped (no key) or failed → try Gemini
      console.log("[VisualSearch] Trying Gemini...");
      identification = await identifyProductFromImage(image, mimeType);
    }
  } catch (err) {
    const msg = (err as Error).message;
    console.error("[VisualSearch] All vision APIs failed:", msg);
    return res.status(502).json({
      error: `ระบบระบุสินค้าไม่พร้อมใช้งานชั่วคราว (${msg.slice(0, 120)})`,
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
