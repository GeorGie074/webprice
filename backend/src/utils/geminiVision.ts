/**
 * geminiVision.ts — Identify a product from an image using Google Gemini.
 *
 * Uses direct fetch to avoid SDK throttling.
 * Tries v1beta first (newer models live there), falls back to v1.
 * Includes older stable models (1.5-flash) with higher daily quotas as last resort.
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

// (model, apiVersion) — tried in order; v1beta first since newer models live there
const MODEL_SEQUENCE: Array<{ model: string; apiVersion: "v1beta" | "v1" }> = [
  { model: "gemini-2.5-flash", apiVersion: "v1beta" }, // newest model on beta
  { model: "gemini-2.5-flash", apiVersion: "v1"     }, // same, stable endpoint
  { model: "gemini-2.0-flash", apiVersion: "v1beta" }, // slightly older
  { model: "gemini-2.0-flash", apiVersion: "v1"     },
  { model: "gemini-1.5-flash", apiVersion: "v1"     }, // 1500 RPD quota (high limit)
  { model: "gemini-1.5-flash", apiVersion: "v1beta" },
  { model: "gemini-1.5-pro",   apiVersion: "v1"     }, // pro fallback
];

async function callGemini(
  modelName: string,
  apiVersion: "v1beta" | "v1",
  base64Image: string,
  mimeType: string,
  apiKey: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: PROMPT },
          { inlineData: { mimeType, data: base64Image } },
        ],
      }],
      generationConfig: { maxOutputTokens: 500, temperature: 0.1 },
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
}

function parseResponse(text: string): ProductIdentification | null {
  if (!text || text === "null") return null;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) { console.warn("[GeminiVision] No JSON:", text.slice(0, 200)); return null; }
  try {
    const parsed: ProductIdentification = JSON.parse(jsonMatch[0]);
    if (!parsed.brand || !parsed.name || !Array.isArray(parsed.keywords)) {
      console.warn("[GeminiVision] Incomplete:", parsed); return null;
    }
    return parsed;
  } catch {
    console.warn("[GeminiVision] JSON parse failed:", text.slice(0, 200)); return null;
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
        console.log(`[GeminiVision] ${model} response:`, text.slice(0, 200));
        const parsed = parseResponse(text);
        if (parsed) console.log(`[GeminiVision] ✅ ${parsed.brand} ${parsed.model} (${parsed.confidence})`);
        return parsed;
      } catch (err: any) {
        lastError = err as Error;
        const status = err?.status ?? 0;
        const msg = lastError.message;
        const is503 = status === 503 || msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("high demand");
        const is404 = status === 404 || msg.includes("404") || msg.includes("not found");
        const isGone = msg.includes("no longer available") || msg.includes("deprecated");

        console.warn(`[GeminiVision] ❌ ${model} (${apiVersion}) attempt=${attempt} status=${status}:`, msg.slice(0, 120));

        if (is404 || isGone) {
          break; // model not available at this endpoint, skip to next combo
        } else if (is503 && attempt < 2) {
          const wait = 3000; // 3s pause before retry
          console.log(`[GeminiVision] 503 → waiting ${wait}ms...`);
          await new Promise(r => setTimeout(r, wait));
        } else {
          break; // exhausted retries → try next combo
        }
      }
    }
  }

  throw lastError ?? new Error("All Gemini models unavailable");
}
