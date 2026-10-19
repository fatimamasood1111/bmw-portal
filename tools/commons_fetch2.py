"""Second pass: swap in the cleaner showroom-style photos chosen from tools/preview2 (and the wide hero),
merging their credits into site/credits.json. PICKS = preview2 number chosen per car after visual review."""
import json, os, re, sys, time, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
import commons_search as cs

sys.stdout.reconfigure(encoding="utf-8")
PICKS = {"BM-101": (1, 1280), "BM-103": (1, 1280), "BM-109": (4, 1280), "BM-111": (3, 1280), "BM-112": (1, 1280),
         "BM-114": (1, 1280), "BM-117": (3, 1280), "BM-118": (1, 1280), "hero": (5, 1920)}

manifest = json.load(open("tools/preview2/manifest.json", encoding="utf-8"))
credits = json.load(open("site/credits.json", encoding="utf-8"))
for cid, (n, width) in PICKS.items():
    c = manifest[cid][n - 1]
    url = re.sub(r"/\d+px-", f"/{width}px-", c["thumb"])
    data = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": cs.UA}), timeout=90).read()
    assert data[:2] == b"\xff\xd8", f"{cid}: not a JPEG"
    open(f"site/img/{cid}.jpg", "wb").write(data)
    credits[cid] = {"title": c["title"][5:], "page": c["page"], "author": c["artist"] or "Unknown", "licence": c["licence"], "licence_url": c["licence_url"]}
    print(cid, len(data) // 1024, "KB", c["title"][5:], "|", c["licence"], "|", credits[cid]["author"])
    time.sleep(0.5)
json.dump(credits, open("site/credits.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
