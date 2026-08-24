import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Product from "../models/Product.js";

const router = express.Router();

// POST /api/seed — seed demo data (dev only)
router.post("/", async (_req, res) => {
  try {
    await User.deleteMany({});
    // ❌ ไม่ลบ Product — ใช้ upsert แทนเพื่อไม่ทำลายสินค้าที่เพิ่มด้วยตนเอง

    // ─── Admin & Demo users ───────────────────────────────────────────────────
    const adminPass = await bcrypt.hash("admin1234", 10);
    const userPass  = await bcrypt.hash("user1234",  10);

    await User.insertMany([
      { name: "Admin",          email: "admin@webprice.com", password: adminPass, role: "admin" },
      { name: "สมชาย ใจดี",    email: "user@webprice.com",  password: userPass,  role: "user"  },
      { name: "มานี รักเรียน", email: "manee@email.com",    password: userPass,  role: "user"  },
    ]);

    // ─── Helper ───────────────────────────────────────────────────────────────
    const mkPrices = (entries: {
      platform: string; price: number; originalPrice: number;
      url: string; rating: number; reviews: number; shipping?: number;
    }[]) => entries.map(e => ({ ...e, inStock: true, shipping: e.shipping ?? 0 }));

    // ─────────────────────────────────────────────────────────────────────────
    // SMARTPHONES
    // ─────────────────────────────────────────────────────────────────────────
    const smartphones = [
      {
        name: "iPhone 17 256GB", nameTh: "ไอโฟน 17 256GB", brand: "Apple",
        category: "smartphone", featured: true,
        image: "https://fdn2.gsmarena.com/vv/bigpic/apple-iphone-17.jpg",
        description: "iPhone 17 พร้อม chip A19 ใหม่, จอ Super Retina XDR 6.3 นิ้ว ProMotion 120Hz, กล้องหลัก 48MP",
        tags: ["iphone", "apple", "smartphone", "5g", "a19", "iphone17"],
        searchKeyword: "iPhone 17",
        prices: mkPrices([
          { platform: "Shopee",      price: 26900, originalPrice: 29900, url: "https://shopee.co.th/search?keyword=iPhone+17",                rating: 4.8, reviews: 890  },
          { platform: "Lazada",      price: 26990, originalPrice: 29900, url: "https://www.lazada.co.th/catalog/?q=iPhone+17",                rating: 4.7, reviews: 620  },
          { platform: "Banana IT",   price: 29900, originalPrice: 29900, url: "https://www.bnn.in.th/p/apple/iphone",                        rating: 4.7, reviews: 85   },
          { platform: "Power Buy",   price: 27900, originalPrice: 29900, url: "https://www.powerbuy.co.th/th/search/iPhone%2017",            rating: 4.7, reviews: 180  },
          { platform: "Studio 7",    price: 29900, originalPrice: 29900, url: "https://www.studio7thailand.com/collection/iphone-17-series", rating: 4.8, reviews: 240  },
          { platform: "JIB",         price: 27690, originalPrice: 29900, url: "https://www.jib.co.th/web/product/product_search/0?str_search=iPhone+17", rating: 4.7, reviews: 130 },
          { platform: "Apple Store", price: 29900, originalPrice: 29900, url: "https://www.apple.com/th/shop/buy-iphone/iphone-17",          rating: 5.0, reviews: 1850 },
        ]),
      },
      {
        name: "iPhone 16 128GB", nameTh: "ไอโฟน 16 128GB", brand: "Apple",
        category: "smartphone", featured: false,
        image: "https://fdn2.gsmarena.com/vv/bigpic/apple-iphone-16.jpg",
        description: "iPhone 16 พร้อม chip A18, กล้อง 48MP พร้อม Camera Control, Action Button, จอ 6.1 นิ้ว",
        tags: ["iphone", "apple", "smartphone", "iphone16", "a18"],
        searchKeyword: "iPhone 16",
        prices: mkPrices([
          { platform: "Shopee",      price: 22900, originalPrice: 25900, url: "https://shopee.co.th/search?keyword=iPhone+16",                rating: 4.8, reviews: 2150 },
          { platform: "Lazada",      price: 22990, originalPrice: 25900, url: "https://www.lazada.co.th/catalog/?q=iPhone+16",                rating: 4.7, reviews: 1890 },
          { platform: "Power Buy",   price: 24900, originalPrice: 25900, url: "https://www.powerbuy.co.th/th/search/iPhone%2016",            rating: 4.7, reviews: 520  },
          { platform: "JIB",         price: 22500, originalPrice: 25900, url: "https://www.jib.co.th/web/product/product_search/0?str_search=iPhone+16", rating: 4.7, reviews: 380 },
          { platform: "Apple Store", price: 25900, originalPrice: 25900, url: "https://www.apple.com/th/shop/buy-iphone/iphone-16",          rating: 5.0, reviews: 4200 },
        ]),
      },
      {
        name: "Samsung Galaxy S26 256GB", nameTh: "ซัมซุง กาแล็กซี่ เอส26 256GB", brand: "Samsung",
        category: "smartphone", featured: true,
        image: "https://fdn2.gsmarena.com/vv/bigpic/samsung-galaxy-s26.jpg",
        description: "Galaxy S26 พร้อม Snapdragon 8 Elite Gen 5, Galaxy AI, กล้องหลัก 50MP, RAM 12GB, จอ 6.3 นิ้ว Dynamic AMOLED 2X 120Hz",
        tags: ["samsung", "galaxy", "s26", "android", "5g", "ai"],
        searchKeyword: "Samsung Galaxy S26",
        prices: mkPrices([
          { platform: "Shopee",       price: 31900, originalPrice: 33900, url: "https://shopee.co.th/search?keyword=Samsung+Galaxy+S26",   rating: 4.8, reviews: 980  },
          { platform: "Lazada",       price: 33900, originalPrice: 33900, url: "https://www.lazada.co.th/catalog/?q=Samsung+Galaxy+S26",   rating: 4.7, reviews: 640  },
          { platform: "Power Buy",    price: 32900, originalPrice: 33900, url: "https://www.powerbuy.co.th/th/search/Samsung%20Galaxy%20S26", rating: 4.6, reviews: 250 },
          { platform: "JIB",          price: 33900, originalPrice: 33900, url: "https://www.jib.co.th/web/product/product_search/0?str_search=Samsung+Galaxy+S26", rating: 4.6, reviews: 78 },
          { platform: "Samsung Shop", price: 33900, originalPrice: 33900, url: "https://www.samsung.com/th/smartphones/galaxy-s26/buy/",    rating: 4.9, reviews: 4200 },
        ]),
      },
      {
        name: "Samsung Galaxy A55 5G 8/256GB", nameTh: "ซัมซุง กาแล็กซี่ A55 5G", brand: "Samsung",
        category: "smartphone", featured: false,
        image: "https://fdn2.gsmarena.com/vv/bigpic/samsung-galaxy-a55.jpg",
        description: "Galaxy A55 5G จอ Super AMOLED 6.6 นิ้ว 120Hz, กล้อง 50MP OIS, RAM 8GB, แบต 5,000 mAh",
        tags: ["samsung", "galaxy", "a55", "android", "5g", "mid-range"],
        searchKeyword: "Samsung Galaxy A55",
        prices: mkPrices([
          { platform: "Shopee",       price: 10990, originalPrice: 12990, url: "https://shopee.co.th/search?keyword=Samsung+Galaxy+A55",   rating: 4.7, reviews: 3200 },
          { platform: "Lazada",       price: 10990, originalPrice: 12990, url: "https://www.lazada.co.th/catalog/?q=Samsung+Galaxy+A55",   rating: 4.6, reviews: 2100 },
          { platform: "Power Buy",    price: 12990, originalPrice: 12990, url: "https://www.powerbuy.co.th/th/search/Samsung%20A55",       rating: 4.6, reviews: 780  },
          { platform: "Samsung Shop", price: 12990, originalPrice: 12990, url: "https://www.samsung.com/th/smartphones/galaxy-a/",          rating: 4.8, reviews: 5600 },
        ]),
      },
      {
        name: "Xiaomi 14T Pro 512GB", nameTh: "เสี่ยวหมี่ 14T Pro 512GB", brand: "Xiaomi",
        category: "smartphone", featured: false,
        image: "https://i01.appmifile.com/v1/MI_18455B3E4DA706226CF7535A58E875F0/pms_1726735038.11453938.png",
        description: "Xiaomi 14T Pro กล้อง Leica 50MP, Dimensity 9300+, จอ AMOLED 144Hz, ชาร์จเร็ว 120W HyperCharge",
        tags: ["xiaomi", "14t", "android", "leica", "gaming"],
        searchKeyword: "Xiaomi 14T Pro",
        prices: mkPrices([
          { platform: "Shopee", price: 19990, originalPrice: 22990, url: "https://shopee.co.th/search?keyword=Xiaomi+14T+Pro", rating: 4.7, reviews: 890  },
          { platform: "Lazada", price: 19990, originalPrice: 22990, url: "https://www.lazada.co.th/catalog/?q=Xiaomi+14T+Pro", rating: 4.6, reviews: 620  },
          { platform: "JIB",    price: 21900, originalPrice: 22990, url: "https://www.jib.co.th/web/product/product_search/0?str_search=Xiaomi+14T+Pro", rating: 4.6, reviews: 95 },
        ]),
      },
      {
        name: "Google Pixel 9 Pro 256GB", nameTh: "กูเกิล พิกเซล 9 โปร 256GB", brand: "Google",
        category: "smartphone", featured: false,
        image: "https://fdn2.gsmarena.com/vv/bigpic/google-pixel-9-pro.jpg",
        description: "Google Pixel 9 Pro Tensor G4, กล้อง 50MP + Telephoto 5x, จอ LTPO OLED 6.3 นิ้ว, Google AI พร้อมใช้",
        tags: ["google", "pixel", "android", "ai", "camera"],
        searchKeyword: "Google Pixel 9 Pro",
        prices: mkPrices([
          { platform: "Shopee", price: 25990, originalPrice: 29900, url: "https://shopee.co.th/search?keyword=Google+Pixel+9+Pro", rating: 4.7, reviews: 580 },
          { platform: "Lazada", price: 26490, originalPrice: 29900, url: "https://www.lazada.co.th/catalog/?q=Google+Pixel+9+Pro", rating: 4.6, reviews: 410 },
          { platform: "Power Buy", price: 29900, originalPrice: 29900, url: "https://www.powerbuy.co.th/th/search/Google%20Pixel%209", rating: 4.6, reviews: 180 },
        ]),
      },
      {
        name: "vivo X200 Pro 512GB", nameTh: "วีโว่ X200 Pro 512GB", brand: "vivo",
        category: "smartphone", featured: false,
        image: "https://fdn2.gsmarena.com/vv/bigpic/vivo-x200-pro.jpg",
        description: "vivo X200 Pro กล้อง Zeiss 200MP Telephoto, Dimensity 9400, แบต 6,000 mAh ชาร์จ 90W",
        tags: ["vivo", "x200", "zeiss", "camera", "android"],
        searchKeyword: "vivo X200 Pro",
        prices: mkPrices([
          { platform: "Shopee", price: 24990, originalPrice: 27990, url: "https://shopee.co.th/search?keyword=vivo+X200+Pro", rating: 4.7, reviews: 420 },
          { platform: "Lazada", price: 24990, originalPrice: 27990, url: "https://www.lazada.co.th/catalog/?q=vivo+X200+Pro", rating: 4.6, reviews: 310 },
          { platform: "Power Buy", price: 27990, originalPrice: 27990, url: "https://www.powerbuy.co.th/th/search/vivo%20X200", rating: 4.6, reviews: 95 },
        ]),
      },
      {
        name: "OPPO Find X8 256GB", nameTh: "ออปโป้ Find X8 256GB", brand: "OPPO",
        category: "smartphone", featured: false,
        image: "https://fdn2.gsmarena.com/vv/bigpic/oppo-find-x8.jpg",
        description: "OPPO Find X8 กล้อง Hasselblad 50MP Triple Camera, Dimensity 9400, จอ 6.59 นิ้ว AMOLED, ชาร์จ 80W",
        tags: ["oppo", "find-x8", "hasselblad", "android", "5g"],
        searchKeyword: "OPPO Find X8",
        prices: mkPrices([
          { platform: "Shopee", price: 29990, originalPrice: 34990, url: "https://shopee.co.th/search?keyword=OPPO+Find+X8", rating: 4.7, reviews: 450  },
          { platform: "Lazada", price: 32990, originalPrice: 34990, url: "https://www.lazada.co.th/catalog/?q=OPPO+Find+X8", rating: 4.6, reviews: 320  },
          { platform: "Power Buy", price: 34990, originalPrice: 34990, url: "https://www.powerbuy.co.th/th/search/OPPO%20Find%20X8", rating: 4.6, reviews: 180 },
        ]),
      },
      // ── 5 new phones (Samsung · OPPO · Xiaomi · Apple · vivo) ─────────────
      {
        name: "Samsung Galaxy S25 Ultra 512GB", nameTh: "ซัมซุง กาแล็กซี่ เอส25 อัลตร้า 512GB", brand: "Samsung",
        category: "smartphone", featured: true,
        image: "",
        description: "Galaxy S25 Ultra Snapdragon 8 Elite, S Pen built-in, กล้อง 200MP + Telephoto 5x, RAM 12GB, จอ 6.9 นิ้ว Dynamic AMOLED 2X 120Hz",
        tags: ["samsung", "galaxy", "s25", "ultra", "s-pen", "android", "5g", "ai"],
        searchKeyword: "Samsung Galaxy S25 Ultra",
        prices: mkPrices([
          { platform: "Shopee",       price: 44900, originalPrice: 49900, url: "https://shopee.co.th/search?keyword=Samsung+Galaxy+S25+Ultra",        rating: 4.8, reviews: 1240 },
          { platform: "Lazada",       price: 44990, originalPrice: 49900, url: "https://www.lazada.co.th/catalog/?q=Samsung+Galaxy+S25+Ultra",        rating: 4.7, reviews: 890  },
          { platform: "Power Buy",    price: 47900, originalPrice: 49900, url: "https://www.powerbuy.co.th/th/search/Samsung%20Galaxy%20S25%20Ultra", rating: 4.7, reviews: 320  },
          { platform: "JIB",          price: 44500, originalPrice: 49900, url: "https://www.jib.co.th/web/product/product_search/0?str_search=Samsung+Galaxy+S25+Ultra", rating: 4.7, reviews: 145 },
          { platform: "Samsung Shop", price: 49900, originalPrice: 49900, url: "https://www.samsung.com/th/smartphones/galaxy-s25-ultra/buy/",       rating: 4.9, reviews: 6800 },
        ]),
      },
      {
        name: "OPPO Reno 13 5G 256GB", nameTh: "ออปโป้ Reno 13 5G 256GB", brand: "OPPO",
        category: "smartphone", featured: false,
        image: "",
        description: "OPPO Reno 13 5G จอ AMOLED 6.59 นิ้ว 120Hz, กล้อง 50MP AF, Dimensity 8350, RAM 12GB, ชาร์จเร็ว 80W, แบต 5,600 mAh",
        tags: ["oppo", "reno13", "reno", "android", "5g", "mid-range"],
        searchKeyword: "OPPO Reno 13 5G",
        prices: mkPrices([
          { platform: "Shopee",    price: 12990, originalPrice: 14999, url: "https://shopee.co.th/search?keyword=OPPO+Reno+13+5G",              rating: 4.7, reviews: 1850 },
          { platform: "Lazada",    price: 12990, originalPrice: 14999, url: "https://www.lazada.co.th/catalog/?q=OPPO+Reno+13+5G",              rating: 4.6, reviews: 1320 },
          { platform: "Power Buy", price: 14999, originalPrice: 14999, url: "https://www.powerbuy.co.th/th/search/OPPO%20Reno%2013",           rating: 4.6, reviews: 420  },
          { platform: "JIB",       price: 13500, originalPrice: 14999, url: "https://www.jib.co.th/web/product/product_search/0?str_search=OPPO+Reno+13+5G", rating: 4.6, reviews: 185 },
        ]),
      },
      {
        name: "Xiaomi Redmi Note 14 Pro+ 5G 256GB", nameTh: "เสี่ยวหมี่ Redmi Note 14 Pro+ 5G 256GB", brand: "Xiaomi",
        category: "smartphone", featured: false,
        image: "",
        description: "Redmi Note 14 Pro+ 5G จอ AMOLED 6.67 นิ้ว 144Hz, กล้อง 200MP, Dimensity 9300+, ชาร์จเร็ว 90W HyperCharge, แบต 6,200 mAh",
        tags: ["xiaomi", "redmi", "note14", "android", "5g", "mid-range", "budget"],
        searchKeyword: "Xiaomi Redmi Note 14 Pro+",
        prices: mkPrices([
          { platform: "Shopee", price:  9990, originalPrice: 11999, url: "https://shopee.co.th/search?keyword=Xiaomi+Redmi+Note+14+Pro+5G",  rating: 4.7, reviews: 4200 },
          { platform: "Lazada", price:  9990, originalPrice: 11999, url: "https://www.lazada.co.th/catalog/?q=Xiaomi+Redmi+Note+14+Pro%2B",  rating: 4.6, reviews: 3100 },
          { platform: "JIB",    price: 10500, originalPrice: 11999, url: "https://www.jib.co.th/web/product/product_search/0?str_search=Xiaomi+Redmi+Note+14+Pro", rating: 4.6, reviews: 310 },
        ]),
      },
      {
        name: "iPhone 16 Pro Max 256GB", nameTh: "ไอโฟน 16 โปร แม็กซ์ 256GB", brand: "Apple",
        category: "smartphone", featured: true,
        image: "https://fdn2.gsmarena.com/vv/bigpic/apple-iphone-16-pro-max.jpg",
        description: "iPhone 16 Pro Max chip A18 Pro, จอ Super Retina XDR 6.9 นิ้ว ProMotion 120Hz, กล้อง 48MP + Telephoto 5x, Camera Control, Action Button",
        tags: ["iphone", "apple", "smartphone", "iphone16", "pro", "promax", "a18", "5g"],
        searchKeyword: "iPhone 16 Pro Max",
        prices: mkPrices([
          { platform: "Shopee",      price: 41900, originalPrice: 45900, url: "https://shopee.co.th/search?keyword=iPhone+16+Pro+Max",                rating: 4.9, reviews: 3200 },
          { platform: "Lazada",      price: 42990, originalPrice: 45900, url: "https://www.lazada.co.th/catalog/?q=iPhone+16+Pro+Max",                rating: 4.8, reviews: 2400 },
          { platform: "Power Buy",   price: 44900, originalPrice: 45900, url: "https://www.powerbuy.co.th/th/search/iPhone%2016%20Pro%20Max",        rating: 4.8, reviews: 680  },
          { platform: "Banana IT",   price: 45900, originalPrice: 45900, url: "https://www.bnn.in.th/p/apple/iphone",                               rating: 4.8, reviews: 190  },
          { platform: "Studio 7",    price: 45900, originalPrice: 45900, url: "https://www.studio7thailand.com/collection/iphone-16-series",         rating: 4.9, reviews: 560  },
          { platform: "JIB",         price: 41500, originalPrice: 45900, url: "https://www.jib.co.th/web/product/product_search/0?str_search=iPhone+16+Pro+Max", rating: 4.8, reviews: 420 },
          { platform: "Apple Store", price: 45900, originalPrice: 45900, url: "https://www.apple.com/th/shop/buy-iphone/iphone-16-pro",             rating: 5.0, reviews: 7800 },
        ]),
      },
      {
        name: "vivo V40 5G 256GB", nameTh: "วีโว่ V40 5G 256GB", brand: "vivo",
        category: "smartphone", featured: false,
        image: "https://fdn2.gsmarena.com/vv/bigpic/vivo-v40.jpg",
        description: "vivo V40 5G กล้อง ZEISS 50MP จอ AMOLED 6.78 นิ้ว 120Hz, Snapdragon 7 Gen 3, RAM 12GB, ชาร์จ 80W FlashCharge, แบต 5,500 mAh",
        tags: ["vivo", "v40", "zeiss", "android", "5g", "mid-range"],
        searchKeyword: "vivo V40 5G",
        prices: mkPrices([
          { platform: "Shopee",    price: 11990, originalPrice: 13999, url: "https://shopee.co.th/search?keyword=vivo+V40+5G",              rating: 4.7, reviews: 2100 },
          { platform: "Lazada",    price: 11990, originalPrice: 13999, url: "https://www.lazada.co.th/catalog/?q=vivo+V40+5G",              rating: 4.6, reviews: 1580 },
          { platform: "Power Buy", price: 13999, originalPrice: 13999, url: "https://www.powerbuy.co.th/th/search/vivo%20V40%205G",        rating: 4.6, reviews: 380  },
          { platform: "JIB",       price: 12500, originalPrice: 13999, url: "https://www.jib.co.th/web/product/product_search/0?str_search=vivo+V40+5G", rating: 4.6, reviews: 145 },
        ]),
      },
    ];

    // ─────────────────────────────────────────────────────────────────────────
    // LAPTOPS
    // ─────────────────────────────────────────────────────────────────────────
    const laptops = [
      {
        name: "MacBook Air M5 13-inch", nameTh: "แมคบุ๊ค แอร์ M5 13 นิ้ว", brand: "Apple",
        category: "laptop", featured: true,
        image: "",
        description: "MacBook Air พร้อม chip M5 ใหม่ล่าสุด, จอ Liquid Retina 13.6 นิ้ว, แบตเตอรี่ 18 ชั่วโมง, 16GB RAM",
        tags: ["macbook", "apple", "laptop", "m5", "mac"],
        searchKeyword: "MacBook Air M5",
        prices: mkPrices([
          { platform: "Shopee",      price: 35900, originalPrice: 44900, url: "https://shopee.co.th/search?keyword=MacBook+Air+M5",   rating: 4.8, reviews: 320 },
          { platform: "Lazada",      price: 35990, originalPrice: 44900, url: "https://www.lazada.co.th/catalog/?q=MacBook+Air+M5",   rating: 4.7, reviews: 210 },
          { platform: "Banana IT",   price: 36900, originalPrice: 44900, url: "https://www.bnn.in.th/p/apple/apple-mac",              rating: 4.7, reviews: 55  },
          { platform: "Power Buy",   price: 44900, originalPrice: 44900, url: "https://www.powerbuy.co.th/th/search/MacBook%20Air%20M5", rating: 4.7, reviews: 88 },
          { platform: "Studio 7",    price: 44900, originalPrice: 44900, url: "https://www.studio7thailand.com/collection/macbook-neo",  rating: 4.8, reviews: 145 },
          { platform: "JIB",         price: 36900, originalPrice: 44900, url: "https://www.jib.co.th/web/product/product_search/0?str_search=MacBook+Air+M5", rating: 4.7, reviews: 63 },
          { platform: "Apple Store", price: 44900, originalPrice: 44900, url: "https://www.apple.com/th/shop/buy-mac/macbook-air/13-inch", rating: 5.0, reviews: 890 },
        ]),
      },
      {
        name: "MacBook Pro M4 14-inch", nameTh: "แมคบุ๊ค โปร M4 14 นิ้ว", brand: "Apple",
        category: "laptop", featured: false,
        image: "",
        description: "MacBook Pro M4 14 นิ้ว, จอ Liquid Retina XDR, 16GB RAM, 512GB SSD, แบต 24 ชั่วโมง",
        tags: ["macbook", "apple", "laptop", "m4", "pro"],
        searchKeyword: "MacBook Pro M4",
        prices: mkPrices([
          { platform: "Shopee",      price: 55900, originalPrice: 64900, url: "https://shopee.co.th/search?keyword=MacBook+Pro+M4",   rating: 4.9, reviews: 240 },
          { platform: "Lazada",      price: 55990, originalPrice: 64900, url: "https://www.lazada.co.th/catalog/?q=MacBook+Pro+M4",   rating: 4.8, reviews: 180 },
          { platform: "Studio 7",    price: 64900, originalPrice: 64900, url: "https://www.studio7thailand.com/collection/macbook-pro",  rating: 4.9, reviews: 320 },
          { platform: "JIB",         price: 57900, originalPrice: 64900, url: "https://www.jib.co.th/web/product/product_search/0?str_search=MacBook+Pro+M4", rating: 4.8, reviews: 48 },
          { platform: "Apple Store", price: 64900, originalPrice: 64900, url: "https://www.apple.com/th/shop/buy-mac/macbook-pro/14-inch", rating: 5.0, reviews: 1240 },
        ]),
      },
      {
        name: "ASUS ROG Zephyrus G14 RTX 5060", nameTh: "ASUS ROG Zephyrus G14 RTX 5060", brand: "ASUS",
        category: "laptop", featured: false,
        image: "https://dlcdnwebimgs.asus.com/files/media/202511/fb90e257-7058-482c-9834-14fd3408e15b/v1/images/large/2x/icon/01_icon1.webp",
        description: "โน้ตบุ๊คเกมมิ่ง AMD Ryzen AI 9 465, RTX 5060 8GB, RAM 32GB, SSD 1TB, จอ OLED 3K 120Hz 14 นิ้ว",
        tags: ["asus", "rog", "gaming", "laptop", "rtx5060", "g14"],
        searchKeyword: "ASUS ROG G14 5060",
        prices: mkPrices([
          { platform: "Shopee",    price: 89990, originalPrice: 92990, url: "https://shopee.co.th/search?keyword=ASUS+ROG+G14+RTX+5060",  rating: 4.7, reviews: 120 },
          { platform: "Lazada",    price: 89990, originalPrice: 92990, url: "https://www.lazada.co.th/catalog/?q=ASUS+ROG+G14+RTX+5060",  rating: 4.6, reviews: 75  },
          { platform: "Power Buy", price: 92990, originalPrice: 92990, url: "https://www.powerbuy.co.th/th/search/ASUS%20ROG%20G14%205060", rating: 4.6, reviews: 38 },
          { platform: "JIB",       price: 89900, originalPrice: 92990, url: "https://www.jib.co.th/web/product/product_search/0?str_search=ASUS+ROG+G14+5060", rating: 4.6, reviews: 22 },
        ]),
      },
      {
        name: "Lenovo IdeaPad Slim 5 15 Intel Core Ultra 5", nameTh: "เลอโนโว IdeaPad Slim 5 15 นิ้ว", brand: "Lenovo",
        category: "laptop", featured: false,
        image: "",
        description: "Lenovo IdeaPad Slim 5, Intel Core Ultra 5, RAM 16GB, SSD 512GB, จอ 15.6 นิ้ว FHD IPS, น้ำหนัก 1.64 กก.",
        tags: ["lenovo", "ideapad", "laptop", "intel", "office", "work"],
        searchKeyword: "Lenovo IdeaPad Slim 5",
        prices: mkPrices([
          { platform: "Shopee",    price: 17990, originalPrice: 21990, url: "https://shopee.co.th/search?keyword=Lenovo+IdeaPad+Slim+5", rating: 4.6, reviews: 540  },
          { platform: "Lazada",    price: 18490, originalPrice: 21990, url: "https://www.lazada.co.th/catalog/?q=Lenovo+IdeaPad+Slim+5", rating: 4.5, reviews: 380  },
          { platform: "Power Buy", price: 21990, originalPrice: 21990, url: "https://www.powerbuy.co.th/th/search/Lenovo%20IdeaPad",     rating: 4.5, reviews: 120  },
          { platform: "JIB",       price: 19900, originalPrice: 21990, url: "https://www.jib.co.th/web/product/product_search/0?str_search=Lenovo+IdeaPad+Slim+5", rating: 4.5, reviews: 65 },
        ]),
      },
      {
        name: "Dell Inspiron 15 3535 AMD Ryzen 5", nameTh: "เดลล์ Inspiron 15 AMD Ryzen 5", brand: "Dell",
        category: "laptop", featured: false,
        image: "",
        description: "Dell Inspiron 15 AMD Ryzen 5 7530U, RAM 16GB, SSD 512GB, จอ 15.6 FHD, Win 11 Home",
        tags: ["dell", "inspiron", "laptop", "amd", "ryzen", "student", "work"],
        searchKeyword: "Dell Inspiron 15",
        prices: mkPrices([
          { platform: "Shopee", price: 14990, originalPrice: 17990, url: "https://shopee.co.th/search?keyword=Dell+Inspiron+15", rating: 4.5, reviews: 680  },
          { platform: "Lazada", price: 15490, originalPrice: 17990, url: "https://www.lazada.co.th/catalog/?q=Dell+Inspiron+15", rating: 4.4, reviews: 490  },
          { platform: "Power Buy", price: 17990, originalPrice: 17990, url: "https://www.powerbuy.co.th/th/search/Dell%20Inspiron", rating: 4.4, reviews: 210 },
          { platform: "JIB",    price: 16900, originalPrice: 17990, url: "https://www.jib.co.th/web/product/product_search/0?str_search=Dell+Inspiron+15", rating: 4.4, reviews: 85 },
        ]),
      },
    ];

    // ─────────────────────────────────────────────────────────────────────────
    // TABLETS
    // ─────────────────────────────────────────────────────────────────────────
    const tablets = [
      {
        name: "iPad Air M3 11-inch WiFi 128GB", nameTh: "ไอแพด แอร์ M3 11 นิ้ว WiFi 128GB", brand: "Apple",
        category: "tablet", featured: false,
        image: "https://www.apple.com/newsroom/images/2025/03/apple-introduces-ipad-air-with-powerful-m3-chip-and-new-magic-keyboard/article/Apple-iPad-Air-hero-250304_big.jpg.large.jpg",
        description: "iPad Air พร้อม chip M3 ล่าสุด, จอ Liquid Retina 11 นิ้ว, รองรับ Apple Pencil Pro และ Magic Keyboard",
        tags: ["ipad", "apple", "tablet", "m3"],
        searchKeyword: "iPad Air M3",
        prices: mkPrices([
          { platform: "Shopee",      price: 17900, originalPrice: 20900, url: "https://shopee.co.th/search?keyword=iPad+Air+M3",   rating: 4.8, reviews: 710 },
          { platform: "Lazada",      price: 17990, originalPrice: 20900, url: "https://www.lazada.co.th/catalog/?q=iPad+Air+M3",   rating: 4.7, reviews: 480 },
          { platform: "Power Buy",   price: 20900, originalPrice: 20900, url: "https://www.powerbuy.co.th/th/search/iPad%20Air%20M3", rating: 4.7, reviews: 78 },
          { platform: "Studio 7",    price: 20900, originalPrice: 20900, url: "https://www.studio7thailand.com/collection/apple-ipad-air-series", rating: 4.8, reviews: 88 },
          { platform: "Apple Store", price: 20900, originalPrice: 20900, url: "https://www.apple.com/th/shop/buy-ipad/ipad-air",   rating: 5.0, reviews: 380 },
        ]),
      },
      {
        name: "Samsung Galaxy Tab S10 FE 6/128GB", nameTh: "ซัมซุง กาแล็กซี่ Tab S10 FE", brand: "Samsung",
        category: "tablet", featured: false,
        image: "https://images.samsung.com/th/galaxy-tab-s10-fe/images/galaxy-tab-s10-fe-highlights-kv.jpg",
        description: "Samsung Galaxy Tab S10 FE จอ 10.9 นิ้ว 90Hz, Exynos 1580, RAM 6GB, รองรับ S Pen",
        tags: ["samsung", "tablet", "s10", "android", "s-pen"],
        searchKeyword: "Samsung Galaxy Tab S10 FE",
        prices: mkPrices([
          { platform: "Shopee",       price: 10990, originalPrice: 13900, url: "https://shopee.co.th/search?keyword=Samsung+Galaxy+Tab+S10+FE", rating: 4.6, reviews: 890  },
          { platform: "Lazada",       price: 11490, originalPrice: 13900, url: "https://www.lazada.co.th/catalog/?q=Samsung+Galaxy+Tab+S10+FE", rating: 4.5, reviews: 640  },
          { platform: "Power Buy",    price: 13900, originalPrice: 13900, url: "https://www.powerbuy.co.th/th/search/Samsung%20Tab%20S10",       rating: 4.5, reviews: 210  },
          { platform: "Samsung Shop", price: 13900, originalPrice: 13900, url: "https://www.samsung.com/th/tablets/galaxy-tab-s/",               rating: 4.8, reviews: 2100 },
        ]),
      },
    ];

    // ─────────────────────────────────────────────────────────────────────────
    // AUDIO
    // ─────────────────────────────────────────────────────────────────────────
    const audio = [
      {
        name: "Sony WH-1000XM6 Wireless Headphones", nameTh: "Sony WH-1000XM6 Wireless Headphones", brand: "Sony",
        category: "audio", featured: true,
        image: "",
        description: "หูฟังตัดเสียง WH-1000XM6, Integrated Processor V2 + QN3 chip, ไมโครโฟน 12 ตัว, Hi-Res Audio, LDAC, แบต 30 ชั่วโมง",
        tags: ["sony", "headphone", "noise-cancelling", "wireless", "wh1000xm6"],
        searchKeyword: "Sony WH-1000XM6",
        prices: mkPrices([
          { platform: "Shopee",     price: 11690, originalPrice: 15990, url: "https://shopee.co.th/search?keyword=Sony+WH-1000XM6",  rating: 4.9, reviews: 2345 },
          { platform: "Lazada",     price: 11690, originalPrice: 15990, url: "https://www.lazada.co.th/catalog/?q=Sony+WH-1000XM6",  rating: 4.8, reviews: 1890 },
          { platform: "Power Buy",  price: 15990, originalPrice: 15990, url: "https://www.powerbuy.co.th/th/search/Sony%20WH-1000XM6", rating: 4.8, reviews: 165 },
          { platform: "JIB",        price: 10990, originalPrice: 15990, url: "https://www.jib.co.th/web/product/product_search/0?str_search=Sony+WH-1000XM6", rating: 4.8, reviews: 72 },
          { platform: "Sony Store", price: 10990, originalPrice: 15990, url: "https://www.sony.co.th/th/headphones/products/wh-1000xm6", rating: 5.0, reviews: 780 },
        ]),
      },
      {
        name: "Apple AirPods Pro 2nd Gen", nameTh: "Apple AirPods Pro รุ่นที่ 2", brand: "Apple",
        category: "audio", featured: false,
        image: "https://fdn2.gsmarena.com/vv/bigpic/apple-airpods-pro-2022.jpg",
        description: "AirPods Pro 2 พร้อม H2 chip, Active Noise Cancellation, Adaptive Audio, ชาร์จ USB-C, แบต 30 ชม. (พร้อมเคส)",
        tags: ["airpods", "apple", "earphone", "noise-cancelling", "wireless"],
        searchKeyword: "AirPods Pro 2",
        prices: mkPrices([
          { platform: "Shopee",      price: 7490, originalPrice: 8990, url: "https://shopee.co.th/search?keyword=AirPods+Pro+2",  rating: 4.8, reviews: 4200 },
          { platform: "Lazada",      price: 7590, originalPrice: 8990, url: "https://www.lazada.co.th/catalog/?q=AirPods+Pro+2",  rating: 4.7, reviews: 3100 },
          { platform: "Banana IT",   price: 8990, originalPrice: 8990, url: "https://www.bnn.in.th/p/apple/airpods",              rating: 4.8, reviews: 180  },
          { platform: "Studio 7",    price: 8990, originalPrice: 8990, url: "https://www.studio7thailand.com/collection/airpods", rating: 4.9, reviews: 560  },
          { platform: "Apple Store", price: 8990, originalPrice: 8990, url: "https://www.apple.com/th/shop/buy-airpods/airpods-pro", rating: 5.0, reviews: 8900 },
        ]),
      },
      {
        name: "Samsung Galaxy Buds 3 Pro", nameTh: "ซัมซุง กาแล็กซี่ Buds 3 Pro", brand: "Samsung",
        category: "audio", featured: false,
        image: "https://fdn2.gsmarena.com/vv/bigpic/samsung-galaxy-buds3-pro.jpg",
        description: "Galaxy Buds 3 Pro รูปแบบ in-ear ใหม่, ANC อัจฉริยะ, Hi-Fi 24-bit audio, แบต 30 ชั่วโมง, ปรับ EQ ด้วย AI",
        tags: ["samsung", "buds", "earphone", "anc", "wireless"],
        searchKeyword: "Samsung Galaxy Buds 3 Pro",
        prices: mkPrices([
          { platform: "Shopee",       price: 5490, originalPrice: 6990, url: "https://shopee.co.th/search?keyword=Samsung+Galaxy+Buds+3+Pro",  rating: 4.7, reviews: 1890 },
          { platform: "Lazada",       price: 5990, originalPrice: 6990, url: "https://www.lazada.co.th/catalog/?q=Samsung+Galaxy+Buds+3+Pro",  rating: 4.6, reviews: 1200 },
          { platform: "Power Buy",    price: 6990, originalPrice: 6990, url: "https://www.powerbuy.co.th/th/search/Samsung%20Buds%203%20Pro",   rating: 4.6, reviews: 320  },
          { platform: "Samsung Shop", price: 6990, originalPrice: 6990, url: "https://www.samsung.com/th/audio-sound/galaxy-buds/",             rating: 4.8, reviews: 3200 },
        ]),
      },
      {
        name: "Anker Soundcore Q45 Wireless Headphones", nameTh: "แองเกอร์ Soundcore Q45 หูฟังไร้สาย", brand: "Anker",
        category: "audio", featured: false,
        image: "https://m.media-amazon.com/images/I/61c7DVZdSjL._AC_SX679_.jpg",
        description: "Anker Soundcore Q45 ตัดเสียง ANC แบบ Multi-Mode, LDAC Hi-Res, แบต 65 ชั่วโมง, พับเก็บได้",
        tags: ["anker", "soundcore", "headphone", "anc", "budget"],
        searchKeyword: "Anker Soundcore Q45",
        prices: mkPrices([
          { platform: "Shopee", price: 1490, originalPrice: 1990, url: "https://shopee.co.th/search?keyword=Anker+Soundcore+Q45", rating: 4.6, reviews: 3800 },
          { platform: "Lazada", price: 1490, originalPrice: 1990, url: "https://www.lazada.co.th/catalog/?q=Anker+Soundcore+Q45", rating: 4.5, reviews: 2600 },
          { platform: "JIB",    price: 1890, originalPrice: 1990, url: "https://www.jib.co.th/web/product/product_search/0?str_search=Anker+Soundcore+Q45", rating: 4.5, reviews: 180 },
        ]),
      },
      {
        name: "JBL Tune 770NC Wireless Headphones", nameTh: "JBL Tune 770NC หูฟังไร้สาย", brand: "JBL",
        category: "audio", featured: false,
        image: "https://www.jbl.com/on/demandware.static/-/Sites-masterCatalog_Harman/default/dw3e9f1e8c/JBL_TUNE770NC_Product%20Image_Hero_Black.png",
        description: "JBL Tune 770NC ตัดเสียง ANC, Pure Bass Sound, แบต 70 ชั่วโมง, Bluetooth 5.3, พับเก็บได้",
        tags: ["jbl", "headphone", "noise-cancelling", "wireless", "bass"],
        searchKeyword: "JBL Tune 770NC",
        prices: mkPrices([
          { platform: "Shopee", price: 1890, originalPrice: 2890, url: "https://shopee.co.th/search?keyword=JBL+Tune+770NC", rating: 4.6, reviews: 2800 },
          { platform: "Lazada", price: 1990, originalPrice: 2890, url: "https://www.lazada.co.th/catalog/?q=JBL+Tune+770NC", rating: 4.5, reviews: 2100 },
          { platform: "Power Buy", price: 2890, originalPrice: 2890, url: "https://www.powerbuy.co.th/th/search/JBL%20Tune%20770", rating: 4.5, reviews: 480 },
        ]),
      },
      {
        name: "Sony WF-1000XM5 True Wireless", nameTh: "Sony WF-1000XM5 True Wireless", brand: "Sony",
        category: "audio", featured: false,
        image: "https://www.sony.co.th/image/5d02da5df552836db5e4de3fb5869742?fmt=pjpeg&bgcolor=FFFFFF&bgc=FFFFFF&wid=800&hei=800",
        description: "Sony WF-1000XM5 ตัดเสียงรบกวน, LDAC Hi-Res, แบต 36 ชั่วโมง (พร้อมเคส), ไมค์คู่ per bud",
        tags: ["sony", "earphone", "noise-cancelling", "true-wireless", "ldac"],
        searchKeyword: "Sony WF-1000XM5",
        prices: mkPrices([
          { platform: "Shopee",     price: 7990,  originalPrice: 9990,  url: "https://shopee.co.th/search?keyword=Sony+WF-1000XM5",  rating: 4.8, reviews: 1560 },
          { platform: "Lazada",     price: 7990,  originalPrice: 9990,  url: "https://www.lazada.co.th/catalog/?q=Sony+WF-1000XM5",  rating: 4.7, reviews: 1200 },
          { platform: "Power Buy",  price: 9990,  originalPrice: 9990,  url: "https://www.powerbuy.co.th/th/search/Sony%20WF-1000XM5", rating: 4.7, reviews: 280 },
          { platform: "Sony Store", price: 8490,  originalPrice: 9990,  url: "https://www.sony.co.th/th/headphones/products/wf-1000xm5", rating: 5.0, reviews: 620 },
        ]),
      },
    ];

    // ─────────────────────────────────────────────────────────────────────────
    // HOME
    // ─────────────────────────────────────────────────────────────────────────
    const home = [
      {
        name: "Dyson V16 Piston Animal", nameTh: "ไดสัน วี16 พิสตัน แอนิมัล เครื่องดูดฝุ่นไร้สาย", brand: "Dyson",
        category: "home", featured: false,
        image: "https://dyson-h.assetsadobe2.com/is/image/content/dam/dyson/products/home/floorcare/cordless/piston-animal/rcc/Web-692B-Overview-Module1.jpg?$responsive$&cropPathE=desktop&fit=stretch,1&wid=800",
        description: "Dyson V16 Piston Animal, Hyperdymium 125,000 RPM, ดูดนานสูงสุด 70 นาที",
        tags: ["dyson", "vacuum", "wireless", "home", "v16"],
        searchKeyword: "Dyson V16",
        prices: mkPrices([
          { platform: "Shopee",         price: 27900, originalPrice: 31900, url: "https://shopee.co.th/search?keyword=Dyson+V16",   rating: 4.9, reviews: 650  },
          { platform: "Lazada",         price: 27900, originalPrice: 31900, url: "https://www.lazada.co.th/catalog/?q=Dyson+V16",   rating: 4.8, reviews: 420  },
          { platform: "Central Online", price: 29900, originalPrice: 31900, url: "https://www.central.co.th/th/dyson",              rating: 4.7, reviews: 195  },
          { platform: "Dyson Store",    price: 31900, originalPrice: 31900, url: "https://www.dyson.co.th/th-TH/v16-piston-animal", rating: 5.0, reviews: 1120 },
        ]),
      },
      {
        name: "Xiaomi Robot Vacuum E10 Plus", nameTh: "เสี่ยวหมี่ หุ่นยนต์ดูดฝุ่น E10 Plus", brand: "Xiaomi",
        category: "home", featured: false,
        image: "https://i01.appmifile.com/webfile/globalimg/products/pc/robot-vacuum-e10-plus/overview-1.png",
        description: "Xiaomi Robot Vacuum E10 Plus แรงดูด 4,000 Pa, แผนที่ LiDAR, ถังเก็บฝุ่นอัตโนมัติ, ทำงาน 200 นาที",
        tags: ["xiaomi", "robot", "vacuum", "smart-home", "lidar"],
        searchKeyword: "Xiaomi Robot Vacuum E10",
        prices: mkPrices([
          { platform: "Shopee", price: 4990, originalPrice: 6490, url: "https://shopee.co.th/search?keyword=Xiaomi+Robot+Vacuum+E10", rating: 4.6, reviews: 1890 },
          { platform: "Lazada", price: 4990, originalPrice: 6490, url: "https://www.lazada.co.th/catalog/?q=Xiaomi+Robot+Vacuum+E10", rating: 4.5, reviews: 1540 },
          { platform: "Central Online", price: 5990, originalPrice: 6490, url: "https://www.central.co.th/th/xiaomi", rating: 4.5, reviews: 320 },
        ]),
      },
      {
        name: "Philips Series 1000i Air Purifier AC1715", nameTh: "ฟิลิปส์ เครื่องฟอกอากาศ Series 1000i", brand: "Philips",
        category: "home", featured: false,
        image: "",
        description: "Philips 1000i กรอง PM2.5 99.97%, HEPA+Carbon, CADR 270 m³/h, พื้นที่ 44 ม², แสดงผล AQI แบบ Real-time",
        tags: ["philips", "air-purifier", "hepa", "pm25", "home"],
        searchKeyword: "Philips Air Purifier 1000i",
        prices: mkPrices([
          { platform: "Shopee", price: 4990, originalPrice: 5990, url: "https://shopee.co.th/search?keyword=Philips+Air+Purifier+1000i", rating: 4.7, reviews: 980  },
          { platform: "Lazada", price: 4990, originalPrice: 5990, url: "https://www.lazada.co.th/catalog/?q=Philips+Air+Purifier+1000i", rating: 4.6, reviews: 780  },
          { platform: "Central Online", price: 5990, originalPrice: 5990, url: "https://www.central.co.th/th/philips-air-purifier", rating: 4.6, reviews: 240 },
        ]),
      },
    ];

    // ─────────────────────────────────────────────────────────────────────────
    // FASHION
    // ─────────────────────────────────────────────────────────────────────────
    const fashion = [
      {
        name: "Nike Air Max DN8", nameTh: "ไนกี้ แอร์ แมกซ์ DN8", brand: "Nike",
        category: "fashion", featured: false,
        image: "",
        description: "Nike Air Max DN8 ระบบ Dynamic Air เต็มพื้น Dual-chamber, โฟม ReactX, สำหรับใส่ประจำวัน",
        tags: ["nike", "airmax", "sneaker", "dn8", "shoes"],
        searchKeyword: "Nike Air Max DN8",
        prices: mkPrices([
          { platform: "Shopee",   price: 3990, originalPrice: 4990, url: "https://shopee.co.th/search?keyword=Nike+Air+Max+DN8", rating: 4.7, reviews: 320, shipping: 40 },
          { platform: "Lazada",   price: 4290, originalPrice: 4990, url: "https://www.lazada.co.th/catalog/?q=Nike+Air+Max+DN8", rating: 4.6, reviews: 245 },
          { platform: "Nike.com", price: 4990, originalPrice: 4990, url: "https://www.nike.com/th/w/air-max-dn8-shoes",          rating: 4.9, reviews: 580 },
        ]),
      },
      {
        name: "Nike Air Force 1 '07", nameTh: "ไนกี้ แอร์ ฟอร์ซ 1 '07 สีขาว", brand: "Nike",
        category: "fashion", featured: false,
        image: "https://static.nike.com/a/images/t_PDP_1728_v1/f_auto,q_auto:eco/b7d9211c-26e7-431a-ac24-b0540fb3c00f/AIR+FORCE+1+%2707.png",
        description: "Nike Air Force 1 '07 รองเท้าคลาสสิก หนังแท้ ทรง Low Top สีขาวล้วน ใส่ได้ทุก Outfit",
        tags: ["nike", "air-force-1", "sneaker", "classic", "white"],
        searchKeyword: "Nike Air Force 1",
        prices: mkPrices([
          { platform: "Shopee",   price: 3290, originalPrice: 3890, url: "https://shopee.co.th/search?keyword=Nike+Air+Force+1", rating: 4.8, reviews: 5600, shipping: 40 },
          { platform: "Lazada",   price: 3390, originalPrice: 3890, url: "https://www.lazada.co.th/catalog/?q=Nike+Air+Force+1", rating: 4.7, reviews: 4200 },
          { platform: "Nike.com", price: 3890, originalPrice: 3890, url: "https://www.nike.com/th/w/air-force-1-shoes",          rating: 4.9, reviews: 12000 },
        ]),
      },
    ];

    // ─────────────────────────────────────────────────────────────────────────
    // BEAUTY
    // ─────────────────────────────────────────────────────────────────────────
    const beauty = [
      {
        name: "CeraVe Moisturising Cream 236ml", nameTh: "เซราวี มอยส์เจอร์ไรซิ่ง ครีม 236ml", brand: "CeraVe",
        category: "beauty", featured: false,
        image: "",
        description: "CeraVe Moisturising Cream บำรุงผิวแห้ง ผสม Ceramides 3 ชนิด, Hyaluronic Acid, ปลอดน้ำหอม ทดสอบแล้วโดยแพทย์ผิวหนัง",
        tags: ["cerave", "moisturizer", "cream", "sensitive-skin", "ceramides"],
        searchKeyword: "CeraVe Moisturising Cream",
        prices: mkPrices([
          { platform: "Shopee", price: 459, originalPrice: 590, url: "https://shopee.co.th/search?keyword=CeraVe+Moisturising+Cream", rating: 4.9, reviews: 18500 },
          { platform: "Lazada", price: 469, originalPrice: 590, url: "https://www.lazada.co.th/catalog/?q=CeraVe+Moisturising+Cream", rating: 4.8, reviews: 12300 },
          { platform: "Watsons", price: 590, originalPrice: 590, url: "https://www.watsons.co.th/search?query=cerave", rating: 4.8, reviews: 2800 },
          { platform: "Central Online", price: 530, originalPrice: 590, url: "https://www.central.co.th/th/search?q=cerave", rating: 4.7, reviews: 980 },
        ]),
      },
      {
        name: "CeraVe Moisturising Cream 50ml", nameTh: "เซราวี มอยส์เจอร์ไรซิ่ง ครีม 50ml", brand: "CeraVe",
        category: "beauty", featured: false,
        image: "",
        description: "CeraVe Moisturising Cream ขนาด 50ml พกพาสะดวก บำรุงผิวแห้งถึงแห้งมาก ผสม Ceramides + Hyaluronic Acid",
        tags: ["cerave", "moisturizer", "cream", "travel-size", "ceramides"],
        searchKeyword: "CeraVe Moisturising Cream 50ml",
        prices: mkPrices([
          { platform: "Shopee",  price: 199, originalPrice: 275, url: "https://shopee.co.th/search?keyword=CeraVe+Moisturising+Cream+50ml", rating: 4.9, reviews: 22000 },
          { platform: "Lazada",  price: 209, originalPrice: 275, url: "https://www.lazada.co.th/catalog/?q=CeraVe+Moisturising+Cream+50ml", rating: 4.8, reviews: 15000 },
          { platform: "Watsons", price: 275, originalPrice: 275, url: "https://www.watsons.co.th/search?query=cerave+50ml",                 rating: 4.9, reviews: 4200  },
        ]),
      },
      {
        name: "The Ordinary Niacinamide 10% + Zinc 1% 30ml", nameTh: "The Ordinary ไนอาซินาไมด์ 10% + สังกะสี 1%", brand: "The Ordinary",
        category: "beauty", featured: false,
        image: "",
        description: "The Ordinary Niacinamide 10% + Zinc 1% ลดรูขุมขน ลดผิวมัน ปรับสีผิวสม่ำเสมอ",
        tags: ["the-ordinary", "niacinamide", "serum", "pores", "oily-skin"],
        searchKeyword: "The Ordinary Niacinamide",
        prices: mkPrices([
          { platform: "Shopee",  price: 299, originalPrice: 390, url: "https://shopee.co.th/search?keyword=The+Ordinary+Niacinamide", rating: 4.8, reviews: 28000 },
          { platform: "Lazada",  price: 309, originalPrice: 390, url: "https://www.lazada.co.th/catalog/?q=The+Ordinary+Niacinamide", rating: 4.7, reviews: 19000 },
          { platform: "Watsons", price: 390, originalPrice: 390, url: "https://www.watsons.co.th/search?query=the+ordinary",          rating: 4.8, reviews: 3800  },
          { platform: "Central Online", price: 360, originalPrice: 390, url: "https://www.central.co.th/th/search?q=the+ordinary+niacinamide", rating: 4.7, reviews: 1200 },
        ]),
      },
      {
        name: "Cetaphil Daily Facial Cleanser 250ml", nameTh: "เซตาฟิล เดลี่ เฟเชียล คลีนเซอร์ 250ml", brand: "Cetaphil",
        category: "beauty", featured: false,
        image: "",
        description: "Cetaphil Daily Facial Cleanser 250ml ทำความสะอาดอ่อนโยน เหมาะผิวแพ้ง่าย ล้างเครื่องสำอางได้",
        tags: ["cetaphil", "cleanser", "sensitive-skin", "gentle", "face-wash"],
        searchKeyword: "Cetaphil Daily Facial Cleanser",
        prices: mkPrices([
          { platform: "Shopee",  price: 299, originalPrice: 390, url: "https://shopee.co.th/search?keyword=Cetaphil+Daily+Facial+Cleanser", rating: 4.8, reviews: 15000 },
          { platform: "Lazada",  price: 319, originalPrice: 390, url: "https://www.lazada.co.th/catalog/?q=Cetaphil+Daily+Facial+Cleanser", rating: 4.7, reviews: 10500 },
          { platform: "Watsons", price: 390, originalPrice: 390, url: "https://www.watsons.co.th/search?query=cetaphil",                    rating: 4.8, reviews: 5200  },
        ]),
      },
      {
        name: "COSRX Advanced Snail 96 Mucin Power Essence 100ml", nameTh: "COSRX สเนล มิวซิน เอสเซนส์ 100ml", brand: "COSRX",
        category: "beauty", featured: false,
        image: "",
        description: "COSRX Snail 96 Mucin ฟื้นฟูผิว ลดรอยแดง เพิ่มความชุ่มชื้น กระชับรูขุมขน ผิวนุ่มเนียน",
        tags: ["cosrx", "snail", "essence", "hydrating", "kbeauty"],
        searchKeyword: "COSRX Snail Mucin",
        prices: mkPrices([
          { platform: "Shopee",  price: 399, originalPrice: 490, url: "https://shopee.co.th/search?keyword=COSRX+Snail+Mucin+Essence", rating: 4.9, reviews: 32000 },
          { platform: "Lazada",  price: 409, originalPrice: 490, url: "https://www.lazada.co.th/catalog/?q=COSRX+Snail+Mucin",         rating: 4.8, reviews: 21000 },
          { platform: "Watsons", price: 490, originalPrice: 490, url: "https://www.watsons.co.th/search?query=cosrx",                   rating: 4.9, reviews: 6500  },
          { platform: "Central Online", price: 450, originalPrice: 490, url: "https://www.central.co.th/th/search?q=cosrx+snail", rating: 4.8, reviews: 1800 },
        ]),
      },
      {
        name: "La Roche-Posay Toleriane Hydrating Cleanser 400ml", nameTh: "ลา โรช-โพเซย์ โทเลอรีน ไฮเดรทติ้ง คลีนเซอร์ 400ml", brand: "La Roche-Posay",
        category: "beauty", featured: false,
        image: "",
        description: "La Roche-Posay Toleriane คลีนเซอร์อ่อนโยน ผสม Niacinamide, Glycerin, Thermal Spring Water ไม่ทำให้ผิวแห้ง",
        tags: ["la-roche-posay", "cleanser", "toleriane", "sensitive", "dermatology"],
        searchKeyword: "La Roche-Posay Toleriane Cleanser",
        prices: mkPrices([
          { platform: "Shopee",  price: 589, originalPrice: 790, url: "https://shopee.co.th/search?keyword=La+Roche-Posay+Toleriane+Cleanser", rating: 4.8, reviews: 7800 },
          { platform: "Lazada",  price: 599, originalPrice: 790, url: "https://www.lazada.co.th/catalog/?q=La+Roche-Posay+Toleriane",          rating: 4.7, reviews: 5200 },
          { platform: "Watsons", price: 790, originalPrice: 790, url: "https://www.watsons.co.th/search?query=la+roche-posay",                  rating: 4.8, reviews: 2100 },
        ]),
      },
      {
        name: "Eucerin UltraSENSITIVE Cleansing Lotion 200ml", nameTh: "ยูเซอรีน อัลตร้าเซ็นซิทีฟ คลีนซิ่ง โลชั่น 200ml", brand: "Eucerin",
        category: "beauty", featured: false,
        image: "https://www.eucerin.co.th/-/media/Project/Loreal/Brand-Sites/Eucerin/APAC/TH/PRODUCTS/Cleansers/Ultra-Sensitive-Cleansing-Lotion/Eucerin-UltraSENSITIVE-Cleansing-Lotion-200ml.png",
        description: "Eucerin UltraSENSITIVE ทำความสะอาดอ่อนโยนมาก ไม่มีน้ำหอม ทดสอบโดยแพทย์ผิวหนัง เหมาะผิวแพ้ง่าย",
        tags: ["eucerin", "cleanser", "sensitive", "gentle", "dermatology"],
        searchKeyword: "Eucerin UltraSENSITIVE",
        prices: mkPrices([
          { platform: "Shopee",  price: 290, originalPrice: 395, url: "https://shopee.co.th/search?keyword=Eucerin+UltraSENSITIVE", rating: 4.8, reviews: 9200 },
          { platform: "Lazada",  price: 299, originalPrice: 395, url: "https://www.lazada.co.th/catalog/?q=Eucerin+UltraSENSITIVE", rating: 4.7, reviews: 6800 },
          { platform: "Watsons", price: 395, originalPrice: 395, url: "https://www.watsons.co.th/search?query=eucerin",              rating: 4.8, reviews: 3100 },
        ]),
      },
      {
        name: "Garnier Vitamin C Serum Booster 30ml", nameTh: "การ์นิเย่ วิตามิน ซี เซรั่ม 30ml", brand: "Garnier",
        category: "beauty", featured: false,
        image: "https://www.garnier.co.th/-/media/project/loreal/brand-sites/garnier/apac/th/skincare/face-serum/vitamin-c-brightening-serum/garnier-vitamin-c-serum-30ml.jpg",
        description: "Garnier Vitamin C Serum 30ml ผสม Vitamin C 3.5%, Niacinamide 1%, Salicylic Acid 0.1% ผิวกระจ่างใสใน 3 วัน",
        tags: ["garnier", "vitamin-c", "serum", "brightening", "affordable"],
        searchKeyword: "Garnier Vitamin C Serum",
        prices: mkPrices([
          { platform: "Shopee",  price: 269, originalPrice: 389, url: "https://shopee.co.th/search?keyword=Garnier+Vitamin+C+Serum", rating: 4.7, reviews: 45000 },
          { platform: "Lazada",  price: 279, originalPrice: 389, url: "https://www.lazada.co.th/catalog/?q=Garnier+Vitamin+C+Serum", rating: 4.6, reviews: 32000 },
          { platform: "Watsons", price: 389, originalPrice: 389, url: "https://www.watsons.co.th/search?query=garnier+vitamin+c",    rating: 4.7, reviews: 8900  },
          { platform: "Central Online", price: 350, originalPrice: 389, url: "https://www.central.co.th/th/search?q=garnier+vitamin+c", rating: 4.6, reviews: 2100 },
        ]),
      },
    ];

    // ─────────────────────────────────────────────────────────────────────────
    // HEALTH
    // ─────────────────────────────────────────────────────────────────────────
    const health = [
      {
        name: "Omron HEM-7142T2 Automatic Blood Pressure Monitor", nameTh: "เครื่องวัดความดัน โลหิต โอมรอน HEM-7142T2", brand: "Omron",
        category: "health", featured: false,
        image: "",
        description: "Omron HEM-7142T2 วัดความดัน Bluetooth เชื่อมต่อ App, ตรวจจับการเต้นของหัวใจผิดปกติ, หน่วยความจำ 60 ครั้ง",
        tags: ["omron", "blood-pressure", "health", "monitor", "bluetooth"],
        searchKeyword: "Omron Blood Pressure Monitor",
        prices: mkPrices([
          { platform: "Shopee",  price: 1490, originalPrice: 1890, url: "https://shopee.co.th/search?keyword=Omron+Blood+Pressure", rating: 4.8, reviews: 5600 },
          { platform: "Lazada",  price: 1490, originalPrice: 1890, url: "https://www.lazada.co.th/catalog/?q=Omron+Blood+Pressure",  rating: 4.7, reviews: 4200 },
          { platform: "Watsons", price: 1890, originalPrice: 1890, url: "https://www.watsons.co.th/search?query=omron",              rating: 4.8, reviews: 1800 },
          { platform: "Central Online", price: 1690, originalPrice: 1890, url: "https://www.central.co.th/th/search?q=omron+blood+pressure", rating: 4.7, reviews: 620 },
        ]),
      },
      {
        name: "Xiaomi Smart Band 9", nameTh: "เสี่ยวหมี่ สมาร์ทแบนด์ 9", brand: "Xiaomi",
        category: "health", featured: false,
        image: "https://i01.appmifile.com/v1/MI_18455B3E4DA706226CF7535A58E875F0/pms_1723439032.40416744.png",
        description: "Xiaomi Smart Band 9 จอ AMOLED 1.62 นิ้ว, ออกกำลังกาย 150 โหมด, วัดออกซิเจนในเลือด, แบต 21 วัน",
        tags: ["xiaomi", "smartband", "fitness", "health", "wearable"],
        searchKeyword: "Xiaomi Smart Band 9",
        prices: mkPrices([
          { platform: "Shopee", price: 990, originalPrice: 1290, url: "https://shopee.co.th/search?keyword=Xiaomi+Smart+Band+9", rating: 4.7, reviews: 12000 },
          { platform: "Lazada", price: 990, originalPrice: 1290, url: "https://www.lazada.co.th/catalog/?q=Xiaomi+Smart+Band+9", rating: 4.6, reviews: 8900  },
          { platform: "JIB",    price: 1190, originalPrice: 1290, url: "https://www.jib.co.th/web/product/product_search/0?str_search=Xiaomi+Smart+Band+9", rating: 4.6, reviews: 320 },
        ]),
      },
      {
        name: "Apple Watch SE 2nd Gen 40mm", nameTh: "Apple Watch SE รุ่นที่ 2 40mm", brand: "Apple",
        category: "health", featured: false,
        image: "https://fdn2.gsmarena.com/vv/bigpic/apple-watch-se-2022.jpg",
        description: "Apple Watch SE 2 chip S8, วัดอัตราการเต้นของหัวใจ, Emergency SOS, Crash Detection, WR50",
        tags: ["apple", "watch", "smartwatch", "health", "fitness"],
        searchKeyword: "Apple Watch SE",
        prices: mkPrices([
          { platform: "Shopee",      price: 7490, originalPrice: 8990, url: "https://shopee.co.th/search?keyword=Apple+Watch+SE+2",  rating: 4.8, reviews: 3800 },
          { platform: "Lazada",      price: 7490, originalPrice: 8990, url: "https://www.lazada.co.th/catalog/?q=Apple+Watch+SE+2",  rating: 4.7, reviews: 2600 },
          { platform: "Studio 7",    price: 8990, originalPrice: 8990, url: "https://www.studio7thailand.com/collection/apple-watch", rating: 4.8, reviews: 890  },
          { platform: "Apple Store", price: 8990, originalPrice: 8990, url: "https://www.apple.com/th/shop/buy-watch/apple-watch-se",  rating: 5.0, reviews: 7200 },
        ]),
      },
      {
        name: "Innisfree Green Tea Seed Serum 80ml", nameTh: "อินนิสฟรี กรีนที ซีด เซรั่ม 80ml", brand: "Innisfree",
        category: "beauty", featured: false,
        image: "",
        description: "Innisfree Green Tea Seed Serum ให้ความชุ่มชื้น ผสม Green Tea จาก Jeju, Hyaluronic Acid 5 ชนิด",
        tags: ["innisfree", "green-tea", "serum", "hydrating", "kbeauty"],
        searchKeyword: "Innisfree Green Tea Serum",
        prices: mkPrices([
          { platform: "Shopee",  price: 490, originalPrice: 690, url: "https://shopee.co.th/search?keyword=Innisfree+Green+Tea+Serum", rating: 4.8, reviews: 15000 },
          { platform: "Lazada",  price: 499, originalPrice: 690, url: "https://www.lazada.co.th/catalog/?q=Innisfree+Green+Tea+Serum", rating: 4.7, reviews: 11000 },
          { platform: "Watsons", price: 690, originalPrice: 690, url: "https://www.watsons.co.th/search?query=innisfree+green+tea",    rating: 4.8, reviews: 3200  },
          { platform: "Central Online", price: 620, originalPrice: 690, url: "https://www.central.co.th/th/search?q=innisfree+green+tea", rating: 4.7, reviews: 890 },
        ]),
      },
      {
        name: "Bioderma Sensibio H2O 250ml", nameTh: "ไบโอเดอร์มา เซนซิบิโอ H2O 250ml", brand: "Bioderma",
        category: "beauty", featured: false,
        image: "",
        description: "Bioderma Sensibio H2O ไมเซลล่า วอเตอร์ ทำความสะอาดอ่อนโยน เหมาะผิวแพ้ง่าย ไม่ต้องล้างออก",
        tags: ["bioderma", "micellar-water", "cleanser", "sensitive", "makeup-remover"],
        searchKeyword: "Bioderma Sensibio H2O",
        prices: mkPrices([
          { platform: "Shopee",  price: 399, originalPrice: 590, url: "https://shopee.co.th/search?keyword=Bioderma+Sensibio+H2O", rating: 4.9, reviews: 22000 },
          { platform: "Lazada",  price: 409, originalPrice: 590, url: "https://www.lazada.co.th/catalog/?q=Bioderma+Sensibio+H2O", rating: 4.8, reviews: 16000 },
          { platform: "Watsons", price: 590, originalPrice: 590, url: "https://www.watsons.co.th/search?query=bioderma",            rating: 4.9, reviews: 5800  },
        ]),
      },
      {
        name: "Pond's Age Miracle Day Cream 50g", nameTh: "พอนด์ส เอจ มิราเคิล เดย์ ครีม 50g", brand: "Pond's",
        category: "beauty", featured: false,
        image: "https://www.ponds.com/th/content/dam/ponds/th/products/age-miracle-day-cream-50g.jpg",
        description: "Pond's Age Miracle กระตุ้นคอลลาเจน ลดเลือนริ้วรอย ผิวแน่นกระชับ ใน 7 วัน",
        tags: ["ponds", "anti-aging", "cream", "collagen", "whitening"],
        searchKeyword: "Ponds Age Miracle",
        prices: mkPrices([
          { platform: "Shopee",  price: 219, originalPrice: 299, url: "https://shopee.co.th/search?keyword=Ponds+Age+Miracle+Day+Cream", rating: 4.7, reviews: 38000 },
          { platform: "Lazada",  price: 225, originalPrice: 299, url: "https://www.lazada.co.th/catalog/?q=Ponds+Age+Miracle",           rating: 4.6, reviews: 28000 },
          { platform: "Watsons", price: 299, originalPrice: 299, url: "https://www.watsons.co.th/search?query=ponds+age+miracle",         rating: 4.7, reviews: 8900  },
          { platform: "Central Online", price: 269, originalPrice: 299, url: "https://www.central.co.th/th/search?q=ponds+age+miracle", rating: 4.6, reviews: 2100 },
        ]),
      },
      {
        name: "Garmin Forerunner 265 GPS Running Watch", nameTh: "การ์มิน ฟอร์รันเนอร์ 265 GPS", brand: "Garmin",
        category: "health", featured: false,
        image: "https://res.garmin.com/transform/image/upload/b_rgb:FFFFFF,c_pad,dpr_2.0,f_auto,h_400,q_auto,w_400/c_pad,h_400,w_400/v1/Product_Images/en/products/010-02810-01/v/cf-lg?pgw=1",
        description: "Garmin Forerunner 265 AMOLED 1.3 นิ้ว, GPS แม่นยำ, วัด HRV, ออกกำลังกาย 30 โหมด, แบต 15 วัน",
        tags: ["garmin", "running", "gps", "smartwatch", "fitness", "triathlon"],
        searchKeyword: "Garmin Forerunner 265",
        prices: mkPrices([
          { platform: "Shopee", price: 12990, originalPrice: 15990, url: "https://shopee.co.th/search?keyword=Garmin+Forerunner+265", rating: 4.8, reviews: 1800 },
          { platform: "Lazada", price: 13490, originalPrice: 15990, url: "https://www.lazada.co.th/catalog/?q=Garmin+Forerunner+265", rating: 4.7, reviews: 1200 },
          { platform: "Central Online", price: 15990, originalPrice: 15990, url: "https://www.central.co.th/th/search?q=garmin+forerunner+265", rating: 4.7, reviews: 480 },
        ]),
      },
      {
        name: "Withings Body+ Smart Scale", nameTh: "วิทธิ้งส์ เครื่องชั่งน้ำหนักอัจฉริยะ Body+", brand: "Withings",
        category: "health", featured: false,
        image: "https://www.withings.com/img/products/body-plus/body-plus-white.png",
        description: "Withings Body+ วัดน้ำหนัก+ไขมัน+กล้ามเนื้อ+น้ำในร่างกาย, Wifi+Bluetooth, ซิงค์ Apple Health/Google Fit อัตโนมัติ",
        tags: ["withings", "smart-scale", "bmi", "health", "wifi"],
        searchKeyword: "Withings Body Smart Scale",
        prices: mkPrices([
          { platform: "Shopee",  price: 2890, originalPrice: 3990, url: "https://shopee.co.th/search?keyword=Withings+Body+Smart+Scale", rating: 4.7, reviews: 980 },
          { platform: "Lazada",  price: 2990, originalPrice: 3990, url: "https://www.lazada.co.th/catalog/?q=Withings+Body+Scale",        rating: 4.6, reviews: 720 },
          { platform: "Central Online", price: 3990, originalPrice: 3990, url: "https://www.central.co.th/th/search?q=withings+body", rating: 4.6, reviews: 210 },
        ]),
      },
      {
        name: "Xiaomi Smart Scale S400", nameTh: "เสี่ยวหมี่ เครื่องชั่งน้ำหนัก Smart Scale S400", brand: "Xiaomi",
        category: "health", featured: false,
        image: "https://i01.appmifile.com/v1/MI_18455B3E4DA706226CF7535A58E875F0/pms_1691396888.85085017.png",
        description: "Xiaomi Smart Scale S400 วัด 24 ค่าสุขภาพ, LED Display ใหม่, ซิงค์แอป Mi Fitness, Bluetooth 5.0",
        tags: ["xiaomi", "scale", "smart", "bmi", "health"],
        searchKeyword: "Xiaomi Smart Scale S400",
        prices: mkPrices([
          { platform: "Shopee", price: 890, originalPrice: 1190, url: "https://shopee.co.th/search?keyword=Xiaomi+Smart+Scale+S400", rating: 4.6, reviews: 5600 },
          { platform: "Lazada", price: 890, originalPrice: 1190, url: "https://www.lazada.co.th/catalog/?q=Xiaomi+Smart+Scale+S400", rating: 4.5, reviews: 4200 },
          { platform: "JIB",    price: 1090, originalPrice: 1190, url: "https://www.jib.co.th/web/product/product_search/0?str_search=Xiaomi+Smart+Scale", rating: 4.5, reviews: 320 },
        ]),
      },
    ];

    // ─────────────────────────────────────────────────────────────────────────
    // MERGE & INSERT
    // ─────────────────────────────────────────────────────────────────────────
    const allProducts = [
      ...smartphones, ...laptops, ...tablets, ...audio,
      ...home, ...fashion, ...beauty, ...health,
    ];

    const productsWithPrices = allProducts.map((p) => ({
      ...p,
      images: [],
      minPrice: Math.min(...p.prices.map((pr) => pr.price)),
      maxPrice: Math.max(...p.prices.map((pr) => pr.price)),
    }));

    // Upsert: อัปเดตถ้ามีอยู่แล้ว (ตาม name), เพิ่มใหม่ถ้ายังไม่มี
    let inserted = 0;
    let updated  = 0;
    for (const p of productsWithPrices) {
      const result = await Product.updateOne(
        { name: p.name },
        { $set: p },
        { upsert: true }
      );
      if (result.upsertedCount) inserted++;
      else updated++;
    }

    const totalNow = await Product.countDocuments();

    res.json({
      message: `✅ Seed สำเร็จ! เพิ่มใหม่ ${inserted} รายการ, อัปเดต ${updated} รายการ (รวมทั้งหมด ${totalNow} สินค้า)`,
      data: {
        users: 3,
        products: totalNow,
        newlyInserted: inserted,
        updated,
        breakdown: {
          smartphone: smartphones.length,
          laptop:     laptops.length,
          tablet:     tablets.length,
          audio:      audio.length,
          home:       home.length,
          fashion:    fashion.length,
          beauty:     beauty.length,
          health:     health.length,
          total_seed: allProducts.length,
        },
        adminCredentials: { email: "admin@webprice.com", password: "admin1234" },
        userCredentials:  { email: "user@webprice.com",  password: "user1234"  },
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Seed ล้มเหลว", error: err });
  }
});

export default router;
