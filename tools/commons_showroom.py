"""Second pass: look for cleaner showroom / exhibition style photos for the weaker cars, and a wide hero image.
Writes tools/preview2/<id>_<n>.jpg (500px previews) + tools/preview2/manifest.json for visual review.
"""
import json, os, re, sys, time, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
import commons_search as cs

sys.stdout.reconfigure(encoding="utf-8")
CLEAN = re.compile(r"showroom|BMW Welt|motor show|auto show|IAA|salon|dealership|exhibition|studio|expo|museum|Autosalon|Messe", re.I)
SKIP = re.compile(r"police|taxi|racing|wrap|rear\b|china|back\b|\bback\b|DTM|rally", re.I)
MODEL = {  # car id -> base name + extra words
    "BM-101": "BMW 3 Series G20", "BM-102": "BMW X3 G45", "BM-103": "BMW X5 G05", "BM-105": "BMW iX I20", "BM-106": "BMW M4 G82",
    "BM-109": "BMW X1 F48", "BM-110": "BMW X5 G05", "BM-111": "BMW X7 G07", "BM-114": "BMW 7 Series G12", "BM-117": "BMW M5 F90",
    "BM-104": "BMW i4 G26", "BM-107": "BMW 3 Series G20", "BM-118": "BMW iX3 G08", "BM-116": "BMW X6 G06", "BM-112": "BMW M3 G80",
}
SUFFIX = ["showroom", "BMW Welt", "motor show", "dealership"]
HERO_Q = ["BMW Welt", "BMW showroom", "BMW motor show", "BMW dealership cars", "BMW M4 Competition BMW Welt"]
seen = set()


def gather(queries, n=30, wide=False):
    pool = {}
    for q in queries:
        try:
            for c in cs.candidates(q, n):
                pool.setdefault(c["title"], c)
        except Exception as e:
            print("   query failed", q, e)
        time.sleep(0.5)
    out = [c for c in pool.values() if not SKIP.search(c["title"])]
    if wide:
        out = [c for c in out if c["w"] / c["h"] >= 1.55 and c["w"] >= 3000]
    return sorted(out, key=lambda c: (not CLEAN.search(c["title"] + " " + c["desc"]), c["index"]))


os.makedirs("tools/preview2", exist_ok=True)
manifest = {}
jobs = {cid: [f"{m} {s}" for s in SUFFIX] for cid, m in MODEL.items()}
jobs["hero"] = HERO_Q
for cid, qs in jobs.items():
    picks = gather(qs, wide=(cid == "hero"))[:5]
    manifest[cid] = picks
    print(cid, len(picks), "|", "; ".join(c["title"][5:48] for c in picks))
    for i, c in enumerate(picks, 1):
        url = re.sub(r"/\d+px-", "/500px-", c["thumb"])
        try:
            open(f"tools/preview2/{cid}_{i}.jpg", "wb").write(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": cs.UA}), timeout=40).read())
        except Exception as e:
            print("   preview failed", cid, i, e)
        time.sleep(0.3)
json.dump(manifest, open("tools/preview2/manifest.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
