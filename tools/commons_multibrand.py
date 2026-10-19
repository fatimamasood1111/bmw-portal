"""Multi-brand pass: find clean Wikimedia Commons photos for the new used-car inventory and save 500px previews
to tools/preview3/<id>_<n>.jpg + manifest.json for visual review."""
import json, os, re, sys, time, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
import commons_search as cs

sys.stdout.reconfigure(encoding="utf-8")
CLEAN = re.compile(r"showroom|motor show|auto show|IAA|salon|dealership|exhibition|studio|expo|Autosalon|Messe|GIMS|Geneva|Genf|Paris", re.I)
SKIP = re.compile(r"police|taxi|racing|wrap|rear\b|back\b|china|rally|DTM|interior|taxis|ambulance|fire|army|military", re.I)
Q = {
    "AG-101": "Toyota Land Cruiser 200 GXR", "AG-102": "Toyota Camry XV70", "AG-103": "Toyota RAV4 XA50 hybrid", "AG-104": "Nissan Patrol Y62",
    "AG-105": "Honda Civic sedan 2022 FE", "AG-106": "Mazda CX-5 KF", "AG-107": "Hyundai Tucson NX4", "AG-108": "Kia Carnival KA4",
    "AG-109": "Mercedes-Benz C-Class W205 C 300", "AG-110": "Mercedes-Benz GLE W167", "AG-111": "Audi A4 B9 sedan", "AG-112": "Audi Q7 4M",
    "AG-113": "Lexus RX AL20", "AG-114": "Porsche Macan 95B S", "AG-115": "Range Rover Sport L494", "AG-116": "Tesla Model 3 Long Range",
    "AG-117": "Ford Mustang GT S550", "AG-118": "Jeep Wrangler JL Rubicon", "AG-123": "Volkswagen Golf GTI Mk7.5", "AG-124": "Toyota Corolla E210 sedan",
}
SUFFIX = ["", " showroom", " motor show"]
os.makedirs("tools/preview3", exist_ok=True)
manifest = {}
for cid, base in Q.items():
    pool = {}
    for s in SUFFIX:
        try:
            for c in cs.candidates(base + s, 20):
                pool.setdefault(c["title"], c)
        except Exception as e:
            print("   query failed", base + s, e)
        time.sleep(0.4)
    picks = sorted([c for c in pool.values() if not SKIP.search(c["title"])], key=lambda c: (not CLEAN.search(c["title"] + " " + c["desc"]), c["index"]))[:4]
    manifest[cid] = picks
    print(cid, base, "->", len(picks), "|", "; ".join(c["title"][5:46] for c in picks))
    for i, c in enumerate(picks, 1):
        url = re.sub(r"/\d+px-", "/500px-", c["thumb"])
        try:
            open(f"tools/preview3/{cid}_{i}.jpg", "wb").write(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": cs.UA}), timeout=40).read())
        except Exception as e:
            print("   preview failed", cid, i, e)
        time.sleep(0.25)
json.dump(manifest, open("tools/preview3/manifest.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
