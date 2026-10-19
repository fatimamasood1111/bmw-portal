/* Car page: full specifications, price insight, Wazir's take, booking + reservation. URL: car.html?id=AG-101 */
(function () {
  const P = Portal, { $, esc, money, km } = P, C = CONFIG, CARS = window.CARS;
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
    else if (d.tone === "high") warn.push(`Priced ${money(-d.saving)} above our market estimate, so there may be room to negotiate`);
    if (perYr <= 12000) pos.push(`Low mileage for its age (about ${km(perYr)} a year)`); else if (perYr > 20000) warn.push(`Higher than average mileage (about ${km(perYr)} a year)`);
    pos.push(c.owners === 1 ? "One previous owner with a full dealer service history" : "Full service history");
    if (c.accel <= 5) pos.push(`Seriously quick: 0–100 km/h in ${c.accel}s`);
    if (isEv) pos.push("Zero tailpipe emissions and very low running costs"); else if (c.fuel === "Hybrid") pos.push(`Hybrid economy of ${c.cons}`);
    if (c.seats >= 7) pos.push(`Seats up to ${c.seats} people`);
    pos.push(`${c.inspection}/150 inspection checks passed, with an AGMC warranty of ${c.warranty}`);
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
      <div class="m-text">
        <span class="kicker">Pre-owned · ${c.id}</span>
        <h1 class="cp-title">${c.year} ${esc(c.make)}<br><em>${esc(c.model)}</em></h1>
        <div class="cp-price">${money(c.price)}</div>
        <div class="cp-mo">est. ${money(P.monthly(c.price))} / month · 48 months, 20% down</div>
        <dl class="facts"><div><dt>Mileage</dt><dd>${km(c.mileage)}</dd></div><div><dt>Fuel</dt><dd>${c.fuel}</dd></div><div><dt>Power</dt><dd>${c.power} hp</dd></div><div><dt>Previous owners</dt><dd>${c.owners}</dd></div><div><dt>Inspection</dt><dd>${c.inspection} / 150</dd></div></dl>
        <div class="cta" id="cta">${reserved ? `<p class="muted"><b>This car is reserved.</b> Ask Wazir for similar cars.</p>` : `<button class="pillbtn dark" id="bTD" type="button"><span>Book a test drive</span><b>→</b></button><button class="pillbtn outline" id="bRes" type="button">Reserve · ${money(C.depositAmount)}</button>`}</div>
        <div id="formArea"></div>
      </div>
      <figure class="m-photo big">${P.carImg(c)}<figcaption>${esc(c.colorName)} · ${c.seats} seats · ${esc(c.drive)}</figcaption></figure>
    </div>
    <div class="credit" id="credit"></div>

    <section class="take-card">
      <span class="kicker">What Wazir noticed</span>
      <h2>${esc(P.name(c))}</h2>
      <p class="muted">${age} year${age === 1 ? "" : "s"} old with ${km(c.mileage)} on the clock. ${esc(c.blurb)}</p>
      <div class="take-cols"><div><h4>What stands out</h4><ul>${t.pos.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div><div><h4>Worth knowing</h4><ul class="warn">${t.warn.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div></div>
      <div class="ask"><button class="chipbtn" data-q="${esc(ask("Is this a good price?"))}">Is this a good price?</button><button class="chipbtn" data-q="${esc(ask("What should I check on a test drive?"))}">What to check on a test drive</button><button class="chipbtn" data-q="${esc(ask("Compare it with similar cars."))}">Compare with similar cars</button></div>
    </section>

    <div class="sec"><div class="sheet">
      <div class="sheet-head"><h2>Specifications</h2><span>${esc(P.name(c))} · ${c.id}</span></div>
      <div class="sheet-grid">
        <div class="sheet-sec"><h3>Overview</h3><dl>${row("Make", esc(c.make))}${row("Model", esc(c.model))}${row("Year", c.year)}${row("Body type", c.body)}${row("Condition", "Pre-owned")}${row("Mileage", km(c.mileage))}${row("Exterior colour", esc(c.colorName))}${row("Interior", esc(c.interior))}${row("Regional spec", esc(c.spec))}</dl></div>
        <div class="sheet-sec"><h3>Engine &amp; performance</h3><dl>${row("Engine", esc(c.engine))}${row("Power", `${c.power} hp`)}${row("Torque", `${c.torque} Nm`)}${row("Transmission", c.transmission)}${row("Drivetrain", c.drive)}${row("0–100 km/h", `${c.accel} s`)}${row("Top speed", `${c.top} km/h`)}${row("Fuel type", c.fuel)}${row(isEv ? "Energy use" : "Fuel consumption", esc(c.cons))}</dl></div>
        <div class="sheet-sec"><h3>Capacity</h3><dl>${row("Seats", c.seats)}${row("Doors", c.doors)}${row("Boot capacity", `${c.boot} L`)}</dl></div>
        <div class="sheet-sec"><h3>History &amp; inspection</h3><dl>${row("Previous owners", c.owners)}${row("Service history", esc(c.service))}${row("Accident history", esc(c.accident))}${row("AGMC inspection", `${c.inspection} / 150 passed`)}${row("AGMC warranty", esc(c.warranty))}${row("Price vs market", `${d.label}`)}</dl></div>
      </div>
      <div class="sheet-feat"><h3>Key features</h3><div class="feat">${c.features.map((f) => `<span>${esc(f)}</span>`).join("")}</div></div>
    </div></div>

    <section class="similar"><div class="sec-head"><div><span class="kicker">Similar cars</span><h2>You might also like</h2></div></div><div class="grid">${others.map((x) => P.cardHtml(x)).join("")}</div></section>`;

  P.creditsReady.then(() => { $("#credit").innerHTML = P.creditLine(c); });
  root.querySelector(".take-card .ask").addEventListener("click", (e) => { const b = e.target.closest("[data-q]"); if (b) { Agent.open(); Agent.send(b.dataset.q); } });
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
})();
