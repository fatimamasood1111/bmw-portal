"""Top up site/gallery.json: for cars with fewer than 4 extras, search Commons by model and keep photos whose title names the model."""
import json, os, re, sys, time, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
import commons_search as cs
sys.stdout.reconfigure(encoding="utf-8")
g = json.load(open("site/gallery.json", encoding="utf-8"))
cr = json.load(open("site/credits.json", encoding="utf-8-sig"))
data = open("site/data.js", encoding="utf-8").read()
cars = {m.group(1): (m.group(2), m.group(3), int(m.group(4))) for m in re.finditer(r'car\("(AG-\d+)", "([^"]+)", "([^"]+)", (\d{4})', data)}
KEY = {"AG-119": r"320i|g20", "AG-120": r"530|g30", "AG-121": r"x5", "AG-122": r"m3", "AG-101": r"land ?cruiser", "AG-102": r"camry", "AG-103": r"rav4", "AG-108": r"carnival", "AG-109": r"c ?300|w206|c-class|c class", "AG-110": r"gle", "AG-111": r"a4", "AG-112": r"q7", "AG-114": r"macan", "AG-115": r"range ?rover", "AG-118": r"wrangler", "AG-123": r"golf", "AG-124": r"corolla"}
BAD = re.compile(r"logo|diagram|drawing|svg|\.png|\.gif|\.tif|cutaway|badge|sticker|brochure|police|taxi|rally|race|racing|crash|toy|miniature|concept|prototype|facelift preview|wrecked|accident", re.I)
for cid, (make, model, year) in cars.items():
    have = g.get(cid, [])
    if len(have) >= 4 or cid not in KEY: continue
    key = re.compile(KEY[cid], re.I); names = {f["title"] for f in have}
    cand = []
    for q in (f"{make} {model}", f"{make} {model.split()[0]} {year}"):
        try:
            d = cs.get({"action": "query", "generator": "search", "gsrsearch": f"{q} filetype:bitmap", "gsrnamespace": 6, "gsrlimit": 40, "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata", "iiurlwidth": 1280})
        except Exception as e:
            print(cid, "search failed", e); continue
        for p in d.get("query", {}).get("pages", []):
            ii = (p.get("imageinfo") or [{}])[0]; md = ii.get("extmetadata", {}); t = p["title"][5:]
            lic = cs.strip(md.get("LicenseShortName", {}).get("value", ""))
            if ii.get("mime") != "image/jpeg" or not cs.OK_LICENCE.match(lic) or BAD.search(t) or not key.search(t) or t in names or t == cr[cid]["title"] or ii.get("width", 0) < 1600: continue
            cand.append({"title": t, "thumb": ii.get("thumburl"), "page": ii.get("descriptionurl"), "author": cs.strip(md.get("Artist", {}).get("value", "")) or "Unknown", "licence": lic, "licence_url": cs.strip(md.get("LicenseUrl", {}).get("value", "")), "w": ii.get("width", 0)})
        time.sleep(0.4)
    seen = set(); n = len(have) + 2
    for c in sorted(cand, key=lambda c: -c["w"]):
        if c["title"] in seen or len(have) >= 4: continue
        seen.add(c["title"]); path = f"site/img/{cid}-{n}.jpg"
        while os.path.exists(path): n += 1; path = f"site/img/{cid}-{n}.jpg"
        try: open(path, "wb").write(urllib.request.urlopen(urllib.request.Request(c["thumb"], headers={"User-Agent": cs.UA}), timeout=60).read())
        except Exception as e: print("dl failed", e); continue
        have.append({"src": f"img/{cid}-{n}.jpg", **{k: c[k] for k in ("title", "page", "author", "licence", "licence_url")}}); n += 1; time.sleep(0.2)
    g[cid] = have; print(cid, make, model, "->", len(have), flush=True)
json.dump(g, open("site/gallery.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
