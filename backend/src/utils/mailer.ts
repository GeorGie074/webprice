import { Resend } from "resend";

/**
 * Lazily-created Resend client.
 * Returns null when RESEND_API_KEY is not set.
 */
let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  _resend = new Resend(key);
  return _resend;
}

/** FROM address — use a verified domain address, or fall back to Resend's test sender */
function getFrom(): string {
  return process.env.SMTP_FROM ?? "PriceCompare <onboarding@resend.dev>";
}

export interface PasswordResetMailOptions {
  to:        string;
  userName:  string;
  resetUrl:  string;
}

/**
 * Send a password-reset email.
 * Returns true on success, false if email is not configured or sending fails.
 */
export async function sendPasswordResetEmail(opts: PasswordResetMailOptions): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.log(`[mailer] RESEND_API_KEY not set — skipping reset email to ${opts.to}`);
    return false;
  }

  const from = getFrom();

  const html = `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>รีเซ็ตรหัสผ่าน</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0"
          style="background:#ffffff;border-radius:16px;overflow:hidden;
                 box-shadow:0 4px 20px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);
                       padding:28px 32px;text-align:center;">
              <p style="margin:0;color:#bfdbfe;font-size:13px;text-transform:uppercase;
                        letter-spacing:1.5px;">PriceCompare</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;">
                🔐 รีเซ็ตรหัสผ่าน
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;color:#374151;font-size:15px;">
                สวัสดีคุณ <strong>${opts.userName}</strong>,
              </p>
              <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6;">
                เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณ
                กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่
                ลิงก์นี้จะหมดอายุใน <strong>1 ชั่วโมง</strong>
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <a href="${opts.resetUrl}"
                      style="display:inline-block;background:#2563eb;color:#ffffff;
                             font-size:15px;font-weight:600;padding:14px 32px;
                             border-radius:12px;text-decoration:none;">
                      ตั้งรหัสผ่านใหม่ →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
                หากคุณไม่ได้ขอรีเซ็ตรหัสผ่าน สามารถเพิกเฉยต่ออีเมลนี้ได้เลย
                รหัสผ่านของคุณจะไม่มีการเปลี่ยนแปลงใดๆ
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:20px 32px;
                       border-top:1px solid #f3f4f6;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                PriceCompare — เปรียบเทียบราคาสินค้าออนไลน์
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    const { error } = await resend.emails.send({
      from,
      to:      opts.to,
      subject: "🔐 รีเซ็ตรหัสผ่าน PriceCompare",
      html,
    });
    if (error) {
      console.error(`[mailer] ❌ Failed reset email to ${opts.to}:`, error.message);
      return false;
    }
    console.log(`[mailer] ✅ Sent password reset email to ${opts.to}`);
    return true;
  } catch (err) {
    console.error(`[mailer] ❌ Failed reset email to ${opts.to}:`, (err as Error).message);
    return false;
  }
}

export interface PriceAlertMailOptions {
  to: string;
  userName: string;
  productName: string;
  productImage: string;
  productUrl: string;
  targetPrice: number;
  currentPrice: number;
}

/**
 * Send a price-drop alert email.
 * Returns true on success, false if email is not configured or sending fails.
 */
export async function sendPriceAlertEmail(opts: PriceAlertMailOptions): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.log(`[mailer] RESEND_API_KEY not set — skipping alert to ${opts.to}`);
    return false;
  }

  const from = getFrom();
  const pctOff = opts.targetPrice > 0
    ? Math.round(((opts.targetPrice - opts.currentPrice) / opts.targetPrice) * 100)
    : 0;

  const html = `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>แจ้งเตือนราคา</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0"
          style="background:#ffffff;border-radius:16px;overflow:hidden;
                 box-shadow:0 4px 20px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);
                       padding:28px 32px;text-align:center;">
              <p style="margin:0;color:#bfdbfe;font-size:13px;text-transform:uppercase;
                        letter-spacing:1.5px;">PriceCompare</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;">
                🎉 ราคาถึงเป้าหมายแล้ว!
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 20px;color:#374151;font-size:15px;">
                สวัสดีคุณ <strong>${opts.userName}</strong>,
              </p>
              <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6;">
                สินค้าที่คุณตั้งแจ้งเตือนไว้มีราคาลดลงถึงเป้าหมายของคุณแล้ว!
              </p>

              <!-- Product card -->
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background:#f9fafb;border:1px solid #e5e7eb;
                       border-radius:12px;overflow:hidden;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px;vertical-align:top;" width="80">
                    <img src="${opts.productImage}" alt="" width="72" height="72"
                      style="border-radius:8px;object-fit:contain;background:#fff;
                             border:1px solid #e5e7eb;display:block;" />
                  </td>
                  <td style="padding:20px 20px 20px 0;vertical-align:top;">
                    <p style="margin:0 0 12px;color:#111827;font-size:15px;font-weight:600;
                               line-height:1.4;">
                      ${opts.productName}
                    </p>
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right:16px;">
                          <p style="margin:0;color:#6b7280;font-size:11px;text-transform:uppercase;
                                     letter-spacing:0.5px;">ราคาเป้าหมาย</p>
                          <p style="margin:4px 0 0;color:#111827;font-size:18px;font-weight:700;">
                            ฿${opts.targetPrice.toLocaleString()}
                          </p>
                        </td>
                        <td style="padding-right:16px;">
                          <p style="margin:0;color:#6b7280;font-size:11px;text-transform:uppercase;
                                     letter-spacing:0.5px;">ราคาปัจจุบัน</p>
                          <p style="margin:4px 0 0;color:#16a34a;font-size:18px;font-weight:700;">
                            ฿${opts.currentPrice.toLocaleString()}
                          </p>
                        </td>
                        ${pctOff > 0 ? `
                        <td>
                          <p style="margin:0;color:#6b7280;font-size:11px;text-transform:uppercase;
                                     letter-spacing:0.5px;">ลดลง</p>
                          <p style="margin:4px 0 0;color:#16a34a;font-size:18px;font-weight:700;">
                            ${pctOff}%
                          </p>
                        </td>` : ""}
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${opts.productUrl}"
                      style="display:inline-block;background:#2563eb;color:#ffffff;
                             font-size:15px;font-weight:600;padding:14px 32px;
                             border-radius:12px;text-decoration:none;">
                      ดูสินค้าและเปรียบเทียบราคา →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 32px;
                       border-top:1px solid #f3f4f6;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                คุณได้รับอีเมลนี้เนื่องจากตั้งการแจ้งเตือนราคาบน PriceCompare
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  try {
    const { error } = await resend.emails.send({
      from,
      to:      opts.to,
      subject: `🎉 ${opts.productName} ราคาถึงเป้าหมาย ฿${opts.currentPrice.toLocaleString()} แล้ว!`,
      html,
    });
    if (error) {
      console.error(`[mailer] ❌ Failed to send to ${opts.to}:`, error.message);
      return false;
    }
    console.log(`[mailer] ✅ Sent price alert to ${opts.to} for "${opts.productName}"`);
    return true;
  } catch (err) {
    console.error(`[mailer] ❌ Failed to send to ${opts.to}:`, (err as Error).message);
    return false;
  }
}
