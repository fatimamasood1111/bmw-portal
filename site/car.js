/* Car page: full specifications, price insight, Wazir's take, booking + reservation. URL: car.html?id=AG-101 */
(function () {
  const P = Portal, { $, esc, money, km, known, nr } = P, C = CONFIG, CARS = window.CARS;
  const id = new URLSearchParams(location.search).get("id"), c = P.carById(id);
  const root = $("#carPage");

  if (!c) {
    document.title = "Car not found — AGMC";
    root.innerHTML = `<div class="empty" style="padding:120px 0"><h2>We couldn't find that car</h2><p class="muted">It may have been sold. <a class="link" href="cars.html">Browse all cars</a> or ask Wazir to find a similar one.</p></div>`;
    return;
  }
  window.PageContext = { carId: c.id };
  document.title = `${P.name(c)} — AGMC`;

  const d = P.deal(c), age = 2026 - c.year, perYr = Math.round(c.mileage / Math.max(age, 1));
  const row = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;
  const isEv = c.fuel === "Electric";

  /* ---------- Wazir's take: a summary built from the inspection + price data ---------- */
  function take() {
    const pos = [], warn = [], lph = parseFloat(c.cons);
    if (d.tone === "great" || d.tone === "good") pos.push(`${d.label}: ${money(d.saving)} below our market estimate`);
    else if (d.tone === "high") warn.push(`Priced ${money(-d.saving)} above our market estimate`);   // prices are fixed: no hint of a discount
    if (perYr <= 12000) pos.push(`Low mileage for its age (about ${km(perYr)} a year)`); else if (perYr > 20000) warn.push(`Higher than average mileage (about ${km(perYr)} a year)`);
    if (known(c.service)) pos.push(c.owners === 1 ? `One previous owner with a ${c.service[0].toLowerCase()}${c.service.slice(1)}` : c.service);
    if (known(c.accel) && c.accel <= 5) pos.push(`Seriously quick: 0–100 km/h in ${c.accel}s`);
    if (isEv) pos.push("Zero tailpipe emissions and very low running costs"); else if (c.fuel === "Hybrid") pos.push(`Hybrid economy of ${c.cons}`);
    if (c.seats >= 7) pos.push(`Seats up to ${c.seats} people`);
    if (known(c.inspection)) pos.push(`${c.inspection}/150 inspection checks passed` + (known(c.warranty) ? `, with an AGMC warranty of ${c.warranty}` : ""));
    else if (known(c.warranty)) pos.push(`An AGMC warranty of ${c.warranty}`);
    if (c.owners >= 2) warn.push(`${c.owners} previous owners`);
    if (c.fuel === "Petrol" && lph >= 12) warn.push(`Thirsty at ${c.cons}`);
    if (age >= 6) warn.push(`${age} years old, so ask about wear items like tyres and brakes`);
    if (!warn.length) warn.push("Nothing of concern in the inspection data");
    const best = c.power >= 400 ? "driving enthusiasts who want real performance" : c.seats >= 7 ? "large families and desert trips" : isEv ? "low-cost daily commuting" : c.body === "Hatchback" ? "city driving and first-time buyers" : c.body === "Coupe" ? "weekend driving and fun" : c.body === "SUV" ? "families who want space and a high driving position" : "daily commuting and business use";
    return { pos: pos.slice(0, 5), warn: warn.slice(0, 3), best };
  }
  const t = take();
  const ask = (q) => `About the ${P.name(c)} (${c.id}): ${q}`;

  /* ---------- page ---------- */
  const reserved = P.store.data.reservations.some((r) => r.car_id === c.id && r.status !== "cancelled");
  const others = P.similar(c, 3);

  root.innerHTML = `

    <nav class="crumbs"><a href="cars.html">All cars</a><span>/</span><a href="brand.html?make=${encodeURIComponent(c.make)}">${esc(c.make)}</a><span>/</span>${esc(c.model)}</nav>

    <div class="mosaic car-mosaic">
      <figure class="m-photo big gal" id="gal"><button class="gal-main" id="galMain" type="button" aria-label="Open photo gallery">${P.carImg(c)}</button><figcaption>${[esc(c.colorName), known(c.seats) ? `${c.seats} seats` : "", esc(c.drive)].filter(Boolean).join(" · ")}</figcaption><span class="gal-count" id="galCount" hidden></span><div class="gal-thumbs" id="galThumbs" hidden></div></figure>
      <div class="m-text">
        <div class="cp-head"><span class="kicker">Pre-owned · ${c.id}</span><div class="cp-tools"><button type="button" id="bSave" class="tool" aria-pressed="false"><span class="ic">♡</span><span id="saveTxt">Save</span></button><button type="button" id="bShare" class="tool"><span class="ic">↗</span>Share</button></div></div>
        <h1 class="cp-title">${c.year} ${esc(c.make)}<br><em>${esc(c.model)}</em></h1>
        <div class="cp-price">${money(c.price)}</div>
        <div class="cp-mo">est. ${money(P.monthly(c.price))} / month · 48 months, 20% down</div>
        <dl class="facts"><div><dt>Mileage</dt><dd>${km(c.mileage)}</dd></div><div><dt>Fuel</dt><dd>${c.fuel}</dd></div><div><dt>Power</dt><dd>${nr(c.power, (x) => `${x} hp`)}</dd></div><div><dt>Previous owners</dt><dd>${nr(c.owners)}</dd></div><div><dt>Inspection</dt><dd>${nr(c.inspection, (x) => `${x} / 150`)}</dd></div></dl>
        <div class="cta" id="cta">${reserved ? `<p class="muted"><b>This car is reserved.</b> Ask Wazir for similar cars.</p>` : `<button class="pillbtn dark" id="bTD" type="button"><span>Book a test drive</span><b>→</b></button><button class="pillbtn outline" id="bRes" type="button">Reserve · ${money(C.depositAmount)}</button>`}</div>
        <div id="formArea"></div>
      </div>

    </div>
    <div class="credit" id="credit"></div>

    <section class="ask-row"><span class="kicker">Ask Wazir about this car</span><div class="ask">${[["Is this a good price?", "Is this a good price?"], ["What to check on a test drive", "What should I check on a test drive?"], ["Does it suit a family?", "Does this car suit a family?"], ["Any issues to know about?", "Is there anything I should be careful about with this car?"], ["Compare with similar cars", "Compare it with similar cars."]].map(([l, q]) => `<button class="chipbtn" data-q="${esc(ask(q))}">${l}</button>`).join("")}</div></section>

    <section class="take-card">
      <span class="kicker">What Wazir noticed</span>
      <h2>${esc(P.name(c))}</h2>
      <p class="muted">${age} year${age === 1 ? "" : "s"} old with ${km(c.mileage)} on the clock. ${esc(c.blurb)}</p>
      <div class="take-cols"><div><h4>What stands out</h4><ul>${t.pos.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div><div><h4>Worth knowing</h4><ul class="warn">${t.warn.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div></div>
    </section>

    <div class="sec"><div class="sheet">
      <div class="sheet-head"><h2>Specifications</h2><span>${esc(P.name(c))} · ${c.id}</span></div>
      <div class="acc-list">
        <details class="acc" open><summary>Overview</summary><dl>${row("Make", esc(c.make))}${row("Model", esc(c.model))}${row("Year", c.year)}${row("Body type", c.body)}${row("Condition", "Pre-owned")}${row("Mileage", km(c.mileage))}${row("Exterior colour", nr(c.colorName, esc))}${row("Interior", nr(c.interior, esc))}${row("Regional spec", nr(c.spec, esc))}</dl></details>
        <details class="acc" open><summary>Engine &amp; performance</summary><dl>${row("Engine", nr(c.engine, esc))}${row("Power", nr(c.power, (x) => `${x} hp`))}${row("Torque", nr(c.torque, (x) => `${x} Nm`))}${row("Transmission", nr(c.transmission, esc))}${row("Drivetrain", nr(c.drive, esc))}${row("0–100 km/h", nr(c.accel, (x) => `${x} s`))}${row("Top speed", nr(c.top, (x) => `${x} km/h`))}${row("Fuel type", nr(c.fuel, esc))}${row(isEv ? "Energy use" : "Fuel consumption", nr(c.cons, esc))}</dl></details>
        <details class="acc"><summary>Capacity</summary><dl>${row("Seats", nr(c.seats))}${row("Doors", nr(c.doors))}${row("Boot capacity", nr(c.boot, (x) => `${x} L`))}</dl></details>
        <details class="acc"><summary>History &amp; inspection</summary><dl>${row("Previous owners", nr(c.owners))}${row("Service history", nr(c.service, esc))}${row("Accident history", nr(c.accident, esc))}${row("AGMC inspection", nr(c.inspection, (x) => `${x} / 150 passed`))}${row("AGMC warranty", nr(c.warranty, esc))}${row("Price vs market", `${d.label}`)}</dl></details>
      <details class="acc"><summary>Key features</summary><div class="feat">${(c.features || []).map((f) => `<span>${esc(f)}</span>`).join("") || "<span>Not recorded</span>"}</div></details>
      </div>
    </div></div>

    <section class="similar"><div class="sec-head"><div><span class="kicker">Similar cars</span><h2>You might also like</h2></div></div><div class="grid">${others.map((x) => P.cardHtml(x)).join("")}</div></section>
    ${reserved ? "" : `<div class="stickybar" id="sbar" aria-hidden="true"><div class="sb-in"><div class="sb-car"><b>${esc(P.name(c))}</b><span>${money(c.price)}</span></div><div class="sb-act"><button class="pillbtn light" id="sbTD" type="button"><span>Book a test drive</span><b>→</b></button><button class="pillbtn ghost" id="sbRes" type="button">Reserve · ${money(C.depositAmount)}</button></div></div></div>`}`;

  P.creditsReady.then(() => { $("#credit").innerHTML = P.creditLine(c); });
  root.querySelector(".ask-row .ask").addEventListener("click", (e) => { const b = e.target.closest("[data-q]"); if (b) { Agent.open(); Agent.send(b.dataset.q); } });
  if (!reserved) { $("#bTD").onclick = () => { Agent.open(); Agent.send(`I'd like to book a test drive for the ${P.name(c)} (${c.id}).`); }; $("#bRes").onclick = () => showForm("res"); }
  function showForm(kind) {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const common = `<div class="row"><label>Full name<input name="name" required></label><label>Phone<input name="phone" required placeholder="+971 5…"></label></div>`;
    const td = `<h4>Book a test drive</h4>${common}<div class="row"><label>Date<input name="date" type="date" min="${P.iso(new Date())}" value="${P.iso(tomorrow)}" required></label><label>Time<select name="time"></select></label></div><button class="btn solid block">Confirm test drive</button>`;
    const rs = `<h4>Reserve this car</h4>${common}<label>Payment method<select name="pm"><option value="card">Card (pay deposit now)</option><option value="bank_transfer">Bank transfer</option><option value="cash_at_showroom">Cash at showroom</option></select></label><p class="tiny" style="margin:0">${money(C.depositAmount)} refundable deposit holds the car for 7 days.</p><button class="btn solid block">Reserve ${esc(c.make)} ${esc(c.model)}</button>`;
    $("#formArea").innerHTML = `<form class="m-form">${kind === "td" ? td : rs}</form>`;
    const f = $("#formArea form"), sel = f.time;
    const fillTimes = () => { const free = P.freeSlots(c.id, f.date.value); sel.innerHTML = free.length ? free.map((x) => `<option>${x}</option>`).join("") : "<option value=''>No slots</option>"; };
    if (kind === "td") { fillTimes(); f.date.onchange = fillTimes; }
    f.name.focus();
    f.onsubmit = (e) => {
      e.preventDefault();
      const r = kind === "td" ? P.bookTestDrive({ car_id: c.id, name: f.name.value, phone: f.phone.value, date: f.date.value, time: sel.value }) : P.reserveCar({ car_id: c.id, name: f.name.value, phone: f.phone.value, payment_method: f.pm.value });
      if (!r.ok) return P.toast(r.error);
      const o = r.booking || r.reservation;
      $("#formArea").innerHTML = `<div class="success"><div class="tick">✓</div><h3>${kind === "td" ? "Test drive booked" : "Car reserved"}</h3><p class="muted">Reference <b>${o.ref}</b><br>${kind === "td" ? `${o.date} at ${o.time}<br>${esc(C.location)}` : `Deposit ${money(o.deposit)} · ${o.payment_method.replace(/_/g, " ")}`}</p></div>`;
      if (kind === "res") $("#cta").innerHTML = `<p class="muted"><b>This car is reserved.</b></p>`;
    };
  }

  /* ---------- save + share ---------- */
  const SAVE_KEY = "agmc_saved", getSaved = () => P.safe(() => JSON.parse(localStorage.getItem(SAVE_KEY)), []) || [];
  const paintSave = () => { const on = getSaved().includes(c.id); $("#bSave").setAttribute("aria-pressed", on); $("#bSave .ic").textContent = on ? "♥" : "♡"; $("#saveTxt").textContent = on ? "Saved" : "Save"; };
  $("#bSave").onclick = () => { const l = getSaved(), on = l.includes(c.id), nl = on ? l.filter((x) => x !== c.id) : [...l, c.id]; P.safe(() => localStorage.setItem(SAVE_KEY, JSON.stringify(nl))); paintSave(); P.toast(on ? "Removed from your saved cars" : "Saved to your shortlist"); };
  paintSave();
  $("#bShare").onclick = async () => {
    const url = location.href, data = { title: `${P.name(c)} — AGMC`, text: `${P.name(c)}, ${money(c.price)}`, url };
    if (navigator.share) { try { await navigator.share(data); return; } catch (e) { if (e && e.name === "AbortError") return; } }
    try { await navigator.clipboard.writeText(url); P.toast("Link copied"); } catch (e) { P.toast("Copy the link from the address bar"); }
  };

  /* ---------- photo gallery + lightbox ---------- */
  let imgs = [`img/${c.id}.jpg`], gi = 0;
  const galMain = $("#galMain"), thumbs = $("#galThumbs"), count = $("#galCount");
  function showImg(i) {
    gi = (i + imgs.length) % imgs.length;
    galMain.innerHTML = gi === 0 ? P.carImg(c) : `<img src="${imgs[gi]}" alt="${esc(P.name(c))}, photo ${gi + 1}">`;
    count.textContent = `${gi + 1} / ${imgs.length}`;
    [...thumbs.children].forEach((b, k) => b.classList.toggle("on", k === gi));
  }
  (window.GALLERY ? Promise.resolve(window.GALLERY) : fetch("gallery.json").then((r) => (r.ok ? r.json() : {}))).then((g) => {
    const extra = (g[c.id] || []).map((x) => x.src); if (!extra.length) return;
    imgs = imgs.concat(extra);
    thumbs.innerHTML = imgs.map((s, k) => `<button type="button" data-i="${k}" aria-label="Photo ${k + 1}"><img src="${s}" alt="" loading="lazy"></button>`).join("");
    thumbs.hidden = false; count.hidden = false; showImg(0);
  }).catch(() => {});
  thumbs.addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (b) showImg(+b.dataset.i); });
  const lb = document.createElement("div");
  lb.className = "lightbox"; lb.hidden = true;
  lb.innerHTML = `<button class="lb-x" type="button" aria-label="Close">✕</button><button class="lb-nav prev" type="button" aria-label="Previous photo">←</button><img alt=""><button class="lb-nav next" type="button" aria-label="Next photo">→</button><div class="lb-cap"></div>`;
  document.body.appendChild(lb);
  const lbShow = () => { lb.querySelector("img").src = imgs[gi]; lb.querySelector(".lb-cap").textContent = `${P.name(c)} · ${gi + 1} / ${imgs.length}`; lb.classList.toggle("single", imgs.length < 2); showImg(gi); };
  const lbClose = () => { lb.hidden = true; document.body.classList.remove("noscroll"); };
  galMain.onclick = () => { lb.hidden = false; document.body.classList.add("noscroll"); lbShow(); };
  lb.addEventListener("click", (e) => { if (e.target.closest(".lb-x") || e.target === lb) lbClose(); else if (e.target.closest(".prev")) { showImg(gi - 1); lbShow(); } else if (e.target.closest(".next")) { showImg(gi + 1); lbShow(); } });
  document.addEventListener("keydown", (e) => { if (lb.hidden) return; if (e.key === "Escape") lbClose(); else if (e.key === "ArrowLeft") { showImg(gi - 1); lbShow(); } else if (e.key === "ArrowRight") { showImg(gi + 1); lbShow(); } });

  /* ---------- sticky action bar: appears once the main buttons scroll out of view ---------- */
  const sbar = $("#sbar");
  if (sbar && "IntersectionObserver" in window) {
    new IntersectionObserver(([en]) => { const show = !en.isIntersecting && en.boundingClientRect.top < 0; sbar.classList.toggle("on", show); document.body.classList.toggle("sbar-on", show); sbar.setAttribute("aria-hidden", String(!show)); }, { threshold: 0 }).observe($("#cta"));
    $("#sbTD").onclick = () => $("#bTD").click();
    $("#sbRes").onclick = () => { window.scrollTo({ top: 0, behavior: "smooth" }); $("#bRes").click(); };
  }
})();
