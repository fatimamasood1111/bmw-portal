/* Wazir — AI car advisor. Talks to local Ollama (via the /ollama proxy) and controls the portal through tools.
   The conversation is kept in sessionStorage so it survives page changes (home <-> car pages). */
const Agent = (function () {
  const P = Portal, C = CONFIG, $ = P.$, esc = P.esc, money = P.money;
  const MODEL_KEY = "agmc_model", SKEY = "agmc_chat";
  let model = P.safe(() => localStorage.getItem(MODEL_KEY), null) || C.model;
  let state = P.safe(() => JSON.parse(sessionStorage.getItem(SKEY)), null) || { history: [], log: [], open: false, wide: false };
  let busy = false, shownIds = [], lastUser = "";
  const save = () => P.safe(() => sessionStorage.setItem(SKEY, JSON.stringify(state)));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pageCar = () => (window.PageContext && P.carById(window.PageContext.carId)) || null;

  /* ---------- tools the model can call ---------- */
  const str = (d) => ({ type: "string", description: d }), num = (d) => ({ type: "number", description: d });
  const tool = (name, description, properties, required = []) => ({ type: "function", function: { name, description, parameters: { type: "object", properties, required } } });
  const TOOLS = [
    tool("search_cars", "Search the pre-owned inventory and show matching cars. Use for any request to find, recommend, list or filter cars. Omit unknown fields.", {
      max_price: num("Budget ceiling: 'under/below/up to X' means max_price=X"), min_price: num("Price floor: ONLY for 'over/above X'"),
      body_type: { type: "string", enum: ["SUV", "Sedan", "Hatchback", "Coupe", "Van"], description: "Body style" }, fuel: { type: "string", enum: ["Petrol", "Hybrid", "Electric"] },
      make: str("Brand, e.g. Toyota, BMW, Mercedes-Benz"), model: str("Model name, e.g. Land Cruiser, X5, Civic"), min_seats: num("Minimum number of seats"),
      min_power: num("Minimum horsepower; performance cars are 400+"), max_mileage: num("Maximum mileage in km"), min_year: num("Oldest acceptable model year"),
      sort: { type: "string", enum: ["price-asc", "price-desc", "mileage", "year", "deal"], description: "Sort order; 'deal' = best price vs market" },
    }),
    tool("request_sourcing", "Log a request for a specific car that is not in stock. A specialist will call the customer back. Needs name, phone and the request.", { name: str("Customer name"), phone: str("Customer phone"), request: str("Which car they want, with spec/budget") }, ["name", "phone", "request"]),
    tool("get_car_details", "Get the full spec sheet of one car by its id (e.g. AG-104).", { car_id: str("Car id like AG-104") }, ["car_id"]),
    tool("compare_cars", "Compare 2-3 cars side by side.", { car_ids: { type: "array", items: { type: "string" }, description: "Car ids like AG-104" } }, ["car_ids"]),
    tool("check_test_drive_slots", "List free test-drive time slots for a car on a date.", { car_id: str("Car id"), date: str("YYYY-MM-DD, or 'today'/'tomorrow'") }, ["car_id", "date"]),
    tool("book_test_drive", "Book a test drive. Only call once you know the car, the customer's name, phone, date and time.", { car_id: str("Car id"), name: str("Customer full name"), phone: str("Customer phone"), date: str("YYYY-MM-DD"), time: str("HH:MM, 24h, e.g. 14:00") }, ["car_id", "name", "phone", "date", "time"]),
    tool("reserve_car", "Reserve / buy a car by paying the refundable deposit. Only call after the customer clearly wants to proceed and you have their name and phone.", { car_id: str("Car id"), name: str("Customer full name"), phone: str("Customer phone"), payment_method: { type: "string", enum: ["card", "bank_transfer", "cash_at_showroom"] } }, ["car_id", "name", "phone"]),
    tool("get_my_activity", "List this customer's test drives and reservations.", {}),
    tool("cancel_booking", "Cancel a test drive or reservation by its reference code (TD-xxxxx or RS-xxxxx).", { reference: str("Reference code") }, ["reference"]),
  ];

  /* Small local models invent filter values. Re-derive them from what the customer actually typed. */
  const userText = () => state.history.filter((m) => m.role === "user").map((m) => m.content).join(" . ").toLowerCase();
  const toNum = (s) => { s = s.replace(/,/g, ""); const m = s.match(/(\d+(?:\.\d+)?)\s*(k|thousand)?/i); return m ? Math.round(+m[1] * (m[2] ? 1000 : 1)) : NaN; };
  function ground(f) {
    const t = userText(), N = "(?:aed|usd|\\$)?\\s*(\\d[\\d,.]*\\s*(?:k|thousand)?)";
    const grab = (re) => { const m = t.match(new RegExp(re.replace("#", N), "i")); return m ? toNum(m[1]) : NaN; };
    const max = grab("(?:under|below|less than|up to|within|max(?:imum)?(?: of)?|at most|budget(?: is| of| around)?|around|about|cheaper than)\\s*#"), min = grab("(?:over|above|more than|at least|min(?:imum)?(?: of)?|starting from)\\s*#");
    delete f.min_price; delete f.max_price;
    if (max > 1000) f.max_price = max; if (min > 1000) f.min_price = min;
    if (f.min_seats && !/\d|seat|people|person|passenger|family|kids|children|seven|eight|six/.test(t)) delete f.min_seats;
    if (f.min_seats && !/\d|seven|eight|six|five/.test(t)) f.min_seats = Math.min(f.min_seats, 5);
    if (f.max_mileage && !/mileage|km|kilomet|low.?mile/.test(t)) delete f.max_mileage;
    if (f.min_year && !/20\d\d|newer|recent|\bnew\b|year/.test(t)) delete f.min_year;
    if (f.fuel && !/petrol|gas|hybrid|electric|\bev\b|fuel|economy|efficien|eco|green|zero emission/.test(t)) delete f.fuel;
    if (f.min_power && !/performance|fast|quick|powerful|sporty|sport|hp|horsepower|power|fun/.test(t)) delete f.min_power;
    if (f.body && !/suv|crossover|sedan|saloon|hatch|coupe|van|minivan|mpv|family|off.?road|4x4|desert|people carrier|seat/.test(t)) delete f.body;
    if (f.make) { const m = String(f.make).toLowerCase().replace(/benz/, "").trim(); if (m.length < 2 || !(t.includes(m) || (m.startsWith("mercedes") && /\bmerc\b/.test(t)))) delete f.make; }
    if (f.model) { const m = String(f.model).toLowerCase().trim(); if (m.length < 2 || !t.includes(m)) delete f.model; else f.model = m; }
  }
  function fixDate(a) {   // relative dates are resolved in code — small models get the arithmetic wrong
    const m = lastUser.toLowerCase().match(/\b(today|tomorrow|(?:mon|tues|wednes|thurs|fri|satur|sun)day)\b/);
    if (m) a.date = P.normDate(m[1]);
    return a;
  }
  const num0 = (v) => (v === undefined || v === null || v === "" || isNaN(+v) ? undefined : +v);
  const REL = ["max_mileage", "min_year", "min_power", "max_price", "min_seats", "fuel", "body", "model", "make"];

  /* each executor returns { result: <sent to the model>, ui: <rendered in the chat> } */
  const EXEC = {
    search_cars(a) {
      const f = { max_price: num0(a.max_price), min_price: num0(a.min_price), body: a.body_type || a.body, fuel: a.fuel, make: a.make, model: a.model, min_seats: num0(a.min_seats), min_power: num0(a.min_power), max_mileage: num0(a.max_mileage), min_year: num0(a.min_year), sort: a.sort };
      Object.keys(f).forEach((k) => (f[k] == null || f[k] === "" || f[k] === "null") && delete f[k]);
      ground(f);
      const sortKey = f.sort; delete f.sort;
      const avail = (g) => P.filterCars(g).filter((c) => !P.store.data.reservations.some((r) => r.car_id === c.id && r.status !== "cancelled"));
      let list = avail(f), relaxed = null;
      if (!list.length) for (const k of REL) { if (!(k in f)) continue; const g = { ...f }; delete g[k]; const l = avail(g); if (l.length) { list = l; relaxed = k; break; } }
      const key = sortKey || "deal", dl = (c) => P.deal(c).pct;
      if (key === "price-asc") list.sort((x, y) => x.price - y.price); else if (key === "price-desc") list.sort((x, y) => y.price - x.price);
      else if (key === "mileage") list.sort((x, y) => x.mileage - y.mileage); else if (key === "year") list.sort((x, y) => y.year - x.year); else list.sort((x, y) => dl(y) - dl(x));
      const shown = list.slice(0, 6), scores = {};
      shown.forEach((c, i) => { let s = 97 - i * 3; if (f.max_price && c.price <= f.max_price * 0.85) s += 1; if (relaxed) s -= 9; scores[c.id] = Math.max(62, Math.min(99, s)); });
      const note = Object.entries(f).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(" · ") || "all cars";
      const gridF = { ...f, ...(sortKey ? { sort: sortKey } : {}) }; if (relaxed) delete gridF[relaxed];
      P.setFilters(gridF, note, scores);
      return { result: { total_matches: list.length, ...(relaxed ? { note: `No exact match. These are the closest options without the "${relaxed}" requirement.` } : {}), cars: shown.map(P.brief) }, ui: { cars: shown.map((c) => c.id), scores } };
    },
    get_car_details(a) { const c = P.carById(a.car_id); if (!c) return { result: { error: "Unknown car_id" } }; return { result: P.full(c), ui: { cars: [c.id] } }; },
    compare_cars(a) {
      let ids = a.car_ids; if (typeof ids === "string") ids = ids.split(/[,\s]+/); const cs = (ids || []).map(P.carById).filter(Boolean).slice(0, 3);
      if (cs.length < 2) return { result: { error: "Need at least two valid car ids." } };
      return { result: { cars: cs.map(P.full) }, ui: { compare: cs.map((c) => c.id) } };
    },
    check_test_drive_slots(a) {
      const c = P.carById(a.car_id), d = P.normDate(fixDate(a).date); if (!c || !d) return { result: { error: "Need a valid car_id and date." } };
      return { result: { car: c.id, date: d, free_slots: P.freeSlots(c.id, d), location: C.location } };
    },
    book_test_drive(a) { const r = P.bookTestDrive(fixDate(a)); if (!r.ok) return { result: r }; window.dispatchEvent(new Event("agmc:changed")); return { result: r, ui: { booking: r.booking } }; },
    reserve_car(a) { const r = P.reserveCar(a); if (!r.ok) return { result: r }; window.dispatchEvent(new Event("agmc:changed")); return { result: r, ui: { reservation: r.reservation } }; },
    request_sourcing(a) { const r = P.requestSourcing(a); return r.ok ? { result: r, ui: { enquiry: r.enquiry } } : { result: r }; },
    get_my_activity() { const s = P.store.data; return { result: { test_drives: s.bookings, reservations: s.reservations.filter((r) => r.status !== "cancelled") } }; },
    cancel_booking(a) { const ref = String(a.reference || "").toUpperCase(); return { result: P.cancelItem(ref.startsWith("RS") ? "reservations" : "bookings", ref) }; },
  };
  const STEP = { search_cars: "Searching the inventory", get_car_details: "Reading the spec sheet", compare_cars: "Comparing the cars", check_test_drive_slots: "Checking test-drive availability", book_test_drive: "Booking your test drive", reserve_car: "Reserving the car", request_sourcing: "Logging your sourcing request", get_my_activity: "Looking up your activity", cancel_booking: "Cancelling" };
  const stepLabel = (name, args) => { const bits = Object.entries(args || {}).filter(([, v]) => v != null && v !== "" && typeof v !== "object").slice(0, 3).map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`); return (STEP[name] || name.replace(/_/g, " ")) + (bits.length && name === "search_cars" ? " · " + bits.join(" · ") : ""); };

  /* ---------- system prompt ---------- */
  const system = () => {
    const now = new Date(), s = P.store.data, vc = pageCar();
    return `You are ${C.advisor}, the AI car advisor for ${C.brand}, a pre-owned car platform at ${C.location}. EVERY car is used, but each passes a 150-point inspection and comes with an AGMC warranty. We sell many brands (Toyota, Nissan, Honda, Mazda, Hyundai, Kia, Mercedes-Benz, Audi, BMW, Lexus, Porsche, Land Rover, Tesla, Ford, Jeep, Volkswagen). Currency is ${C.currency}. Today is ${now.toDateString()} (${P.iso(now)}). Showroom hours ${C.hours.open}:00-${C.hours.close}:00 every day. Tone: sharp, friendly, concise, like a knowledgeable expert.
You control the website with tools. Rules:
1. For ANY request to find, recommend, filter or browse cars, call search_cars. Never invent cars, prices or ids — only use tool results.
2. After search results, reply in 1-3 short sentences: recommend the best 1-2 cars and say why (mention "price_rating" when it is Great price or Good price). Cars are already shown to the customer as cards; do not list every spec. Only claim a car fits the budget if its price in the tool result is within it; if total_matches is 0 say so honestly.
   Only pass search_cars filters the customer actually asked for — never guess budget, seats or fuel.
3. By need: family -> SUV or Van with min_seats 5-7 (Land Cruiser, Patrol, Q7 and Carnival seat 7-8); economy -> Hybrid or Electric; performance -> min_power 400; luxury -> Mercedes-Benz, BMW, Audi, Lexus, Porsche, Land Rover; off-road -> Jeep, Land Cruiser, Patrol. If the customer wants a car we do not have, offer request_sourcing (needs name, phone and the request). If the budget is unclear, ask ONE short question first only when nothing else is known.
4. To book a test drive you need: car, name, phone, date, time. Ask for whatever is missing in one message. As soon as you have all five, call book_test_drive IMMEDIATELY (24h time, e.g. 3pm = 15:00) — do not call check_test_drive_slots first; book_test_drive tells you the free slots if the time is taken. Use check_test_drive_slots only when the customer asks what times are free and has not chosen one. NEVER say a booking is confirmed unless book_test_drive returned ok:true; if it fails, explain and offer the available slots.
5. To buy: offer a test drive, then reserve_car (needs name, phone and payment method: card, bank transfer or cash at the showroom). The deposit is ${money(C.depositAmount)}, refundable, holds the car 7 days. Do not reserve without a clear yes. Do not discuss financing, instalments or trade-ins; if asked, say a team member will help in person at the showroom.
6. Quote only numbers that appear in tool results; never calculate or estimate payments or values yourself. For details of one car call get_car_details; to compare cars call compare_cars. Plain text, no markdown tables, no emojis. Prices as "${C.currency} 62,900".
7. If a question is unrelated to cars or this platform, politely steer back.${vc ? `\nThe customer is currently viewing ${P.name(vc)} (${vc.id}), priced ${money(vc.price)}. Questions like "this car" or "it" refer to it — call get_car_details with that id when you need specs.` : ""}${s.bookings.length ? `\nCustomer currently has ${s.bookings.length} test drive(s) booked.` : ""}`;
  };

  /* ---------- panel UI ---------- */
  const fmt = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  const scroller = () => $("#wzScroll");
  const toEnd = () => { const s = scroller(); s.scrollTop = s.scrollHeight; };
  const add = (html, cls) => { const d = document.createElement("div"); d.className = cls; d.innerHTML = html; scroller().appendChild(d); toEnd(); return d; };
  const dl = (rows) => `<dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>`;
  const AVA = `<span class="wz-ava"></span>`;

  function render(it) {
    switch (it.k) {
      case "user": return add(`<div class="wz-t">${esc(it.t)}</div>`, "wz-m user");
      case "bot": return add(`${AVA}<div class="wz-t">${fmt(it.t)}</div>`, "wz-m bot");
      case "err": return add(`${AVA}<div class="wz-t">${it.html}</div>`, "wz-m bot err");
      case "step": return add(`<span class="st"></span><span>${esc(it.t)}</span>`, "wz-step done");
      case "cars": {
        const el = add(it.ids.map((id) => { const c = P.carById(id); if (!c) return ""; const dd = P.deal(c); return `<a class="wz-car" href="${P.carHref(c.id)}"><div class="car-img">${P.carImg(c)}<span class="chip deal ${dd.tone}"><i></i>${dd.label}</span>${it.scores && it.scores[id] ? `<span class="chip match">✦ ${it.scores[id]}%</span>` : ""}</div><div class="wz-car-b"><b>${c.year} ${esc(c.make)} ${esc(c.model)}</b><small>${P.km(c.mileage)} · ${c.fuel} · ${c.power} hp</small><span class="go">specs →</span><span class="p">${money(c.price)}</span></div></a>`; }).join(""), "wz-cars");
        P.flash(it.ids); return el;
      }
      case "card": return add(`<b>${esc(it.title)}</b>${dl(it.rows)}`, "wz-card");
      case "links": return add(it.ids.map((id) => { const c = P.carById(id); return c ? `<a href="${P.carHref(id)}">View full specs · ${esc(c.make)} ${esc(c.model)} →</a>` : ""; }).join(""), "wz-links");
    }
  }
  function log(it) { state.log.push(it); save(); return render(it); }

  const PROMPTS = [["Family", "Find me a 7-seater SUV under 200,000"], ["Economy", "A fuel-efficient hybrid for the daily commute"], ["Performance", "Something fast and fun, over 400 hp"], ["Value", "Show me the best deals right now"], ["Visit", "I'd like to book a test drive"], ["Sourcing", "I'm looking for a car you don't have"]];
  function welcome() {
    const car = pageCar();
    return add(`<span class="orb" style="width:44px;height:44px"></span><h2>${car ? `Ask me about the ${esc(car.make)} ${esc(car.model)}` : `Hi, I'm ${esc(C.advisor)}.`}</h2><p>${car ? "I can explain the price, compare it with similar cars, or book your test drive." : "Your AI advisor for pre-owned cars. Tell me what you need and I'll search the inventory, check prices, and book your test drive."}</p><div class="wz-prompts">${(car ? [["This car", `Is the ${P.name(car)} a good price?`], ["Compare", "Compare it with similar cars"], ["Test drive", "Book a test drive for this car"], ["Check", "What should I check on a test drive?"]] : PROMPTS).map(([l, t]) => `<button data-p="${esc(t)}"><small>${l}</small>${esc(t)}</button>`).join("")}</div>`, "wz-welcome");
  }
  function suggestions() {
    const car = pageCar();
    return state.log.length ? (car ? ["Is this a good price?", "Compare with similar cars", "Book a test drive"] : ["Show me the best deals", "Cheaper options", "Compare the top two", "Book a test drive"]) : [];
  }
  function drawSuggestions() { $("#wzSugg").innerHTML = suggestions().map((s) => `<button type="button">${esc(s)}</button>`).join(""); }

  function mount() {
    document.body.insertAdjacentHTML("beforeend", `
      <button class="wz-fab" id="wzFab" aria-label="Ask ${esc(C.advisor)}"><span class="orb"></span>Ask ${esc(C.advisor)}</button>
      <aside class="wz" id="wz" aria-label="${esc(C.advisor)}, AI car advisor">
        <header class="wz-head"><span class="orb"></span><div class="wz-who"><b>${esc(C.advisor)}</b><span><i class="wz-dot" id="wzDot"></i><span id="wzStatus">connecting…</span></span></div>
          <button class="wz-ib" id="wzNew" title="New conversation" aria-label="New conversation">↺</button><button class="wz-ib" id="wzWide" title="Expand" aria-label="Expand">⤢</button><button class="wz-ib" id="wzClose" title="Close" aria-label="Close">✕</button></header>
        <div class="wz-scroll" id="wzScroll"></div>
        <div class="wz-sugg" id="wzSugg"></div>
        <form class="wz-compose" id="wzForm"><input id="wzInput" placeholder="Ask ${esc(C.advisor)} anything about our cars…" autocomplete="off"><button class="wz-send" id="wzSend" type="submit" aria-label="Send">↑</button></form>
        <div class="wz-foot">${esc(C.advisor)} is AI and can make mistakes — confirm details with ${esc(C.brand)}.</div>
      </aside>`);
    $("#wzFab").onclick = $("#btnAsk").onclick = open;
    if ($("#footAsk")) $("#footAsk").onclick = open;
    $("#wzClose").onclick = close; $("#wzNew").onclick = reset;
    $("#wzWide").onclick = () => { state.wide = !state.wide; $("#wz").classList.toggle("wide", state.wide); save(); };
    $("#wzForm").onsubmit = (e) => { e.preventDefault(); const v = $("#wzInput").value; $("#wzInput").value = ""; run(v); };
    scroller().addEventListener("click", (e) => { const b = e.target.closest("[data-p]"); if (b) run(b.dataset.p); });
    $("#wzSugg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) run(b.textContent); });
    $("#wz").classList.toggle("wide", !!state.wide);
    if (state.log.length) state.log.forEach(render); else welcome();
    drawSuggestions();
    if (state.open) requestAnimationFrame(() => { $("#wz").classList.add("open"); $("#wzFab").hidden = true; toEnd(); checkStatus(); });
  }
  function open() { $("#wz").classList.add("open"); $("#wzFab").hidden = true; state.open = true; save(); checkStatus(); setTimeout(() => { $("#wzInput").focus(); toEnd(); }, 380); }
  function close() { $("#wz").classList.remove("open"); $("#wzFab").hidden = false; state.open = false; save(); }
  function reset() { state.history = []; state.log = []; save(); scroller().innerHTML = ""; P.clearFilters(); welcome(); drawSuggestions(); }
  function setBusy(b) { busy = b; $("#wzSend").disabled = b; }

  async function checkStatus() {
    const dot = $("#wzDot"), st = $("#wzStatus");
    try {
      const j = await (await fetch("/ollama/api/tags")).json(), has = (j.models || []).some((m) => m.name === model || m.name.startsWith(model + ":") || m.name === model + ":latest");
      dot.className = "wz-dot " + (has ? "ok" : "bad"); st.textContent = has ? "Online · AI car advisor" : "Unavailable";
    } catch { dot.className = "wz-dot bad"; st.textContent = "Unavailable"; }
  }

  /* ---------- Ollama streaming ---------- */
  async function chatOnce(messages, onToken) {
    const res = await fetch("/ollama/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model, messages, tools: TOOLS, stream: true, keep_alive: "30m", options: { temperature: 0.3, num_ctx: 4096 } }) });
    if (!res.ok || !res.body) { let m = res.statusText; try { m = (await res.json()).error || m; } catch {} throw new Error(m); }
    const reader = res.body.getReader(), dec = new TextDecoder(); let buf = "", content = "", calls = [];
    for (;;) {
      const { value, done } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true });
      let i; while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line) continue;
        const j = JSON.parse(line); if (j.error) throw new Error(j.error);
        if (j.message?.content) { content += j.message.content; onToken(content); }
        if (j.message?.tool_calls) calls.push(...j.message.tool_calls);
      }
    }
    if (!calls.length) {   // small models sometimes print the call as text instead of using the tool channel
      const m = content.match(/<tool_call>\s*([\s\S]*?)\s*(<\/tool_call>|$)/) || content.trim().match(/^(\{[\s\S]*"name"[\s\S]*\})$/);
      if (m) { try { const o = JSON.parse(m[1]); if (o.name) { calls.push({ function: { name: o.name, arguments: o.arguments || o.parameters || {} } }); content = content.replace(m[0], "").trim(); } } catch {} }
    }
    return { content, calls };
  }
  const clean = (t) => t.replace(/<tool_call>[\s\S]*/, "").trim();
  const trim = (h) => { const t = h.slice(-30); while (t.length && t[0].role !== "user") t.shift(); return t; };

  async function run(text) {
    text = (text || "").trim(); if (busy || !text) return; if (!$("#wz").classList.contains("open")) open();
    setBusy(true); lastUser = text; shownIds = [];
    scroller().querySelector(".wz-welcome")?.remove();
    log({ k: "user", t: text }); state.history.push({ role: "user", content: text }); save(); $("#wzSugg").innerHTML = "";
    try {
      for (let step = 0; step < 6; step++) {
        const think = add(`${AVA}<b>${esc(C.advisor)} is thinking…</b>`, "wz-think"); let bubble = null;
        const { content, calls } = await chatOnce([{ role: "system", content: system() }, ...trim(state.history)], (t) => {
          const shown = clean(t); if (!shown) return;
          if (!bubble) { think.remove(); bubble = add(`${AVA}<div class="wz-t"></div>`, "wz-m bot"); }
          bubble.querySelector(".wz-t").innerHTML = fmt(shown); toEnd();
        });
        think.remove(); const shown = clean(content);
        if (shown) { if (!bubble) bubble = add(`${AVA}<div class="wz-t"></div>`, "wz-m bot"); bubble.querySelector(".wz-t").innerHTML = fmt(shown); state.log.push({ k: "bot", t: shown }); }
        state.history.push({ role: "assistant", content: content || "", ...(calls.length ? { tool_calls: calls } : {}) });
        if (!calls.length) { if (!shown) log({ k: "bot", t: "Sorry, I didn't catch that — could you rephrase?" }); else linkCars(shown); break; }
        for (const call of calls) {
          const name = call.function.name; let args = call.function.arguments || {};
          if (typeof args === "string") { try { args = JSON.parse(args); } catch { args = {}; } }
          const label = stepLabel(name, args), stepEl = add(`<span class="st"></span><span>${esc(label)}</span>`, "wz-step");
          let out; try { out = EXEC[name] ? EXEC[name](args) : { result: { error: "Unknown tool " + name } }; } catch (e) { out = { result: { error: String(e.message || e) } }; }
          await sleep(420); stepEl.classList.add("done"); state.log.push({ k: "step", t: label });
          renderUi(out.ui); console.debug("[wazir tool]", name, args, out.result);
          state.history.push({ role: "tool", tool_name: name, content: JSON.stringify(out.result) });
        }
        save();
      }
    } catch (e) {
      log({ k: "err", html: `${esc(e.message || e)}<br><small>Is Ollama running, and is <b>${esc(model)}</b> pulled? <code>ollama pull ${esc(model)}</code></small>` });
      state.history.pop(); checkStatus();
    }
    setBusy(false); save(); drawSuggestions(); $("#wzInput").focus();
  }

  function renderUi(ui) {
    if (!ui) return;
    if (ui.cars) { ui.cars.forEach((id) => !shownIds.includes(id) && shownIds.push(id)); log({ k: "cars", ids: ui.cars, scores: ui.scores }); }
    if (ui.compare) {
      ui.compare.forEach((id) => !shownIds.includes(id) && shownIds.push(id));
      const cs = ui.compare.map(P.carById), row = (k, f) => [k, cs.map(f).join(" | ")];
      log({ k: "card", title: "Comparison", rows: [row("Car", (c) => `${c.make} ${c.model}`), row("Year", (c) => c.year), row("Price", (c) => money(c.price)), row("Mileage", (c) => P.km(c.mileage)), row("Power", (c) => c.power + " hp"), row("Fuel", (c) => c.fuel), row("Seats", (c) => c.seats)] });
    }
    if (ui.booking) { const b = ui.booking; log({ k: "card", title: `Test drive confirmed · ${b.ref}`, rows: [["Car", esc(b.car)], ["When", `${b.date} at ${b.time}`], ["Where", esc(C.location)], ["Name", esc(b.name)]] }); }
    if (ui.reservation) { const r = ui.reservation; log({ k: "card", title: `Car reserved · ${r.ref}`, rows: [["Car", esc(r.car)], ["Price", money(r.price)], ["Deposit", money(r.deposit)], ["Payment", r.payment_method.replace(/_/g, " ")]] }); }
    if (ui.enquiry) { const q = ui.enquiry; log({ k: "card", title: `Sourcing request logged · ${q.ref}`, rows: [["Request", esc(q.request)], ["Contact", `${esc(q.name)} · ${esc(q.phone)}`], ["Callback", "Within 1 business day"]] }); }
  }

  // Cars named in the final reply get a link; the first one opens on its own full-specs page.
  function linkCars(text) {
    const t = text.toLowerCase(), hits = [];
    for (const id of shownIds) {
      const c = P.carById(id); if (!c) continue;
      const full = `${c.make} ${c.model}`.toLowerCase(), model = c.model.toLowerCase(), key = model.split(" ")[0];
      let i = t.indexOf(full); if (i < 0) i = t.indexOf(model);
      if (i < 0 && key.length >= 3) { const m = t.match(new RegExp("\\b" + key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b")); i = m ? m.index : -1; }
      if (i >= 0) hits.push({ c, i });
    }
    if (!hits.length && shownIds.length === 1) hits.push({ c: P.carById(shownIds[0]), i: 0 });
    hits.sort((a, b) => a.i - b.i); if (!hits.length) return;
    log({ k: "links", ids: hits.slice(0, 3).map((h) => h.c.id) });
    const cur = pageCar(), first = hits[0].c;
    if (C.autoOpenCar && (!cur || cur.id !== first.id)) { state.open = true; save(); setTimeout(() => { location.href = P.carHref(first.id); }, 1800); }
  }

  mount();
  return { open, close, send: run, setModel(m) { model = m; P.safe(() => localStorage.setItem(MODEL_KEY, m)); checkStatus(); }, tools: TOOLS, exec: EXEC };
})();
