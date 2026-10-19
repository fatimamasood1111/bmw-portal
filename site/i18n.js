/* English / Arabic. The site is written in English; in Arabic mode every text node and a few attributes are translated
   from the dictionary in i18n-ar.js (exact phrases first, then patterns), the page flips to RTL, and Arabic fonts load.
   Switch with I18N.set("ar" | "en"). Untranslated English is collected in I18N.missing for debugging. */
(function () {
  let lang = "en";
  try { lang = localStorage.getItem("agmc_lang") === "ar" ? "ar" : "en"; } catch (e) {}
  const root = document.documentElement;
  root.lang = lang; root.dir = lang === "ar" ? "rtl" : "ltr";
  const api = window.I18N = { lang, missing: new Set(), tr: (s) => s, set(l) { try { localStorage.setItem("agmc_lang", l); } catch (e) {} location.reload(); } };
  if (lang !== "ar") return;

  const f = document.createElement("link"); f.rel = "stylesheet";
  f.href = "https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap";
  document.head.appendChild(f);

  const AR = /[؀-ۿ]/, LAT = /[A-Za-z]{2,}/;
  const D = () => window.AR_DICT || {}, RULES = () => window.AR_RULES || [];
  const num = (s) => s;                                  // digits stay Western
  const generic = (s) => s
    .replace(/AED\s*([\d,]+)/g, "$1 درهم").replace(/([\d,.]+)\s*km\/h/g, "$1 كم/س").replace(/([\d,]+)\s*km\b/g, "$1 كم")
    .replace(/(\d+)\s*hp\b/g, "$1 حصان").replace(/(\d+)\s*Nm\b/g, "$1 نيوتن.م").replace(/\bWazir\b/g, "وزير").replace(/(\d[\d,.]*\s\/\s\d[\d,.]*)/g, "⁦$1⁩").replace(/→/g, "←").replace(/↗/g, "↖");

  const NAMES = (window.CARS || []).flatMap((c) => [c.make, c.model]);
  const isCarText = (t) => /^[\d.]+L /.test(t) || /^[A-Z]{2}-\d+$/.test(t) || /@|^\d+[A-Z]+$/.test(t) || NAMES.some((n) => t.includes(n));
  function tr(str) {
    if (!str) return str;
    const m = str.match(/^(\s*)([\s\S]*?)(\s*)$/), lead = m[1], t = m[2], trail = m[3];
    if (!t || AR.test(t) || t.indexOf("⁦") >= 0) return str;   // already translated or already direction-marked: never process twice (prevents an endless mutation loop)
    let out = D()[t];
    if (out === undefined) for (const [re, fn] of RULES()) { const mm = t.match(re); if (mm) { out = typeof fn === "function" ? fn(...mm.slice(1), mm) : t.replace(re, fn); break; } }
    if (out === undefined) { out = generic(t); if (out === t && LAT.test(t) && !isCarText(t)) api.missing.add(t); }
    else out = generic(out);
    return lead + out + trail;
  }
  api.tr = tr;

  const ATTRS = ["placeholder", "aria-label", "title", "alt"], SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1 };
  function text(node) { if (node.parentNode && SKIP[node.parentNode.nodeName]) return; const v = node.nodeValue, o = tr(v); if (o !== v) node.nodeValue = o; }
  function walk(el) {
    if (el.nodeType === 3) return text(el);
    if (el.nodeType !== 1 || SKIP[el.nodeName]) return;
    if (el.getAttribute && el.hasAttribute("data-noi18n")) return;
    for (const a of ATTRS) if (el.hasAttribute && el.hasAttribute(a)) { const v = el.getAttribute(a), o = tr(v); if (o !== v) el.setAttribute(a, o); }
    for (let n = el.firstChild; n; n = n.nextSibling) walk(n);
  }
  function run() {
    document.title = tr(document.title);
    walk(document.body);
    new MutationObserver((ms) => {
      for (const m of ms) {
        if (m.type === "characterData") text(m.target);
        else if (m.type === "attributes") { const v = m.target.getAttribute(m.attributeName), o = tr(v); if (o !== v) m.target.setAttribute(m.attributeName, o); }
        else m.addedNodes.forEach(walk);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    new MutationObserver(() => { const o = tr(document.title); if (o !== document.title) document.title = o; }).observe(document.querySelector("title"), { childList: true });
  }
  // scripts sit at the end of <body>, so the DOM is ready when this runs; core.js mounts the chrome a moment later and the observer picks it up
  if (document.body) run(); else document.addEventListener("DOMContentLoaded", run);
})();
