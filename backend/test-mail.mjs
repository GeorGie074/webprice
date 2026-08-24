import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

console.log("📧 Testing SMTP connection...");
console.log(`   Host: ${SMTP_HOST}:${SMTP_PORT}`);
console.log(`   User: ${SMTP_USER}`);

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT ?? 587),
  secure: false,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

try {
  await transporter.verify();
  console.log("✅ SMTP connection OK!\n");

  const info = await transporter.sendMail({
    from: SMTP_FROM,
    to: SMTP_USER, // ส่งหาตัวเองก่อน
    subject: "🎉 PriceCompare — ทดสอบส่งอีเมล",
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:32px;">
        <h2 style="color:#2563eb">✅ ระบบอีเมลพร้อมใช้งาน!</h2>
        <p>อีเมลนี้ถูกส่งจากระบบ PriceCompare เพื่อทดสอบการตั้งค่า SMTP</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
        <p style="color:#6b7280;font-size:13px">
          SMTP: ${SMTP_HOST}:${SMTP_PORT}<br/>
          From: ${SMTP_FROM}
        </p>
      </div>
    `,
  });

  console.log("✅ Test email sent!");
  console.log(`   Message ID: ${info.messageId}`);
  console.log(`   Check inbox: ${SMTP_USER}`);
} catch (err) {
  console.error("❌ Failed:", err.message);
  process.exit(1);
}
