/* AGMC core: data helpers, bookings, shared page chrome (header, footer, drawers, style studio). Exposes window.Portal. */
(function () {
  const C = CONFIG, CARS = window.CARS;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => `${C.currency} ${Math.round(n).toLocaleString("en-US")}`;
  const km = (n) => `${Math.round(n).toLocaleString("en-US")} km`;
  const safe = (fn, d) => { try { return fn(); } catch { return d; } };
  const name = (c) => `${c.year} ${c.make} ${c.model}`;
  // a fact the stock list does not record is null (the stock API): shown as "Not recorded", never as "null" or a guess
  const known = (v) => v !== null && v !== undefined && v !== "";
  const nr = (v, fmt = (x) => x) => (known(v) ? fmt(v) : "Not recorded");
  const carHref = (id) => `car.html?id=${encodeURIComponent(id)}`;
  const brandHref = (m) => `brand.html?make=${encodeURIComponent(m)}`;
  // official logo: drop img/logo.svg (or logo.png) into site/img and it is used everywhere; falls back to the AGMC wordmark
  const logoHtml = () => `<img class="logo-img" src="img/logo.svg" alt="${esc(C.brand)}" onerror="if(!this.dataset.t){this.dataset.t=1;this.src='img/logo.png'}else{var s=document.createElement('span');s.className='logo-name';s.textContent='${esc(C.brand)}';this.replaceWith(s)}">`;
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  /* ---------- persistence (this browser only) ---------- */
  const store = {
    data: Object.assign({ bookings: [], reservations: [], enquiries: [] }, safe(() => JSON.parse(localStorage.getItem("agmc_store")), null)),
    save() { safe(() => localStorage.setItem("agmc_store", JSON.stringify(this.data))); renderActivityCount(); },
  };
  const ref = (p) => p + "-" + Math.random().toString(36).slice(2, 7).toUpperCase();

  /* ---------- photo credits (CC BY-SA photos need attribution) ---------- */
  let CREDITS = {};
  const creditsReady = fetch("credits.json").then((r) => r.json()).then((j) => { CREDITS = j; }).catch(() => {});
  const lnk = (u, t) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`;
  const creditLine = (c) => { const k = C.showPhotoCredits ? CREDITS[c.id] : null; return k ? `Photo: ${esc(k.author)} · ${lnk(k.licence_url, k.licence)} · ${lnk(k.page, "Wikimedia Commons")}` : ""; };

  /* ---------- money / pricing ---------- */
  function monthly(price, { down = 20, months = 48, apr = C.defaultApr } = {}) {
    const principal = price * (1 - down / 100), r = apr / 1200;
    return Math.round(r ? (principal * r) / (1 - Math.pow(1 + r, -months)) : principal / months);
  }
  function deal(c) {
    if (!known(c.market) || !c.market) return { label: "No price rating", tone: "none", pct: 0, saving: 0 };   // no market estimate recorded
    const pct = ((c.market - c.price) / c.market) * 100;
    const d = pct >= 6 ? ["Great price", "great"] : pct >= 3 ? ["Good price", "good"] : pct >= 0 ? ["Fair price", "fair"] : ["Above market", "high"];
    return { label: d[0], tone: d[1], pct: Math.round(pct * 10) / 10, saving: c.market - c.price };
  }

  /* ---------- dates / test-drive slots ---------- */
  function normDate(v) {
    if (!v) return null; const s = String(v).trim().toLowerCase(); const now = new Date();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (s === "today") return iso(now);
    if (s === "tomorrow") { now.setDate(now.getDate() + 1); return iso(now); }
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const w = days.findIndex((d) => s.includes(d.slice(0, 3)));
    if (w >= 0) { const add = (w - now.getDay() + 7) % 7 || 7; now.setDate(now.getDate() + add); return iso(now); }
    const p = new Date(s); return isNaN(p) ? null : iso(p);
  }
  function normTime(v) {
    if (v == null) return null; const m = String(v).trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (!m) return null; let h = +m[1]; if (m[3] === "pm" && h < 12) h += 12; if (m[3] === "am" && h === 12) h = 0;
    return `${pad(h)}:00`;
  }
  const allSlots = () => Array.from({ length: C.hours.close - C.hours.open }, (_, i) => `${pad(C.hours.open + i)}:00`);
  const takenSlots = (carId, date) => store.data.bookings.filter((b) => b.car_id === carId && b.date === date).map((b) => b.time);
  const freeSlots = (carId, date) => allSlots().filter((t) => !takenSlots(carId, date).includes(t) && !(date === iso(new Date()) && +t.slice(0, 2) <= new Date().getHours()));

  /* ---------- inventory helpers ---------- */
  const carById = (id) => { id = String(id || "").toUpperCase().trim(); return CARS.find((c) => c.id === id) || (/^\d{3}$/.test(id) ? CARS.find((c) => c.id === "AG-" + id) : null) || (/\d{3}/.test(id) ? CARS.find((c) => c.id.endsWith(id.match(/\d{3}/)[0])) : null); };
  const isReserved = (id) => store.data.reservations.some((r) => r.car_id === id && r.status !== "cancelled") || CARS.some((c) => c.id === id && c.status === "reserved");
  const brief = (c) => ({ id: c.id, name: name(c), price: c.price, price_rating: deal(c).label, mileage_km: c.mileage, body: c.body, fuel: c.fuel, seats: c.seats, power_hp: c.power, colour: c.colorName, ...(isReserved(c.id) ? { status: "reserved" } : {}) });
  const full = (c) => ({ ...brief(c), make: c.make, model: c.model, year: c.year, engine: c.engine, torque_nm: c.torque, drivetrain: c.drive, transmission: c.transmission, acceleration_0_100_s: c.accel, top_speed_kmh: c.top, consumption: c.cons, boot_litres: c.boot, doors: c.doors, interior: c.interior, previous_owners: c.owners, regional_spec: c.spec, service_history: c.service, accident_history: c.accident, warranty: c.warranty, inspection: known(c.inspection) ? `${c.inspection}/150 checks passed` : null, market_price_estimate: c.market, features: c.features, description: c.blurb });

  function filterCars(f = {}) {
    const t = (f.text || f.model || "").toLowerCase().trim(), body = f.body ? String(f.body).toLowerCase() : "", make = f.make ? String(f.make).toLowerCase() : "";
    let r = CARS.filter((c) => {
      if (t && !`${c.make} ${c.model} ${c.body} ${c.fuel} ${c.colorName}`.toLowerCase().includes(t)) return false;
      if (make && !c.make.toLowerCase().includes(make)) return false;
      if (body && c.body.toLowerCase() !== body) return false;
      if (f.fuel && c.fuel.toLowerCase() !== String(f.fuel).toLowerCase()) return false;
      if (f.max_price && c.price > +f.max_price) return false;
      if (f.min_price && c.price < +f.min_price) return false;
      if (f.min_seats && c.seats < +f.min_seats) return false;
      if (f.max_mileage && c.mileage > +f.max_mileage) return false;
      if (f.min_year && c.year < +f.min_year) return false;
      if (f.min_power && c.power < +f.min_power) return false;
      return true;
    });
    const s = f.sort || "featured";
    if (s === "price-asc") r.sort((a, b) => a.price - b.price);
    else if (s === "price-desc") r.sort((a, b) => b.price - a.price);
    else if (s === "mileage") r.sort((a, b) => a.mileage - b.mileage);
    else if (s === "year") r.sort((a, b) => b.year - a.year || a.mileage - b.mileage);
    else if (s === "deal") r.sort((a, b) => deal(b).pct - deal(a).pct);
    return r;
  }
  function similar(c, n = 3) {
    return CARS.filter((x) => x.id !== c.id).map((x) => ({ x, d: (x.body === c.body ? 0 : 1.2) + Math.abs(x.price - c.price) / c.price + (x.make === c.make ? -0.15 : 0) + (x.fuel === c.fuel ? 0 : 0.2) })).sort((a, b) => a.d - b.d).slice(0, n).map((o) => o.x);
  }

  /* ---------- photos + cards ---------- */
  const photoSrc = (c) => `img/${c.id}.jpg`;
  function carImg(c, cls = "") {
    return `<div class="photo ${cls}" role="img" aria-label="${esc(name(c))}">
      <div class="ph"><span class="ph-brand">${esc(c.make)}</span><span class="ph-series">${esc(c.model)}</span></div>
      <img src="${photoSrc(c)}" alt="${esc(name(c))}" decoding="async" onerror="this.remove()"></div>`;
  }
  function cardHtml(c, opts = {}) {
    const d = deal(c), res = isReserved(c.id);
    return `<a class="car" href="${carHref(c.id)}" data-id="${c.id}">
      <div class="car-img">${carImg(c)}<span class="chip deal ${d.tone}"><i></i>${d.label}</span>${opts.score ? `<span class="chip match">✦ ${opts.score}% match</span>` : ""}${res ? `<span class="chip res">Reserved</span>` : ""}</div>
      <div class="car-top"><span class="make">${esc(c.make)} · ${c.year}</span><h3>${esc(c.model)}</h3></div>
      <div class="car-foot"><div class="price">${money(c.price)}</div><span class="go">View →</span></div></a>`;
  }
  /* ---------- actions (shared by pages + Wazir) ---------- */
  function bookTestDrive({ car_id, name: cust, phone, date, time }) {
    const c = carById(car_id); if (!c) return { ok: false, error: "Unknown car_id. Search first." };
    if (isReserved(c.id)) return { ok: false, error: "That car is already reserved." };
    if (!cust || !phone) return { ok: false, error: "Need the customer's name and phone number." };
    const d = normDate(date); if (!d) return { ok: false, error: "Date missing or invalid. Ask for a date (YYYY-MM-DD)." };
    if (d < iso(new Date())) return { ok: false, error: "That date is in the past." };
    const t = normTime(time), free = freeSlots(c.id, d);
    if (!t) return { ok: false, error: "Time missing. Ask the customer to choose one.", available_slots: free };
    if (!free.includes(t)) return { ok: false, error: `${t} is not available on ${d}.`, available_slots: free };
    const b = { ref: ref("TD"), car_id: c.id, car: name(c), name: cust, phone, date: d, time: t, created: Date.now() };
    store.data.bookings.push(b); store.save();
    return { ok: true, booking: b, location: C.location, note: "Please bring a valid driving licence." };
  }
  function reserveCar({ car_id, name: cust, phone, payment_method }) {
    const c = carById(car_id); if (!c) return { ok: false, error: "Unknown car_id." };
    if (isReserved(c.id)) return { ok: false, error: "That car is already reserved by someone else." };
    if (!cust || !phone) return { ok: false, error: "Need name and phone number." };
    const pm = ["card", "bank_transfer", "cash_at_showroom"].includes(payment_method) ? payment_method : "card";
    const r = { ref: ref("RS"), car_id: c.id, car: name(c), price: c.price, deposit: C.depositAmount, name: cust, phone, payment_method: pm, status: "confirmed", created: Date.now() };
    store.data.reservations.push(r); store.save(); window.dispatchEvent(new Event("agmc:changed"));
    return { ok: true, reservation: r, note: `${money(C.depositAmount)} refundable deposit holds the car for 7 days. Balance ${money(c.price - C.depositAmount)} due at handover.` };
  }
  function requestSourcing({ name: cust, phone, request }) {
    if (!cust || !phone || !request) return { ok: false, error: "Need name, phone and what car they are looking for." };
    const e = { ref: ref("EQ"), name: cust, phone, request, created: Date.now() }; store.data.enquiries.push(e); store.save();
    return { ok: true, enquiry: e, note: "A specialist will call within one business day." };
  }
  function cancelItem(kind, refId) {
    const list = store.data[kind]; if (!list) return { ok: false, error: "Reference not found." };
    const i = list.findIndex((x) => x.ref === refId); if (i < 0) return { ok: false, error: "Reference not found." };
    if (kind === "bookings") list.splice(i, 1); else list[i].status = "cancelled";
    store.save(); renderDrawer(); window.dispatchEvent(new Event("agmc:changed")); return { ok: true, cancelled: refId };
  }

  /* ---------- toast ---------- */
  let tt; function toast(msg) { const t = $("#toast"); if (!t) return; t.textContent = msg; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => (t.hidden = true), 3200); }

  /* ---------- shared page chrome ---------- */
  const SPARK = `<svg class="spark-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" fill="currentColor"/></svg>`;
  const SOC = {
    linkedin: '<svg viewBox="0 0 24 24"><rect x="3" y="9" width="4" height="12"/><circle cx="5" cy="5" r="2.2"/><path d="M10 9h3.8v1.7c.6-1.1 1.9-2 3.7-2 3.3 0 4 2.1 4 5V21h-4v-6c0-1.4-.1-2.7-1.7-2.7S14 13.6 14 15v6h-4z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.2"/></svg>',
    facebook: '<svg viewBox="0 0 24 24"><path d="M14 8h3V4h-3c-2.2 0-4 1.8-4 4v2H7v4h3v6h4v-6h3l1-4h-4V8z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24"><rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 9.2v5.6l5-2.8z"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M5 4l14 16M19 4L5 20" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>',
  };
  function footerHtml() {
    const brands = [...new Set(CARS.map((c) => c.make))].map((m) => ({ m, n: CARS.filter((c) => c.make === m).length })).sort((a, b) => b.n - a.n || a.m.localeCompare(b.m)).slice(0, 8).map((b) => b.m), ct = C.contact || {}, apps = C.apps || {};
    return `<footer class="footer"><div class="wrap">
      <div class="foot-cta"><div><h3>Not sure which car is right for you?</h3><p>Tell ${esc(C.advisor)} what you need. It shortlists, explains and books your test drive.</p></div><button class="btn solid" id="footAsk">Ask ${esc(C.advisor)} →</button></div>
      <div class="foot-grid">
        <div><div class="logo">${logoHtml()}</div>
          <div class="contact" style="margin-top:20px"><a href="${esc(ct.phoneHref || "#")}"><i>CALL</i>${esc(ct.phone || "")}</a><a href="${esc(ct.whatsappHref || "#")}" target="_blank" rel="noopener"><i>WHATSAPP</i>${esc(ct.whatsapp || "")}</a><a href="mailto:${esc(ct.email || "")}"><i>EMAIL</i>${esc(ct.email || "")}</a></div>
          <div class="apps"><span class="apps-l">Get the app</span><a class="appbtn" href="${esc(apps.ios || "#")}" target="_blank" rel="noopener"><span><small>Download on the</small>App Store</span></a><a class="appbtn" href="${esc(apps.android || "#")}" target="_blank" rel="noopener"><span><small>Get it on</small>Google Play</span></a></div>
          <div class="social">${Object.entries(C.social || {}).map(([k, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener" aria-label="${k}">${SOC[k] || ""}</a>`).join("")}</div></div>
        <div><h4>Brands</h4><ul class="foot-list brands-list">${brands.map((m) => `<li><a href="${brandHref(m)}">${esc(m)}</a></li>`).join("")}<li><a href="brand.html">All brands →</a></li></ul></div>
        <div class="about"><h4>About us</h4><p>${esc(C.brand)} is a Dubai pre-owned car dealership. Every car is 150-point inspected, backed by an AGMC warranty and a 7-day return guarantee, and priced against the market.</p><p>Our AI advisor, ${esc(C.advisor)}, helps you find, compare and book a test drive in one conversation, and our team is on hand at the showroom.</p></div>
        <div><h4>Visit us</h4><div class="loc">${(C.locations || []).map((l) => `<div><b>${esc(l.name)}</b><span>${esc(l.addr)}<br>${esc(l.hours)}</span></div>`).join("")}</div><p style="margin-top:16px"><a href="${esc(C.allLocationsUrl || "#")}" target="_blank" rel="noopener">View all locations →</a></p></div>
      </div>
      <div class="foot-bar"><span>© 2026 ${esc(C.brand)}. Demonstration portal: inventory, prices and bookings are sample data.</span><span><a href="#">Terms</a><a href="#">Privacy</a><a href="#top">Back to top</a>${C.showPhotoCredits ? `<a href="#" class="link" id="btnCredits">Photo credits</a>` : ""}</span></div>
    </div></footer>`;
  }  function mountChrome() {
    document.body.insertAdjacentHTML("afterbegin", `
    <header class="topbar"><div class="wrap bar">
      <a class="logo" href="index.html" aria-label="${esc(C.brand)} home">${logoHtml()}</a>
      <nav class="nav"><a href="cars.html">Cars</a><a href="brand.html">Brands</a></nav>
      <div class="bar-actions">
        
        <button class="tbtn" id="btnLang" data-noi18n aria-label="Language">${window.I18N && I18N.lang === "ar" ? "EN" : "عربي"}</button>
        <button class="tbtn" id="btnStyle">Style</button>
        <button class="btn solid sm" id="btnAsk">${SPARK} Ask ${esc(C.advisor)}</button>
      </div></div></header>`);
    document.body.insertAdjacentHTML("beforeend", `
    ${footerHtml()}
    <div class="overlay" id="modalOverlay" hidden><div class="modal" id="modal" role="dialog" aria-modal="true"></div></div>
    <aside class="drawer" id="drawer" hidden><div class="drawer-head"><h3>My activity</h3><button class="x" data-close="drawer" aria-label="Close">×</button></div><div id="drawerBody"></div></aside>
    <aside class="stylepanel" id="stylePanel" hidden data-noi18n>
      <div class="drawer-head"><h3>Style studio</h3><button class="x" data-close="stylePanel" aria-label="Close">×</button></div>
      <div class="sp-body">${document.body.dataset.page === "home" ? `<h4>Hero photo</h4><p class="tiny" style="margin:0 0 12px">Try any image behind the headline. It stays in this browser only.</p><div class="heroph"><label class="filebtn">Choose photo…<input type="file" id="spPhoto" accept="image/*" hidden></label><button type="button" class="tbtn dark" id="spPhotoReset">Reset</button><a class="tbtn dark" id="spPhotoDl" download="hero.jpg" hidden>Download hero.jpg</a></div><label class="range">Overlay darkness <input type="range" id="spShade" min="0" max="100" value="100"></label><h4 style="margin-top:22px">Or try one of these</h4><div class="hopts" id="spHeroOpts"></div><h4>Wazir chat preview in hero</h4><div class="seg" id="spHeroChat"></div>` : ""}<h4>Colour palette</h4><div class="pals" id="spPal"></div><h4>Custom colours</h4><div class="c2"><label><input type="color" id="spC1"><span>Beige<br><small>colour 1</small></span></label><label><input type="color" id="spC2"><span>Accent<br><small>colour 2</small></span></label></div><h4>Page theme</h4><div class="seg" id="spMode"></div>
        <h4>Corners</h4><div class="seg" id="spRadius"></div><h4>Typography</h4><div class="seg" id="spFont"></div>
        <button class="tbtn dark" id="spReset">Reset to default</button></div>
    </aside>
    <div class="toast" id="toast" hidden></div>`);

    
    $("#btnLang").onclick = () => I18N.set(I18N.lang === "ar" ? "en" : "ar");
    $("#btnStyle").onclick = () => { $("#drawer").hidden = true; $("#stylePanel").hidden = !$("#stylePanel").hidden; };
    if ($("#btnCredits")) $("#btnCredits").onclick = openCredits;
    $("#drawerBody").addEventListener("click", (e) => { const b = e.target.closest("[data-cancel]"); if (b) { cancelItem(b.dataset.cancel, b.dataset.ref); toast("Cancelled"); } });
    document.addEventListener("click", (e) => { const cl = e.target.dataset.close; if (cl === "modal") closeModal(); else if (cl) $("#" + cl).hidden = true; if (e.target.id === "modalOverlay") closeModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeModal(); ["drawer", "stylePanel"].forEach((i) => ($("#" + i).hidden = true)); } });
    renderActivityCount(); applyStyle();
    loadHeroOpts(); const onScroll = () => document.body.classList.toggle("scrolled", window.scrollY > 90); window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  }
  const closeModal = () => { $("#modalOverlay").hidden = true; };
  function openCredits() {
    creditsReady.then(() => {
      $("#modal").innerHTML = `<button class="x" data-close="modal" aria-label="Close">×</button><div class="modal-pad"><h2>Photo credits</h2><p class="muted" style="font-size:.88rem">Vehicle photographs are free-licence images from Wikimedia Commons, used under the licences shown. They are illustrative and may not match the exact vehicle listed.</p>` +
        CARS.filter((c) => CREDITS[c.id]).map((c) => { const k = CREDITS[c.id]; return `<div class="act"><b>${esc(name(c))}</b>${esc(k.author)} · ${lnk(k.licence_url, k.licence)} · ${lnk(k.page, "source")}</div>`; }).join("") + `</div>`;
      $("#modalOverlay").hidden = false;
    });
  }
  function renderActivityCount() { const d = store.data, n = d.bookings.length + d.reservations.filter((r) => r.status !== "cancelled").length + d.enquiries.length; const el = $("#activityCount"); if (el) { el.hidden = !n; el.textContent = n; } }
  function renderDrawer() {
    const d = store.data, live = d.reservations.filter((r) => r.status !== "cancelled");
    $("#drawerBody").innerHTML = d.bookings.length + live.length + d.enquiries.length === 0 ? `<p class="muted">Nothing yet. Book a test drive or reserve a car — or just ask ${esc(C.advisor)}.</p>` :
      [...d.bookings.map((b) => `<div class="act"><span class="ref">TEST DRIVE · ${b.ref}</span><b><a href="${carHref(b.car_id)}">${esc(b.car)}</a></b>${b.date} at ${b.time}<br><span class="muted">${esc(b.name)} · ${esc(b.phone)}</span><br><button class="link cancel" data-cancel="bookings" data-ref="${b.ref}">Cancel booking</button></div>`),
        ...live.map((r) => `<div class="act"><span class="ref">RESERVATION · ${r.ref}</span><b><a href="${carHref(r.car_id)}">${esc(r.car)}</a></b>${money(r.price)} · deposit ${money(r.deposit)}<br><span class="muted">${esc(r.name)} · ${r.payment_method.replace(/_/g, " ")}</span><br><button class="link cancel" data-cancel="reservations" data-ref="${r.ref}">Cancel reservation</button></div>`),
        ...d.enquiries.map((q) => `<div class="act"><span class="ref">SOURCING REQUEST · ${q.ref}</span><b>${esc(q.request)}</b><span class="muted">${esc(q.name)} · ${esc(q.phone)}</span></div>`)].join("");
  }

  /* ---------- style studio: two-colour palettes (beige + one deep accent) ---------- */
  const STYLE_KEY = "agmc_style_v7", DEF = { sand: "#ffffff", accent: "#000000", mode: "light", radius: "soft", font: "luxe", shade: 100, heroChat: "off" };
  let S = { ...DEF, ...(safe(() => JSON.parse(localStorage.getItem(STYLE_KEY)), {}) || {}) };
  const PALETTES = [   // [name, colour 1 = beige base, colour 2 = deep accent]
    ["Black & White", "#ffffff", "#000000"], ["Sand & Ink", "#e9e3d6", "#111111"], ["Sand & Navy", "#e6dac4", "#1a2b4c"], ["Sand & Burgundy", "#e8dccb", "#6d1a2c"], ["Sand & Espresso", "#e4d6c0", "#3b2a20"],
    ["Cream & Cobalt", "#efe6d2", "#1d3fae"], ["Sand & Terracotta", "#eadcc6", "#b4492d"], ["Stone & Charcoal", "#e3ddd2", "#1f2024"],
  ];
  const OPTS = { spHeroChat: ["heroChat", [["on", "Show"], ["off", "Hide"]]], spMode: ["mode", [["light", "Light"], ["dark", "Dark"]]], spRadius: ["radius", [["sharp", "Sharp"], ["soft", "Soft"], ["round", "Round"]]], spFont: ["font", [["luxe", "Luxe"], ["modern", "Modern"], ["editorial", "Editorial"]]] };
  const persistStyle = () => safe(() => localStorage.setItem(STYLE_KEY, JSON.stringify(S)));
  const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
  function tint(hex) {   // brighter, more saturated version of the accent, used for glows and highlights on dark surfaces
    const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let h = 0, s = 0, l = (mx + mn) / 2; const d = mx - mn;
    if (d) { s = d / (1 - Math.abs(2 * l - 1)); h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
    s = s < 0.15 ? s : Math.max(s, 0.68); l = Math.max(l, 0.64);
    return `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
  }
  function paint() {
    const r = document.documentElement, t = tint(S.accent);
    r.style.setProperty("--shade", (S.shade ?? 100) / 100); r.style.setProperty("--sand", S.sand); r.style.setProperty("--accent", S.accent); r.style.setProperty("--ai", t);
    const cv = document.createElement("canvas").getContext("2d"); cv.fillStyle = t; const hex = cv.fillStyle;   // normalise hsl() -> #rrggbb
    r.style.setProperty("--hi-ink", /^#/.test(hex) && lum(hex) > 0.6 ? "#0a0d14" : "#ffffff");
  }
  function applyStyle() {
    const r = document.documentElement; paint(); r.dataset.mode = S.mode; r.dataset.radius = S.radius; r.dataset.font = S.font; r.dataset.herochat = S.heroChat || "on"; r.dataset.pal = S.sand.toLowerCase() === "#ffffff" && S.accent.toLowerCase() === "#000000" ? "mono" : "";
    if ($("#spShade")) $("#spShade").value = S.shade ?? 100; { const dl = $("#spPhotoDl"), saved = safe(() => localStorage.getItem("agmc_hero_photo"), null); if (dl && saved) { dl.href = saved; dl.hidden = false; } }
    if (!$("#spPal")) return;
    $("#spPal").innerHTML = PALETTES.map(([n, a, b]) => `<button class="pal ${a.toLowerCase() === S.sand.toLowerCase() && b.toLowerCase() === S.accent.toLowerCase() ? "on" : ""}" data-pa="${a}" data-ph="${b}" title="${n}"><span style="background:${a}"></span><span style="background:${b}"></span><em>${n}</em></button>`).join("");
    $("#spC1").value = S.sand; $("#spC2").value = S.accent;
    for (const [id, [key, opts]] of Object.entries(OPTS)) if ($("#" + id)) $("#" + id).innerHTML = opts.map(([v, l]) => `<button class="${S[key] === v ? "on" : ""}" data-k="${key}" data-v="${v}">${l}</button>`).join("");
    persistStyle();
  }
  document.addEventListener("click", (e) => { const p = e.target.closest("#stylePanel"); if (!p) return; const pal = e.target.closest("[data-pa]"), b = e.target.closest("[data-k]"); if (pal) { S.sand = pal.dataset.pa; S.accent = pal.dataset.ph; } else if (b) S[b.dataset.k] = b.dataset.v; else if (e.target.id === "spReset") S = { ...DEF }; else return; applyStyle(); });
  document.addEventListener("input", (e) => { if (e.target.id === "spC1" || e.target.id === "spC2") { S[e.target.id === "spC1" ? "sand" : "accent"] = e.target.value; paint(); persistStyle(); const on = $("#spPal .on"); if (on) on.classList.remove("on"); } });
  /* hero photo playground: pick an image, it is downscaled and kept in this browser (home page only) */
  const HERO_KEY = "agmc_hero_photo";
  function useHeroPhoto(url) { window.dispatchEvent(new CustomEvent("agmc:heroPhoto", { detail: url })); const dl = $("#spPhotoDl"); if (dl) { dl.hidden = !url; if (url) dl.href = url; } }
  document.addEventListener("change", (e) => {
    if (e.target.id !== "spPhoto" || !e.target.files[0]) return;
    const url = URL.createObjectURL(e.target.files[0]), img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1920 / img.naturalWidth), cv = document.createElement("canvas"); cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
      const data = cv.toDataURL("image/jpeg", 0.86); safe(() => localStorage.setItem(HERO_KEY, data)); useHeroPhoto(data); toast("Hero photo updated");
    };
    img.onerror = () => toast("That file couldn't be read as an image"); img.src = url; e.target.value = "";
  });
  function loadHeroOpts() {
    const box = $("#spHeroOpts"); if (!box) return; let list = [];
    const draw = () => { const cur = safe(() => localStorage.getItem(HERO_KEY), null); box.innerHTML = list.map((o) => `<button type="button" class="${cur === o.file ? "on" : ""}" data-hp="${esc(o.file)}" title="${esc(o.label)}" style="background-image:url('${esc(o.file)}')"><span>${esc(o.label)}</span></button>`).join(""); };
    fetch("img/hero-options/options.json").then((r) => r.json()).then((j) => { list = j; draw(); window.addEventListener("agmc:heroPhoto", draw); }).catch(() => {});
    box.addEventListener("click", (e) => { const b = e.target.closest("[data-hp]"); if (!b) return; safe(() => localStorage.setItem(HERO_KEY, b.dataset.hp)); useHeroPhoto(b.dataset.hp); });
  }
  document.addEventListener("click", (e) => { if (e.target.id === "spPhotoReset") { safe(() => localStorage.removeItem(HERO_KEY)); useHeroPhoto(null); toast("Back to the original photo"); } });
  document.addEventListener("input", (e) => { if (e.target.id === "spShade") { S.shade = +e.target.value; paint(); persistStyle(); } });
  applyStyle(); // apply the saved theme immediately (before the chrome exists) to avoid a flash
  window.Portal = {
    $, $$, esc, money, km, name, known, nr, carHref, safe, iso, store, monthly, deal, normDate, freeSlots, carById, brief, full, filterCars, similar,
    carImg, cardHtml, creditLine, brandHref, creditsReady, bookTestDrive, reserveCar, requestSourcing, cancelItem, toast, SPARK, renderDrawer, closeModal,
    openActivity: () => { renderDrawer(); $("#drawer").hidden = false; },
    // page hooks — the home page overrides these so Wazir can drive the inventory grid
    setFilters() {}, clearFilters() {}, flash() {},
  };
  mountChrome();
})();
