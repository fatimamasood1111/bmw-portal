"""Find cinematic wide car photos on Wikimedia Commons for the hero and build a contact sheet at site/_hero_candidates/index.html
(temporary: delete the folder once a hero is chosen)."""
import html, json, os, re, sys, time, urllib.parse, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
import commons_search as cs

sys.stdout.reconfigure(encoding="utf-8")
MAKES = r"porsche|ferrari|lamborghini|bmw|mercedes|audi|mclaren|bentley|aston martin|rolls|maserati|jaguar|lotus|bugatti|koenigsegg|pagani|tesla|range rover|land rover|mustang|corvette|gt-r|lexus|supra|dodge|chevrolet|nissan|toyota|ford|honda|alfa romeo|lucid|rivian|polestar|genesis|cadillac|maybach|g-class|g 63|huracan|huracán|aventador|urus|911|taycan|cayenne"
PERSON = r"woman|man |girl|boy|person|people|model |couple|bride|driver|selfie|portrait|silhouette of a"
QUERIES = ["Porsche 911 sunset", "Porsche 911 night", "Porsche Taycan night", "Lamborghini Huracán night", "Lamborghini Aventador sunset", "Lamborghini Urus dusk", "Ferrari 488 night", "Ferrari sunset",
           "McLaren 720S sunset", "McLaren night", "Aston Martin Vantage night", "Aston Martin DB11 sunset", "Bentley Continental GT sunset", "Bentley night", "Mercedes-AMG GT night", "Mercedes-Benz G-Class sunset",
           "BMW M4 sunset", "BMW M5 night", "Audi R8 night", "Audi RS sunset", "Rolls-Royce night", "Rolls-Royce Cullinan sunset", "Nissan GT-R night", "Tesla Model S night", "Range Rover sunset", "Jaguar F-Type dusk", "Lexus LC night", "Corvette sunset", "Ford Mustang sunset", "Maserati sunset", "Bugatti night", "Lotus night"]
GOOD = re.compile(r"sunset|sunrise|dusk|dawn|night|twilight|golden|blue hour|evening|dark|moody|silhouette", re.I)
BAD = re.compile(r"interior|engine|wheel|badge|logo|detail|dashboard|cockpit|seat|taxi|police|rally|race|racing|crash|accident|wreck|show floor|expo|exhibition|museum|parking|junkyard|scrap|diagram|map|drawing|model car|toy|truck|bus|tractor|motorcycle|bike|train|aircraft|plane", re.I)

def search(q):
    data = cs.get({"action": "query", "generator": "search", "gsrsearch": f"{q} filetype:bitmap", "gsrnamespace": 6, "gsrlimit": 30,
                   "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata", "iiurlwidth": 960})
    out = []
    for p in data.get("query", {}).get("pages", []):
        ii = (p.get("imageinfo") or [{}])[0]; md = ii.get("extmetadata", {})
        lic = cs.strip(md.get("LicenseShortName", {}).get("value", ""))
        w, h = ii.get("width", 0), ii.get("height", 0)
        if ii.get("mime") != "image/jpeg" or not cs.OK_LICENCE.match(lic) or BAD.search(p["title"]) or re.search(PERSON, p["title"], re.I) or not re.search(MAKES, p["title"], re.I) or w < 4000 or not (1.45 <= w / max(h, 1) <= 2.4):
            continue
        desc = cs.strip(md.get("ImageDescription", {}).get("value", ""))
        out.append({"title": p["title"][5:], "thumb": ii.get("thumburl"), "page": ii.get("descriptionurl"), "w": w, "h": h, "licence": lic,
                    "licence_url": cs.strip(md.get("LicenseUrl", {}).get("value", "")), "artist": cs.strip(md.get("Artist", {}).get("value", "")) or "Unknown",
                    "desc": desc[:120], "score": (3 if GOOD.search(p["title"]) else 0) + (2 if GOOD.search(desc) else 0) + min(w, 8000) / 4000})
    return out

pool = {}
for q in QUERIES:
    try:
        for c in search(q): pool.setdefault(c["title"], c)
    except Exception as e:
        print("query failed", q, e)
    time.sleep(0.5)
top = sorted(pool.values(), key=lambda c: -c["score"])[:18]
print(len(pool), "candidates;", len(top), "shortlisted")
os.makedirs("site/_hero_candidates", exist_ok=True)
tiles = []
for i, c in enumerate(top, 1):
    try:
        data = urllib.request.urlopen(urllib.request.Request(c["thumb"], headers={"User-Agent": cs.UA}), timeout=60).read()
        open(f"site/_hero_candidates/{i:02d}.jpg", "wb").write(data)
    except Exception as e:
        print("download failed", i, e); continue
    c["n"] = i
    tiles.append(f'<figure><div class="n">{i}</div><img src="{i:02d}.jpg"><figcaption><b>{html.escape(c["title"][:70])}</b><br>{html.escape(c["artist"][:40])} · {html.escape(c["licence"])} · {c["w"]}×{c["h"]}</figcaption></figure>')
    time.sleep(0.3)
open("site/_hero_candidates/index.html", "w", encoding="utf-8").write(
    "<!doctype html><meta charset=utf-8><title>Hero candidates</title><style>body{margin:0;background:#111;color:#eee;font:13px system-ui;padding:20px}h1{font-size:18px}.g{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}"
    "figure{margin:0;position:relative;background:#1b1b1b;border-radius:12px;overflow:hidden}img{width:100%;display:block;aspect-ratio:16/9;object-fit:cover}figcaption{padding:10px 12px;color:#aaa;line-height:1.4}"
    ".n{position:absolute;top:10px;left:10px;background:#fff;color:#000;font-weight:800;border-radius:99px;width:34px;height:34px;display:grid;place-items:center;font-size:16px}</style>"
    f"<h1>Hero candidates — tell me the number you like</h1><div class=g>{''.join(tiles)}</div>")
json.dump(top, open("tools/hero_candidates.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
