// Test with actual Lazada search results for "ไอโฟน 15 โปร แมกซ์"
function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9฀-๿]/g, ' ').split(/\s+/).filter(Boolean);
}
function bestMatch(items, productName, existingPrice) {
  if (!items.length) return null;
  const keywords = normalize(productName);
  const minScore = Math.ceil(keywords.length * 0.4); // 40% threshold
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
  return { ...scored[0].item, score: scored[0].score, total: keywords.length, minScore };
}

// Actual results from Lazada for "ไอโฟน 15 โปร แมกซ์"
const lazadaResults = [
  { name: 'iPhone 15', price: 21590 },
  { name: 'iPhone 17', price: 27590 },
  { name: 'Apple iPhone 15 I iStudio by SPVi', price: 23500 },
  { name: 'New Oppq Reno15Promax Phone, 7.5Android13, Mobile Phone, Cheap Mobile', price: 899 },
  { name: 'M-Horse 17 Pro Max 4g (4/64) 12-Month Warranty', price: 2649 },
  { name: 'iPhone 16', price: 24990 },
  { name: 'Redmi Note 15 Pro 5g (12/512Gb)', price: 9999 },
  { name: 'iPhone 17e', price: 20990 },
];

console.log('=== English search: "iPhone 15 Pro Max 256GB" (MSRP ฿52,900) ===');
const r1 = bestMatch(lazadaResults, 'iPhone 15 Pro Max 256GB', 52900);
console.log('Result:', r1 ? `"${r1.name}" ฿${r1.price} (score ${r1.score}/${r1.total} ≥ ${r1.minScore})` : 'NO MATCH ❌');

console.log('\n=== Thai search: "ไอโฟน 15 โปร แมกซ์ 256GB" (MSRP ฿52,900) ===');
const r2 = bestMatch(lazadaResults, 'ไอโฟน 15 โปร แมกซ์ 256GB', 52900);
console.log('Result:', r2 ? `"${r2.name}" ฿${r2.price} (score ${r2.score}/${r2.total} ≥ ${r2.minScore})` : 'NO MATCH ❌');

// Verify Oppo still blocked
console.log('\n=== Verify Oppo blocked with English name ===');
const oppoPool = [{ name: 'New Oppq Reno15Promax Phone, 7.5Android13', price: 899 }];
const r3 = bestMatch(oppoPool, 'iPhone 15 Pro Max 256GB', 52900);
console.log('Oppo match:', r3 ? `"${r3.name}" ฿${r3.price}` : 'Blocked ✅ (mustMatch "iphone" not found in Oppo name)');
