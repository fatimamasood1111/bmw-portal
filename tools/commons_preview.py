"""Download small preview thumbnails of the top candidates per car into tools/preview/ for visual checking."""
import json, os, re, sys, time, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
import commons_search as cs

sys.stdout.reconfigure(encoding="utf-8")
EXTRA_QUERIES = {"BM-101": "BMW 330i M Sport", "BM-110": "BMW X5 G05 2019 xDrive40i"}
SKIP = re.compile(r"police|taxi|racing|wrap|rear\b|china", re.I)  # prefer plain front-3/4 dealer-style shots
PER_CAR = 4

cands = json.load(open("tools/candidates.json", encoding="utf-8"))
for cid, q in EXTRA_QUERIES.items():
    cands[cid] = {"query": q, "candidates": cs.candidates(q)}
os.makedirs("tools/preview", exist_ok=True)
manifest = {}
for cid, info in cands.items():
    pool = [c for c in info["candidates"] if not SKIP.search(c["title"])] or info["candidates"]
    picks = pool[:PER_CAR]
    manifest[cid] = picks
    for i, c in enumerate(picks, 1):
        url = re.sub(r"/\d+px-", "/500px-", c["thumb"])
        req = urllib.request.Request(url, headers={"User-Agent": cs.UA})
        try:
            data = urllib.request.urlopen(req, timeout=40).read()
            open(f"tools/preview/{cid}_{i}.jpg", "wb").write(data)
            print(cid, i, len(data) // 1024, "KB", c["title"][5:60])
        except Exception as e:
            print(cid, i, "FAILED", e)
        time.sleep(0.4)
json.dump(manifest, open("tools/preview/manifest.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
