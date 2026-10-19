/* Cars page: the full collection with dropdown filters. Wazir drives the grid through Portal.setFilters. */
(function () {
  const P = Portal, { $, $$, esc, money } = P, CARS = window.CARS;
  const bodies = [...new Set(CARS.map((c) => c.body))], makes = [...new Set(CARS.map((c) => c.make))].sort();

  /* ---------- the collection: every filter is a dropdown ---------- */
  const F = { text: "", make: "", body: "", fuel: "", max_price: "", min_seats: "", sort: "featured" };
  let aiNote = "", scores = {};
  const brandCount = (m) => CARS.filter((c) => c.make === m).length, brandOrder = makes.slice().sort((a, b) => brandCount(b) - brandCount(a) || a.localeCompare(b));
  const DDS = [
    { id: "make", key: "make", label: "Brand", opts: () => [["", "All brands"], ...brandOrder.map((m) => [m, m, brandCount(m)])], foot: ["brand.html", "Browse brand pages →"] },
    { id: "body", key: "body", label: "Body type", opts: () => [["", "All types"], ...bodies.map((b) => [b, b])] },
    { id: "price", key: "max_price", label: "Budget", opts: () => [["", "Any budget"], ["80000", "Up to 80,000"], ["120000", "Up to 120,000"], ["160000", "Up to 160,000"], ["200000", "Up to 200,000"], ["250000", "Up to 250,000"]] },
    { id: "fuel", key: "fuel", label: "Fuel", opts: () => [["", "Any fuel"], ["Petrol", "Petrol"], ["Hybrid", "Hybrid"], ["Electric", "Electric"]] },
    { id: "seats", key: "min_seats", label: "Seats", opts: () => [["", "Any seats"], ["5", "5+ seats"], ["7", "7+ seats"]] },
    { id: "sort", key: "sort", label: "Sort", right: true, always: true, opts: () => [["featured", "Featured"], ["deal", "Best deal"], ["price-asc", "Price: low to high"], ["price-desc", "Price: high to low"], ["mileage", "Lowest mileage"], ["year", "Newest"]] },
  ];
  const cur = (k) => { const v = F[k]; if (v === "" || v == null) return ""; if (k === "min_seats") return v >= 7 ? "7" : v >= 5 ? "5" : ""; if (k === "max_price") return String(+v); if (k === "fuel") return String(v)[0].toUpperCase() + String(v).slice(1).toLowerCase(); if (k === "make") return makes.find((m) => m.toLowerCase() === String(v).toLowerCase()) || String(v); if (k === "body") return bodies.find((b) => b.toLowerCase() === String(v).toLowerCase()) || String(v); return String(v); };
  function renderDDs() {
    const open = $(".sg .menu:not([hidden])")?.closest(".sg")?.dataset.dd;
    $("#ddRow").innerHTML = DDS.map((d) => {
      const v = cur(d.key), opts = d.opts(), sel = opts.find(([ov]) => ov === v);
      const shown = sel ? sel[1] : v ? (d.key === "max_price" ? `Up to ${money(v)}` : v) : opts[0][1];
      return `<div class="sg" data-dd="${d.id}"><span class="sg-l">${d.label}</span><button type="button" class="sg-btn ${v && d.id !== "sort" ? "set" : ""}" aria-haspopup="true" aria-expanded="false"><span>${v && d.id !== "sort" || d.id === "sort" ? `${d.label}: <b>${esc(shown)}</b>` : d.label}</span><i>⌄</i></button>
        <div class="menu" hidden>${opts.map(([ov, ol, n]) => `<button type="button" class="${ov === v ? "on" : ""}" data-v="${esc(ov)}"><span>${esc(ol)}</span>${n ? `<small>${n}</small>` : ov === v ? "<i>✓</i>" : ""}</button>`).join("")}${d.foot ? `<a class="mfoot" href="${d.foot[0]}">${d.foot[1]}</a>` : ""}</div></div>`;
    }).join("");
    if (open) { const g = $(`.sg[data-dd="${open}"]`); if (g) { $(".menu", g).hidden = false; $(".sg-btn", g).setAttribute("aria-expanded", "true"); } }
    $("#btnClearAll").hidden = !["text", "make", "body", "fuel", "max_price", "min_seats"].some((k) => F[k]);
  }
  function syncControls() { $("#fText").value = F.text || ""; }
  function render() {
    renderDDs();
    const list = P.filterCars(F);
    if (aiNote && Object.keys(scores).length) list.sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));
    $("#grid").innerHTML = list.map((c) => P.cardHtml(c, { score: scores[c.id] })).join("");
    $("#count").textContent = `${list.length} car${list.length === 1 ? "" : "s"} available`; $("#barCount").textContent = `${list.length} car${list.length === 1 ? "" : "s"} available`;
    $("#empty").hidden = list.length > 0;
    const b = $("#aiBanner"); b.hidden = !aiNote;
    b.innerHTML = aiNote ? `<span>${P.SPARK} Curated by Wazir — ${esc(aiNote)}</span><button class="link" id="bClear">Show all</button>` : "";
  }
  P.setFilters = (f, note, sc) => {
    for (const k of Object.keys(F)) delete F[k];
    Object.assign(F, { text: "", make: "", body: "", fuel: "", max_price: "", min_seats: "", sort: "featured" }, f);
    F.text = [f.text, f.model].filter(Boolean).join(" "); delete F.model;
    aiNote = note || ""; scores = sc || {}; syncControls(); render();
  };
  P.clearFilters = () => P.setFilters({}, "");
  P.flash = (ids) => ids.forEach((id) => { const el = $(`#grid .car[data-id="${id}"]`); if (el) { el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); } });
  const touch = () => { aiNote = ""; scores = {}; render(); };

  $("#fText").addEventListener("input", (e) => { F.text = e.target.value; touch(); });
  const closeMenus = () => $$(".sg .menu").forEach((m) => { m.hidden = true; m.closest(".sg").querySelector(".sg-btn").setAttribute("aria-expanded", "false"); });
  $("#ddRow").addEventListener("click", (e) => {
    const g = e.target.closest(".sg"); if (!g) return;
    const opt = e.target.closest(".menu button");
    if (opt) { const d = DDS.find((x) => x.id === g.dataset.dd); F[d.key] = opt.dataset.v; closeMenus(); return touch(); }
    if (e.target.closest(".sg-btn")) { const m = $(".menu", g), was = m.hidden; closeMenus(); m.hidden = !was; $(".sg-btn", g).setAttribute("aria-expanded", String(was)); }
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".sg")) closeMenus(); if (e.target.id === "bClear") P.clearFilters(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenus(); });
  $("#btnClearAll").onclick = P.clearFilters; $("#btnClear2").onclick = P.clearFilters;
  window.addEventListener("agmc:changed", render);
  const q = new URLSearchParams(location.search), init = {};
  ["make", "body", "fuel", "max_price", "min_seats"].forEach((k) => { if (q.get(k)) init[k] = q.get(k); });
  if (q.get("q")) init.text = q.get("q");
  if (Object.keys(init).length) P.setFilters(init, ""); else render();
})();
(function () {
  const bar = document.querySelector(".cars-bar"); if (!bar) return;
  const upd = () => bar.classList.toggle("stuck", bar.getBoundingClientRect().top <= 88);
  addEventListener("scroll", upd, { passive: true }); upd();
})();
/* the header row follows the filter bar's real height (it wraps when several filters are set), so the list never sits under it */
(function () {
  const grid = document.querySelector(".cars-grid"), bar = document.querySelector(".cars-bar-in"); if (!grid || !bar || !window.ResizeObserver) return;
  const set = () => grid.style.setProperty("--bar-h", bar.offsetHeight + "px");
  new ResizeObserver(set).observe(bar); set();
})();
