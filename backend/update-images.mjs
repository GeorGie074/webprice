/**
 * update-images.mjs — อัพเดทรูปภาพสินค้าทั้ง 60 รายการด้วย URL ที่เสถียร
 * Usage: node update-images.mjs
 */
import mongoose from "mongoose";
const MONGO_URI = "mongodb://localhost:27017/webprice";
await mongoose.connect(MONGO_URI);
console.log("✅ MongoDB connected");

const productSchema = new mongoose.Schema({
  name: String, nameTh: String, brand: String, category: String,
  image: String, images: [String],
}, { strict: false, timestamps: true });

const Product = mongoose.models.Product || mongoose.model("Product", productSchema);

// ─────────────────────────────────────────────────────────────────────────────
// ตาราง URL รูปภาพ ← ใช้ Official CDN / Manufacturer press images
// ─────────────────────────────────────────────────────────────────────────────
const imageMap = [

  // ══════════════ SMARTPHONE ══════════════
  {
    search: "ไอโฟน 17",
    image: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-7inch-naturaltitanium?wid=800&hei=800&fmt=jpeg",
  },
  {
    search: "ไอโฟน 16 โปร แมกซ์",
    image: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-9inch-desertitanium?wid=800&hei=800&fmt=jpeg",
  },
  {
    search: "เอส26",
    image: "https://images.samsung.com/th/smartphones/galaxy-s25/images/galaxy-s25-highlights-kv.jpg",
  },
  {
    search: "เอส25 อัลตร้า",
    image: "https://images.samsung.com/th/smartphones/galaxy-s25-ultra/images/galaxy-s25-ultra-highlight-kv.jpg",
  },
  {
    search: "ออปโป้ ไฟน์ด เอ็กซ์8",
    image: "https://image.oppo.com/content/dam/oppo/product-asset-library/find/find-x8-pro/v1/assets/pc-spec.png",
  },
  {
    search: "เสี่ยวหมี่ 15 โปร",
    image: "https://i01.appmifile.com/webfile/globalimg/products/m/xiaomi-15-pro/pc/kv.png",
  },
  {
    search: "วิโว่ เอ็กซ์200 โปร",
    image: "https://www.vivo.com/content/dam/vivo/global/product/phones/x200-pro/kv-phone.png",
  },
  {
    search: "กูเกิล พิกเซล 9",
    image: "https://lh3.googleusercontent.com/nu-W6TVPYEkzSH37C2tAInbBNWZp0kgbdOdWRqrpVJvUhFNjPPVUFGU4g6CQ8ZWAFoMt7uFR=rw-w1000",
  },
  {
    search: "วันพลัส 13",
    image: "https://oasis.opstatics.com/content/dam/oasis/page/2024/global/oneplus-13/memory/arctic-dawn/mobile-kv.png",
  },
  {
    search: "เรียลมี จีที 7",
    image: "https://image.realme.com/content/dam/document/product/c73/c73-kv.png",
  },

  // ══════════════ LAPTOP ══════════════
  {
    search: "แมคบุ๊ค โปร M4",
    image: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/mbp14-m4pro-spaceb-select-202411?wid=800&hei=800&fmt=jpeg",
  },
  {
    search: "แมคบุ๊ค แอร์ M5",
    image: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/mba13-m3-midnight-select-202402?wid=800&hei=800&fmt=jpeg",
  },
  {
    search: "เดลล์ XPS 15",
    image: "https://i.dell.com/is/image/DellContent/content/dam/ss2/product-images/dell-client-products/notebooks/xps-notebooks/xps-15-9530/pdp/laptop-xps-15-9530-t-black-gallery-4.psd?fmt=png-alpha&pscan=auto&scl=1&hei=402&wid=402&qlt=100,1&resMode=sharp2&size=402,402&chrss=full",
  },
  {
    search: "ThinkPad X1 Carbon",
    image: "https://p3-ofp.static.pub/fes/cms/2025/02/24/d9hn6lnhfvfavywmijb05s5lp76hxo571703.png",
  },
  {
    search: "เอชพี สเปกเตอร์ x360",
    image: "https://ssl-product-images.www8-hp.com/digmedialib/prodimg/knowledgebase/c08494456.png",
  },
  {
    search: "เอซุส เซนบุ๊ค 14 OLED",
    image: "https://dlcdnwebimgs.asus.com/gain/b8b50b08-8a70-4b9b-9f5c-d3cf9cccfdfa/w800/fwebp",
  },
  {
    search: "เอ็มเอสไอ เพรสทีจ",
    image: "https://storage-asset.msi.com/global/picture/image/feature/nb/Prestige16-AI-Evo-B1M/kv-prestige.png",
  },
  {
    search: "เอเซอร์ สวิฟต์",
    image: "https://static.acer.com/up/Resource/Acer/Laptops/Swift_14_AI/Images/20240115/Swift_14_AI_SF14-71T_Primary-image-001.png",
  },
  {
    search: "ซัมซุง กาแล็กซี่ บุ๊ค5",
    image: "https://images.samsung.com/th/computers/galaxy-book/galaxy-book5-pro-360/images/galaxy-book5-pro-360-highlights-kv.jpg",
  },
  {
    search: "ASUS ROG Zephyrus",
    image: "https://dlcdnwebimgs.asus.com/gain/94b7f5c7-9e4a-45b2-aa11-4d2c6b8d6e24/w800/fwebp",
  },

  // ══════════════ TABLET ══════════════
  {
    search: "ไอแพด โปร M4 13",
    image: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/ipad-pro-model-unselect-gallery-2-202405?wid=800&hei=800&fmt=jpeg",
  },
  {
    search: "ไอแพด มินิ 7",
    image: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/ipad-mini-finish-unselect-gallery-1-202410?wid=800&hei=800&fmt=jpeg",
  },
  {
    search: "ไอแพด แอร์ M3",
    image: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/ipad-air-model-unselect-gallery-1-202405?wid=800&hei=800&fmt=jpeg",
  },
  {
    search: "กาแล็กซี่ แท็บ เอส10 อัลตร้า",
    image: "https://images.samsung.com/th/tablets/galaxy-tab-s10-ultra/images/galaxy-tab-s10-ultra-highlights-kv-m.jpg",
  },
  {
    search: "กาแล็กซี่ แท็บ เอส10+",
    image: "https://images.samsung.com/th/tablets/galaxy-tab-s10-plus/images/galaxy-tab-s10-plus-highlights-kv-m.jpg",
  },
  {
    search: "เสี่ยวหมี่ แพด 7 โปร",
    image: "https://i01.appmifile.com/webfile/globalimg/products/m/xiaomi-pad-7-pro/kv.png",
  },
  {
    search: "เซอร์เฟส โปร 11",
    image: "https://img-prod-cms-rt-microsoft-com.akamaized.net/cms/api/am/imageFileData/RE4OXhB?ver=1",
  },
  {
    search: "เลอโนโว่ แท็บ P12",
    image: "https://p4-ofp.static.pub/ShareResource/na/products/tablets/tab-p12/lenovo-tab-p12-overview-hero.png",
  },
  {
    search: "ออปโป้ แพด 3 โปร",
    image: "https://image.oppo.com/content/dam/oppo/product-asset-library/pad/pad3-pro/v1/assets/pc-kv.png",
  },
  {
    search: "เรียลมี แพด X2",
    image: "https://image.realme.com/content/dam/document/product/realme-pad-x2/kv.png",
  },

  // ══════════════ AUDIO ══════════════
  {
    search: "แอร์พอดส์ โปร",
    image: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/MQD83?wid=800&hei=800&fmt=jpeg",
  },
  {
    search: "กาแล็กซี่ บัดส์ 3 โปร",
    image: "https://images.samsung.com/th/galaxy-buds/galaxy-buds3-pro/images/galaxy-buds3-pro-highlights-kv.jpg",
  },
  {
    search: "โบส ควอยเอท",
    image: "https://assets.bose.com/content/dam/Bose_DAM/Web/consumer_electronics/global/products/headphones/qc_ultra_headphones/product_silo_images/QCU_HP_BLK_EC_001_r1_v5.png/jcr:content/renditions/cq5dam.web.1280.1280.png",
  },
  {
    search: "WF-1000XM5",
    image: "https://www.sony.com/en/img/products/wf-1000xm5/img01-wf-1000xm5.jpg",
  },
  {
    search: "WH-1000XM6",
    image: "https://www.sony.com/en/img/products/wh-1000xm5/wh-1000xm5_bcuc.jpg",
  },
  {
    search: "เจบีแอล ทัวร์ โปร 3",
    image: "https://uk.jbl.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-master-catalog-jbl/default/dw3dfe6e0d/JBL_TOUR_PRO3_Product%20Image_Hero_Black.png?sw=537&sfrm=png",
  },
  {
    search: "โมเมนตัม 4",
    image: "https://assets.sennheiser.com/img/19952/x1_desktop_Sennheiser_Momentum_4_Wireless_Product-shots_02.jpg",
  },
  {
    search: "บีตส์ สตูดิโอ โปร",
    image: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/MQTP3?wid=800&hei=800&fmt=jpeg",
  },
  {
    search: "นัทธิ่ง อีร์ 3",
    image: "https://cdn.shopify.com/s/files/1/0677/3671/8430/products/ear3-pdp-hero.png?v=1700000000&width=800",
  },
  {
    search: "จาบร้า อีโวลฟ์",
    image: "https://www.jabra.com/~/media/Images/Product%20Pages/Evolve2%2075/Jabra-Evolve2-75-cover-image.png",
  },

  // ══════════════ HOME ══════════════
  {
    search: "โรโบร็อค เอส8 แม็กซ์วี",
    image: "https://home.roborock.com/cdn/shop/files/s8-maxv-ultra-0.png?v=1700000000&width=800",
  },
  {
    search: "เสี่ยวหมี่ โรบอท แวคคั่ม X20",
    image: "https://i01.appmifile.com/webfile/globalimg/products/m/robot-vacuum-x20-pro/overview/pc-kv.png",
  },
  {
    search: "ไดสัน เพียวริไฟเออร์ ฮ็อต",
    image: "https://dyson-h.assetsadobe2.com/is/image/content/dam/dyson/images/products/primary/368676-01.png?$responsive$&cropPathE=desktop&fit=stretch,1&wid=800",
  },
  {
    search: "ไดสัน วี16",
    image: "https://dyson-h.assetsadobe2.com/is/image/content/dam/dyson/images/products/primary/440325-01.png?$responsive$&cropPathE=desktop&fit=stretch,1&wid=800",
  },
  {
    search: "ฟิลิปส์ เครื่องฟอกอากาศ ซีรีส์",
    image: "https://images.philips.com/is/image/PhilipsConsumer/AC3858_10-IMS-en_US?wid=800&hei=800&$jpglarge$",
  },
  {
    search: "ไอโรบอท รูมบ้า",
    image: "https://www.irobot.com/content/dam/irobot/images/products/roomba/j-series/roomba-combo-j9-plus/roomba-combo-j9-plus-hero-image.png",
  },
  {
    search: "เสี่ยวหมี่ สมาร์ท เครื่องฟอกอากาศ",
    image: "https://i01.appmifile.com/webfile/globalimg/products/m/air-purifier-4-pro/pc/kv.png",
  },
  {
    search: "เนสเพรสโซ่",
    image: "https://www.nespresso.com/shared_res/agility/n-components/pdp/sku-main-hero/vertuo/sku-main-hero_vertuo-next_chrome_2.png",
  },
  {
    search: "เบรวิลล์ บาริสต้า",
    image: "https://www.breville.com/content/dam/breville/us/assets/espresso/display-pages/bes878/bes878bss-barista-express-impress-image-3.jpg",
  },
  {
    search: "แอลจี คอร์ดซีโร่",
    image: "https://gscs-b2c.lge.com/downloadFile?fileId=kN5Fk1KqXlgn0Hjjk5pMxQ",
  },

  // ══════════════ FASHION ══════════════
  {
    search: "แอปเปิ้ลวอร์ช",
    image: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/apple-watch-s10-hero-select-202409?wid=800&hei=800&fmt=jpeg",
  },
  {
    search: "อาดิดาส อัลตร้าบูสต์ 25",
    image: "https://assets.adidas.com/images/h_840,f_auto,q_auto,fl_lossy,c_fill,g_auto/ultraboost-25-shoes.jpg",
  },
  {
    search: "นิวแบลนซ์ เฟรชโฟม X 1080v14",
    image: "https://nb.scene7.com/is/image/NB/m1080b14_nb_02_i?$pdpflexf2$&qlt=70&fmt=webp&wid=880&hei=880",
  },
  {
    search: "โฮก้า บอนได 9",
    image: "https://www.hoka.com/on/demandware.static/-/Sites-master-catalog-na-hoka/default/bondi-9-hero.jpg",
  },
  {
    search: "ออน คลาวด์มอนสเตอร์ 2",
    image: "https://www.on-running.com/en-us/content/cloudmonster2-hero.jpg",
  },
  {
    search: "อาซิคส์ เจล-คายาโน่",
    image: "https://images.asics.com/is/image/asics/1011B548_001_SR_RT_GLB?$zoom$",
  },
  {
    search: "ซาโลมอน XT-6",
    image: "https://product.hstatic.net/200000278317/product/salomon-xt-6-kv.jpg",
  },
  {
    search: "คอนเวิร์ส",
    image: "https://www.converse.com/dw/image/v2/BCZC_PRD/on/demandware.static/-/Sites-cnv-master-catalog/default/chuck-taylor-all-star-classic.png?sw=800&sh=800",
  },
  {
    search: "แวนส์ โอลด์ สคูล",
    image: "https://images.vans.com/is/image/VansUS/VN000D3HY28-HERO?wid=800&hei=800",
  },
  {
    search: "จอร์แดน 1 เรโทร",
    image: "https://static.nike.com/a/images/c_limit,w_592,f_auto/t_product_v1/dece9e08-2c5f-4568-91ca-05e3fc1d4bca/air-jordan-1-retro-high-og-shoes.png",
  },
  {
    search: "ไนกี้ แอร์ แมกซ์ DN8",
    image: "https://static.nike.com/a/images/c_limit,w_592,f_auto/t_product_v1/air-max-dn8.png",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// อัพเดทรูปทุกตัว
// ─────────────────────────────────────────────────────────────────────────────
let updated = 0;
let notFound = 0;

for (const item of imageMap) {
  const result = await Product.updateOne(
    { nameTh: { $regex: item.search, $options: "i" } },
    { $set: { image: item.image } }
  );
  if (result.matchedCount > 0) {
    console.log(`✅ ${item.search} → updated`);
    updated++;
  } else {
    console.log(`❌ NOT FOUND: ${item.search}`);
    notFound++;
  }
}

console.log(`\n📊 อัพเดทแล้ว: ${updated} | ไม่พบ: ${notFound}`);

await mongoose.disconnect();
console.log("✅ Done!");
