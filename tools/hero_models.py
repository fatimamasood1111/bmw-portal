"""Search Wikimedia Commons by premium model name for wide, high-res, free-licence car photos. Writes 500px previews to tools/hero_prev/ and tools/hero_models.json."""
import json, os, re, sys, time, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
import commons_search as cs

sys.stdout.reconfigure(encoding="utf-8")
MODELS = ["Porsche 911 992", "Porsche 911 GT3", "Porsche Taycan", "Porsche Panamera", "Lamborghini Huracán", "Lamborghini Aventador", "Lamborghini Urus", "Ferrari 488", "Ferrari F8 Tributo", "Ferrari Roma",
          "Ferrari 812", "McLaren 720S", "McLaren 570S", "Aston Martin Vantage", "Aston Martin DB11", "Bentley Continental GT", "Bentley Bentayga", "Rolls-Royce Ghost", "Rolls-Royce Cullinan", "Rolls-Royce Phantom",
          "Mercedes-AMG GT", "Mercedes-Benz S-Class", "Mercedes-Maybach", "Mercedes-AMG G 63", "BMW M4", "BMW M8", "BMW 7 Series", "BMW i8", "Audi R8", "Audi RS7", "Audi e-tron GT", "Maserati MC20", "Jaguar F-Type",
          "Lexus LC 500", "Range Rover Autobiography", "Tesla Model S Plaid", "Lucid Air", "Bugatti Chiron", "Pagani Huayra", "Koenigsegg"]
BAD = re.compile(r"interior|engine|wheel|badge|logo|detail|dashboard|cockpit|seat|taxi|police|rally|racing|race |crash|museum|exhibition|expo |parking|diagram|drawing|model car|toy|\.svg|\.png|\.tif|rear|back view|rear view|tail", re.I)
PERSON = r"woman|man |girl|boy|person|people|couple|bride|driver|selfie|portrait|team|crew|staff"

def search(q):
    d = cs.get({"action": "query", "generator": "search", "gsrsearch": f"{q} filetype:bitmap", "gsrnamespace": 6, "gsrlimit": 40, "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata", "iiurlwidth": 500})
    out = []
    for p in d.get("query", {}).get("pages", []):
        ii = (p.get("imageinfo") or [{}])[0]; md = ii.get("extmetadata", {})
        lic = cs.strip(md.get("LicenseShortName", {}).get("value", "")); w, h = ii.get("width", 0), ii.get("height", 0)
        if ii.get("mime") != "image/jpeg" or not cs.OK_LICENCE.match(lic) or BAD.search(p["title"]) or re.search(PERSON, p["title"], re.I) or w < 4200 or not (1.4 <= w / max(h, 1) <= 2.3): continue
        out.append({"q": q, "title": p["title"][5:], "thumb": ii.get("thumburl"), "page": ii.get("descriptionurl"), "w": w, "h": h, "licence": lic, "licence_url": cs.strip(md.get("LicenseUrl", {}).get("value", "")),
                    "artist": cs.strip(md.get("Artist", {}).get("value", "")) or "Unknown", "files": p["title"]})
    return sorted(out, key=lambda c: -c["w"])[:2]

pool = {}
for q in MODELS:
    try:
        for c in search(q): pool.setdefault(c["title"], c)
    except Exception as e:
        print("failed", q, e)
    time.sleep(0.4)
items = list(pool.values())
print(len(items), "candidates")
os.makedirs("tools/hero_prev", exist_ok=True)
for i, c in enumerate(items, 1):
    c["n"] = i
    try: open(f"tools/hero_prev/{i:02d}.jpg", "wb").write(urllib.request.urlopen(urllib.request.Request(c["thumb"], headers={"User-Agent": cs.UA}), timeout=60).read())
    except Exception as e: print("preview failed", i, e)
    time.sleep(0.2)
json.dump(items, open("tools/hero_models.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
for c in items: print(c["n"], "|", c["title"][:60], "|", c["artist"][:24], "|", c["w"], "x", c["h"])
