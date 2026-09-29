/**
 * cloudflareVision.ts — Identify a product using Cloudflare Workers AI (Llama 3.2 Vision).
 *
 * Free tier: 10,000 neurons/day — reliable, no 503 issues.
 * Docs: https://developers.cloudflare.com/workers-ai/models/llama-3.2-11b-vision-instruct/
 *
 * Required env vars:
 *   CF_ACCOUNT_ID  — from Cloudflare dashboard URL (32-char hex)
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

// Only models confirmed to exist at Cloudflare Workers AI
// @cf/meta/llama-3.2-90b-vision-instruct → "No route for that URI" — removed
const CF_VISION_MODELS = [
  "@cf/meta/llama-3.2-11b-vision-instruct",
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

/**
 * Call Cloudflare Workers AI vision model.
 * Handles the "Model Agreement" 403 automatically by sending "agree" first.
 */
async function callCloudflare(
  url: string,
  base64Image: string,
  mimeType: string,
  apiToken: string
): Promise<string> {
  const headers = {
    "Authorization": `Bearer ${apiToken}`,
    "Content-Type": "application/json",
  };

  // OpenAI-compatible content array format (works with CF's Llama 3.2 Vision)
  const payload = {
    messages: [{
      role: "user",
      content: [
        { type: "text", text: PROMPT },
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
      ],
    }],
    max_tokens: 1024,
    temperature: 0.1,
  };

  let response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  // Handle Llama license agreement (one-time, stored per account)
  if (response.status === 403) {
    const errText = await response.text();
    if (errText.includes("Model Agreement") || errText.includes("agree")) {
      console.log("[CFVision] License agreement required — auto-agreeing to Llama terms...");
      // Submit "agree" to accept Meta Llama license
      await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ prompt: "agree" }),
      });
      // Retry the real request
      response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
    } else {
      throw Object.assign(new Error(errText.slice(0, 300)), { status: 403 });
    }
  }

  if (!response.ok) {
    const errBody = await response.text();
    throw Object.assign(new Error(errBody.slice(0, 300)), { status: response.status });
  }

  const json = await response.json() as {
    result?: unknown;
    success?: boolean;
    errors?: { message: string }[];
  };

  if (json.success === false) {
    const msg = (json.errors as any)?.[0]?.message ?? "Unknown Cloudflare error";
    throw new Error(msg);
  }

  // Log full result to diagnose the actual response structure
  console.log("[CFVision] Raw result:", JSON.stringify(json.result).slice(0, 500));

  // Handle different Cloudflare response formats robustly
  const r = json.result as any;
  let rawText = "";

  if (typeof r?.response === "string") {
    rawText = r.response;                            // standard CF string format
  } else if (r?.response && typeof r.response === "object") {
    // Cloudflare returned an already-parsed JSON object — stringify for parseResponse
    rawText = JSON.stringify(r.response);
  } else if (Array.isArray(r?.choices)) {
    rawText = r.choices[0]?.message?.content ?? "";  // OpenAI-compatible output
  } else if (typeof r?.generated_text === "string") {
    rawText = r.generated_text;                      // HuggingFace-style
  } else if (typeof r === "string") {
    rawText = r;                                     // plain string result
  } else {
    console.warn("[CFVision] Unknown response structure:", JSON.stringify(r).slice(0, 300));
    throw new Error("CF: unexpected response format — " + JSON.stringify(r).slice(0, 150));
  }

  return rawText.trim();
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

      // Model name contains @ and / — do NOT encodeURIComponent
      const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

      const text = await callCloudflare(url, base64Image, mimeType, apiToken);
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
      continue;
    }
  }

  throw lastError ?? new Error("All Cloudflare vision models unavailable");
}
