"""Multi-brand pass: download the chosen Commons photos into site/img/AG-xxx.jpg, carry over the four reused BMW photos,
and rebuild site/credits.json (author + licence per car). PICKS = preview number chosen after visual review."""
import json, os, re, shutil, sys, time, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
import commons_search as cs

sys.stdout.reconfigure(encoding="utf-8")
PICKS = {"AG-101": 2, "AG-102": 1, "AG-103": 2, "AG-104": 5, "AG-105": 1, "AG-106": 1, "AG-107": 1, "AG-108": 1, "AG-109": 2,
         "AG-110": 3, "AG-111": 3, "AG-112": 3, "AG-113": 2, "AG-114": 1, "AG-115": 1, "AG-116": 1, "AG-117": 4, "AG-118": 3,
         "AG-123": 1, "AG-124": 1}
REUSE = {"AG-119": "BM-107", "AG-120": "BM-108", "AG-121": "BM-110", "AG-122": "BM-112"}  # existing BMW photos

manifest = json.load(open("tools/preview3/manifest.json", encoding="utf-8"))
old = json.load(open("site/credits.json", encoding="utf-8-sig"))
credits = {}
for new_id, old_id in REUSE.items():
    shutil.copyfile(f"site/img/{old_id}.jpg", f"site/img/{new_id}.jpg")
    credits[new_id] = old[old_id]
for cid, n in PICKS.items():
    c = manifest[cid][n - 1]
    url = re.sub(r"/\d+px-", "/1280px-", c["thumb"])
    data = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": cs.UA}), timeout=60).read()
    assert data[:2] == b"\xff\xd8", f"{cid}: not a JPEG"
    open(f"site/img/{cid}.jpg", "wb").write(data)
    credits[cid] = {"title": c["title"][5:], "page": c["page"], "author": c["artist"] or "Unknown", "licence": c["licence"], "licence_url": c["licence_url"]}
    print(cid, len(data) // 1024, "KB", c["title"][5:60], "|", c["licence"], "|", credits[cid]["author"][:30])
    time.sleep(0.5)
json.dump(credits, open("site/credits.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
for f in os.listdir("site/img"):  # drop photos of cars that are no longer in the inventory
    if f.startswith("BM-") or f in ("showroom-night.jpg",):
        os.remove(os.path.join("site/img", f))
print(len(credits), "credits;", len(os.listdir("site/img")), "files in site/img")
