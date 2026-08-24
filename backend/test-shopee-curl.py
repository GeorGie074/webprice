"""
Shopee search via curl_cffi — impersonates Chrome TLS fingerprint
Run: python test-shopee-curl.py [keyword]
"""
import sys, json, os
from pathlib import Path

try:
    from curl_cffi import requests as curl_req
except ImportError:
    print("❌  pip install curl_cffi  แล้วลองใหม่")
    sys.exit(1)

SESSION_FILE = Path(__file__).parent / "shopee-session.json"
KEYWORD = " ".join(sys.argv[1:]) or "iphone 15 pro max"

if not SESSION_FILE.exists():
    print("❌  shopee-session.json not found — run: node setup-shopee-session.mjs")
    sys.exit(1)

session_data = json.loads(SESSION_FILE.read_text(encoding="utf-8"))
cookies = {
    c["name"]: c["value"]
    for c in session_data.get("cookies", [])
    if "shopee" in c.get("domain", "")
}
print(f"Session: {len(cookies)} cookies | SPC_EC: {'✅' if 'SPC_EC' in cookies else '❌'}")

url = (
    "https://shopee.co.th/api/v4/search/search_items/"
    f"?by=relevancy&keyword={KEYWORD.replace(' ', '+')}"
    "&limit=20&newest=0&order=desc"
    "&page_type=search&scenario=PAGE_GLOBAL_SEARCH&version=2"
)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "th-TH,th;q=0.9,en-US;q=0.8",
    "sec-ch-ua": '"Chromium";v="124","Google Chrome";v="124","Not-A.Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "none",
}

# Use a session so cookies persist across requests
s = curl_req.Session(impersonate="chrome124")

# Seed with saved cookies (auth)
for name, value in cookies.items():
    s.cookies.set(name, value, domain=".shopee.co.th")

# Step 1: visit homepage to refresh SPC_F with new fingerprint
print("\nStep 1: Visiting homepage to refresh SPC_F…")
home = s.get("https://shopee.co.th/", headers=HEADERS, timeout=15)
print(f"  status: {home.status_code} | cookies now: {len(s.cookies)}")
spc_f = s.cookies.get("SPC_F")
print(f"  SPC_F: {str(spc_f)[:30] if spc_f else 'missing'}...")

# Step 2: search API with fresh cookies
print(f"\nStep 2: Searching \"{KEYWORD}\"…")
API_HEADERS = {
    "User-Agent": HEADERS["User-Agent"],
    "x-api-source": "pc",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "th-TH,th;q=0.9,en-US;q=0.8",
    "Referer": f"https://shopee.co.th/search?keyword={KEYWORD.replace(' ', '+')}",
    "Origin": "https://shopee.co.th",
    "sec-ch-ua": HEADERS["sec-ch-ua"],
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
}

resp = s.get(
    url,
    headers=API_HEADERS,
        timeout=20,
)

print(f"HTTP status : {resp.status_code}")

try:
    data = resp.json()
except Exception as e:
    print(f"❌  JSON parse error: {e}")
    print("Body:", resp.text[:300])
    sys.exit(1)

err = data.get("error") or data.get("3")
print(f"API error   : {err if err is not None else 'NONE ✅'}")

items = data.get("items") or (data.get("data") or {}).get("items") or []
print(f"Items       : {len(items)}\n")

if items:
    for i, it in enumerate(items[:8]):
        b = it.get("item_basic") or it
        price = round(b.get("price", 0) / 100_000)
        name  = b.get("name", "")[:58]
        star  = b.get("item_rating", {}).get("rating_star", 0)
        print(f"  [{i+1}] ฿{price:>9,}  ⭐{star:.1f}  {name}")
else:
    print("Keys in response:", list(data.keys())[:10])
    print("Body preview    :", resp.text[:300])
