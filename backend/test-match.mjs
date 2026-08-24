// Quick unit test of the name matching logic
function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9฀-๿]/g, ' ').split(/\s+/).filter(Boolean);
}

function bestMatch(items, productName, existingPrice) {
  if (!items.length) return null;
  const keywords = normalize(productName);
  const minScore = Math.ceil(keywords.length * 0.5);
  const mustMatch = keywords[0];
  const sane = items.filter(i => i.price > existingPrice * 0.3 && i.price < existingPrice * 2.5);
  const pool = sane.length > 0 ? sane : items;
  const scored = pool.map(i => {
    const words = normalize(i.name);
    const score = keywords.filter(k => words.some(w => w.includes(k) || k.includes(w))).length;
    const hasMustMatch = words.some(w => w.includes(mustMatch) || mustMatch.includes(w));
    return { item: i, score, hasMustMatch };
  })
  .filter(c => c.score >= minScore && c.hasMustMatch)
  .sort((a, b) => b.score - a.score || a.item.price - b.item.price);

  if (!scored.length) return null;
  return { ...scored[0].item, score: scored[0].score, total: keywords.length };
}

const oppoReno = { name: 'New Oppo Reno 15 Pro Series Reno 15Pro 6.32" 15 Pro Max 6.78"', price: 20480 };
const iphone = { name: 'Apple iPhone 15 Pro Max 256GB Natural Titanium', price: 46900 };
const iphoneCase = { name: 'iPhone 15 Pro Max Case Cover', price: 199 };

console.log('=== iPhone 15 Pro Max 256GB (originalPrice ฿52,900) ===');
const iphoneResult = bestMatch([oppoReno, iphone, iphoneCase], 'iPhone 15 Pro Max 256GB', 52900);
console.log('Best match:', iphoneResult?.name, '฿' + iphoneResult?.price, `(score ${iphoneResult?.score}/${iphoneResult?.total})`);

const sonyXM5 = { name: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones', price: 10190 };
const sonyFake = { name: 'Wireless Headphone 1000 Bass', price: 890 };
console.log('\n=== Sony WH-1000XM5 (originalPrice ฿13,900) ===');
const sonyResult = bestMatch([sonyFake, sonyXM5], 'Sony WH-1000XM5 Wireless Headphones', 13900);
console.log('Best match:', sonyResult?.name, '฿' + sonyResult?.price);
