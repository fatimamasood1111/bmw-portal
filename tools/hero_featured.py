"""Mine Wikimedia Commons *featured pictures* of cars for a cinematic wide hero. Writes site/_hero_candidates/index.html (temporary)."""
import html, json, os, re, sys, time, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
import commons_search as cs

sys.stdout.reconfigure(encoding="utf-8")
ROOTS = ["Featured pictures of automobiles", "Featured pictures of sports cars", "Featured pictures of Porsche", "Featured pictures of Ferrari", "Featured pictures of Lamborghini",
         "Featured pictures of BMW", "Featured pictures of Mercedes-Benz", "Featured pictures of Audi", "Featured pictures of Bentley", "Featured pictures of Aston Martin", "Featured pictures of Rolls-Royce",
         "Featured pictures of McLaren", "Featured pictures of Jaguar", "Featured pictures of Tesla", "Featured pictures of supercars"]
MOOD = re.compile(r"sunset|sunrise|dusk|dawn|night|twilight|golden|evening|blue hour|rain|fog|mist|neon|lights", re.I)
BAD = re.compile(r"interior|engine|wheel|badge|logo|detail|dashboard|cockpit|seat|taxi|police|rally|racing|race |crash|museum|exhibition|show|expo|parking|truck|bus|motorcycle|bike|locomotive|train|aircraft|plane|boat|ship|diagram|drawing|cutaway|\.svg|\.png|\.tif", re.I)

def members(cat, kind):
    out, cont = [], {}
    while True:
        d = cs.get({"action": "query", "list": "categorymembers", "cmtitle": f"Category:{cat}", "cmtype": kind, "cmlimit": 500, **cont})
        out += [m["title"] for m in d.get("query", {}).get("categorymembers", [])]
        if "continue" not in d: return out
        cont = d["continue"]

files = {}
for root in ROOTS:
    try:
        for t in members(root, "file"): files[t] = 1
        for sub in members(root, "subcat")[:12]:
            for t in members(sub[9:], "file")[:150]: files[t] = 1
    except Exception as e:
        print("category failed", root, e)
    time.sleep(0.3)
print(len(files), "featured files found")

info = []
titles = list(files)
for i in range(0, len(titles), 40):
    try:
        d = cs.get({"action": "query", "titles": "|".join(titles[i:i + 40]), "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata", "iiurlwidth": 960})
    except Exception as e:
        print("batch failed", e); continue
    for p in d.get("query", {}).get("pages", []):
        ii = (p.get("imageinfo") or [{}])[0]; md = ii.get("extmetadata", {})
        lic = cs.strip(md.get("LicenseShortName", {}).get("value", "")); w, h = ii.get("width", 0), ii.get("height", 0)
        if ii.get("mime") != "image/jpeg" or not cs.OK_LICENCE.match(lic) or BAD.search(p["title"]) or w < 4200 or not (1.5 <= w / max(h, 1) <= 2.3): continue
        desc = cs.strip(md.get("ImageDescription", {}).get("value", ""))
        info.append({"title": p["title"][5:], "thumb": ii.get("thumburl"), "page": ii.get("descriptionurl"), "w": w, "h": h, "licence": lic, "licence_url": cs.strip(md.get("LicenseUrl", {}).get("value", "")),
                     "artist": cs.strip(md.get("Artist", {}).get("value", "")) or "Unknown", "desc": desc[:140], "score": (4 if MOOD.search(p["title"]) else 0) + (3 if MOOD.search(desc) else 0) + min(w, 9000) / 3000})
    time.sleep(0.3)
print(len(info), "wide, free-licence candidates")
top = sorted(info, key=lambda c: -c["score"])[:20]
os.makedirs("site/_hero_candidates", exist_ok=True)
for f in os.listdir("site/_hero_candidates"): os.remove(os.path.join("site/_hero_candidates", f))
tiles = []
for i, c in enumerate(top, 1):
    try:
        open(f"site/_hero_candidates/{i:02d}.jpg", "wb").write(urllib.request.urlopen(urllib.request.Request(c["thumb"], headers={"User-Agent": cs.UA}), timeout=60).read())
    except Exception as e:
        print("download failed", i, e); continue
    c["n"] = i
    tiles.append(f'<figure><div class="n">{i}</div><img src="{i:02d}.jpg"><figcaption><b>{html.escape(c["title"][:72])}</b><br>{html.escape(c["artist"][:40])} · {html.escape(c["licence"])} · {c["w"]}×{c["h"]}</figcaption></figure>')
    time.sleep(0.25)
open("site/_hero_candidates/index.html", "w", encoding="utf-8").write(
    "<!doctype html><meta charset=utf-8><title>Hero candidates</title><style>body{margin:0;background:#111;color:#eee;font:13px system-ui;padding:20px}h1{font-size:18px}.g{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}"
    "figure{margin:0;position:relative;background:#1b1b1b;border-radius:12px;overflow:hidden}img{width:100%;display:block;aspect-ratio:16/9;object-fit:cover}figcaption{padding:10px 12px;color:#aaa;line-height:1.4}"
    ".n{position:absolute;top:10px;left:10px;background:#fff;color:#000;font-weight:800;border-radius:99px;width:34px;height:34px;display:grid;place-items:center;font-size:16px}</style>"
    f"<h1>Hero candidates (Commons featured pictures) — tell me the number you like</h1><div class=g>{''.join(tiles)}</div>")
json.dump(top, open("tools/hero_candidates.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
