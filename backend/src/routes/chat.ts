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
 */
import express from "express";
import { extractFilters, generateResponse, type ChatMessage } from "../utils/geminiChat.js";
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

  // ── 1. Extract filters from user message ─────────────────────────────────
  const filters = await extractFilters(message, history);
  console.log(`[Chat] Filters:`, filters);

  // ── 2. Query database with extracted filters ──────────────────────────────
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

  if (filters.keywords && filters.keywords.length > 0) {
    const keywordOr = filters.keywords.flatMap((kw) => [
      { name:   { $regex: kw, $options: "i" } },
      { nameTh: { $regex: kw, $options: "i" } },
      { tags:   { $regex: kw, $options: "i" } },
    ]);
    // Merge with existing $or if any, otherwise set
    dbFilter.$or = keywordOr;
  }

  // Sort
  let sortField: Record<string, 1 | -1> = { minPrice: 1 }; // default: cheapest first
  if (filters.sortBy === "rating")  sortField = { "prices.0.rating": -1 };
  if (filters.sortBy === "reviews") sortField = { "prices.0.reviews": -1 };
  if (filters.sortBy === "price")   sortField = { minPrice: 1 };

  const products = await Product.find(dbFilter)
    .sort(sortField)
    .limit(6)
    .lean();

  console.log(`[Chat] Found ${products.length} products for: "${message}"`);

  // ── 3. Build product summaries for Gemini ────────────────────────────────
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

  // ── 4. Generate Thai response ─────────────────────────────────────────────
  const aiMessage = await generateResponse(message, history, summaries, filters);

  return res.json({
    message: aiMessage,
    products,
    filters,
  });
});

export default router;
