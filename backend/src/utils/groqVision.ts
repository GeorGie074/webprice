/**
 * groqVision.ts — Identify a product from an image using Groq (Llama Vision).
 *
 * Groq free tier: ~7,000 requests/day, very fast, reliable.
 * Uses OpenAI-compatible chat completions endpoint with image_url.
 *
 * Env var required: GROQ_API_KEY  (get free at console.groq.com)
 */

import type { ProductIdentification } from "./geminiVision.js";

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

// Groq vision models — as of Sept 2026, all vision models are decommissioned
// llama-3.2-11b-vision-preview → decommissioned
// llama-3.2-90b-vision-preview → decommissioned
// meta-llama/llama-4-scout-17b-16e-instruct → 404 (no vision support)
// Keeping empty so function returns null quickly (no wasted API calls)
const GROQ_MODELS: string[] = [];

function parseResponse(text: string): ProductIdentification | null {
  if (!text || text.trim() === "null") return null;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.warn("[GroqVision] No JSON in response:", text.slice(0, 200));
    return null;
  }
  try {
    const parsed: ProductIdentification = JSON.parse(jsonMatch[0]);
    if (!parsed.brand || !parsed.name || !Array.isArray(parsed.keywords)) {
      console.warn("[GroqVision] Incomplete response:", parsed);
      return null;
    }
    return parsed;
  } catch {
    console.warn("[GroqVision] JSON parse failed:", text.slice(0, 200));
    return null;
  }
}

export async function identifyProductWithGroq(
  base64Image: string,
  mimeType: string = "image/jpeg"
): Promise<ProductIdentification | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.log("[GroqVision] GROQ_API_KEY not set — skipping");
    return null; // returns null so caller can fall back to Gemini
  }

  let lastError: Error | null = null;

  for (const model of GROQ_MODELS) {
    try {
      console.log(`[GroqVision] Trying ${model}...`);

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                },
              },
            ],
          }],
          max_tokens: 500,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw Object.assign(
          new Error(errBody.slice(0, 300)),
          { status: response.status }
        );
      }

      const json = await response.json() as {
        choices?: { message?: { content?: string } }[];
      };
      const text = json.choices?.[0]?.message?.content?.trim() ?? "";
      console.log(`[GroqVision] ${model} response:`, text.slice(0, 200));

      const parsed = parseResponse(text);
      if (parsed) {
        console.log(`[GroqVision] ✅ ${parsed.brand} ${parsed.model} (${parsed.confidence})`);
      }
      return parsed; // success (even if parsed is null = not identified)

    } catch (err: any) {
      lastError = err as Error;
      const status = err?.status ?? 0;
      const msg = lastError.message;
      console.warn(`[GroqVision] ❌ ${model} status=${status}:`, msg.slice(0, 120));

      // 404 = model not found → try next
      // 429 = rate limit → try next model
      // 503 = try next model
      // other error → skip to next model too
      continue;
    }
  }

  throw lastError ?? new Error("All Groq models unavailable");
}
