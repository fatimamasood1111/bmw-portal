"""For each car, find extra Commons photos from the same photographer / model category. Writes site/img/AG-xxx-2..5.jpg (1280px) and site/gallery.json."""
import json, os, re, sys, time, urllib.parse, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
import commons_search as cs
sys.stdout.reconfigure(encoding="utf-8")
credits = json.load(open("site/credits.json", encoding="utf-8-sig"))
SKIP = re.compile(r"photograph|self-published|uploaded|cc-|cc by|creative commons|files by|images by|license|licence|wikimedia|featured|quality|valued|taken|pages with|^media|geograph", re.I)
BAD = re.compile(r"logo|diagram|drawing|svg|\.png|\.gif|\.tif|cutaway|engine bay|key fob|badge|sticker|brochure|dealership sign|police|taxi|rally|race|racing|crash|toy|model car|miniature", re.I)
def info(titles):
    d = cs.get({"action": "query", "titles": "|".join(titles), "prop": "imageinfo|categories", "iiprop": "url|size|mime|extmetadata", "iiurlwidth": 1280, "cllimit": 60, "clshow": "!hidden"})
    return d.get("query", {}).get("pages", [])
def okfile(p, author=None):
    ii = (p.get("imageinfo") or [{}])[0]; md = ii.get("extmetadata", {})
    lic = cs.strip(md.get("LicenseShortName", {}).get("value", ""))
    if ii.get("mime") != "image/jpeg" or not cs.OK_LICENCE.match(lic) or BAD.search(p["title"]) or ii.get("width", 0) < 1600: return None
    return {"title": p["title"][5:], "thumb": ii.get("thumburl"), "page": ii.get("descriptionurl"), "licence": lic, "licence_url": cs.strip(md.get("LicenseUrl", {}).get("value", "")), "author": cs.strip(md.get("Artist", {}).get("value", "")) or "Unknown"}
out, report = {}, []
for cid, cr in credits.items():
    if not cid.startswith("AG-"): continue
    try:
        pg = info(["File:" + cr["title"]])[0]
        cats = [c["title"][9:] for c in pg.get("categories", []) if not SKIP.search(c["title"][9:])]
        cands = []
        for cat in cats[:4]:
            d = cs.get({"action": "query", "list": "categorymembers", "cmtitle": "Category:" + cat, "cmtype": "file", "cmlimit": 60})
            titles = [m["title"] for m in d.get("query", {}).get("categorymembers", []) if m["title"][5:] != cr["title"]]
            for i in range(0, len(titles), 30):
                for p in info(titles[i:i + 30]):
                    f = okfile(p)
                    if f: cands.append(f)
            time.sleep(0.3)
        seen, picks = set(), []
        same = [c for c in cands if c["author"] == cr["author"]]; rest = [c for c in cands if c["author"] != cr["author"]]
        for c in same + rest:
            if c["title"] in seen: continue
            seen.add(c["title"]); picks.append(c)
            if len(picks) >= 4: break
        files = []
        for n, c in enumerate(picks, 2):
            path = f"site/img/{cid}-{n}.jpg"
            open(path, "wb").write(urllib.request.urlopen(urllib.request.Request(c["thumb"], headers={"User-Agent": cs.UA}), timeout=60).read())
            files.append({"src": f"img/{cid}-{n}.jpg", **{k: c[k] for k in ("title", "page", "author", "licence", "licence_url")}})
            time.sleep(0.2)
        out[cid] = files
        report.append(f"{cid} {cr['title'][:34]:34} cats={len(cats)} same-author={len(same)} total={len(cands)} saved={len(files)}")
        print(report[-1], flush=True)
    except Exception as e:
        print(cid, "failed", e, flush=True)
json.dump(out, open("site/gallery.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
