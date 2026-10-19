"""Download the chosen Wikimedia Commons photos into site/img and write site/credits.json (author + licence for each).
Run after commons_preview.py. PICKS = which preview (1-based) was chosen for each car after visual review.
"""
import json, os, re, sys, time, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
import commons_search as cs

sys.stdout.reconfigure(encoding="utf-8")
PICKS = {"BM-101": 2, "BM-102": 1, "BM-103": 2, "BM-104": 2, "BM-105": 3, "BM-106": 1, "BM-107": 1, "BM-108": 1, "BM-109": 1,
         "BM-110": 1, "BM-111": 2, "BM-112": 1, "BM-113": 1, "BM-114": 2, "BM-115": 1, "BM-116": 1, "BM-117": 1, "BM-118": 1}
WIDTH = 1280  # Commons only serves fixed widths: 960, 1280, 1920, ...

manifest = json.load(open("tools/preview/manifest.json", encoding="utf-8"))
os.makedirs("site/img", exist_ok=True)
credits = {}
for cid, n in PICKS.items():
    c = manifest[cid][n - 1]
    url = re.sub(r"/\d+px-", f"/{WIDTH}px-", c["thumb"])
    data = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": cs.UA}), timeout=60).read()
    assert data[:2] == b"\xff\xd8", f"{cid}: not a JPEG"
    open(f"site/img/{cid}.jpg", "wb").write(data)
    credits[cid] = {"title": c["title"][5:], "page": c["page"], "author": c["artist"] or "Unknown", "licence": c["licence"], "licence_url": c["licence_url"]}
    print(cid, len(data) // 1024, "KB", c["title"][5:], "|", c["licence"])
    time.sleep(0.5)
json.dump(credits, open("site/credits.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
