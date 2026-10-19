/* Brand page: every car of one brand (brand.html?make=Toyota). Without ?make it lists all brands. */
(function () {
  const P = Portal, { $, esc, money, km } = P, CARS = window.CARS;
  const root = $("#brandPage"), makeParam = new URLSearchParams(location.search).get("make") || "";
  const makes = [...new Set(CARS.map((c) => c.make))].sort();
  const count = (m) => CARS.filter((c) => c.make === m).length;
  const make = makes.find((m) => m.toLowerCase() === makeParam.toLowerCase());
  const others = (cur) => makes.filter((m) => m !== cur).sort((a, b) => count(b) - count(a) || a.localeCompare(b)).map((m) => `<a class="chipbtn" href="${P.brandHref(m)}">${esc(m)} <small>${count(m)}</small></a>`).join("");

  /* ---------- all brands ---------- */
  if (!make) {
    document.title = "All brands — AGMC";
    const ordered = makes.slice().sort((a, b) => count(b) - count(a) || a.localeCompare(b));
    root.innerHTML = `<section class="section brands-page"><div class="wrap">
      <div class="coll-head"><div><span class="kicker">Pre-owned · inspected · warrantied</span><h1 class="cars-h1">Shop by brand</h1><p class="muted">${makes.length} brands · ${CARS.length} inspected cars</p></div></div>
      <div class="brand-tiles all">${ordered.map((m) => { const c = CARS.find((x) => x.make === m), n = count(m); return `<a class="btile" href="${P.brandHref(m)}"><img src="img/${c.id}.jpg" alt="" loading="lazy"><span class="bt-name">${esc(m)}</span><span class="bt-n">${n} ${n === 1 ? "car" : "cars"}</span><span class="bt-go">↗</span></a>`; }).join("")}</div>
      <div class="sourcing"><div><span class="kicker">Can't find your brand?</span><h3>Tell Wazir what you're after.</h3><p class="muted">We can source a specific make and model for you, inspected and priced like everything else.</p></div><button class="pillbtn dark" id="askSource" type="button"><span>Ask Wazir to source it</span><b>→</b></button></div>
    </div></section>`;
    $("#askSource").onclick = () => { Agent.open(); Agent.send("I can't find the brand I'm looking for. Can you source a specific car for me?"); };
    return;
  }

  /* ---------- one brand ---------- */
  const list = CARS.filter((c) => c.make === make), prices = list.map((c) => c.price), avgKm = Math.round(list.reduce((a, c) => a + c.mileage, 0) / list.length);
  const best = list.slice().sort((a, b) => P.deal(b).pct - P.deal(a).pct)[0], bodies = [...new Set(list.map((c) => c.body))];
  document.title = `Pre-owned ${make} for sale — AGMC`;
  root.innerHTML = `
    <section class="brandhero"><div class="wrap">
      <nav class="crumbs"><a href="cars.html">All cars</a><span>/</span><a href="brand.html">Brands</a><span>/</span>${esc(make)}</nav>
      <span class="kicker">Pre-owned · inspected · warrantied</span>
      <h1>${esc(make)}</h1>
      <p class="lead">${list.length} pre-owned ${esc(make)} ${list.length === 1 ? "car" : "cars"} ready to drive, each with a 150-point inspection, an AGMC warranty and an AI price check.</p>
      <div class="bstats"><div><b>${list.length}</b><span>${list.length === 1 ? "car" : "cars"} available</span></div><div><b>${money(Math.min(...prices))}</b><span>from</span></div>${list.length > 1 ? `<div><b>${money(Math.max(...prices))}</b><span>up to</span></div>` : ""}<div><b>${km(avgKm)}</b><span>average mileage</span></div><div><b>${esc(best.model)}</b><span>best price vs market</span></div></div>
      <button class="btn solid" id="askBrand">${P.SPARK} Ask Wazir about ${esc(make)}</button>
    </div></section>
    <section class="section" style="padding-top:48px"><div class="wrap">
      <div class="brandbar"><div class="chips" id="bChips"></div><div class="f-row"><label>Sort <select id="bSort"><option value="featured">Featured</option><option value="deal">Best deal</option><option value="price-asc">Price, low to high</option><option value="price-desc">Price, high to low</option><option value="mileage">Lowest mileage</option><option value="year">Newest</option></select></label></div></div>
      <div class="grid" id="bGrid"></div>
    </div></section>
    <section class="otherbrands"><div class="wrap"><span class="kicker">Other brands</span><div class="chips">${others(make)}</div></div></section>`;

  let body = "", sort = "featured";
  function draw() {
    $("#bChips").innerHTML = bodies.length > 1 ? ["", ...bodies].map((b) => `<button class="chipbtn ${body === b ? "on" : ""}" data-b="${b}">${b || "All"}</button>`).join("") : "";
    $("#bGrid").innerHTML = P.filterCars({ make, body, sort }).map((c) => P.cardHtml(c)).join("");
  }
  $("#bChips").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { body = b.dataset.b; draw(); } });
  $("#bSort").addEventListener("input", (e) => { sort = e.target.value; draw(); });
  $("#askBrand").onclick = () => { Agent.open(); Agent.send(`Show me your ${make} cars`); };
  window.addEventListener("agmc:changed", draw);
  draw();
})();
