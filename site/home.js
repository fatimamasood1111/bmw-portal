/* Home page: cinematic hero, search bar, editorial sections and the inventory browser.
   Wazir drives the grid through Portal.setFilters. */
(function () {
  const P = Portal, { $, $$, esc, money } = P, CARS = window.CARS, car = (id) => P.carById(id);
  const bodies = [...new Set(CARS.map((c) => c.body))], makes = [...new Set(CARS.map((c) => c.make))].sort();

  /* ---------- hero background: your photo from the Style studio, else img/hero.jpg, else a slideshow of the inventory ---------- */
  const bg = $("#luxBg"); let slideTimer = null;
  function setBg(url) { clearInterval(slideTimer); bg.innerHTML = `<div class="lb on"></div>`; $(".lb", bg).style.backgroundImage = `url("${url}")`; }
  function initBg() {
    clearInterval(slideTimer);
    const saved = P.safe(() => localStorage.getItem("agmc_hero_photo"), null); if (saved) return setBg(saved);
    const probe = new Image();
    probe.onload = () => setBg("img/hero.jpg");
    probe.onerror = () => { bg.innerHTML = ["AG-122", "AG-110", "AG-115"].map((id, i) => `<div class="lb ${i ? "" : "on"}" style="background-image:url(img/${id}.jpg)"></div>`).join(""); let n = 0; slideTimer = setInterval(() => { const s = $$(".lb", bg); s[n].classList.remove("on"); n = (n + 1) % s.length; s[n].classList.add("on"); }, 6500); };
    probe.src = "img/hero.jpg";
  }
  window.addEventListener("agmc:heroPhoto", (e) => (e.detail ? setBg(e.detail) : initBg()));
  initBg();
  $("#ctaAsk").onclick = $("#storyAsk").onclick = () => Agent.open();

  /* ---------- hero card: a preview of a Wazir conversation, built from real inventory ---------- */
  const mini = (id, s) => { const c = car(id), d = P.deal(c); return `<a class="wz-car" href="${P.carHref(id)}"><div class="car-img">${P.carImg(c)}<span class="chip deal ${d.tone}"><i></i>${d.label}</span><span class="chip match">✦ ${s}%</span></div><div class="wz-car-b"><b>${c.year} ${esc(c.make)} ${esc(c.model)}</b><small>${P.km(c.mileage)} · ${c.fuel} · ${c.power} hp</small><span class="go">specs →</span><span class="p">${money(c.price)}</span></div></a>`; };
  $("#hvChat").innerHTML = `<div class="hvc-head"><span class="orb" style="width:30px;height:30px"></span><div><b>Wazir</b><br><small>Online · AI car advisor</small></div></div><div class="mock">
    <div class="wz-m user"><div class="wz-t">I need a 7-seater SUV under 200,000</div></div>
    <div class="wz-step done"><span class="st"></span><span>Searching the inventory · min seats 7 · max price 200000</span></div>
    <div class="wz-cars">${mini("AG-101", 97)}${mini("AG-108", 94)}</div>
    <div class="wz-m bot"><span class="wz-ava"></span><div class="wz-t">The ${esc(car("AG-101").make)} ${esc(car("AG-101").model)} is the best match: eight seats, a good price, and a full service history.</div></div></div>`;

  /* ---------- shop by brand: the four biggest brands ---------- */
  const topBrands = makes.slice().sort((a, b) => CARS.filter((c) => c.make === b).length - CARS.filter((c) => c.make === a).length || a.localeCompare(b)).slice(0, 4);
  $("#brandTiles").innerHTML = topBrands.map((m) => { const c = CARS.find((x) => x.make === m); return `<a class="btile" href="cars.html?make=${encodeURIComponent(m)}"><img src="img/${c.id}.jpg" alt="" loading="lazy"><span class="bt-name">${esc(m)}</span><span class="bt-n">${CARS.filter((x) => x.make === m).length} cars</span><span class="bt-go">↗</span></a>`; }).join("");

  /* ---------- latest arrivals: a taste of the collection, the rest lives on cars.html ---------- */
  $("#grid").innerHTML = CARS.slice().sort((a, b) => P.deal(b).saving - P.deal(a).saving).slice(0, 6).map((c) => P.cardHtml(c)).join("");
})();