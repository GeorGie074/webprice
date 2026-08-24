/**
 * Standalone seed — runs the seed logic directly (no Express server needed).
 * Usage: node run-seed.mjs
 *
 * Products updated to latest 2025–2026 models (May 2026):
 *   iPhone 16 → iPhone 17 256GB (฿29,900)
 *   Samsung S25 → Galaxy S26 256GB (฿33,900)
 *   Sony XM6 originalPrice corrected to ฿15,990
 *   ASUS G14 2025 → G14 2026 / RTX 5060 (฿92,990)
 *   Dyson V15 Fluffy → V16 Piston Animal (฿31,900)
 *   Nike Air Max 270 React → Air Max DN8 (฿4,990)
 */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const MONGO_URI = "mongodb://localhost:27017/webprice";
await mongoose.connect(MONGO_URI);
console.log("✅ MongoDB connected");

// ── Inline schema definitions ────────────────────────────────────────────────
const priceSchema = new mongoose.Schema({
  platform:      String,
  price:         Number,
  originalPrice: Number,
  url:           String,
  inStock:       Boolean,
  shipping:      Number,
  rating:        Number,
  reviews:       Number,
}, { _id: false });

const productSchema = new mongoose.Schema({
  name:          String,
  nameTh:        String,
  brand:         String,
  category:      String,
  image:         String,
  images:        [String],
  description:   String,
  tags:          [String],
  featured:      Boolean,
  searchKeyword: String,
  minPrice:      Number,
  maxPrice:      Number,
  prices:        [priceSchema],
  lastScraped:   Date,
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  name:     String,
  email:    String,
  password: String,
  role:     String,
}, { timestamps: true });

const User    = mongoose.models.User    || mongoose.model("User",    userSchema);
const Product = mongoose.models.Product || mongoose.model("Product", productSchema);

// ── Clear existing data ──────────────────────────────────────────────────────
await User.deleteMany({});
await Product.deleteMany({});
console.log("🗑  Cleared existing data");

// ── Users ────────────────────────────────────────────────────────────────────
const adminPass = await bcrypt.hash("admin1234", 10);
const userPass  = await bcrypt.hash("user1234",  10);
await User.insertMany([
  { name: "Admin",         email: "admin@webprice.com", password: adminPass, role: "admin" },
  { name: "สมชาย ใจดี",    email: "user@webprice.com",  password: userPass,  role: "user"  },
  { name: "มานี รักเรียน", email: "manee@email.com",    password: userPass,  role: "user"  },
]);
console.log("👤 3 users inserted");

// ── Products (latest 2025–2026 models) ───────────────────────────────────────
const products = [

  // ── 1. iPhone 17 256GB ─────────────────────────────────────────────────────
  // Released: 19 Sep 2025 | A19 chip | 6.3" ProMotion 120Hz | MSRP ฿29,900
  {
    name:          "iPhone 17 256GB",
    nameTh:        "ไอโฟน 17 256GB",
    brand:         "Apple",
    category:      "smartphone",
    image:         "https://www.apple.com/newsroom/images/2025/09/apple-debuts-iphone-17/article/Apple-iPhone-17-hero-250909_inline.jpg.large.jpg",
    images:        [],
    description:   "iPhone 17 พร้อม chip A19 ใหม่, จอ Super Retina XDR 6.3 นิ้ว ProMotion 120Hz, กล้องหลัก 48MP พร้อม Camera Control และ Action Button",
    tags:          ["iphone", "apple", "smartphone", "5g", "a19", "iphone17"],
    featured:      true,
    searchKeyword: "iPhone 17",   // drop "256GB" — causes Lazada to return 0 results
    prices: [
      { platform: "Shopee",     price: 26900, originalPrice: 29900, url: "https://shopee.co.th/search?keyword=iPhone+17",                    inStock: true, shipping: 0, rating: 4.8, reviews: 890  },
      { platform: "Lazada",     price: 26990, originalPrice: 29900, url: "https://www.lazada.co.th/catalog/?q=iPhone+17",                     inStock: true, shipping: 0, rating: 4.7, reviews: 620  },
      { platform: "Banana IT",  price: 29900, originalPrice: 29900, url: "https://www.bnn.in.th/p/apple/iphone/iphone-17",    inStock: true, shipping: 0, rating: 4.7, reviews: 85   },
      { platform: "Power Buy",  price: 27900, originalPrice: 29900, url: "https://www.powerbuy.co.th/th/search/iPhone%2017",  inStock: true, shipping: 0, rating: 4.7, reviews: 180  },
      { platform: "Studio 7",   price: 29900, originalPrice: 29900, url: "https://www.studio7thailand.com/collection/iphone-17-series", inStock: true, shipping: 0, rating: 4.8, reviews: 240  },
      { platform: "JIB",        price: 27690, originalPrice: 29900, url: "https://www.jib.co.th/web/product/product_search/0?str_search=iPhone+17&cate_id%5B%5D=", inStock: true, shipping: 0, rating: 4.7, reviews: 130 },
      { platform: "Apple Store",price: 29900, originalPrice: 29900, url: "https://www.apple.com/th/shop/buy-iphone/iphone-17", inStock: true, shipping: 0, rating: 5.0, reviews: 1850 },
    ],
  },

  // ── 2. Samsung Galaxy S26 256GB ────────────────────────────────────────────
  // Released: 11 Mar 2026 | Snapdragon 8 Elite Gen 5 | 6.3" AMOLED | MSRP ฿33,900
  {
    name:          "Samsung Galaxy S26 256GB",
    nameTh:        "ซัมซุง กาแล็กซี่ เอส26 256GB",
    brand:         "Samsung",
    category:      "smartphone",
    image:         "https://images.samsung.com/th/smartphones/galaxy-s26/images/galaxy-s26-features-kv.jpg?imbypass=true",
    images:        [],
    description:   "Galaxy S26 พร้อม Snapdragon 8 Elite Gen 5, Galaxy AI, กล้องหลัก 50MP, RAM 12GB, จอ 6.3 นิ้ว Dynamic AMOLED 2X 120Hz",
    tags:          ["samsung", "galaxy", "s26", "android", "5g", "ai"],
    featured:      true,
    searchKeyword: "Samsung Galaxy S26",   // drop "256GB" — causes Lazada to return 0 results
    prices: [
      { platform: "Shopee",       price: 31900, originalPrice: 33900, url: "https://shopee.co.th/search?keyword=Samsung+Galaxy+S26",   inStock: true, shipping: 0, rating: 4.8, reviews: 980  },
      { platform: "Lazada",       price: 33900, originalPrice: 33900, url: "https://www.lazada.co.th/catalog/?q=Samsung+Galaxy+S26",    inStock: true, shipping: 0, rating: 4.7, reviews: 640  },
      { platform: "Power Buy",    price: 32900, originalPrice: 33900, url: "https://www.powerbuy.co.th/th/search/Samsung%20Galaxy%20S26", inStock: true, shipping: 0, rating: 4.6, reviews: 250 },
      { platform: "JIB",          price: 33900, originalPrice: 33900, url: "https://www.jib.co.th/web/product/product_search/0?str_search=Samsung+Galaxy+S26&cate_id%5B%5D=", inStock: true, shipping: 0, rating: 4.6, reviews: 78 },
      { platform: "Samsung Shop", price: 33900, originalPrice: 33900, url: "https://www.samsung.com/th/smartphones/galaxy-s26/buy/", inStock: true, shipping: 0, rating: 4.9, reviews: 4200 },
    ],
  },

  // ── 3. Sony WH-1000XM6 Wireless Headphones ─────────────────────────────────
  // Still latest model as of 2026 | Official Thai price: ฿15,990
  {
    name:          "Sony WH-1000XM6 Wireless Headphones",
    nameTh:        "Sony WH-1000XM6 Wireless Headphones",   // keep English — Thai returns 0 Lazada results
    brand:         "Sony",
    category:      "audio",
    image:         "https://images.droidsans.com/wp-content/uploads/2025/06/SONY-WH-1000X-M6-819x1024.jpg",
    images:        [],
    description:   "หูฟังตัดเสียงรบกวน WH-1000XM6, Integrated Processor V2 + QN3 chip, ไมโครโฟน 12 ตัว, Hi-Res Audio, LDAC, แบตเตอรี่ 30 ชั่วโมง",
    tags:          ["sony", "headphone", "noise-cancelling", "wireless", "wh1000xm6"],
    featured:      true,
    searchKeyword: "Sony WH-1000XM6",   // drop "Wireless Headphones" — causes Lazada to return 0 results
    prices: [
      { platform: "Shopee",    price: 11690, originalPrice: 15990, url: "https://shopee.co.th/search?keyword=Sony+WH-1000XM6",             inStock: true, shipping: 0, rating: 4.9, reviews: 2345 },
      { platform: "Lazada",    price: 11690, originalPrice: 15990, url: "https://www.lazada.co.th/catalog/?q=Sony+WH-1000XM6",            inStock: true, shipping: 0, rating: 4.8, reviews: 1890 },
      { platform: "Banana IT", price: 13990, originalPrice: 15990, url: "https://www.bnn.in.th/p/audio-and-headphone/sony",                inStock: true, shipping: 0, rating: 4.8, reviews: 95   },
      { platform: "Power Buy", price: 15990, originalPrice: 15990, url: "https://www.powerbuy.co.th/th/search/Sony%20WH-1000XM6",          inStock: true, shipping: 0, rating: 4.8, reviews: 165  },
      { platform: "JIB",       price: 10990, originalPrice: 15990, url: "https://www.jib.co.th/web/product/product_search/0?str_search=Sony+WH-1000XM6&cate_id%5B%5D=", inStock: true, shipping: 0, rating: 4.8, reviews: 72 },
      { platform: "Sony Store",price: 10990, originalPrice: 15990, url: "https://www.sony.co.th/th/headphones/products/wh-1000xm6", inStock: true, shipping: 0, rating: 5.0, reviews: 780 },
    ],
  },

  // ── 4. MacBook Air M5 13-inch ──────────────────────────────────────────────
  // Released: Mar 2025 | Still latest Apple laptop as of May 2026 | MSRP ฿44,900
  {
    name:          "MacBook Air M5 13-inch",
    nameTh:        "แมคบุ๊ค แอร์ M5 13 นิ้ว",
    brand:         "Apple",
    category:      "laptop",
    image:         "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/mba13-skyblue-select-202503?wid=800&hei=800&fmt=jpeg",
    images:        [],
    description:   "MacBook Air พร้อม chip M5 ใหม่ล่าสุด, จอ Liquid Retina 13.6 นิ้ว, แบตเตอรี่ใช้งาน 18 ชั่วโมง, เริ่มต้น 16GB RAM / 256GB SSD",
    tags:          ["macbook", "apple", "laptop", "m5", "mac"],
    featured:      true,
    searchKeyword: "MacBook Air M5",   // drop "13-inch" — causes Lazada to return 0 results
    prices: [
      { platform: "Shopee",     price: 35900, originalPrice: 44900, url: "https://shopee.co.th/search?keyword=MacBook+Air+M5",          inStock: true, shipping: 0, rating: 4.8, reviews: 320 },
      { platform: "Lazada",     price: 35990, originalPrice: 44900, url: "https://www.lazada.co.th/catalog/?q=MacBook+Air+M5",         inStock: true, shipping: 0, rating: 4.7, reviews: 210 },
      { platform: "Banana IT",  price: 36900, originalPrice: 44900, url: "https://www.bnn.in.th/p/apple/apple-mac",              inStock: true, shipping: 0, rating: 4.7, reviews: 55  },
      { platform: "Power Buy",  price: 44900, originalPrice: 44900, url: "https://www.powerbuy.co.th/th/search/MacBook%20Air%20M5", inStock: true, shipping: 0, rating: 4.7, reviews: 88 },
      { platform: "Studio 7",   price: 44900, originalPrice: 44900, url: "https://www.studio7thailand.com/collection/macbook-neo", inStock: true, shipping: 0, rating: 4.8, reviews: 145 },
      { platform: "JIB",        price: 36900, originalPrice: 44900, url: "https://www.jib.co.th/web/product/product_search/0?str_search=MacBook+Air+M5&cate_id%5B%5D=", inStock: true, shipping: 0, rating: 4.7, reviews: 63 },
      { platform: "Apple Store",price: 44900, originalPrice: 44900, url: "https://www.apple.com/th/shop/buy-mac/macbook-air/13-inch", inStock: true, shipping: 0, rating: 5.0, reviews: 890 },
    ],
  },

  // ── 5. ASUS ROG Zephyrus G14 RTX 5060 ────────────────────────────────────
  // Released 2026 | Ryzen AI 9 465 | RTX 5060 | OLED 3K 120Hz | 1.5kg | MSRP ฿92,990
  // Name uses "RTX 5060" (not "2026") — scraper uses model number as key identifier,
  // not release year, since Lazada/PowerBuy listings rarely include the year in the title.
  {
    name:          "ASUS ROG Zephyrus G14 RTX 5060",
    nameTh:        "ASUS ROG Zephyrus G14 RTX 5060",   // keep English — Thai transliteration returns 0 Lazada results
    brand:         "ASUS",
    category:      "laptop",
    image:         "https://dlcdnwebimgs.asus.com/files/media/202511/fb90e257-7058-482c-9834-14fd3408e15b/v1/images/large/2x/icon/01_icon1.webp",
    images:        [],
    description:   "โน้ตบุ๊คเกมมิ่ง AMD Ryzen AI 9 465, RTX 5060 Laptop GPU 8GB GDDR7, RAM 32GB LPDDR5X, SSD 1TB, จอ OLED 3K 120Hz 14 นิ้ว บางเพียง 1.59 ซม. น้ำหนัก 1.5 กก.",
    tags:          ["asus", "rog", "gaming", "laptop", "rtx5060", "g14"],
    featured:      false,
    searchKeyword: "ASUS ROG G14 5060",   // "5060" used to filter out older G14 models (2024/2025)
    prices: [
      { platform: "Shopee",    price: 89990, originalPrice: 92990, url: "https://shopee.co.th/search?keyword=ASUS+ROG+G14+RTX+5060",    inStock: true, shipping: 0, rating: 4.7, reviews: 120 },
      { platform: "Lazada",    price: 89990, originalPrice: 92990, url: "https://www.lazada.co.th/catalog/?q=ASUS+ROG+G14+RTX+5060",   inStock: true, shipping: 0, rating: 4.6, reviews: 75  },
      { platform: "Power Buy", price: 92990, originalPrice: 92990, url: "https://www.powerbuy.co.th/th/search/ASUS%20ROG%20G14%205060", inStock: true, shipping: 0, rating: 4.6, reviews: 38 },
      { platform: "JIB",       price: 89900, originalPrice: 92990, url: "https://www.jib.co.th/web/product/product_search/0?str_search=ASUS+ROG+G14+5060&cate_id%5B%5D=", inStock: true, shipping: 0, rating: 4.6, reviews: 22 },
    ],
  },

  // ── 6. iPad Air M3 11-inch WiFi 128GB ─────────────────────────────────────
  // Released: Mar 2025 | Still current as of May 2026 | MSRP ฿20,900
  {
    name:          "iPad Air M3 11-inch WiFi 128GB",
    nameTh:        "ไอแพด แอร์ M3 11 นิ้ว WiFi 128GB",
    brand:         "Apple",
    category:      "tablet",
    image:         "https://www.apple.com/newsroom/images/2025/03/apple-introduces-ipad-air-with-powerful-m3-chip-and-new-magic-keyboard/article/Apple-iPad-Air-hero-250304_big.jpg.large.jpg",
    images:        [],
    description:   "iPad Air พร้อม chip M3 ล่าสุด, จอ Liquid Retina 11 นิ้ว, รองรับ Apple Pencil Pro และ Magic Keyboard",
    tags:          ["ipad", "apple", "tablet", "m3"],
    featured:      false,
    searchKeyword: "iPad Air M3",   // drop "11-inch" with hyphen — causes Lazada to return 0 results
    prices: [
      { platform: "Shopee",     price: 17900, originalPrice: 20900, url: "https://shopee.co.th/search?keyword=iPad+Air+M3",              inStock: true, shipping: 0, rating: 4.8, reviews: 710 },
      { platform: "Lazada",     price: 17990, originalPrice: 20900, url: "https://www.lazada.co.th/catalog/?q=iPad+Air+M3",             inStock: true, shipping: 0, rating: 4.7, reviews: 480 },
      { platform: "Banana IT",  price: 20900, originalPrice: 20900, url: "https://www.bnn.in.th/p/apple/apple-ipad",             inStock: true, shipping: 0, rating: 4.7, reviews: 62  },
      { platform: "Power Buy",  price: 20900, originalPrice: 20900, url: "https://www.powerbuy.co.th/th/search/iPad%20Air%20M3", inStock: true, shipping: 0, rating: 4.7, reviews: 78  },
      { platform: "Studio 7",   price: 20900, originalPrice: 20900, url: "https://www.studio7thailand.com/collection/apple-ipad-air-series", inStock: true, shipping: 0, rating: 4.8, reviews: 88  },
      { platform: "JIB",        price: 20900, originalPrice: 20900, url: "https://www.jib.co.th/web/product/product_search/0?str_search=iPad+Air+M3&cate_id%5B%5D=", inStock: true, shipping: 0, rating: 4.7, reviews: 44 },
      { platform: "Apple Store",price: 20900, originalPrice: 20900, url: "https://www.apple.com/th/shop/buy-ipad/ipad-air",      inStock: true, shipping: 0, rating: 5.0, reviews: 380 },
    ],
  },

  // ── 7. Dyson V16 Piston Animal ─────────────────────────────────────────────
  // Upgraded from V15 Fluffy | 125,000 RPM Hyperdymium | 70 min run time | MSRP ฿31,900
  {
    name:          "Dyson V16 Piston Animal",
    nameTh:        "ไดสัน วี16 พิสตัน แอนิมัล เครื่องดูดฝุ่นไร้สาย",
    brand:         "Dyson",
    category:      "home",
    image:         "https://dyson-h.assetsadobe2.com/is/image/content/dam/dyson/products/home/floorcare/cordless/piston-animal/rcc/Web-692B-Overview-Module1.jpg?$responsive$&cropPathE=desktop&fit=stretch,1&wid=800",
    images:        [],
    description:   "เครื่องดูดฝุ่นไร้สาย Dyson V16 Piston Animal, เทคโนโลยี Piston Motor ใหม่, Hyperdymium 125,000 RPM, ดูดนานสูงสุด 70 นาที, สีดำ/ทองแดง",
    tags:          ["dyson", "vacuum", "wireless", "home", "v16"],
    featured:      false,
    searchKeyword: "Dyson V16",   // shorter keyword for better Lazada results
    prices: [
      { platform: "Shopee",         price: 27900, originalPrice: 31900, url: "https://shopee.co.th/search?keyword=Dyson+V16",            inStock: true, shipping: 0, rating: 4.9, reviews: 650  },
      { platform: "Lazada",         price: 27900, originalPrice: 31900, url: "https://www.lazada.co.th/catalog/?q=Dyson+V16",           inStock: true, shipping: 0, rating: 4.8, reviews: 420  },
      { platform: "Central Online", price: 29900, originalPrice: 31900, url: "https://www.central.co.th/th/dyson",            inStock: true, shipping: 0, rating: 4.7, reviews: 195  },
      { platform: "Dyson Store",    price: 31900, originalPrice: 31900, url: "https://www.dyson.co.th/th-TH/v16-piston-animal-cordless-vacuum-matte-black-copper", inStock: true, shipping: 0, rating: 5.0, reviews: 1120 },
    ],
  },

  // ── 8. Nike Air Max DN8 ───────────────────────────────────────────────────
  // Air Max Day 2025 flagship | Full-length Dynamic Air | Released: 6 Mar 2025
  {
    name:          "Nike Air Max DN8",
    nameTh:        "ไนกี้ แอร์ แมกซ์ DN8",
    brand:         "Nike",
    category:      "fashion",
    image:         "https://media.about.nike.com/img/3a348c07-6124-4466-a330-2325bf8a3651/nike-air-max-dn8.jpg",
    images:        [],
    description:   "รองเท้า Nike Air Max DN8 ระบบ Dynamic Air เต็มพื้น Dual-chamber, โฟม ReactX เบาและนุ่ม, สำหรับใส่ประจำวัน",
    tags:          ["nike", "airmax", "sneaker", "dn8", "shoes"],
    featured:      false,
    searchKeyword: "Nike Air Max DN8",
    prices: [
      { platform: "Shopee",   price: 3990, originalPrice: 4990, url: "https://shopee.co.th/search?keyword=Nike+Air+Max+DN8",    inStock: true, shipping: 40, rating: 4.7, reviews: 320 },
      { platform: "Lazada",   price: 4290, originalPrice: 4990, url: "https://www.lazada.co.th/catalog/?q=Nike+Air+Max+DN8",   inStock: true, shipping: 0,  rating: 4.6, reviews: 245 },
      { platform: "Nike.com", price: 4990, originalPrice: 4990, url: "https://www.nike.com/th/w/air-max-dn8-shoes-5ju6gzy7ok", inStock: true, shipping: 0, rating: 4.9, reviews: 580 },
    ],
  },
];

// ── Calculate minPrice / maxPrice and insert ─────────────────────────────────
const productsWithPrices = products.map(p => ({
  ...p,
  minPrice: Math.min(...p.prices.map(pr => pr.price)),
  maxPrice: Math.max(...p.prices.map(pr => pr.price)),
}));

await Product.insertMany(productsWithPrices);
console.log(`📦 ${products.length} products inserted`);

await mongoose.disconnect();
console.log("✅ Seed complete!\n");

// ── Summary ──────────────────────────────────────────────────────────────────
console.log("📋 Products seeded:");
products.forEach(p => {
  const min = Math.min(...p.prices.map(pr => pr.price));
  const max = Math.max(...p.prices.map(pr => pr.price));
  const platforms = p.prices.map(pr => pr.platform).join(", ");
  console.log(`  • ${p.name.padEnd(40)} ฿${String(min.toLocaleString()).padEnd(8)} – ฿${max.toLocaleString()}`);
  console.log(`    Platforms: ${platforms}`);
});
