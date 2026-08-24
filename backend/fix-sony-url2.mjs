import mongoose from "mongoose";
await mongoose.connect("mongodb://localhost:27017/webprice");
const db = mongoose.connection.db;
const result = await db.collection("products").updateOne(
  { "prices.platform": "Sony Store", name: /WH-1000XM6/ },
  { $set: { "prices.$.url": "https://www.sony.co.th/th/headphones/products/wh-1000xm6" } }
);
console.log(`✅ matched=${result.matchedCount} modified=${result.modifiedCount}`);
console.log("   Sony Store URL → https://www.sony.co.th/th/headphones/products/wh-1000xm6");

// Verify
const product = await db.collection("products").findOne({ name: /WH-1000XM6/ });
const sony = product.prices.find(p => p.platform === "Sony Store");
console.log("   Current entry:", JSON.stringify({ url: sony.url, price: sony.price, originalPrice: sony.originalPrice }));
await mongoose.disconnect();
