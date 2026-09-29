/**
 * chat.ts — POST /api/chat
 *
 * Conversational product search assistant.
 *
 * Request body:
 *   {
 *     message: string,
 *     history: { role: "user"|"assistant", content: string }[]
 *   }
 *
 * Response:
 *   {
 *     message: string,      — Thai-language AI response
 *     products: Product[],  — matched products from DB (max 6)
 *     filters: ChatFilters  — extracted filters for debugging
 *   }
 *
 * AI chain: Cloudflare Workers AI (Llama 3.3 70B) → Gemini (gemini-3.8-flash / 3.5-flash)
 */
import express from "express";
import { extractFilters, generateResponse, type ChatMessage, type ChatFilters } from "../utils/geminiChat.js";
import { extractFiltersWithCloudflare, generateResponseWithCloudflare } from "../utils/cloudflareChat.js";
import Product from "../models/Product.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const { message, history = [] } = req.body as {
    message?: string;
    history?: ChatMessage[];
  };

  if (!message?.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  // ── 1. Extract filters — Cloudflare → Gemini fallback ────────────────────
  let filters: ChatFilters;
  const cfFilters = await extractFiltersWithCloudflare(message, history).catch((err) => {
    console.warn("[Chat] CF filter extraction failed:", (err as Error).message.slice(0, 80));
    return null;
  });

  if (cfFilters !== null) {
    filters = cfFilters;
    console.log("[Chat] CF filters:", filters);
  } else {
    console.log("[Chat] CF filters unavailable — falling back to Gemini");
    filters = await extractFilters(message, history);
    console.log("[Chat] Gemini filters:", filters);
  }

  // ── 2. Query database with extracted filters ──────────────────────────────
  // NOTE: keywords are NOT used as DB filters — Thai product names/tags rarely
  // match English keyword extractions like "good camera". Instead, keywords are
  // forwarded to the AI as preference hints so it can recommend from the DB list.
  const dbFilter: Record<string, unknown> = { hidden: { $ne: true } };

  if (filters.category) {
    dbFilter.category = filters.category;
  }

  if (filters.maxPrice || filters.minPrice) {
    const priceFilter: Record<string, number> = {};
    if (filters.maxPrice) priceFilter.$lte = filters.maxPrice;
    if (filters.minPrice) priceFilter.$gte = filters.minPrice;
    dbFilter.minPrice = priceFilter;
  }

  if (filters.brands && filters.brands.length > 0) {
    dbFilter.brand = {
      $in: filters.brands.map((b) => new RegExp(b, "i")),
    };
  }

  // Sort
  let sortField: Record<string, 1 | -1> = { minPrice: 1 }; // default: cheapest first
  if (filters.sortBy === "rating")  sortField = { "prices.0.rating": -1 };
  if (filters.sortBy === "reviews") sortField = { "prices.0.reviews": -1 };
  if (filters.sortBy === "price")   sortField = { minPrice: 1 };

  let products = await Product.find(dbFilter)
    .sort(sortField)
    .limit(8)
    .lean();

  // If brand filter + price returns no results, widen to category + price only
  if (products.length === 0 && filters.brands && filters.brands.length > 0) {
    const { brand: _removed, ...widerFilter } = dbFilter as any;
    products = await Product.find(widerFilter).sort(sortField).limit(8).lean();
    console.log(`[Chat] Widened query (dropped brand filter): ${products.length} results`);
  }

  console.log(`[Chat] Found ${products.length} products for: "${message}"`);

  // ── 3. Build product summaries for AI ─────────────────────────────────────
  const summaries = products.map((p) => {
    const activePrices = p.prices.filter(
      (pr) => pr.available !== false
    );
    const minPrice = activePrices.length > 0
      ? Math.min(...activePrices.map((pr) => pr.price))
      : p.minPrice;
    const cheapest = activePrices.find((pr) => pr.price === minPrice);
    return {
      name:     p.nameTh || p.name,
      brand:    p.brand,
      minPrice,
      platform: cheapest?.platform ?? "",
      rating:   cheapest?.rating ?? 0,
      category: p.category,
    };
  });

  // ── 4. Generate Thai response — Cloudflare → Gemini fallback ─────────────
  const cfResponse = await generateResponseWithCloudflare(message, history, summaries, filters).catch((err) => {
    console.warn("[Chat] CF response generation failed:", (err as Error).message.slice(0, 80));
    return null;
  });

  const aiMessage = cfResponse ?? await generateResponse(message, history, summaries, filters);

  return res.json({
    message: aiMessage,
    products,
    filters,
  });
});

export default router;
