"""List candidate Wikimedia Commons photos (free licences only) for each car in the inventory.
Usage: python tools/commons_search.py            -> writes tools/candidates.json and prints a summary
"""
import json, re, sys, time, urllib.parse, urllib.request
sys.stdout.reconfigure(encoding="utf-8")

API = "https://commons.wikimedia.org/w/api.php"
UA = "AGMC-demo-portal/1.0 (local dev; contact: fatimamasood9@gmail.com)"

# car id -> search phrase (generation codes keep the photo matched to the right model year)
QUERIES = {
    "BM-101": "BMW 3 Series G20 LCI 330i",
    "BM-102": "BMW X3 G45 2024",
    "BM-103": "BMW X5 G05 LCI 2024",
    "BM-104": "BMW i4 eDrive40 G26",
    "BM-105": "BMW iX xDrive50 I20",
    "BM-106": "BMW M4 Competition G82",
    "BM-107": "BMW 320i G20 M Sport",
    "BM-108": "BMW 530i G30 LCI M Sport",
    "BM-109": "BMW X1 F48",
    "BM-110": "BMW X5 G05 xDrive40i",
    "BM-111": "BMW X7 xDrive40i G07",
    "BM-112": "BMW M3 Competition G80",
    "BM-113": "BMW Z4 G29 sDrive30i",
    "BM-114": "BMW 740Li G12 LCI",
    "BM-115": "BMW 218i Gran Coupe F44",
    "BM-116": "BMW X6 M50i G06",
    "BM-117": "BMW M5 Competition F90",
    "BM-118": "BMW iX3 G08",
    "hero": "BMW M4 Competition G82 front",
}
OK_LICENCE = re.compile(r"^(CC BY(-SA)? [\d.]+|CC0|Public domain|PD)", re.I)
BAD_TITLE = re.compile(r"interior|dashboard|cockpit|engine|wheel|badge|logo|detail|steering|seat|headlight|taillight|rear light|grille|trunk|boot|interieur|cutaway|drawing|svg|\.png|\.gif", re.I)


def get(params):
    url = API + "?" + urllib.parse.urlencode({**params, "format": "json", "formatversion": "2"})
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def strip(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html or "")).strip()


def candidates(query, n=14):
    data = get({"action": "query", "generator": "search", "gsrsearch": f"{query} filetype:bitmap", "gsrnamespace": 6, "gsrlimit": n,
                "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata", "iiurlwidth": 1600})
    out = []
    for p in data.get("query", {}).get("pages", []):
        ii = (p.get("imageinfo") or [{}])[0]
        md = ii.get("extmetadata", {})
        lic = strip(md.get("LicenseShortName", {}).get("value", ""))
        if ii.get("mime") != "image/jpeg" or BAD_TITLE.search(p["title"]) or not OK_LICENCE.match(lic):
            continue
        w, h = ii.get("width", 0), ii.get("height", 0)
        if w < 1800 or not (1.25 <= w / max(h, 1) <= 1.9):
            continue
        out.append({"title": p["title"], "thumb": ii.get("thumburl"), "page": ii.get("descriptionurl"), "w": w, "h": h, "licence": lic,
                    "licence_url": strip(md.get("LicenseUrl", {}).get("value", "")), "artist": strip(md.get("Artist", {}).get("value", "")),
                    "desc": strip(md.get("ImageDescription", {}).get("value", ""))[:140], "index": p.get("index", 99)})
    return sorted(out, key=lambda c: c["index"])


if __name__ == "__main__":
    res = {}
    for cid, q in QUERIES.items():
        try:
            res[cid] = {"query": q, "candidates": candidates(q)}
        except Exception as e:  # keep going, report at the end
            res[cid] = {"query": q, "error": str(e), "candidates": []}
        print(f"{cid}  {q}: {len(res[cid]['candidates'])} candidates")
        for c in res[cid]["candidates"][:6]:
            print("     -", c["title"][5:], f"({c['w']}x{c['h']}, {c['licence']})")
        time.sleep(0.6)
    with open("tools/candidates.json", "w", encoding="utf-8") as f:
        json.dump(res, f, indent=1, ensure_ascii=False)
