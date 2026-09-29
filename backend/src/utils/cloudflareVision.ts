/**
 * cloudflareVision.ts — Identify a product using Cloudflare Workers AI (Llama 3.2 Vision).
 *
 * Free tier: 10,000 neurons/day — reliable, fast, no 503 issues.
 * Docs: https://developers.cloudflare.com/workers-ai/models/llama-3.2-11b-vision-instruct/
 *
 * Required env vars:
 *   CF_ACCOUNT_ID  — from Cloudflare dashboard (right sidebar)
 *   CF_API_TOKEN   — API token with "Workers AI: Run" permission
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

// Vision models available on Cloudflare Workers AI
const CF_VISION_MODELS = [
  "@cf/meta/llama-3.2-11b-vision-instruct",
  "@cf/meta/llama-3.2-90b-vision-instruct",
];

function parseResponse(text: string): ProductIdentification | null {
  if (!text || text.trim() === "null") return null;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.warn("[CFVision] No JSON in response:", text.slice(0, 200));
    return null;
  }
  try {
    const parsed: ProductIdentification = JSON.parse(jsonMatch[0]);
    if (!parsed.brand || !parsed.name || !Array.isArray(parsed.keywords)) {
      console.warn("[CFVision] Incomplete:", parsed);
      return null;
    }
    return parsed;
  } catch {
    console.warn("[CFVision] JSON parse failed:", text.slice(0, 200));
    return null;
  }
}

export async function identifyProductWithCloudflare(
  base64Image: string,
  mimeType: string = "image/jpeg"
): Promise<ProductIdentification | null> {
  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken  = process.env.CF_API_TOKEN;

  if (!accountId || !apiToken) {
    console.log("[CFVision] CF_ACCOUNT_ID or CF_API_TOKEN not set — skipping");
    return null;
  }

  let lastError: Error | null = null;

  for (const model of CF_VISION_MODELS) {
    try {
      console.log(`[CFVision] Trying ${model}...`);

      // URL-encode the model name (contains @ and / characters)
      const encodedModel = encodeURIComponent(model);
      const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${encodedModel}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [{
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64Image}` },
              },
            ],
          }],
          max_tokens: 500,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw Object.assign(new Error(errBody.slice(0, 300)), { status: response.status });
      }

      const json = await response.json() as {
        result?: { response?: string };
        success?: boolean;
        errors?: { message: string }[];
      };

      if (!json.success) {
        const msg = json.errors?.[0]?.message ?? "Unknown Cloudflare error";
        throw new Error(msg);
      }

      const text = json.result?.response?.trim() ?? "";
      console.log(`[CFVision] ${model} response:`, text.slice(0, 200));

      const parsed = parseResponse(text);
      if (parsed) {
        console.log(`[CFVision] ✅ ${parsed.brand} ${parsed.model} (${parsed.confidence})`);
      }
      return parsed;

    } catch (err: any) {
      lastError = err as Error;
      const status = err?.status ?? 0;
      console.warn(`[CFVision] ❌ ${model} status=${status}:`, lastError.message.slice(0, 120));
      continue; // try next model
    }
  }

  throw lastError ?? new Error("All Cloudflare vision models unavailable");
}
