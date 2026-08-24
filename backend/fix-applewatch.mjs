import mongoose from "mongoose";
const MONGO_URI = "mongodb://localhost:27017/webprice";
await mongoose.connect(MONGO_URI);

const Product = mongoose.model("Product", new mongoose.Schema({}, { strict: false }));

const result = await Product.updateOne(
  { _id: new mongoose.Types.ObjectId("6a170bb8af35694550895888") },
  {
    $set: {
      category: "smartphone",
      name: "Apple Watch Series 10 46mm",
      nameTh: "แอปเปิล วอทช์ ซีรีส์ 10 46mm",
      brand: "Apple",
      description: "Apple Watch Series 10 จอ 46mm Super Retina LTPO OLED Always-On, chip S10 SiP, GPS + Cellular, WR50M, ชาร์จเร็วสุด 80% ใน 45 นาที, watchOS 11",
      tags: ["apple", "watch", "smartwatch", "applewatch", "wearable"],
      searchKeyword: "Apple Watch Series 10",
      minPrice: 13900,
      maxPrice: 18900,
      prices: [
        { platform: "Shopee",      price: 13900, originalPrice: 15900, url: "https://shopee.co.th/search?keyword=Apple+Watch+Series+10", inStock: true, shipping: 0, rating: 4.9, reviews: 820 },
        { platform: "Lazada",      price: 13900, originalPrice: 15900, url: "https://www.lazada.co.th/catalog/?q=Apple+Watch+Series+10", inStock: true, shipping: 0, rating: 4.8, reviews: 640 },
        { platform: "Power Buy",   price: 15900, originalPrice: 15900, url: "https://www.powerbuy.co.th/th/search/Apple%20Watch%20Series%2010", inStock: true, shipping: 0, rating: 4.7, reviews: 180 },
        { platform: "Studio 7",    price: 15900, originalPrice: 15900, url: "https://www.studio7thailand.com/collection/apple-watch-series10", inStock: true, shipping: 0, rating: 4.9, reviews: 290 },
        { platform: "Apple Store", price: 15900, originalPrice: 15900, url: "https://www.apple.com/th/shop/buy-watch/apple-watch", inStock: true, shipping: 0, rating: 5.0, reviews: 2100 },
      ],
      image: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/apple-watch-s10-hero-select-202409?wid=800&hei=800&fmt=jpeg",
    }
  }
);

console.log("Updated:", result.modifiedCount, "document(s)");

// Verify counts
const counts = await Product.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
counts.forEach(c => console.log(`  ${c._id.padEnd(12)}: ${c.count}`));

await mongoose.disconnect();
console.log("Done!");
