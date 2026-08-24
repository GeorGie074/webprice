/**
 * LINE Notify helper
 * Docs: https://notify-bot.line.me/doc/en/
 *
 * Each user gets their own personal access token from notify.line.me
 * We just POST to the API with their token.
 */

export interface LineNotifyOptions {
  token: string;
  message: string;
  imageUrl?: string;
}

/**
 * Send a LINE Notify message.
 * Returns true on success, false on failure (never throws).
 */
export async function sendLineNotify(opts: LineNotifyOptions): Promise<boolean> {
  if (!opts.token || !opts.message) return false;

  try {
    const body = new URLSearchParams({ message: opts.message });
    if (opts.imageUrl) {
      body.append("imageThumbnail", opts.imageUrl);
      body.append("imageFullsize", opts.imageUrl);
    }

    const res = await fetch("https://notify-api.line.me/api/notify", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const json = (await res.json()) as { status: number; message: string };

    if (res.ok) {
      console.log(`[LINE Notify] ✅ Sent: ${json.message}`);
      return true;
    } else {
      console.error(`[LINE Notify] ❌ Error ${res.status}: ${json.message}`);
      return false;
    }
  } catch (err) {
    console.error(`[LINE Notify] ❌ Network error:`, (err as Error).message);
    return false;
  }
}

/** Build the price alert message string */
export function buildPriceAlertMessage(opts: {
  productName: string;
  targetPrice: number;
  currentPrice: number;
  productUrl: string;
}): string {
  const diff = opts.targetPrice - opts.currentPrice;
  const pct = opts.targetPrice > 0
    ? Math.round((diff / opts.targetPrice) * 100)
    : 0;

  return (
    `\n🎉 ราคาถึงเป้าหมายแล้ว!\n\n` +
    `📦 ${opts.productName}\n` +
    `🎯 เป้าหมาย: ฿${opts.targetPrice.toLocaleString("th-TH")}\n` +
    `💰 ราคาปัจจุบัน: ฿${opts.currentPrice.toLocaleString("th-TH")}` +
    (pct > 0 ? ` (ลด ${pct}%)` : "") +
    `\n\n🔗 ${opts.productUrl}`
  );
}
