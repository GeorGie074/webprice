/**
 * geminiVision.ts — Identify a product from an image using Google Gemini.
 *
 * Uses direct fetch to avoid SDK throttling.
 * Tries v1beta first (newer models live there), falls back to v1.
 */

export interface ProductIdentification {
  brand: string;
  name: string;
  model: string;
  keywords: string[];
  category: string;
  confidence: "high" | "medium" | "low";
}

const PROMPT = `You are a product identification expert for a Thai e-commerce price comparison website.

Analyze the image and identify the product shown.

Respond with ONLY a valid JSON object — no markdown, no explanation:
{
  "brand": "brand name in English (e.g. Apple, Samsung, Sony, Nike)",
  "name": "full product name (English preferred, e.g. iPhone 15 Pro Max, Sony WH-1000XM5)",
  "model": "specific model number or name only (e.g. 15 Pro Max, WH-1000XM5, Galaxy S24 Ultra)",
  "keywords": ["2-4 short English keywords for Thai e-commerce search", "be specific"],
  "category": "one of: smartphone, laptop, tablet, audio, home, fashion, beauty, health",
  "confidence": "high if product is clearly visible, medium if partially visible, low if uncertain"
}

If you cannot identify the product at all, respond with exactly: null`;

// Model names confirmed from /api/visual-search/models for this API key
const MODEL_SEQUENCE: Array<{ model: string; apiVersion: "v1beta" | "v1" }> = [
  { model: "gemini-3.8-flash",       apiVersion: "v1beta" },
  { model: "gemini-3.8-flash",       apiVersion: "v1"     },
  { model: "gemini-3.5-flash",       apiVersion: "v1beta" },
  { model: "gemini-3.5-flash",       apiVersion: "v1"     },
  { model: "gemini-2.5-flash-image", apiVersion: "v1beta" },
  { model: "gemini-2.5-flash",       apiVersion: "v1beta" },
  { model: "gemini-2.5-flash",       apiVersion: "v1"     },
];

const FETCH_TIMEOUT_MS = 25_000; // 25 s per request — prevent hanging

async function callGemini(
  modelName: string,
  apiVersion: "v1beta" | "v1",
  base64Image: string,
  mimeType: string,
  apiKey: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${apiKey}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: PROMPT },
            { inlineData: { mimeType, data: base64Image } },
          ],
        }],
        // 1024 tokens — enough to complete the JSON without truncation
        generationConfig: { maxOutputTokens: 1024, temperature: 0.1 },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw Object.assign(new Error(errBody.slice(0, 300)), { status: response.status });
    }

    const json = await response.json() as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  } finally {
    clearTimeout(timer);
  }
}

/** Returns parsed result, "PARSE_FAILED" sentinel, or throws on HTTP error */
function parseResponse(text: string): ProductIdentification | null | "PARSE_FAILED" {
  if (!text || text.trim() === "null") return null; // model says: can't identify

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.warn("[GeminiVision] No closing } (likely truncated):", text.slice(0, 200));
    return "PARSE_FAILED"; // truncated → try next model
  }
  try {
    const parsed: ProductIdentification = JSON.parse(jsonMatch[0]);
    if (!parsed.brand || !parsed.name || !Array.isArray(parsed.keywords)) {
      console.warn("[GeminiVision] Incomplete fields:", parsed);
      return "PARSE_FAILED"; // malformed → try next model
    }
    return parsed;
  } catch {
    console.warn("[GeminiVision] JSON.parse failed:", text.slice(0, 200));
    return "PARSE_FAILED"; // parse error → try next model
  }
}

export async function identifyProductFromImage(
  base64Image: string,
  mimeType: string = "image/jpeg"
): Promise<ProductIdentification | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[GeminiVision] GEMINI_API_KEY not set");
    return null;
  }

  let lastError: Error | null = null;

  for (const { model, apiVersion } of MODEL_SEQUENCE) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[GeminiVision] Trying ${model} (${apiVersion}) attempt=${attempt}...`);
        const text = await callGemini(model, apiVersion, base64Image, mimeType, apiKey);
        console.log(`[GeminiVision] ${model} raw:`, text.slice(0, 200));

        const result = parseResponse(text);

        if (result === "PARSE_FAILED") {
          // Truncated or malformed response — skip to next model/version
          console.warn(`[GeminiVision] Parse failed for ${model} (${apiVersion}), trying next...`);
          break; // break inner loop → next MODEL_SEQUENCE entry
        }

        // result is null (model said "can't identify") or a valid object
        if (result) {
          console.log(`[GeminiVision] ✅ ${result.brand} ${result.model} (${result.confidence})`);
        } else {
          console.log(`[GeminiVision] ${model} returned null (product not identifiable)`);
        }
        return result; // null or valid — both are "model gave a definitive answer"

      } catch (err: any) {
        lastError = err as Error;
        const status = err?.status ?? 0;
        const msg = lastError.message;
        const is503 = status === 503 || msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("high demand");
        const is404 = status === 404 || msg.includes("404") || msg.includes("not found");
        const isGone = msg.includes("no longer available") || msg.includes("deprecated");
        const isTimeout = err?.name === "AbortError";

        console.warn(
          `[GeminiVision] ❌ ${model} (${apiVersion}) attempt=${attempt} status=${status}:`,
          isTimeout ? "TIMEOUT (25s)" : msg.slice(0, 120)
        );

        if (is404 || isGone) {
          break; // skip this model/version
        } else if (is503 && attempt < 2) {
          console.log("[GeminiVision] 503 → waiting 2000ms...");
          await new Promise(r => setTimeout(r, 2000)); // 2s retry (was 3s)
        } else {
          break; // exhausted retries → next combo
        }
      }
    }
  }

  throw lastError ?? new Error("All Gemini models unavailable");
}
