/**
 * add-products.mjs — เพิ่มสินค้าใหม่โดยไม่ล้างข้อมูลเดิม
 * Usage: node add-products.mjs
 */
import mongoose from "mongoose";
const MONGO_URI = "mongodb://localhost:27017/webprice";
await mongoose.connect(MONGO_URI);
console.log("✅ MongoDB connected");

const priceSchema = new mongoose.Schema({
  platform: String, price: Number, originalPrice: Number,
  url: String, inStock: Boolean, shipping: Number,
  rating: Number, reviews: Number,
}, { _id: false });

const productSchema = new mongoose.Schema({
  name: String, nameTh: String, brand: String, category: String,
  image: String, images: [String], description: String,
  tags: [String], featured: Boolean, searchKeyword: String,
  minPrice: Number, maxPrice: Number, prices: [priceSchema], lastScraped: Date,
}, { timestamps: true });

const Product = mongoose.models.Product || mongoose.model("Product", productSchema);

// ─────────────────────────────────────────────────────────────────────────────
// สินค้าใหม่ทั้งหมด (ราคาตลาดไทย พ.ค. 2025–2026)
// ─────────────────────────────────────────────────────────────────────────────
const newProducts = [

  // ════════════════════════════════════════════════════════
  //  SMARTPHONE  (เพิ่ม 8 รุ่น → รวมเป็น 10)
  // ════════════════════════════════════════════════════════

  {
    name: "iPhone 16 Pro Max 256GB",
    nameTh: "ไอโฟน 16 โปร แมกซ์ 256GB",
    brand: "Apple", category: "smartphone",
    image: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-9inch-desertitanium?wid=800&hei=800&fmt=jpeg",
    images: [], featured: true,
    description: "iPhone 16 Pro Max จอ 6.9 นิ้ว Super Retina XDR ProMotion, chip A18 Pro, กล้อง 48MP Ultra Wide, Camera Control, Action Button",
    tags: ["iphone", "apple", "smartphone", "5g", "a18pro", "iphone16"],
    searchKeyword: "iPhone 16 Pro Max",
    prices: [
      { platform: "Shopee",      price: 41900, originalPrice: 46900, url: "https://shopee.co.th/search?keyword=iPhone+16+Pro+Max", inStock: true, shipping: 0, rating: 4.9, reviews: 1250 },
      { platform: "Lazada",      price: 41900, originalPrice: 46900, url: "https://www.lazada.co.th/catalog/?q=iPhone+16+Pro+Max", inStock: true, shipping: 0, rating: 4.8, reviews: 980  },
      { platform: "Banana IT",   price: 44900, originalPrice: 46900, url: "https://www.bnn.in.th/p/apple/iphone/iphone-16-pro-max", inStock: true, shipping: 0, rating: 4.8, reviews: 112 },
      { platform: "Power Buy",   price: 44900, originalPrice: 46900, url: "https://www.powerbuy.co.th/th/search/iPhone%2016%20Pro%20Max", inStock: true, shipping: 0, rating: 4.7, reviews: 210 },
      { platform: "Studio 7",    price: 46900, originalPrice: 46900, url: "https://www.studio7thailand.com/collection/iphone-16-pro-series", inStock: true, shipping: 0, rating: 4.9, reviews: 320 },
      { platform: "JIB",         price: 42900, originalPrice: 46900, url: "https://www.jib.co.th/web/product/product_search/0?str_search=iPhone+16+Pro+Max", inStock: true, shipping: 0, rating: 4.8, reviews: 88 },
      { platform: "Apple Store", price: 46900, originalPrice: 46900, url: "https://www.apple.com/th/shop/buy-iphone/iphone-16-pro", inStock: true, shipping: 0, rating: 5.0, reviews: 3200 },
    ],
  },

  {
    name: "Samsung Galaxy S25 Ultra 256GB",
    nameTh: "ซัมซุง กาแล็กซี่ เอส25 อัลตร้า 256GB",
    brand: "Samsung", category: "smartphone",
    image: "https://images.samsung.com/th/smartphones/galaxy-s25-ultra/images/galaxy-s25-ultra-highlight-kv.jpg?imbypass=true",
    images: [], featured: true,
    description: "Galaxy S25 Ultra พร้อม Snapdragon 8 Elite, S Pen ในตัว, กล้อง 200MP, RAM 12GB, จอ 6.9 นิ้ว Dynamic AMOLED 2X 120Hz, Galaxy AI",
    tags: ["samsung", "galaxy", "s25ultra", "spen", "android", "5g"],
    searchKeyword: "Samsung Galaxy S25 Ultra",
    prices: [
      { platform: "Shopee",       price: 38900, originalPrice: 42900, url: "https://shopee.co.th/search?keyword=Samsung+Galaxy+S25+Ultra", inStock: true, shipping: 0, rating: 4.9, reviews: 1540 },
      { platform: "Lazada",       price: 39900, originalPrice: 42900, url: "https://www.lazada.co.th/catalog/?q=Samsung+Galaxy+S25+Ultra", inStock: true, shipping: 0, rating: 4.8, reviews: 890  },
      { platform: "Power Buy",    price: 41900, originalPrice: 42900, url: "https://www.powerbuy.co.th/th/search/Samsung%20Galaxy%20S25%20Ultra", inStock: true, shipping: 0, rating: 4.7, reviews: 340 },
      { platform: "JIB",          price: 40900, originalPrice: 42900, url: "https://www.jib.co.th/web/product/product_search/0?str_search=Samsung+Galaxy+S25+Ultra", inStock: true, shipping: 0, rating: 4.8, reviews: 130 },
      { platform: "Samsung Shop", price: 42900, originalPrice: 42900, url: "https://www.samsung.com/th/smartphones/galaxy-s25-ultra/buy/", inStock: true, shipping: 0, rating: 4.9, reviews: 5600 },
    ],
  },

  {
    name: "OPPO Find X8 Pro 256GB",
    nameTh: "ออปโป้ ไฟน์ด เอ็กซ์8 โปร 256GB",
    brand: "OPPO", category: "smartphone",
    image: "https://image.oppo.com/content/dam/oppo/product-asset-library/find/find-x8-pro/v1/assets/pc-spec.png",
    images: [], featured: false,
    description: "OPPO Find X8 Pro Dimensity 9400, กล้อง Hasselblad 50MP Periscope Telephoto 6x, Aero Arc Design, จอ 6.78 นิ้ว LTPO AMOLED, ชาร์จ 80W",
    tags: ["oppo", "findx8", "hasselblad", "android", "5g"],
    searchKeyword: "OPPO Find X8 Pro",
    prices: [
      { platform: "Shopee",  price: 30900, originalPrice: 34900, url: "https://shopee.co.th/search?keyword=OPPO+Find+X8+Pro", inStock: true, shipping: 0, rating: 4.7, reviews: 520 },
      { platform: "Lazada",  price: 31900, originalPrice: 34900, url: "https://www.lazada.co.th/catalog/?q=OPPO+Find+X8+Pro", inStock: true, shipping: 0, rating: 4.6, reviews: 380 },
      { platform: "Power Buy", price: 34900, originalPrice: 34900, url: "https://www.powerbuy.co.th/th/search/OPPO%20Find%20X8%20Pro", inStock: true, shipping: 0, rating: 4.6, reviews: 95 },
      { platform: "JIB",     price: 31900, originalPrice: 34900, url: "https://www.jib.co.th/web/product/product_search/0?str_search=OPPO+Find+X8+Pro", inStock: true, shipping: 0, rating: 4.6, reviews: 42 },
    ],
  },

  {
    name: "Xiaomi 15 Pro 512GB",
    nameTh: "เสี่ยวหมี่ 15 โปร 512GB",
    brand: "Xiaomi", category: "smartphone",
    image: "https://i01.appmifile.com/webfile/globalimg/products/m/xiaomi-15-pro/phone.png",
    images: [], featured: false,
    description: "Xiaomi 15 Pro Snapdragon 8 Elite, กล้อง Leica 50MP Hyper Telephoto, จอ 6.73 นิ้ว LTPO AMOLED 120Hz, ชาร์จ 90W + ไร้สาย 50W",
    tags: ["xiaomi", "15pro", "leica", "android", "5g"],
    searchKeyword: "Xiaomi 15 Pro",
    prices: [
      { platform: "Shopee", price: 27900, originalPrice: 31900, url: "https://shopee.co.th/search?keyword=Xiaomi+15+Pro", inStock: true, shipping: 0, rating: 4.8, reviews: 680 },
      { platform: "Lazada", price: 28900, originalPrice: 31900, url: "https://www.lazada.co.th/catalog/?q=Xiaomi+15+Pro", inStock: true, shipping: 0, rating: 4.7, reviews: 450 },
      { platform: "JIB",    price: 29900, originalPrice: 31900, url: "https://www.jib.co.th/web/product/product_search/0?str_search=Xiaomi+15+Pro", inStock: true, shipping: 0, rating: 4.7, reviews: 58 },
    ],
  },

  {
    name: "vivo X200 Pro 512GB",
    nameTh: "วิโว่ เอ็กซ์200 โปร 512GB",
    brand: "vivo", category: "smartphone",
    image: "https://www.vivo.com/content/dam/vivo-website/images/th/products/x200pro/series/color/black/pc-main-kv.webp",
    images: [], featured: false,
    description: "vivo X200 Pro Dimensity 9400, กล้อง ZEISS 200MP Telephoto APO, จอ 6.78 นิ้ว LTPO AMOLED 120Hz, แบตเตอรี่ 6000mAh ชาร์จ 90W",
    tags: ["vivo", "x200pro", "zeiss", "android", "5g"],
    searchKeyword: "vivo X200 Pro",
    prices: [
      { platform: "Shopee", price: 22900, originalPrice: 26900, url: "https://shopee.co.th/search?keyword=vivo+X200+Pro", inStock: true, shipping: 0, rating: 4.7, reviews: 390 },
      { platform: "Lazada", price: 23900, originalPrice: 26900, url: "https://www.lazada.co.th/catalog/?q=vivo+X200+Pro", inStock: true, shipping: 0, rating: 4.6, reviews: 280 },
      { platform: "Power Buy", price: 26900, originalPrice: 26900, url: "https://www.powerbuy.co.th/th/search/vivo%20X200%20Pro", inStock: true, shipping: 0, rating: 4.6, reviews: 68 },
    ],
  },

  {
    name: "Google Pixel 9 Pro 128GB",
    nameTh: "กูเกิล พิกเซล 9 โปร 128GB",
    brand: "Google", category: "smartphone",
    image: "https://lh3.googleusercontent.com/MHFlyT_m1Gml_e-YT2m87DzKvWmn5PQVDqT3cpAiTF4i1J5Tm5Fh3nnFiHd5e-s4VCDSLIFzuEVE8R_eMc8q9UZYesBNQ=rw-e365-w800",
    images: [], featured: false,
    description: "Google Pixel 9 Pro chip Tensor G4, AI ถ่ายภาพ Magic Eraser, Best Take, Photo Unblur, กล้อง 50MP + 48MP Telephoto 5x, จอ 6.3 นิ้ว LTPO OLED",
    tags: ["google", "pixel", "android", "ai", "5g"],
    searchKeyword: "Google Pixel 9 Pro",
    prices: [
      { platform: "Shopee", price: 31900, originalPrice: 36900, url: "https://shopee.co.th/search?keyword=Google+Pixel+9+Pro", inStock: true, shipping: 0, rating: 4.7, reviews: 210 },
      { platform: "Lazada", price: 32900, originalPrice: 36900, url: "https://www.lazada.co.th/catalog/?q=Google+Pixel+9+Pro", inStock: true, shipping: 0, rating: 4.6, reviews: 165 },
      { platform: "JIB",    price: 33900, originalPrice: 36900, url: "https://www.jib.co.th/web/product/product_search/0?str_search=Google+Pixel+9+Pro", inStock: true, shipping: 0, rating: 4.7, reviews: 38 },
    ],
  },

  {
    name: "OnePlus 13 5G 512GB",
    nameTh: "วันพลัส 13 5G 512GB",
    brand: "OnePlus", category: "smartphone",
    image: "https://oasis.opstatics.com/content/dam/oasis/page/2024/global/oneplus-13/memory/arctic-dawn/mobile-kv.png",
    images: [], featured: false,
    description: "OnePlus 13 Snapdragon 8 Elite, กล้อง Hasselblad 50MP Periscope 3x, จอ 6.82 นิ้ว LTPO AMOLED 120Hz, ชาร์จ 100W SuperVOOC",
    tags: ["oneplus", "13", "hasselblad", "android", "5g"],
    searchKeyword: "OnePlus 13",
    prices: [
      { platform: "Shopee", price: 27900, originalPrice: 31900, url: "https://shopee.co.th/search?keyword=OnePlus+13", inStock: true, shipping: 0, rating: 4.8, reviews: 340 },
      { platform: "Lazada", price: 28900, originalPrice: 31900, url: "https://www.lazada.co.th/catalog/?q=OnePlus+13", inStock: true, shipping: 0, rating: 4.7, reviews: 240 },
      { platform: "JIB",    price: 29900, originalPrice: 31900, url: "https://www.jib.co.th/web/product/product_search/0?str_search=OnePlus+13", inStock: true, shipping: 0, rating: 4.7, reviews: 45 },
    ],
  },

  {
    name: "realme GT 7 Pro 256GB",
    nameTh: "เรียลมี จีที 7 โปร 256GB",
    brand: "realme", category: "smartphone",
    image: "https://image.realme.com/content/dam/realme/attachments/product/gt7pro/color/titan-silver/color-detail-2.webp",
    images: [], featured: false,
    description: "realme GT 7 Pro Snapdragon 8 Elite, กล้อง 50MP Sony LYT-808, จอ 6.78 นิ้ว LTPO AMOLED 144Hz, ชาร์จ 120W SuperVOOC แบต 5800mAh",
    tags: ["realme", "gt7pro", "snapdragon", "android", "5g"],
    searchKeyword: "realme GT 7 Pro",
    prices: [
      { platform: "Shopee", price: 17900, originalPrice: 21900, url: "https://shopee.co.th/search?keyword=realme+GT+7+Pro", inStock: true, shipping: 0, rating: 4.7, reviews: 480 },
      { platform: "Lazada", price: 18900, originalPrice: 21900, url: "https://www.lazada.co.th/catalog/?q=realme+GT+7+Pro", inStock: true, shipping: 0, rating: 4.6, reviews: 310 },
      { platform: "JIB",    price: 19900, originalPrice: 21900, url: "https://www.jib.co.th/web/product/product_search/0?str_search=realme+GT+7+Pro", inStock: true, shipping: 0, rating: 4.6, reviews: 55 },
    ],
  },

  // ════════════════════════════════════════════════════════
  //  LAPTOP  (เพิ่ม 8 รุ่น → รวมเป็น 10)
  // ════════════════════════════════════════════════════════

  {
    name: "MacBook Pro M4 Pro 14-inch",
    nameTh: "แมคบุ๊ค โปร M4 โปร 14 นิ้ว",
    brand: "Apple", category: "laptop",
    image: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/mbp14-spaceblack-select-202410?wid=800&hei=800&fmt=jpeg",
    images: [], featured: true,
    description: "MacBook Pro 14 นิ้ว chip M4 Pro (12-core CPU / 20-core GPU), RAM 24GB, SSD 512GB, จอ Liquid Retina XDR 120Hz, แบต 24 ชั่วโมง",
    tags: ["macbook", "apple", "laptop", "m4pro", "mac"],
    searchKeyword: "MacBook Pro M4 Pro 14",
    prices: [
      { platform: "Shopee",     price: 62900, originalPrice: 74900, url: "https://shopee.co.th/search?keyword=MacBook+Pro+M4+Pro+14", inStock: true, shipping: 0, rating: 4.9, reviews: 210 },
      { platform: "Lazada",     price: 63900, originalPrice: 74900, url: "https://www.lazada.co.th/catalog/?q=MacBook+Pro+M4+Pro+14", inStock: true, shipping: 0, rating: 4.8, reviews: 155 },
      { platform: "Banana IT",  price: 69900, originalPrice: 74900, url: "https://www.bnn.in.th/p/apple/apple-mac", inStock: true, shipping: 0, rating: 4.8, reviews: 42 },
      { platform: "Studio 7",   price: 74900, originalPrice: 74900, url: "https://www.studio7thailand.com/collection/macbook-pro-series", inStock: true, shipping: 0, rating: 4.9, reviews: 118 },
      { platform: "Apple Store",price: 74900, originalPrice: 74900, url: "https://www.apple.com/th/shop/buy-mac/macbook-pro/14-inch", inStock: true, shipping: 0, rating: 5.0, reviews: 650 },
    ],
  },

  {
    name: "Dell XPS 15 9530 Core Ultra 9",
    nameTh: "เดลล์ XPS 15 9530 Core Ultra 9",
    brand: "Dell", category: "laptop",
    image: "https://i.dell.com/is/image/DellContent/content/dam/ss2/product-images/dell-client-products/notebooks/xps-notebooks/xps-15-9530/media-gallery/touch/notebook-xps-15-9530-touch-gallery-1.psd?fmt=jpg&wid=800",
    images: [], featured: false,
    description: "Dell XPS 15 Intel Core Ultra 9 185H, RTX 4070 8GB, RAM 32GB DDR5, SSD 1TB, จอ OLED 15.6 นิ้ว 3.5K OLED Touch 120Hz",
    tags: ["dell", "xps15", "laptop", "intel", "rtx4070"],
    searchKeyword: "Dell XPS 15",
    prices: [
      { platform: "Shopee", price: 69900, originalPrice: 82900, url: "https://shopee.co.th/search?keyword=Dell+XPS+15", inStock: true, shipping: 0, rating: 4.7, reviews: 145 },
      { platform: "Lazada", price: 71900, originalPrice: 82900, url: "https://www.lazada.co.th/catalog/?q=Dell+XPS+15", inStock: true, shipping: 0, rating: 4.6, reviews: 98  },
      { platform: "Power Buy", price: 79900, originalPrice: 82900, url: "https://www.powerbuy.co.th/th/search/Dell%20XPS%2015", inStock: true, shipping: 0, rating: 4.6, reviews: 58 },
      { platform: "JIB",    price: 72900, originalPrice: 82900, url: "https://www.jib.co.th/web/product/product_search/0?str_search=Dell+XPS+15", inStock: true, shipping: 0, rating: 4.6, reviews: 32 },
    ],
  },

  {
    name: "Lenovo ThinkPad X1 Carbon Gen 13",
    nameTh: "เลอโนโว่ ThinkPad X1 Carbon Gen 13",
    brand: "Lenovo", category: "laptop",
    image: "https://p3-ofp.static.pub/fes/cms/2025/02/24/d9hn6lnhfvfavywmijb05s5lp76hxo571703.png",
    images: [], featured: false,
    description: "ThinkPad X1 Carbon Gen 13 Intel Core Ultra 7 268V (Lunar Lake), RAM 32GB LPDDR5x, SSD 1TB, จอ 14 นิ้ว 2.8K OLED 120Hz น้ำหนัก 1.12 กก.",
    tags: ["lenovo", "thinkpad", "x1carbon", "laptop", "business", "ultrabook"],
    searchKeyword: "ThinkPad X1 Carbon Gen 13",
    prices: [
      { platform: "Shopee", price: 55900, originalPrice: 65900, url: "https://shopee.co.th/search?keyword=ThinkPad+X1+Carbon+Gen+13", inStock: true, shipping: 0, rating: 4.8, reviews: 88  },
      { platform: "Lazada", price: 57900, originalPrice: 65900, url: "https://www.lazada.co.th/catalog/?q=ThinkPad+X1+Carbon+Gen+13", inStock: true, shipping: 0, rating: 4.7, reviews: 62  },
      { platform: "JIB",    price: 59900, originalPrice: 65900, url: "https://www.jib.co.th/web/product/product_search/0?str_search=ThinkPad+X1+Carbon+Gen+13", inStock: true, shipping: 0, rating: 4.7, reviews: 28 },
    ],
  },

  {
    name: "HP Spectre x360 14-eu0013dx",
    nameTh: "เอชพี สเปกเตอร์ x360 14 นิ้ว",
    brand: "HP", category: "laptop",
    image: "https://ssl-product-images.www8-hp.com/digmedialib/prodimg/knoll/c08788820.png",
    images: [], featured: false,
    description: "HP Spectre x360 14 Intel Core Ultra 7 155H, Iris Xe, RAM 32GB, SSD 1TB, จอ OLED 2.8K 120Hz 14 นิ้ว Touch 360°, น้ำหนัก 1.41 กก.",
    tags: ["hp", "spectre", "x360", "laptop", "2in1", "oled"],
    searchKeyword: "HP Spectre x360 14",
    prices: [
      { platform: "Shopee", price: 44900, originalPrice: 54900, url: "https://shopee.co.th/search?keyword=HP+Spectre+x360+14", inStock: true, shipping: 0, rating: 4.7, reviews: 112 },
      { platform: "Lazada", price: 46900, originalPrice: 54900, url: "https://www.lazada.co.th/catalog/?q=HP+Spectre+x360+14", inStock: true, shipping: 0, rating: 4.6, reviews: 78  },
      { platform: "Power Buy", price: 52900, originalPrice: 54900, url: "https://www.powerbuy.co.th/th/search/HP%20Spectre%20x360", inStock: true, shipping: 0, rating: 4.6, reviews: 45 },
    ],
  },

  {
    name: "ASUS Zenbook 14 OLED UX3405",
    nameTh: "เอซุส เซนบุ๊ค 14 OLED",
    brand: "ASUS", category: "laptop",
    image: "https://dlcdnwebimgs.asus.com/files/media/8DF0BF67-BA4E-4827-BEA6-B1E2D53BF1B6/v1/images/large/2x/img/kv.webp",
    images: [], featured: false,
    description: "ASUS Zenbook 14 OLED Intel Core Ultra 7 258V, Intel Arc, RAM 32GB, SSD 1TB, จอ OLED 2.8K 120Hz 14 นิ้ว น้ำหนัก 1.2 กก. ASUS AI",
    tags: ["asus", "zenbook", "oled", "laptop", "ultrabook", "ai"],
    searchKeyword: "ASUS Zenbook 14 OLED",
    prices: [
      { platform: "Shopee",    price: 29900, originalPrice: 36900, url: "https://shopee.co.th/search?keyword=ASUS+Zenbook+14+OLED", inStock: true, shipping: 0, rating: 4.8, reviews: 195 },
      { platform: "Lazada",    price: 30900, originalPrice: 36900, url: "https://www.lazada.co.th/catalog/?q=ASUS+Zenbook+14+OLED", inStock: true, shipping: 0, rating: 4.7, reviews: 142 },
      { platform: "Power Buy", price: 34900, originalPrice: 36900, url: "https://www.powerbuy.co.th/th/search/ASUS%20Zenbook%2014%20OLED", inStock: true, shipping: 0, rating: 4.7, reviews: 68 },
      { platform: "JIB",       price: 31900, originalPrice: 36900, url: "https://www.jib.co.th/web/product/product_search/0?str_search=ASUS+Zenbook+14+OLED", inStock: true, shipping: 0, rating: 4.7, reviews: 45 },
    ],
  },

  {
    name: "MSI Prestige 16 AI+ B1VFG",
    nameTh: "เอ็มเอสไอ เพรสทีจ 16 AI+",
    brand: "MSI", category: "laptop",
    image: "https://asset.msi.com/resize/image/global/product/product_17082318482a68c05c2553b399ae42c01a93c2d6e.png62405b38d36f0d801d1f1ca7d.png",
    images: [], featured: false,
    description: "MSI Prestige 16 AI+ Intel Core Ultra 9 185H, RTX 4060 8GB, RAM 32GB DDR5, SSD 1TB, จอ 16 นิ้ว QHD+ OLED 120Hz, บางเพียง 16.9mm",
    tags: ["msi", "prestige", "laptop", "rtx4060", "creator"],
    searchKeyword: "MSI Prestige 16 AI",
    prices: [
      { platform: "Shopee", price: 51900, originalPrice: 61900, url: "https://shopee.co.th/search?keyword=MSI+Prestige+16+AI", inStock: true, shipping: 0, rating: 4.7, reviews: 75 },
      { platform: "Lazada", price: 53900, originalPrice: 61900, url: "https://www.lazada.co.th/catalog/?q=MSI+Prestige+16+AI", inStock: true, shipping: 0, rating: 4.6, reviews: 52 },
      { platform: "JIB",    price: 54900, originalPrice: 61900, url: "https://www.jib.co.th/web/product/product_search/0?str_search=MSI+Prestige+16+AI", inStock: true, shipping: 0, rating: 4.6, reviews: 22 },
    ],
  },

  {
    name: "Acer Swift 14 AI SF14-51",
    nameTh: "เอเซอร์ สวิฟต์ 14 เอไอ",
    brand: "Acer", category: "laptop",
    image: "https://static-ecshop.acer.com/media/catalog/product/s/f/sf14-51-s1-nxkhusl003-fsize.png",
    images: [], featured: false,
    description: "Acer Swift 14 AI Intel Core Ultra 5 226V (Lunar Lake), RAM 16GB LPDDR5x, SSD 512GB, จอ OLED 2.8K 120Hz 14 นิ้ว น้ำหนัก 1.2 กก.",
    tags: ["acer", "swift", "laptop", "ultrabook", "ai", "oled"],
    searchKeyword: "Acer Swift 14 AI",
    prices: [
      { platform: "Shopee",    price: 24900, originalPrice: 29900, url: "https://shopee.co.th/search?keyword=Acer+Swift+14+AI", inStock: true, shipping: 0, rating: 4.6, reviews: 165 },
      { platform: "Lazada",    price: 25900, originalPrice: 29900, url: "https://www.lazada.co.th/catalog/?q=Acer+Swift+14+AI", inStock: true, shipping: 0, rating: 4.6, reviews: 110 },
      { platform: "Power Buy", price: 28900, originalPrice: 29900, url: "https://www.powerbuy.co.th/th/search/Acer%20Swift%2014%20AI", inStock: true, shipping: 0, rating: 4.5, reviews: 55 },
      { platform: "JIB",       price: 25900, originalPrice: 29900, url: "https://www.jib.co.th/web/product/product_search/0?str_search=Acer+Swift+14+AI", inStock: true, shipping: 0, rating: 4.6, reviews: 38 },
    ],
  },

  {
    name: "Samsung Galaxy Book5 Pro 360",
    nameTh: "ซัมซุง กาแล็กซี่ บุ๊ค5 โปร 360",
    brand: "Samsung", category: "laptop",
    image: "https://images.samsung.com/th/computers/galaxy-book/galaxy-book5-pro-360/images/galaxy-book5-pro-360-highlights-kv.jpg?imbypass=true",
    images: [], featured: false,
    description: "Samsung Galaxy Book5 Pro 360 Intel Core Ultra 7 265H, Arc Graphics, RAM 16GB, SSD 512GB, จอ AMOLED 2K 120Hz 14 นิ้ว, ปากกา S Pen",
    tags: ["samsung", "galaxybook", "laptop", "spen", "2in1", "amoled"],
    searchKeyword: "Samsung Galaxy Book5 Pro",
    prices: [
      { platform: "Shopee",       price: 44900, originalPrice: 52900, url: "https://shopee.co.th/search?keyword=Samsung+Galaxy+Book5+Pro", inStock: true, shipping: 0, rating: 4.7, reviews: 88 },
      { platform: "Lazada",       price: 46900, originalPrice: 52900, url: "https://www.lazada.co.th/catalog/?q=Samsung+Galaxy+Book5+Pro", inStock: true, shipping: 0, rating: 4.6, reviews: 62 },
      { platform: "Power Buy",    price: 51900, originalPrice: 52900, url: "https://www.powerbuy.co.th/th/search/Samsung%20Galaxy%20Book5%20Pro", inStock: true, shipping: 0, rating: 4.6, reviews: 35 },
      { platform: "Samsung Shop", price: 52900, originalPrice: 52900, url: "https://www.samsung.com/th/computers/galaxy-book/galaxy-book5-pro-360/", inStock: true, shipping: 0, rating: 4.8, reviews: 520 },
    ],
  },

  // ════════════════════════════════════════════════════════
  //  TABLET  (เพิ่ม 9 รุ่น → รวมเป็น 10)
  // ════════════════════════════════════════════════════════

  {
    name: "iPad Pro M4 13-inch WiFi 256GB",
    nameTh: "ไอแพด โปร M4 13 นิ้ว WiFi 256GB",
    brand: "Apple", category: "tablet",
    image: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/ipad-pro-model-unselect-gallery-2-202405?wid=800&hei=800&fmt=jpeg",
    images: [], featured: true,
    description: "iPad Pro 13 นิ้ว chip M4, Ultra Retina XDR จอ OLED สองชั้นบางเพียง 5.1mm, รองรับ Apple Pencil Pro และ Magic Keyboard Folio",
    tags: ["ipad", "ipadpro", "apple", "m4", "tablet", "oled"],
    searchKeyword: "iPad Pro M4 13",
    prices: [
      { platform: "Shopee",     price: 39900, originalPrice: 44900, url: "https://shopee.co.th/search?keyword=iPad+Pro+M4+13", inStock: true, shipping: 0, rating: 4.9, reviews: 420 },
      { platform: "Lazada",     price: 40900, originalPrice: 44900, url: "https://www.lazada.co.th/catalog/?q=iPad+Pro+M4+13", inStock: true, shipping: 0, rating: 4.8, reviews: 310 },
      { platform: "Banana IT",  price: 44900, originalPrice: 44900, url: "https://www.bnn.in.th/p/apple/apple-ipad", inStock: true, shipping: 0, rating: 4.8, reviews: 58 },
      { platform: "Studio 7",   price: 44900, originalPrice: 44900, url: "https://www.studio7thailand.com/collection/apple-ipad-pro-series", inStock: true, shipping: 0, rating: 4.9, reviews: 128 },
      { platform: "Apple Store",price: 44900, originalPrice: 44900, url: "https://www.apple.com/th/shop/buy-ipad/ipad-pro", inStock: true, shipping: 0, rating: 5.0, reviews: 890 },
    ],
  },

  {
    name: "iPad mini 7 WiFi 128GB",
    nameTh: "ไอแพด มินิ 7 WiFi 128GB",
    brand: "Apple", category: "tablet",
    image: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/ipad-mini-finish-unselect-gallery-2-202410?wid=800&hei=800&fmt=jpeg",
    images: [], featured: false,
    description: "iPad mini 7 chip A17 Pro, จอ Liquid Retina 8.3 นิ้ว, รองรับ Apple Pencil Pro, พกพาสะดวก ออกแบบขอบจอบาง",
    tags: ["ipad", "ipadmini", "apple", "tablet", "a17pro"],
    searchKeyword: "iPad mini 7",
    prices: [
      { platform: "Shopee",     price: 16900, originalPrice: 18900, url: "https://shopee.co.th/search?keyword=iPad+mini+7", inStock: true, shipping: 0, rating: 4.8, reviews: 320 },
      { platform: "Lazada",     price: 17900, originalPrice: 18900, url: "https://www.lazada.co.th/catalog/?q=iPad+mini+7", inStock: true, shipping: 0, rating: 4.7, reviews: 240 },
      { platform: "Banana IT",  price: 18900, originalPrice: 18900, url: "https://www.bnn.in.th/p/apple/apple-ipad", inStock: true, shipping: 0, rating: 4.8, reviews: 38 },
      { platform: "Studio 7",   price: 18900, originalPrice: 18900, url: "https://www.studio7thailand.com/collection/apple-ipad-mini-series", inStock: true, shipping: 0, rating: 4.9, reviews: 88 },
      { platform: "Apple Store",price: 18900, originalPrice: 18900, url: "https://www.apple.com/th/shop/buy-ipad/ipad-mini", inStock: true, shipping: 0, rating: 5.0, reviews: 450 },
    ],
  },

  {
    name: "Samsung Galaxy Tab S10 Ultra 256GB",
    nameTh: "ซัมซุง กาแล็กซี่ แท็บ เอส10 อัลตร้า 256GB",
    brand: "Samsung", category: "tablet",
    image: "https://images.samsung.com/th/tablets/galaxy-tab-s10-ultra/images/galaxy-tab-s10-ultra-highlights-kv.jpg?imbypass=true",
    images: [], featured: false,
    description: "Galaxy Tab S10 Ultra Snapdragon 8 Gen 3, จอ 14.6 นิ้ว Dynamic AMOLED 120Hz, RAM 12GB, S Pen ในกล่อง, กล้องคู่ด้านหน้า",
    tags: ["samsung", "galaxy", "tab", "s10ultra", "android", "spen"],
    searchKeyword: "Samsung Galaxy Tab S10 Ultra",
    prices: [
      { platform: "Shopee",       price: 36900, originalPrice: 42900, url: "https://shopee.co.th/search?keyword=Samsung+Galaxy+Tab+S10+Ultra", inStock: true, shipping: 0, rating: 4.8, reviews: 380 },
      { platform: "Lazada",       price: 37900, originalPrice: 42900, url: "https://www.lazada.co.th/catalog/?q=Samsung+Galaxy+Tab+S10+Ultra", inStock: true, shipping: 0, rating: 4.7, reviews: 265 },
      { platform: "Power Buy",    price: 41900, originalPrice: 42900, url: "https://www.powerbuy.co.th/th/search/Samsung%20Galaxy%20Tab%20S10%20Ultra", inStock: true, shipping: 0, rating: 4.7, reviews: 98 },
      { platform: "Samsung Shop", price: 42900, originalPrice: 42900, url: "https://www.samsung.com/th/tablets/galaxy-tab-s/galaxy-tab-s10-ultra/buy/", inStock: true, shipping: 0, rating: 4.9, reviews: 1250 },
    ],
  },

  {
    name: "Samsung Galaxy Tab S10+ 256GB",
    nameTh: "ซัมซุง กาแล็กซี่ แท็บ เอส10+ 256GB",
    brand: "Samsung", category: "tablet",
    image: "https://images.samsung.com/th/tablets/galaxy-tab-s10-plus/images/galaxy-tab-s10-plus-highlights-kv.jpg?imbypass=true",
    images: [], featured: false,
    description: "Galaxy Tab S10+ Snapdragon 8 Gen 3, จอ 12.4 นิ้ว Dynamic AMOLED 120Hz, RAM 12GB, S Pen ในกล่อง",
    tags: ["samsung", "galaxy", "tab", "s10plus", "android", "spen"],
    searchKeyword: "Samsung Galaxy Tab S10 Plus",
    prices: [
      { platform: "Shopee",       price: 26900, originalPrice: 32900, url: "https://shopee.co.th/search?keyword=Samsung+Galaxy+Tab+S10+Plus", inStock: true, shipping: 0, rating: 4.8, reviews: 420 },
      { platform: "Lazada",       price: 27900, originalPrice: 32900, url: "https://www.lazada.co.th/catalog/?q=Samsung+Galaxy+Tab+S10+Plus", inStock: true, shipping: 0, rating: 4.7, reviews: 298 },
      { platform: "Power Buy",    price: 31900, originalPrice: 32900, url: "https://www.powerbuy.co.th/th/search/Samsung%20Galaxy%20Tab%20S10%20Plus", inStock: true, shipping: 0, rating: 4.7, reviews: 115 },
      { platform: "Samsung Shop", price: 32900, originalPrice: 32900, url: "https://www.samsung.com/th/tablets/galaxy-tab-s/galaxy-tab-s10-plus/buy/", inStock: true, shipping: 0, rating: 4.9, reviews: 2100 },
    ],
  },

  {
    name: "Xiaomi Pad 7 Pro 256GB",
    nameTh: "เสี่ยวหมี่ แพด 7 โปร 256GB",
    brand: "Xiaomi", category: "tablet",
    image: "https://i01.appmifile.com/webfile/globalimg/products/m/xiaomi-pad-7-pro/overview/img-p1.png",
    images: [], featured: false,
    description: "Xiaomi Pad 7 Pro Snapdragon 8s Gen 3, จอ 12.1 นิ้ว LCD 3K 144Hz, RAM 8GB, SSD 256GB, ชาร์จ 45W, รองรับปากกา Xiaomi Focus Pen",
    tags: ["xiaomi", "pad7pro", "android", "tablet"],
    searchKeyword: "Xiaomi Pad 7 Pro",
    prices: [
      { platform: "Shopee", price: 11900, originalPrice: 14900, url: "https://shopee.co.th/search?keyword=Xiaomi+Pad+7+Pro", inStock: true, shipping: 0, rating: 4.7, reviews: 580 },
      { platform: "Lazada", price: 12900, originalPrice: 14900, url: "https://www.lazada.co.th/catalog/?q=Xiaomi+Pad+7+Pro", inStock: true, shipping: 0, rating: 4.6, reviews: 420 },
      { platform: "JIB",    price: 13900, originalPrice: 14900, url: "https://www.jib.co.th/web/product/product_search/0?str_search=Xiaomi+Pad+7+Pro", inStock: true, shipping: 0, rating: 4.6, reviews: 62 },
    ],
  },

  {
    name: "Microsoft Surface Pro 11 Copilot+",
    nameTh: "ไมโครซอฟท์ เซอร์เฟส โปร 11",
    brand: "Microsoft", category: "tablet",
    image: "https://img-prod-cms-rt-microsoft-com.akamaized.net/cms/api/am/imageFileData/RW1ljyX?ver=c438&q=90&m=6&h=450&w=800&b=%23FFFFFF&f=jpg&o=f",
    images: [], featured: false,
    description: "Microsoft Surface Pro 11 Snapdragon X Elite, RAM 16GB, SSD 256GB, จอ 13 นิ้ว PixelSense Flow 120Hz, Copilot+ AI, แบต 14 ชั่วโมง",
    tags: ["microsoft", "surface", "windows", "tablet", "2in1", "ai"],
    searchKeyword: "Microsoft Surface Pro 11",
    prices: [
      { platform: "Shopee", price: 45900, originalPrice: 54900, url: "https://shopee.co.th/search?keyword=Microsoft+Surface+Pro+11", inStock: true, shipping: 0, rating: 4.6, reviews: 88 },
      { platform: "Lazada", price: 47900, originalPrice: 54900, url: "https://www.lazada.co.th/catalog/?q=Microsoft+Surface+Pro+11", inStock: true, shipping: 0, rating: 4.5, reviews: 65 },
      { platform: "Power Buy", price: 53900, originalPrice: 54900, url: "https://www.powerbuy.co.th/th/search/Microsoft%20Surface%20Pro%2011", inStock: true, shipping: 0, rating: 4.5, reviews: 42 },
    ],
  },

  {
    name: "Lenovo Tab P12 Pro 256GB",
    nameTh: "เลอโนโว่ แท็บ P12 โปร 256GB",
    brand: "Lenovo", category: "tablet",
    image: "https://p3-ofp.static.pub/fes/cms/2022/10/09/1tgnzmwmuzg7pqrlfizq5r2a5r6w2a219085.png",
    images: [], featured: false,
    description: "Lenovo Tab P12 Pro Snapdragon 870, จอ AMOLED 12.6 นิ้ว 2K 120Hz, RAM 8GB, SSD 256GB, 4 ลำโพง Dolby Atmos, รองรับ Lenovo Precision Pen 3",
    tags: ["lenovo", "tab", "p12pro", "android", "tablet"],
    searchKeyword: "Lenovo Tab P12 Pro",
    prices: [
      { platform: "Shopee", price: 15900, originalPrice: 19900, url: "https://shopee.co.th/search?keyword=Lenovo+Tab+P12+Pro", inStock: true, shipping: 0, rating: 4.6, reviews: 245 },
      { platform: "Lazada", price: 16900, originalPrice: 19900, url: "https://www.lazada.co.th/catalog/?q=Lenovo+Tab+P12+Pro", inStock: true, shipping: 0, rating: 4.5, reviews: 188 },
      { platform: "JIB",    price: 17900, originalPrice: 19900, url: "https://www.jib.co.th/web/product/product_search/0?str_search=Lenovo+Tab+P12+Pro", inStock: true, shipping: 0, rating: 4.5, reviews: 35 },
    ],
  },

  {
    name: "OPPO Pad 3 Pro 256GB",
    nameTh: "ออปโป้ แพด 3 โปร 256GB",
    brand: "OPPO", category: "tablet",
    image: "https://image.oppo.com/content/dam/oppo/product-asset-library/oppo-pad3pro/v1/assets/specs-header.png",
    images: [], featured: false,
    description: "OPPO Pad 3 Pro Dimensity 9300, จอ 12.1 นิ้ว OLED 144Hz, RAM 12GB, ชาร์จ 67W SuperVOOC, รองรับ OPPO Pencil 2",
    tags: ["oppo", "pad3pro", "android", "tablet", "oled"],
    searchKeyword: "OPPO Pad 3 Pro",
    prices: [
      { platform: "Shopee", price: 15900, originalPrice: 19900, url: "https://shopee.co.th/search?keyword=OPPO+Pad+3+Pro", inStock: true, shipping: 0, rating: 4.7, reviews: 210 },
      { platform: "Lazada", price: 16900, originalPrice: 19900, url: "https://www.lazada.co.th/catalog/?q=OPPO+Pad+3+Pro", inStock: true, shipping: 0, rating: 4.6, reviews: 158 },
      { platform: "Power Buy", price: 18900, originalPrice: 19900, url: "https://www.powerbuy.co.th/th/search/OPPO%20Pad%203%20Pro", inStock: true, shipping: 0, rating: 4.6, reviews: 55 },
    ],
  },

  {
    name: "realme Pad X2 128GB",
    nameTh: "เรียลมี แพด X2 128GB",
    brand: "realme", category: "tablet",
    image: "https://fdn2.gsmarena.com/vv/pics/realme/realme-pad-x2-1.jpg",
    images: [], featured: false,
    description: "realme Pad X2 Snapdragon 695, จอ 11 นิ้ว FHD+ IPS 90Hz, RAM 6GB, ชาร์จ 45W SUPERVOOC, 4 ลำโพง Dolby Atmos ราคาคุ้มค่า",
    tags: ["realme", "padx2", "android", "tablet"],
    searchKeyword: "realme Pad X2",
    prices: [
      { platform: "Shopee", price: 7490, originalPrice: 9990, url: "https://shopee.co.th/search?keyword=realme+Pad+X2", inStock: true, shipping: 0, rating: 4.5, reviews: 380 },
      { platform: "Lazada", price: 7990, originalPrice: 9990, url: "https://www.lazada.co.th/catalog/?q=realme+Pad+X2", inStock: true, shipping: 0, rating: 4.4, reviews: 265 },
      { platform: "JIB",    price: 8990, originalPrice: 9990, url: "https://www.jib.co.th/web/product/product_search/0?str_search=realme+Pad+X2", inStock: true, shipping: 0, rating: 4.4, reviews: 38 },
    ],
  },

  // ════════════════════════════════════════════════════════
  //  AUDIO  (เพิ่ม 9 รุ่น → รวมเป็น 10)
  // ════════════════════════════════════════════════════════

  {
    name: "Apple AirPods Pro 2nd Gen",
    nameTh: "แอปเปิล แอร์พอดส์ โปร รุ่น 2",
    brand: "Apple", category: "audio",
    image: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/MQD83?wid=800&hei=800&fmt=jpeg",
    images: [], featured: true,
    description: "AirPods Pro รุ่น 2 chip H2, ตัดเสียงรบกวน Active Noise Cancellation ระดับ 2x, Adaptive Audio, Personalized Spatial Audio, แบต 6 ชม. + เคส 30 ชม.",
    tags: ["apple", "airpods", "earbuds", "anc", "wireless"],
    searchKeyword: "AirPods Pro 2",
    prices: [
      { platform: "Shopee",     price: 7490, originalPrice: 8990,  url: "https://shopee.co.th/search?keyword=AirPods+Pro+2", inStock: true, shipping: 0, rating: 4.9, reviews: 2150 },
      { platform: "Lazada",     price: 7590, originalPrice: 8990,  url: "https://www.lazada.co.th/catalog/?q=AirPods+Pro+2", inStock: true, shipping: 0, rating: 4.8, reviews: 1680 },
      { platform: "Banana IT",  price: 8490, originalPrice: 8990,  url: "https://www.bnn.in.th/p/audio-and-headphone/apple", inStock: true, shipping: 0, rating: 4.8, reviews: 98   },
      { platform: "Studio 7",   price: 8990, originalPrice: 8990,  url: "https://www.studio7thailand.com/collection/airpods-pro", inStock: true, shipping: 0, rating: 4.9, reviews: 340 },
      { platform: "Apple Store",price: 8990, originalPrice: 8990,  url: "https://www.apple.com/th/shop/buy-airpods/airpods-pro", inStock: true, shipping: 0, rating: 5.0, reviews: 4500 },
    ],
  },

  {
    name: "Samsung Galaxy Buds3 Pro",
    nameTh: "ซัมซุง กาแล็กซี่ บัดส์ 3 โปร",
    brand: "Samsung", category: "audio",
    image: "https://images.samsung.com/th/galaxy-buds/galaxy-buds3-pro/images/galaxy-buds3-pro-highlights-kv.jpg?imbypass=true",
    images: [], featured: false,
    description: "Galaxy Buds3 Pro รูปทรงใหม่ตัดเสียง ANC 2 ชั้น, Intelligent ANC ปรับตามสภาพแวดล้อม, 360 Audio, Blade Light Design, ทน IPX7",
    tags: ["samsung", "buds3pro", "earbuds", "anc", "wireless"],
    searchKeyword: "Samsung Galaxy Buds3 Pro",
    prices: [
      { platform: "Shopee",       price: 4990, originalPrice: 5990, url: "https://shopee.co.th/search?keyword=Samsung+Galaxy+Buds3+Pro", inStock: true, shipping: 0, rating: 4.7, reviews: 780 },
      { platform: "Lazada",       price: 5190, originalPrice: 5990, url: "https://www.lazada.co.th/catalog/?q=Samsung+Galaxy+Buds3+Pro", inStock: true, shipping: 0, rating: 4.6, reviews: 560 },
      { platform: "Power Buy",    price: 5790, originalPrice: 5990, url: "https://www.powerbuy.co.th/th/search/Samsung%20Galaxy%20Buds3%20Pro", inStock: true, shipping: 0, rating: 4.6, reviews: 155 },
      { platform: "Samsung Shop", price: 5990, originalPrice: 5990, url: "https://www.samsung.com/th/audio-sound/galaxy-buds/galaxy-buds3-pro/buy/", inStock: true, shipping: 0, rating: 4.8, reviews: 1850 },
    ],
  },

  {
    name: "Bose QuietComfort Ultra Headphones",
    nameTh: "โบส ควอยเอทคอมฟอร์ต อัลตร้า",
    brand: "Bose", category: "audio",
    image: "https://assets.bose.com/content/dam/clouvassets/Bose_DAM/Web/consumer_electronics/global/products/headphones/qc_ultra_headphones/product_silo_images/QC_Ultra_Headphones_Black_EC_Hero.png/jcr:content/renditions/cq5dam.web.600.600.png",
    images: [], featured: false,
    description: "Bose QuietComfort Ultra Headphones ตัดเสียงดีที่สุดในตลาด, Immersive Audio พร้อม Head Tracking, แบต 24 ชั่วโมง, น้ำหนัก 250g",
    tags: ["bose", "quietcomfort", "headphone", "anc", "wireless"],
    searchKeyword: "Bose QuietComfort Ultra Headphones",
    prices: [
      { platform: "Shopee",   price: 11900, originalPrice: 14900, url: "https://shopee.co.th/search?keyword=Bose+QuietComfort+Ultra+Headphones", inStock: true, shipping: 0, rating: 4.8, reviews: 450 },
      { platform: "Lazada",   price: 12900, originalPrice: 14900, url: "https://www.lazada.co.th/catalog/?q=Bose+QuietComfort+Ultra+Headphones", inStock: true, shipping: 0, rating: 4.7, reviews: 320 },
      { platform: "Power Buy",price: 14490, originalPrice: 14900, url: "https://www.powerbuy.co.th/th/search/Bose%20QuietComfort%20Ultra", inStock: true, shipping: 0, rating: 4.7, reviews: 88 },
      { platform: "Banana IT",price: 13990, originalPrice: 14900, url: "https://www.bnn.in.th/p/audio-and-headphone/bose", inStock: true, shipping: 0, rating: 4.7, reviews: 45 },
    ],
  },

  {
    name: "Sony WF-1000XM5",
    nameTh: "โซนี่ WF-1000XM5 หูฟังไร้สาย",
    brand: "Sony", category: "audio",
    image: "https://www.sony.co.th/image/f3dfca9d19a7fb3cf5e4e6a6a773c62e?fmt=pjpeg&wid=800",
    images: [], featured: false,
    description: "Sony WF-1000XM5 ตัดเสียงรบกวน Dual Chip QN2e, ไดรเวอร์ Dynamic 8.4mm, LDAC + DSEE Extreme, Speak-to-Chat, แบต 8+16 ชั่วโมง",
    tags: ["sony", "wf1000xm5", "earbuds", "anc", "wireless", "ldac"],
    searchKeyword: "Sony WF-1000XM5",
    prices: [
      { platform: "Shopee",    price: 7490,  originalPrice: 9990, url: "https://shopee.co.th/search?keyword=Sony+WF-1000XM5", inStock: true, shipping: 0, rating: 4.8, reviews: 980  },
      { platform: "Lazada",    price: 7690,  originalPrice: 9990, url: "https://www.lazada.co.th/catalog/?q=Sony+WF-1000XM5", inStock: true, shipping: 0, rating: 4.7, reviews: 720  },
      { platform: "Power Buy", price: 9490,  originalPrice: 9990, url: "https://www.powerbuy.co.th/th/search/Sony%20WF-1000XM5", inStock: true, shipping: 0, rating: 4.7, reviews: 190 },
      { platform: "Sony Store",price: 9990,  originalPrice: 9990, url: "https://www.sony.co.th/th/headphones/products/wf-1000xm5", inStock: true, shipping: 0, rating: 5.0, reviews: 1100 },
    ],
  },

  {
    name: "JBL Tour Pro 3",
    nameTh: "เจบีแอล ทัวร์ โปร 3",
    brand: "JBL", category: "audio",
    image: "https://in.jbl.com/on/demandware.static/-/Sites-masterCatalog_Harman/default/dw57da44fc/JBL_TOUR_PRO_3_Product%20Image_Hero_Champagne.png",
    images: [], featured: false,
    description: "JBL Tour Pro 3 ANC รุ่นใหม่, Smart Charging Case มีหน้าจอสัมผัส, ตัวดีไดรเวอร์ 10mm, Spatial Sound, แบต 10+40 ชั่วโมง",
    tags: ["jbl", "tourpro3", "earbuds", "anc", "wireless"],
    searchKeyword: "JBL Tour Pro 3",
    prices: [
      { platform: "Shopee",   price: 5490, originalPrice: 6990, url: "https://shopee.co.th/search?keyword=JBL+Tour+Pro+3", inStock: true, shipping: 0, rating: 4.7, reviews: 320 },
      { platform: "Lazada",   price: 5690, originalPrice: 6990, url: "https://www.lazada.co.th/catalog/?q=JBL+Tour+Pro+3", inStock: true, shipping: 0, rating: 4.6, reviews: 240 },
      { platform: "Power Buy",price: 6790, originalPrice: 6990, url: "https://www.powerbuy.co.th/th/search/JBL%20Tour%20Pro%203", inStock: true, shipping: 0, rating: 4.6, reviews: 85 },
    ],
  },

  {
    name: "Sennheiser Momentum 4 Wireless",
    nameTh: "เซนน์ไฮเซอร์ โมเมนตัม 4 ไวร์เลส",
    brand: "Sennheiser", category: "audio",
    image: "https://assets.sennheiser.com/img/41289/x1_desktop_Sennheiser_Momentum_4_Wireless_Black.jpg",
    images: [], featured: false,
    description: "Sennheiser Momentum 4 Wireless ตัดเสียงที่ปรับแต่ง AI ได้, ไดรเวอร์ 42mm, แบต 60 ชั่วโมง เสียงคุณภาพสูง Hi-Res Audio Wireless",
    tags: ["sennheiser", "momentum4", "headphone", "anc", "wireless", "hires"],
    searchKeyword: "Sennheiser Momentum 4 Wireless",
    prices: [
      { platform: "Shopee",   price: 8990, originalPrice: 11990, url: "https://shopee.co.th/search?keyword=Sennheiser+Momentum+4+Wireless", inStock: true, shipping: 0, rating: 4.8, reviews: 280 },
      { platform: "Lazada",   price: 9490, originalPrice: 11990, url: "https://www.lazada.co.th/catalog/?q=Sennheiser+Momentum+4+Wireless", inStock: true, shipping: 0, rating: 4.7, reviews: 195 },
      { platform: "Power Buy",price: 11490, originalPrice: 11990, url: "https://www.powerbuy.co.th/th/search/Sennheiser%20Momentum%204", inStock: true, shipping: 0, rating: 4.7, reviews: 68 },
    ],
  },

  {
    name: "Beats Studio Pro Wireless",
    nameTh: "บีตส์ สตูดิโอ โปร ไวร์เลส",
    brand: "Beats", category: "audio",
    image: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/MQTP3?wid=800&hei=800&fmt=jpeg",
    images: [], featured: false,
    description: "Beats Studio Pro ตัดเสียง Active Noise Cancelling, Personalized Spatial Audio, ชิป Apple + USB-C, แบต 40 ชม. เชื่อม Android + iOS ได้",
    tags: ["beats", "studiopro", "headphone", "anc", "wireless", "apple"],
    searchKeyword: "Beats Studio Pro",
    prices: [
      { platform: "Shopee",     price: 7490, originalPrice: 9990, url: "https://shopee.co.th/search?keyword=Beats+Studio+Pro", inStock: true, shipping: 0, rating: 4.7, reviews: 320 },
      { platform: "Lazada",     price: 7690, originalPrice: 9990, url: "https://www.lazada.co.th/catalog/?q=Beats+Studio+Pro", inStock: true, shipping: 0, rating: 4.6, reviews: 240 },
      { platform: "Banana IT",  price: 9490, originalPrice: 9990, url: "https://www.bnn.in.th/p/audio-and-headphone/beats", inStock: true, shipping: 0, rating: 4.7, reviews: 55  },
      { platform: "Apple Store",price: 9990, originalPrice: 9990, url: "https://www.apple.com/th/shop/product/MQTP3LL/A", inStock: true, shipping: 0, rating: 4.8, reviews: 890 },
    ],
  },

  {
    name: "Nothing Ear (3)",
    nameTh: "นัทธิ่ง อีร์ 3",
    brand: "Nothing", category: "audio",
    image: "https://nothing.tech/cdn/shop/products/Ear3_Clear_1_2000x.jpg?v=1739452834",
    images: [], featured: false,
    description: "Nothing Ear (3) ดีไซน์โปร่งใสเอกลักษณ์, ANC 3 ระดับ, ไดรเวอร์ Dynamic 11mm + Balanced Armature, ChatGPT integration, แบต 8+24 ชม.",
    tags: ["nothing", "ear3", "earbuds", "anc", "wireless"],
    searchKeyword: "Nothing Ear 3",
    prices: [
      { platform: "Shopee", price: 2990, originalPrice: 3990, url: "https://shopee.co.th/search?keyword=Nothing+Ear+3", inStock: true, shipping: 0, rating: 4.7, reviews: 410 },
      { platform: "Lazada", price: 3190, originalPrice: 3990, url: "https://www.lazada.co.th/catalog/?q=Nothing+Ear+3", inStock: true, shipping: 0, rating: 4.6, reviews: 295 },
      { platform: "JIB",    price: 3490, originalPrice: 3990, url: "https://www.jib.co.th/web/product/product_search/0?str_search=Nothing+Ear+3", inStock: true, shipping: 0, rating: 4.6, reviews: 48 },
    ],
  },

  {
    name: "Jabra Evolve2 75 Wireless",
    nameTh: "จาบร้า อีโวลฟ์ 2 75 ไวร์เลส",
    brand: "Jabra", category: "audio",
    image: "https://www.jabra.com/contentassets/ed36bef90ad4440b9ee7c67a5c3085a9/evolve2-75-ms-titanium-black-headphones_main.png",
    images: [], featured: false,
    description: "Jabra Evolve2 75 หูฟัง Business Grade ANC, ไมโครโฟน 8 ตัว AI-based Noise Cancellation, รับรอง MS Teams/UC, แบต 36 ชั่วโมง",
    tags: ["jabra", "evolve2", "headphone", "business", "anc", "wireless"],
    searchKeyword: "Jabra Evolve2 75",
    prices: [
      { platform: "Shopee", price: 10900, originalPrice: 13900, url: "https://shopee.co.th/search?keyword=Jabra+Evolve2+75", inStock: true, shipping: 0, rating: 4.8, reviews: 155 },
      { platform: "Lazada", price: 11900, originalPrice: 13900, url: "https://www.lazada.co.th/catalog/?q=Jabra+Evolve2+75", inStock: true, shipping: 0, rating: 4.7, reviews: 110 },
    ],
  },

  // ════════════════════════════════════════════════════════
  //  HOME  (เพิ่ม 9 รุ่น → รวมเป็น 10)
  // ════════════════════════════════════════════════════════

  {
    name: "Roborock S8 MaxV Ultra",
    nameTh: "โรโบร็อค เอส8 แม็กซ์วี อัลตร้า",
    brand: "Roborock", category: "home",
    image: "https://cdn.shopify.com/s/files/1/0618/1922/9993/files/S8MaxVUltra_Main.png?v=1699521337",
    images: [], featured: false,
    description: "Roborock S8 MaxV Ultra หุ่นยนต์ดูดฝุ่น+ถูพื้น AI Reactive Obstacle Avoidance 3.0, 10000Pa, แท่นอัตโนมัติ ล้างม็อบ+ดูดฝุ่น+เติมน้ำ",
    tags: ["roborock", "robot", "vacuum", "home", "auto"],
    searchKeyword: "Roborock S8 MaxV Ultra",
    prices: [
      { platform: "Shopee",         price: 32900, originalPrice: 39900, url: "https://shopee.co.th/search?keyword=Roborock+S8+MaxV+Ultra", inStock: true, shipping: 0, rating: 4.8, reviews: 520 },
      { platform: "Lazada",         price: 33900, originalPrice: 39900, url: "https://www.lazada.co.th/catalog/?q=Roborock+S8+MaxV+Ultra", inStock: true, shipping: 0, rating: 4.7, reviews: 380 },
      { platform: "Central Online", price: 37900, originalPrice: 39900, url: "https://www.central.co.th/th/search?q=Roborock+S8+MaxV+Ultra", inStock: true, shipping: 0, rating: 4.7, reviews: 95  },
    ],
  },

  {
    name: "Xiaomi Robot Vacuum X20 Pro",
    nameTh: "เสี่ยวหมี่ โรบอท แวคคั่ม X20 โปร",
    brand: "Xiaomi", category: "home",
    image: "https://i01.appmifile.com/webfile/globalimg/products/m/robot-vacuum-x20-pro/overview/pc-kv.png",
    images: [], featured: false,
    description: "Xiaomi Robot Vacuum X20 Pro 7000Pa Hyper Suction, AI รู้จักสิ่งกีดขวาง 100+ ประเภท, ไม้ม็อบสั่นสะเทือน, แท่น All-in-One Station",
    tags: ["xiaomi", "robot", "vacuum", "home", "ai"],
    searchKeyword: "Xiaomi Robot Vacuum X20 Pro",
    prices: [
      { platform: "Shopee", price: 11900, originalPrice: 15900, url: "https://shopee.co.th/search?keyword=Xiaomi+Robot+Vacuum+X20+Pro", inStock: true, shipping: 0, rating: 4.7, reviews: 680 },
      { platform: "Lazada", price: 12900, originalPrice: 15900, url: "https://www.lazada.co.th/catalog/?q=Xiaomi+Robot+Vacuum+X20+Pro", inStock: true, shipping: 0, rating: 4.6, reviews: 490 },
    ],
  },

  {
    name: "Dyson Purifier Hot+Cool HP09",
    nameTh: "ไดสัน เพียวริไฟเออร์ ฮ็อต+คูล HP09",
    brand: "Dyson", category: "home",
    image: "https://dyson-h.assetsadobe2.com/is/image/content/dam/dyson/products/home/purifiers/hp09/rcc/White-Gold-HP09.jpg?$responsive$&cropPathE=desktop&fit=stretch,1&wid=800",
    images: [], featured: false,
    description: "Dyson HP09 ฟอกอากาศ+พัดลม+ให้ความร้อน กรอง PM0.1, Formaldehyde, กำจัดแบคทีเรีย สั่งงานผ่าน MyDyson App, ทำงานเงียบ",
    tags: ["dyson", "purifier", "airpurifier", "home", "hp09"],
    searchKeyword: "Dyson HP09",
    prices: [
      { platform: "Shopee",         price: 18900, originalPrice: 23900, url: "https://shopee.co.th/search?keyword=Dyson+HP09", inStock: true, shipping: 0, rating: 4.8, reviews: 285 },
      { platform: "Lazada",         price: 19900, originalPrice: 23900, url: "https://www.lazada.co.th/catalog/?q=Dyson+HP09", inStock: true, shipping: 0, rating: 4.7, reviews: 198 },
      { platform: "Central Online", price: 22900, originalPrice: 23900, url: "https://www.central.co.th/th/search?q=Dyson+HP09", inStock: true, shipping: 0, rating: 4.7, reviews: 68  },
      { platform: "Dyson Store",    price: 23900, originalPrice: 23900, url: "https://www.dyson.co.th/th-TH/purifiers/dyson-purifier-hot-cool/dyson-purifier-hot-cool", inStock: true, shipping: 0, rating: 5.0, reviews: 420 },
    ],
  },

  {
    name: "Philips Air Purifier Series 3000i AC3858",
    nameTh: "ฟิลิปส์ เครื่องฟอกอากาศ ซีรีส์ 3000i",
    brand: "Philips", category: "home",
    image: "https://images.philips.com/is/image/philipsconsumer/ac3858_60-IMS-en_US?wid=800&hei=800&$pjpeg$",
    images: [], featured: false,
    description: "Philips Air Purifier 3000i กำจัด 99.97% PM2.5, ไวรัส, แบคทีเรีย, สารก่อภูมิแพ้, เชื่อม Air+ App, ห้อง 100 ตร.ม., ระดับเสียง 14dB",
    tags: ["philips", "airpurifier", "home", "pm25"],
    searchKeyword: "Philips Air Purifier AC3858",
    prices: [
      { platform: "Shopee",         price: 5990, originalPrice: 7990, url: "https://shopee.co.th/search?keyword=Philips+Air+Purifier+AC3858", inStock: true, shipping: 0, rating: 4.7, reviews: 420 },
      { platform: "Lazada",         price: 6490, originalPrice: 7990, url: "https://www.lazada.co.th/catalog/?q=Philips+Air+Purifier+AC3858", inStock: true, shipping: 0, rating: 4.6, reviews: 310 },
      { platform: "Central Online", price: 7490, originalPrice: 7990, url: "https://www.central.co.th/th/search?q=Philips+AC3858", inStock: true, shipping: 0, rating: 4.6, reviews: 88 },
    ],
  },

  {
    name: "iRobot Roomba Combo j9+",
    nameTh: "ไอโรบอท รูมบ้า คอมโบ้ j9+",
    brand: "iRobot", category: "home",
    image: "https://cdn.irobot.co.th/media/catalog/product/cache/a4d84d8e2a08f2c6ab8e4f3a4af1e8c7/r/o/roomba-combo-j9.png",
    images: [], featured: false,
    description: "iRobot Roomba Combo j9+ ดูดฝุ่น+ถูพื้นในเครื่องเดียว, ยกแผ่นม็อบอัตโนมัติ, Smart Dirt Detect, แท่นทิ้งฝุ่นอัตโนมัติ 60 วัน",
    tags: ["irobot", "roomba", "robot", "vacuum", "home"],
    searchKeyword: "iRobot Roomba j9",
    prices: [
      { platform: "Shopee",         price: 21900, originalPrice: 27900, url: "https://shopee.co.th/search?keyword=iRobot+Roomba+j9", inStock: true, shipping: 0, rating: 4.7, reviews: 185 },
      { platform: "Lazada",         price: 22900, originalPrice: 27900, url: "https://www.lazada.co.th/catalog/?q=iRobot+Roomba+j9", inStock: true, shipping: 0, rating: 4.6, reviews: 138 },
      { platform: "Central Online", price: 26900, originalPrice: 27900, url: "https://www.central.co.th/th/search?q=iRobot+Roomba+j9", inStock: true, shipping: 0, rating: 4.6, reviews: 55 },
    ],
  },

  {
    name: "Xiaomi Smart Air Purifier 4 Pro",
    nameTh: "เสี่ยวหมี่ สมาร์ท เครื่องฟอกอากาศ 4 โปร",
    brand: "Xiaomi", category: "home",
    image: "https://i01.appmifile.com/webfile/globalimg/products/m/xiaomi-smart-air-purifier-4-pro/overview/img-kv.png",
    images: [], featured: false,
    description: "Xiaomi Smart Air Purifier 4 Pro CADR 500m³/h กำจัด PM2.5, ฝุ่นละออง, แบคทีเรีย, เชื่อม Mi Home App, จอ OLED, ห้อง 60 ตร.ม.",
    tags: ["xiaomi", "airpurifier", "home", "pm25", "smart"],
    searchKeyword: "Xiaomi Smart Air Purifier 4 Pro",
    prices: [
      { platform: "Shopee", price: 3490, originalPrice: 4990, url: "https://shopee.co.th/search?keyword=Xiaomi+Smart+Air+Purifier+4+Pro", inStock: true, shipping: 0, rating: 4.6, reviews: 1250 },
      { platform: "Lazada", price: 3690, originalPrice: 4990, url: "https://www.lazada.co.th/catalog/?q=Xiaomi+Smart+Air+Purifier+4+Pro", inStock: true, shipping: 0, rating: 4.5, reviews: 890  },
    ],
  },

  {
    name: "Nespresso Vertuo Next ENV120",
    nameTh: "เนสเพรสโซ่ เวอร์ทูโอ เน็กซ์",
    brand: "Nespresso", category: "home",
    image: "https://www.nespresso.com/shared_res/ams/us/machines/vertuo/env120/env120-baq-pdp-media-1_sku-main.jpg",
    images: [], featured: false,
    description: "Nespresso Vertuo Next ระบบ Centrifusion ชงกาแฟ 5 ขนาด Espresso–Alto, เชื่อม Bluetooth ผ่าน Nespresso App, อุ่นใน 30 วินาที",
    tags: ["nespresso", "coffee", "machine", "home"],
    searchKeyword: "Nespresso Vertuo Next",
    prices: [
      { platform: "Shopee",         price: 3490, originalPrice: 4590, url: "https://shopee.co.th/search?keyword=Nespresso+Vertuo+Next", inStock: true, shipping: 0, rating: 4.7, reviews: 680 },
      { platform: "Lazada",         price: 3690, originalPrice: 4590, url: "https://www.lazada.co.th/catalog/?q=Nespresso+Vertuo+Next", inStock: true, shipping: 0, rating: 4.6, reviews: 490 },
      { platform: "Central Online", price: 4290, originalPrice: 4590, url: "https://www.central.co.th/th/search?q=Nespresso+Vertuo", inStock: true, shipping: 0, rating: 4.6, reviews: 155 },
    ],
  },

  {
    name: "Breville Barista Express Impress BES876",
    nameTh: "เบรวิลล์ บาริสต้า เอ็กซ์เพรส อิมเพรส",
    brand: "Breville", category: "home",
    image: "https://www.breville.com/content/dam/breville/us/assets/espresso/finished-goods/bes876bssusc/images/BES876BSS_001_square_1000x1000.jpg",
    images: [], featured: false,
    description: "Breville Barista Express Impress เครื่องทำกาแฟ Built-in Grinder 30 ระดับ, Assisted Tamping, ThermoJet 3 วินาที, ระบบ Steam Wand",
    tags: ["breville", "espresso", "coffee", "home", "barista"],
    searchKeyword: "Breville Barista Express Impress",
    prices: [
      { platform: "Shopee",         price: 21900, originalPrice: 26900, url: "https://shopee.co.th/search?keyword=Breville+Barista+Express+Impress", inStock: true, shipping: 0, rating: 4.8, reviews: 195 },
      { platform: "Lazada",         price: 22900, originalPrice: 26900, url: "https://www.lazada.co.th/catalog/?q=Breville+Barista+Express", inStock: true, shipping: 0, rating: 4.7, reviews: 142 },
      { platform: "Central Online", price: 25900, originalPrice: 26900, url: "https://www.central.co.th/th/search?q=Breville+Barista+Express", inStock: true, shipping: 0, rating: 4.7, reviews: 68 },
    ],
  },

  {
    name: "LG CordZero A9 Kompressor",
    nameTh: "แอลจี คอร์ดซีโร่ A9 คอมเพรสเซอร์",
    brand: "LG", category: "home",
    image: "https://www.lg.com/th/images/vacuums/md07874688/gallery/desktop-01.jpg",
    images: [], featured: false,
    description: "LG CordZero A9 Kompressor ดูดฝุ่นไร้สาย 200W Inverter Motor, Kompressor Technology กด compact ขยะ 40%, แบต 2 ก้อน รวม 120 นาที",
    tags: ["lg", "cordzero", "vacuum", "home", "wireless"],
    searchKeyword: "LG CordZero A9",
    prices: [
      { platform: "Shopee",         price: 8490, originalPrice: 11900, url: "https://shopee.co.th/search?keyword=LG+CordZero+A9+Kompressor", inStock: true, shipping: 0, rating: 4.7, reviews: 380 },
      { platform: "Lazada",         price: 8990, originalPrice: 11900, url: "https://www.lazada.co.th/catalog/?q=LG+CordZero+A9", inStock: true, shipping: 0, rating: 4.6, reviews: 268 },
      { platform: "Central Online", price: 10900, originalPrice: 11900, url: "https://www.central.co.th/th/search?q=LG+CordZero+A9", inStock: true, shipping: 0, rating: 4.6, reviews: 88 },
    ],
  },

  // ════════════════════════════════════════════════════════
  //  FASHION  (เพิ่ม 9 รุ่น → รวมเป็น 10)
  // ════════════════════════════════════════════════════════

  {
    name: "Adidas Ultraboost 25",
    nameTh: "อาดิดาส อัลตร้าบูสต์ 25",
    brand: "Adidas", category: "fashion",
    image: "https://assets.adidas.com/images/h_840,f_auto,q_auto,fl_lossy,c_fill,g_auto/a22985b0e9f242f0ace7ce1d3f84a89e_9366/Ultraboost_25_Shoes_Black_JI3924_01_standard.jpg",
    images: [], featured: false,
    description: "Adidas Ultraboost 25 พื้น BOOST+ ใหม่, UpperKnit Primeknit+ รับเท้าแบบ 360°, ดีไซน์ใหม่ Mirrored Torsion System, เบาและนุ่มกว่าเดิม",
    tags: ["adidas", "ultraboost", "running", "shoes", "fashion"],
    searchKeyword: "Adidas Ultraboost 25",
    prices: [
      { platform: "Shopee", price: 4990, originalPrice: 6490, url: "https://shopee.co.th/search?keyword=Adidas+Ultraboost+25", inStock: true, shipping: 0, rating: 4.7, reviews: 425 },
      { platform: "Lazada", price: 5190, originalPrice: 6490, url: "https://www.lazada.co.th/catalog/?q=Adidas+Ultraboost+25", inStock: true, shipping: 0, rating: 4.6, reviews: 312 },
    ],
  },

  {
    name: "New Balance Fresh Foam X 1080v14",
    nameTh: "นิวแบลนซ์ เฟรชโฟม X 1080v14",
    brand: "New Balance", category: "fashion",
    image: "https://nb.scene7.com/is/image/NB/m1080k14_nb_02_i?$pdpflexf2$&qlt=80&fmt=webp&wid=800",
    images: [], featured: false,
    description: "New Balance 1080v14 พื้น Fresh Foam X ปรับสูตรใหม่ รับน้ำหนักได้ดีขึ้น 15%, วัสดุ Hypoknit Upper, เหมาะ Long Distance",
    tags: ["newbalance", "1080", "running", "shoes", "fashion"],
    searchKeyword: "New Balance 1080v14",
    prices: [
      { platform: "Shopee", price: 5490, originalPrice: 6990, url: "https://shopee.co.th/search?keyword=New+Balance+1080v14", inStock: true, shipping: 0, rating: 4.8, reviews: 285 },
      { platform: "Lazada", price: 5690, originalPrice: 6990, url: "https://www.lazada.co.th/catalog/?q=New+Balance+1080v14", inStock: true, shipping: 0, rating: 4.7, reviews: 198 },
    ],
  },

  {
    name: "Hoka Bondi 9",
    nameTh: "โฮก้า บอนได 9",
    brand: "Hoka", category: "fashion",
    image: "https://www.hoka.com/on/demandware.static/-/Sites-hoka-master-catalog/default/dw4f16e9e6/images/large/1127952-BWHT_1.png",
    images: [], featured: false,
    description: "Hoka Bondi 9 พื้น EVA รุ่นใหม่หนาสุดใน Hoka, Early Stage Meta-Rocker, Engineered Mesh Upper, รองรับระยะไกล น้ำหนัก 288g",
    tags: ["hoka", "bondi9", "running", "shoes", "fashion"],
    searchKeyword: "Hoka Bondi 9",
    prices: [
      { platform: "Shopee", price: 5990, originalPrice: 7490, url: "https://shopee.co.th/search?keyword=Hoka+Bondi+9", inStock: true, shipping: 0, rating: 4.8, reviews: 320 },
      { platform: "Lazada", price: 6190, originalPrice: 7490, url: "https://www.lazada.co.th/catalog/?q=Hoka+Bondi+9", inStock: true, shipping: 0, rating: 4.7, reviews: 225 },
    ],
  },

  {
    name: "On Cloudmonster 2",
    nameTh: "ออน คลาวด์มอนสเตอร์ 2",
    brand: "On", category: "fashion",
    image: "https://cdn.on-running.com/images/products/cloudmonster-2/3me10102196-hero_2.jpg?w=800",
    images: [], featured: false,
    description: "On Cloudmonster 2 Helion Super Foam ปริมาณมากขึ้น, CloudTec Phase รุ่นใหม่, Speedboard คาร์บอน, เหมาะทั้ง Daily และ Race",
    tags: ["on", "cloudmonster", "running", "shoes", "fashion"],
    searchKeyword: "On Cloudmonster 2",
    prices: [
      { platform: "Shopee", price: 5990, originalPrice: 7490, url: "https://shopee.co.th/search?keyword=On+Cloudmonster+2", inStock: true, shipping: 0, rating: 4.7, reviews: 190 },
      { platform: "Lazada", price: 6290, originalPrice: 7490, url: "https://www.lazada.co.th/catalog/?q=On+Cloudmonster+2", inStock: true, shipping: 0, rating: 4.6, reviews: 138 },
    ],
  },

  {
    name: "ASICS Gel-Kayano 31",
    nameTh: "อาซิคส์ เจล-คายาโน่ 31",
    brand: "ASICS", category: "fashion",
    image: "https://images.asics.com/is/image/asics/1011B714_001_SR_RT_GLB?wid=800&hei=800",
    images: [], featured: false,
    description: "ASICS Gel-Kayano 31 4D Guidance System, PureGEL หน้า+หลัง, FF BLAST+ Eco Foam ลด CO2, วิ่งยาวรองรับ Overpronation ได้ดี",
    tags: ["asics", "gelkayano", "running", "shoes", "fashion"],
    searchKeyword: "ASICS Gel-Kayano 31",
    prices: [
      { platform: "Shopee", price: 4990, originalPrice: 6490, url: "https://shopee.co.th/search?keyword=ASICS+Gel-Kayano+31", inStock: true, shipping: 0, rating: 4.7, reviews: 250 },
      { platform: "Lazada", price: 5190, originalPrice: 6490, url: "https://www.lazada.co.th/catalog/?q=ASICS+Gel-Kayano+31", inStock: true, shipping: 0, rating: 4.6, reviews: 182 },
    ],
  },

  {
    name: "Salomon XT-6",
    nameTh: "ซาโลมอน XT-6",
    brand: "Salomon", category: "fashion",
    image: "https://image.salomon.com/on/demandware.static/-/Sites/default/dw3b2ef42f/images/hi-res/L47295000_1.png",
    images: [], featured: false,
    description: "Salomon XT-6 รองเท้า Trail Running สายสตรีท, Contagrip Outsole ยึดเกาะทุกพื้นผิว, ดีไซน์ Chunky Futuristic เป็น Streetwear",
    tags: ["salomon", "xt6", "trail", "shoes", "streetwear", "fashion"],
    searchKeyword: "Salomon XT-6",
    prices: [
      { platform: "Shopee", price: 4990, originalPrice: 6490, url: "https://shopee.co.th/search?keyword=Salomon+XT-6", inStock: true, shipping: 0, rating: 4.7, reviews: 380 },
      { platform: "Lazada", price: 5190, originalPrice: 6490, url: "https://www.lazada.co.th/catalog/?q=Salomon+XT-6", inStock: true, shipping: 0, rating: 4.6, reviews: 265 },
    ],
  },

  {
    name: "Converse Chuck Taylor All Star Classic Hi",
    nameTh: "คอนเวิร์ส ชัค เทย์เลอร์ ออล สตาร์ คลาสสิค",
    brand: "Converse", category: "fashion",
    image: "https://www.converse.com/dw/image/v2/BCZC_PRD/on/demandware.static/-/Sites-cnv-master-catalog/default/dw4b5a9d06/images/a_107/M9160_A_107X1.jpg?sw=800",
    images: [], featured: false,
    description: "Converse Chuck Taylor All Star Hi รองเท้าผ้าใบทรง High-Top Classic ไม่มีวันล้าสมัย วัสดุผ้าใบ Iconic Star Patch ที่ข้อเท้า",
    tags: ["converse", "chucktaylor", "sneaker", "classic", "fashion"],
    searchKeyword: "Converse Chuck Taylor All Star",
    prices: [
      { platform: "Shopee", price: 1490, originalPrice: 1890, url: "https://shopee.co.th/search?keyword=Converse+Chuck+Taylor+All+Star", inStock: true, shipping: 0, rating: 4.6, reviews: 2150 },
      { platform: "Lazada", price: 1590, originalPrice: 1890, url: "https://www.lazada.co.th/catalog/?q=Converse+Chuck+Taylor+All+Star", inStock: true, shipping: 0, rating: 4.5, reviews: 1680 },
    ],
  },

  {
    name: "Vans Old Skool Classic",
    nameTh: "แวนส์ โอลด์ สคูล คลาสสิค",
    brand: "Vans", category: "fashion",
    image: "https://images.vans.com/is/image/VansEU/VN000D3HY28-HERO?wid=800&hei=800",
    images: [], featured: false,
    description: "Vans Old Skool รองเท้าสเก็ตบอร์ดดิ้ง Iconic Sidestripe ปี 1977, วัสดุผ้าใบ+หนัง Duracap Rubber, พื้น Waffle Outsole",
    tags: ["vans", "oldskool", "sneaker", "classic", "skate", "fashion"],
    searchKeyword: "Vans Old Skool",
    prices: [
      { platform: "Shopee", price: 1690, originalPrice: 2190, url: "https://shopee.co.th/search?keyword=Vans+Old+Skool", inStock: true, shipping: 0, rating: 4.6, reviews: 1850 },
      { platform: "Lazada", price: 1790, originalPrice: 2190, url: "https://www.lazada.co.th/catalog/?q=Vans+Old+Skool", inStock: true, shipping: 0, rating: 4.5, reviews: 1390 },
    ],
  },

  {
    name: "Jordan 1 Retro High OG",
    nameTh: "จอร์แดน 1 เรโทร ไฮ OG",
    brand: "Jordan", category: "fashion",
    image: "https://static.nike.com/a/images/t_PDP_1728_v1/f_auto,q_auto:eco,u_126ab356-44d8-4a80-b4a3-a02256a4e72e/prod/55881602-63be-4843-96a4-7e6c8bff90bc/jordan-1-retro-high-og-shoes-S1JZtl.png",
    images: [], featured: false,
    description: "Air Jordan 1 Retro High OG หนัง Full Grain Leather, ลิ้นรองเท้า Wings Logo, Tumbled Leather, Nike Air Cushioning, งาน OG Colorway",
    tags: ["jordan", "aj1", "sneaker", "basketball", "retro", "fashion", "nike"],
    searchKeyword: "Jordan 1 Retro High OG",
    prices: [
      { platform: "Shopee", price: 4990, originalPrice: 6490, url: "https://shopee.co.th/search?keyword=Jordan+1+Retro+High+OG", inStock: true, shipping: 40, rating: 4.8, reviews: 1250 },
      { platform: "Lazada", price: 5190, originalPrice: 6490, url: "https://www.lazada.co.th/catalog/?q=Jordan+1+Retro+High+OG", inStock: true, shipping: 0,  rating: 4.7, reviews: 890  },
      { platform: "Nike.com", price: 6490, originalPrice: 6490, url: "https://www.nike.com/th/w/air-jordan-1-shoes-1ry4zvznik1", inStock: true, shipping: 0, rating: 4.9, reviews: 3200 },
    ],
  },
];

// ── Calculate minPrice / maxPrice ────────────────────────────────────────────
const toInsert = newProducts.map(p => ({
  ...p,
  minPrice: Math.min(...p.prices.map(pr => pr.price)),
  maxPrice: Math.max(...p.prices.map(pr => pr.price)),
}));

await Product.insertMany(toInsert);
console.log(`\n✅ เพิ่มสินค้าใหม่ ${toInsert.length} รายการเรียบร้อยแล้ว!\n`);

// Summary
const count = await Product.countDocuments();
console.log(`📦 สินค้าทั้งหมดในระบบ: ${count} รายการ\n`);

const cats = await Product.aggregate([
  { $group: { _id: "$category", count: { $sum: 1 } } },
  { $sort: { _id: 1 } }
]);
console.log("📊 จำนวนต่อประเภท:");
cats.forEach(c => console.log(`  ${c._id.padEnd(12)} : ${c.count} รายการ`));

await mongoose.disconnect();
console.log("\n✅ Done!");
