function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9฀-๿]/g, ' ').split(/\s+/).filter(Boolean);
}
function bestMatch(items, productName, existingPrice) {
  if (!items.length) return null;
  const keywords = normalize(productName);
  const minScore = Math.ceil(keywords.length * 0.4);
  const mustMatch = keywords[0];
  const sane = items.filter(i => i.price > existingPrice * 0.3 && i.price < existingPrice * 2.5);
  const pool = sane.length > 0 ? sane : items;
  const scored = pool.map(i => {
    const words = normalize(i.name);
    const score = keywords.filter(k => words.some(w => w.includes(k) || k.includes(w))).length;
    // mustMatch: result word must CONTAIN keyword (not reverse) — prevents "phone" → "iphone" bug
    const hasMustMatch = words.some(w => w === mustMatch || w.includes(mustMatch));
    return { item: i, score, hasMustMatch };
  })
  .filter(c => c.score >= minScore && c.hasMustMatch)
  .sort((a, b) => b.score - a.score || a.item.price - b.item.price);
  if (!scored.length) return null;
  return { ...scored[0].item, _score: scored[0].score, _minScore: minScore, _total: keywords.length };
}

// Real Lazada results for ไอโฟน 15 โปร แมกซ์
const lazadaIphone = [
  { name: 'iPhone 15', price: 21590, url: 'https://lazada.co.th/products/pdp-1.html' },
  { name: 'Apple iPhone 15 I iStudio by SPVi', price: 23500, url: 'https://lazada.co.th/products/pdp-2.html' },
  { name: 'Xiaomi Redmi 15 8+256Gb', price: 5990, url: '' },
  { name: 'New Oppq Reno15Promax Phone, 7.5Android13, Mobile Phone', price: 899, url: '' },
  { name: 'LEYI 16 ProMax Smartphone 256GB 5G', price: 4009, url: '' },
  { name: 'iPhone 16', price: 24990, url: '' },
  { name: 'iPhone 17e', price: 20990, url: '' },
];

console.log('=== iPhone 15 Pro Max 256GB (MSRP ฿52,900) ===');
const r = bestMatch(lazadaIphone, 'iPhone 15 Pro Max 256GB', 52900);
console.log('Match:', r ? `"${r.name}" ฿${r.price}  score ${r._score}/${r._total} ≥ ${r._minScore}` : 'NONE');

console.log('\n=== Verify Oppo NOT matched (mustMatch "iphone" check) ===');
const oppoOnly = [{ name: 'New Oppq Reno15Promax Phone, 7.5Android13', price: 20999, url: '' }];
const oppoR = bestMatch(oppoOnly, 'iPhone 15 Pro Max 256GB', 52900);
console.log('Oppo result:', oppoR ? `WRONGLY matched "${oppoR.name}" ❌` : 'Correctly blocked ✅');

console.log('\n=== Sony WH-1000XM5 (MSRP ฿13,900) ===');
const lazadaSony = [
  { name: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones', price: 10190, url: 'https://lazada.co.th/products/sony.html' },
  { name: 'JBL Wireless Headphones 1000', price: 2500, url: '' },
];
const sonyR = bestMatch(lazadaSony, 'Sony WH-1000XM5 Wireless Headphones', 13900);
console.log('Match:', sonyR ? `"${sonyR.name}" ฿${sonyR.price}  score ${sonyR._score}/${sonyR._total} ≥ ${sonyR._minScore}` : 'NONE');
