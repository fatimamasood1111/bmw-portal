"""Search Commons for wide, moody premium-car photos with open space for a headline. Writes site/_hero_candidates/ (temporary) and tools/hero_wide.json."""
import html, json, os, re, sys, time, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
import commons_search as cs
sys.stdout.reconfigure(encoding="utf-8")
QS = ["sports car sunset road", "supercar dusk", "Porsche 911 sunset", "Aston Martin dusk", "Lamborghini sunset", "Ferrari sunset", "McLaren sunset", "luxury car night city", "car coast road golden hour", "Bentley sunset", "Mercedes AMG sunset", "dark sports car mountain road", "car lake reflection dusk", "Rolls-Royce evening"]
BAD = re.compile(r"interior|engine|wheel|badge|logo|detail|dashboard|cockpit|seat|taxi|police|rally|racing|race |crash|museum|exhibition|expo |parking|diagram|drawing|model car|toy|\.svg|\.png|\.tif|show|truck|bus|motorcycle|bike", re.I)
PERSON = r"woman|man |girl|boy|person|people|couple|bride|driver|selfie|portrait|team|crew|staff"
pool = {}
for q in QS:
    try:
        d = cs.get({"action": "query", "generator": "search", "gsrsearch": f"{q} filetype:bitmap", "gsrnamespace": 6, "gsrlimit": 40, "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata", "iiurlwidth": 700})
    except Exception as e:
        print("failed", q, e); continue
    for p in d.get("query", {}).get("pages", []):
        ii = (p.get("imageinfo") or [{}])[0]; md = ii.get("extmetadata", {})
        lic = cs.strip(md.get("LicenseShortName", {}).get("value", "")); w, h = ii.get("width", 0), ii.get("height", 0)
        if ii.get("mime") != "image/jpeg" or not cs.OK_LICENCE.match(lic) or BAD.search(p["title"]) or re.search(PERSON, p["title"], re.I) or w < 3800 or not (1.7 <= w / max(h, 1) <= 3.2): continue
        pool.setdefault(p["title"], {"q": q, "title": p["title"][5:], "thumb": ii.get("thumburl"), "page": ii.get("descriptionurl"), "w": w, "h": h, "licence": lic, "licence_url": cs.strip(md.get("LicenseUrl", {}).get("value", "")), "artist": cs.strip(md.get("Artist", {}).get("value", "")) or "Unknown", "file": p["title"]})
    time.sleep(0.4)
items = sorted(pool.values(), key=lambda c: -(min(c["w"], 9000) / 3000 + (c["w"] / c["h"]))) [:20]
os.makedirs("site/_hero_candidates", exist_ok=True)
for f in os.listdir("site/_hero_candidates"): os.remove(os.path.join("site/_hero_candidates", f))
tiles = []
for i, c in enumerate(items, 1):
    c["n"] = i
    try: open(f"site/_hero_candidates/{i:02d}.jpg", "wb").write(urllib.request.urlopen(urllib.request.Request(c["thumb"], headers={"User-Agent": cs.UA}), timeout=60).read())
    except Exception as e: print("dl failed", i, e); continue
    tiles.append(f'<figure><div class="n">{i}</div><img src="{i:02d}.jpg"><figcaption><b>{html.escape(c["title"][:70])}</b><br>{html.escape(c["artist"][:30])} · {c["licence"]} · {c["w"]}×{c["h"]}</figcaption></figure>')
open("site/_hero_candidates/index.html", "w", encoding="utf-8").write("<!doctype html><meta charset=utf-8><title>Hero candidates</title><style>body{margin:0;background:#111;color:#eee;font:12px system-ui;padding:16px}.g{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}figure{margin:0;position:relative;background:#1b1b1b}img{width:100%;display:block;aspect-ratio:21/9;object-fit:cover}figcaption{padding:8px 10px;color:#aaa}.n{position:absolute;top:8px;left:8px;background:#fff;color:#000;font-weight:800;width:30px;height:30px;display:grid;place-items:center}</style><div class=g>" + "".join(tiles) + "</div>")
json.dump(items, open("tools/hero_wide.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
for c in items: print(c["n"], "|", c["title"][:62], "|", c["artist"][:20], "|", c["w"], "x", c["h"])
