/* Voice for Wazir — a microphone button in the chat panel that opens a call to the local voice server (the carvoice project, ws://localhost:8765/voice).
   The server listens, understands, speaks, and tells this page what to show: transcript lines, car cards, and the booking to save.
   Everything the page shows still comes from this site's own code (Agent.log / Agent.ui / Agent.exec), so cards and bookings look and
   behave exactly as they do in text chat.
   Server address: CONFIG.voiceUrl, or ?voice=ws://host:port/voice, or ws://localhost:8765/voice.

   TAP TO TALK (the default; ?voicemode=handsfree or CONFIG.voiceMode = "handsfree" keeps the microphone open for the whole call instead):
     tap the mic -> it opens, you speak -> the server decides your turn is over and the mic CLOSES -> Wazir answers (mic closed) ->
     tap again to reply, or tap while Wazir is talking to interrupt. Tapping while you speak finishes your turn early. The small x ends the call.
   The microphone is really released between turns (the browser's recording indicator goes off). */
(function () {
  if (typeof Agent === "undefined" || !navigator.mediaDevices || !window.AudioWorkletNode) return;   // no mic or no AudioWorklet: no button
  const P = Portal, C = CONFIG, $ = P.$;
  const Q = new URLSearchParams(location.search);
  const URL_ = Q.get("voice") || C.voiceUrl || "ws://localhost:8765/voice";
  // With many voice servers, a router (CONFIG.voiceGateway, e.g. "http://localhost:8760") says which one to use for each call.
  const GATEWAY = Q.get("gateway") || C.voiceGateway || "";
  let callId = "", retried = false, returning = false;
  // A call that ended (hung up, or ended by Wazir after a quiet spell) is carried on if the visitor starts again within KEEP_MS: the server keeps it as long (voice.calls_kept_secs)
  const KEEP_MS = 15 * 60 * 1000;
  function lastCall() { try { const c = JSON.parse(localStorage.getItem("wzLastCall") || "null"); return c && Date.now() - c.at < KEEP_MS ? c.id : ""; } catch (e) { return ""; } }
  function keepCall(id) { try { if (id) localStorage.setItem("wzLastCall", JSON.stringify({ id, at: Date.now() })); } catch (e) {} }
  async function serverUrl() {
    if (!GATEWAY) return URL_;
    const r = await fetch(GATEWAY.replace(/\/$/, "") + "/assign");
    if (r.status === 503) throw new Error("busy");
    if (!r.ok) throw new Error("router");
    return (await r.json()).url;
  }
  const MODE = (Q.get("voicemode") || C.voiceMode || "tap") === "handsfree" ? "handsfree" : "tap";
  // ?mic=raw (or CONFIG.voiceMic = "raw"): the browser's noise suppression and automatic gain control are switched OFF for the microphone (echo cancellation stays on).
  // Safari's processing is the suspect for choppy / half-missing microphone audio (voice-agent docs/ARCH_REVIEW.md, section 7). Default is unchanged: the server's quiet-speech
  // thresholds were set against levels measured WITH automatic gain, so compare first (the worker log prints each turn's level), then change the default.
  const RAW_MIC = (Q.get("mic") || C.voiceMic || "") === "raw";

  let ws = null, ctx = null, stream = null, node = null, src = null, nextAt = 0, sources = [];
  let phase = "idle";                       // idle | connecting | listening | thinking | speaking | waiting      (waiting = mic closed, tap to reply)
  let micOn = false, doneTimer = null;
  let bubble = null, bubbleTurn = -1, bubbleText = "", youTurn = -1;

  const mic = document.createElement("button");
  mic.type = "button"; mic.id = "wzMic"; mic.className = "wz-mic"; mic.title = "Talk to " + C.advisor; mic.setAttribute("aria-label", "Talk to " + C.advisor);
  mic.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
  const endBtn = document.createElement("button");
  endBtn.type = "button"; endBtn.id = "wzMicEnd"; endBtn.className = "wz-mic-end"; endBtn.title = "End the voice call"; endBtn.setAttribute("aria-label", "End the voice call"); endBtn.textContent = "End call"; endBtn.hidden = true;
  const send = $("#wzSend");
  if (!send) return;
  const bar = document.createElement("div");
  bar.className = "wz-voicebar";
  const form = send.closest("form") || send.parentNode;
  form.parentNode.insertBefore(bar, form.nextSibling);
  bar.append(mic, endBtn);
  const cap = document.createElement("span");
  cap.className = "wz-mic-cap"; cap.hidden = true; cap.setAttribute("aria-live", "polite");
  bar.insertBefore(cap, endBtn);

  const status = (text, tone) => {
    const st = $("#wzStatus"), dot = $("#wzDot");
    if (st) st.textContent = text;
    if (dot && tone) dot.className = "wz-dot " + tone;
  };
  const note = (html) => Agent.log({ k: "err", html });
  const LABEL = { connecting: ["connecting voice…", "Connecting…"], listening: ["Listening · speak now", "Tap to finish speaking"], thinking: ["Wazir is thinking…", "Tap to speak instead"],
                  speaking: ["Wazir is speaking", "Tap to interrupt"], waiting: ["Your turn · tap the mic to reply", "Tap to reply"] };
  const draw = () => {
    for (const c of ["live", "wait", "think", "speak", "ready"]) mic.classList.remove(c);
    if (phase === "listening") mic.classList.add("live");
    else if (phase === "connecting") mic.classList.add("wait");
    else if (phase === "thinking") mic.classList.add("think");
    else if (phase === "speaking") mic.classList.add("speak");
    else if (phase === "waiting") mic.classList.add("ready");
    mic.title = phase === "idle" ? "Talk to " + C.advisor : MODE === "handsfree" ? "End the voice call" : LABEL[phase][1];
    endBtn.hidden = phase === "idle" || MODE === "handsfree";
    cap.hidden = phase === "idle" || MODE === "handsfree"; cap.textContent = phase === "idle" || MODE === "handsfree" ? "" : LABEL[phase][1];
    if (phase !== "idle") status(MODE === "handsfree" && phase === "listening" ? "Listening · voice call" : LABEL[phase][0], phase === "listening" ? "ok" : "");
    clearTimeout(drawTimer);
    if (phase !== "idle") drawTimer = setTimeout(draw, 1200);       // the site's own status check can overwrite the status line a moment after opening the chat: put ours back
  };
  let drawTimer = null;

  // ---- the microphone: opened for a turn, released after it (tap mode) ----------------------------------------------------------------------
  async function openMic() {
    if (micOn || !ctx) return;
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: !RAW_MIC, autoGainControl: !RAW_MIC } });
    src = ctx.createMediaStreamSource(stream);
    src.connect(node);
    micOn = true;
  }
  function closeMic() {
    micOn = false;
    try { if (src) src.disconnect(); } catch {}
    try { if (stream) stream.getTracks().forEach((t) => t.stop()); } catch {}
    src = stream = null;
  }
  function silence() {                     // drop whatever Wazir has queued to play
    sources.forEach((s) => { try { s.stop(); } catch {} }); sources = []; nextAt = 0;
    clearTimeout(doneTimer);
  }
  const tell = (obj) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); };

  async function start() {
    if (phase !== "idle") return;
    phase = "connecting"; draw();
    try { if (MODE === "tap" && !localStorage.getItem("wzVoiceHint")) { localStorage.setItem("wzVoiceHint", "1"); note("Tap the mic, speak, and I'll answer. When it's your turn again, tap the mic to reply. Tap while I'm talking to interrupt. \"End call\" hangs up."); } } catch (e) {}
    Agent.open();
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    try { await ctx.audioWorklet.addModule("voice-worklet.js"); } catch (e) { fail("Voice could not start in this browser."); return; }
    node = new AudioWorkletNode(ctx, "mic-capture");
    node.port.onmessage = (m) => { if (micOn && ws && ws.readyState === 1) ws.send(m.data); };
    try { await openMic(); } catch (e) {
      stop(); note("I need microphone access to hear you. Allow the microphone for this site, or type instead.");
      return;
    }
    returning = false;
    if (!callId) { callId = lastCall(); returning = !!callId; }
    if (!callId) callId = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()).slice(0, 36);
    let url;
    try { url = await serverUrl(); } catch (e) {
      fail(e.message === "busy" ? "Voice is busy right now. You can keep chatting by typing." : "I can't reach the voice server. You can keep chatting by typing.");
      return;
    }
    try { ws = new WebSocket(url); } catch (e) { fail("The voice server address is not valid."); return; }
    ws.binaryType = "arraybuffer";
    ws.onopen = () => {
      // Tell the server which car page this is, how the visitor wants to talk, and what they already have booked or reserved, so Wazir never offers a slot the site would refuse.
      const d = (P.store && P.store.data) || {};
      ws.send(JSON.stringify({ type: "hello", mode: MODE, call_id: callId, returning, car: (window.PageContext && window.PageContext.carId) || null,
        bookings: (d.bookings || []).map((b) => ({ ref: b.ref, car_id: b.car_id, date: b.date, time: b.time, name: b.name, phone: b.phone })),
        reserved: (d.reservations || []).filter((r) => r.status !== "cancelled").map((r) => r.car_id) }));
    };
    ws.onmessage = onMessage;
    ws.onerror = () => { if (phase === "connecting") fail("I can't reach the voice server. You can keep chatting by typing."); };
    ws.onclose = () => {
      if (phase === "idle") return;
      if (GATEWAY && !retried) {                                   // the voice server went away mid-call: carry on with another one, same call
        retried = true;
        note("Reconnecting…");
        const keep = callId;
        stop(); callId = keep;
        setTimeout(() => start(), 400);
        return;
      }
      stop();
    };
  }

  function fail(msg) { note(msg); stop(); }

  function stop() {
    if (!retried) { keepCall(callId); callId = ""; }
    phase = "idle";
    try { if (ws) { ws.onclose = null; ws.close(); } } catch {}
    closeMic();
    try { if (node) node.disconnect(); } catch {}
    silence();
    try { if (ctx) ctx.close(); } catch {}
    ws = ctx = node = null; bubble = null; caption = null;
    draw(); status("Online · AI car advisor", "ok");
  }

  function play(buf, rate) {
    if (MODE === "tap" && (phase === "thinking" || phase === "waiting")) { phase = "speaking"; draw(); }
    const pcm = new Int16Array(buf), f = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) f[i] = pcm[i] / 32768;
    const ab = ctx.createBuffer(1, f.length, rate);
    ab.copyToChannel(f, 0);
    const s = ctx.createBufferSource();
    s.buffer = ab; s.connect(ctx.destination);
    const t = Math.max(nextAt, ctx.currentTime + 0.12);       // a short cushion absorbs network jitter
    s.start(t); nextAt = t + ab.duration;
    sources.push(s);
    s.onended = () => {
      sources = sources.filter((x) => x !== s);
      if (MODE === "tap" && !sources.length) { clearTimeout(doneTimer); doneTimer = setTimeout(() => { if (phase === "speaking" && !sources.length) { phase = "waiting"; draw(); } }, 500); }
    };
  }

  // Live caption: what the caller is saying, shown (faded) while they say it, then replaced by the final line.
  let caption = null;
  const capStyle = document.createElement("style");
  capStyle.textContent = ".wz-m.wz-partial .wz-t{opacity:.55;font-style:italic}";
  document.head.appendChild(capStyle);
  function dropCaption() {
    if (!caption) return;
    const i = Agent.state.log.indexOf(caption.entry);
    if (i >= 0) Agent.state.log.splice(i, 1);
    Agent.save(); caption.el.remove(); caption = null;
  }

  let rate = 22050, pendingTime = null;
  function stamp(seconds) { const t = document.createElement("small"); t.className = "wz-time"; t.textContent = "replied in " + seconds.toFixed(1) + " s"; bubble.appendChild(t); }
  function onMessage(ev) {
    if (typeof ev.data !== "string") { if (ctx) play(ev.data, rate); return; }
    const m = JSON.parse(ev.data);
    switch (m.type) {
      case "ready": rate = m.sample_rate; retried = false;   // a reconnect worked: a later drop may reconnect again
       
        if (MODE === "tap" && m.listen) { phase = "listening"; draw(); }                       // you speak first: the mic is open (Wazir greets only if you say nothing)
        else if (MODE === "tap") { closeMic(); phase = m.resumed ? "waiting" : "thinking"; draw(); }   // Wazir greets first (not on a reconnect); the mic opens when you tap
        else { phase = "listening"; draw(); }
        break;
      case "thinking":                                               // tap mode: your turn is over, Wazir works on the answer. The microphone stays OPEN until the reply starts (so a pause in the middle of a sentence is not lost)
        if (MODE === "tap" && phase === "listening") { phase = "thinking"; draw(); }
        break;
      case "mic":                                                    // tap mode: the microphone closes now (the reply is starting, or the server waited long enough)
        if (!m.on && MODE === "tap") { closeMic(); if (phase === "listening") { phase = "thinking"; draw(); } }
        break;
      case "stop":                                                   // the caller spoke over the agent: drop what is queued to play
        sources.forEach((x) => { try { x.stop(); } catch {} }); sources = []; nextAt = 0; break;
      case "busy": note("Voice is busy right now. You can keep chatting by typing."); stop(); break;
      case "end": note("I ended the call after a quiet spell. Tap the microphone within 15 minutes to carry on where we left off."); stop(); break;
      case "clear": sources.forEach((s) => { try { s.stop(); } catch {} }); sources = []; nextAt = 0; break;     // the caller interrupted: drop what Wazir was about to say
      case "line":
        if (m.who === "you") {
          if (caption) { caption.el.querySelector(".wz-t").textContent = m.text; caption.el.classList.remove("wz-partial"); caption.entry.t = m.text; Agent.save(); caption = null; }
          else Agent.log({ k: "user", t: m.text });
          youTurn = m.turn; bubble = null;
        }
        else if (bubble && bubbleTurn === m.turn) {                 // the agent's sentences of one turn grow one message
          bubbleText += " " + m.text; bubble.querySelector(".wz-t").textContent = bubbleText;
          const last = Agent.state.log[Agent.state.log.length - 1]; if (last && last.k === "bot") { last.t = bubbleText; Agent.save(); }
        } else { bubbleTurn = m.turn; bubbleText = m.text; bubble = Agent.log({ k: "bot", t: m.text }); if (pendingTime !== null && m.turn === youTurn) stamp(pendingTime); pendingTime = null; }
        break;
      case "partial":
        if (!m.text) { dropCaption(); break; }
        if (!caption) { const el = Agent.log({ k: "user", t: m.text }); el.classList.add("wz-partial"); caption = { el, entry: Agent.state.log[Agent.state.log.length - 1] }; }
        else { caption.el.querySelector(".wz-t").textContent = m.text; caption.entry.t = m.text; }
        break;
      case "timing":
        if (bubble && bubbleTurn === youTurn) stamp(m.seconds); else pendingTime = m.seconds;       // the reply bubble may not exist yet: stamp it when it does
        break;
      case "cars": Agent.ui({ cars: m.ids }); break;
      case "cancelled": {                                            // Wazir cancelled (or moved) a test drive: take it off the site's list too
        const list = (P.store && P.store.data && P.store.data.bookings) || [];
        const b = list.find((x) => (m.ref && x.ref === m.ref) || (x.car_id === m.car_id && x.date === m.date && x.time === m.time));
        if (b) P.cancelItem("bookings", b.ref);
        break;
      }
      case "booking": {
        const out = Agent.exec.book_test_drive({ car_id: m.car_id, name: m.name, phone: m.phone, date: m.date, time: m.time });
        if (out.ui) Agent.ui(out.ui); else note("I couldn't save that booking on the site: " + P.esc((out.result && (out.result.error || out.result.reason)) || "please try the text chat."));
        break;
      }
    }
  }

  async function tap() {
    if (phase === "idle") return start();
    if (MODE === "handsfree") return stop();
    if (phase === "connecting") return;
    if (phase === "listening") {                                     // finish speaking now: close the mic, the server ends the turn
      tell({ type: "mic", on: false }); closeMic(); phase = "thinking"; draw(); return;
    }
    // thinking / speaking / waiting: a tap = "let me speak" (and, if Wazir is talking, stop it)
    silence();
    tell({ type: "mic", on: true });
    phase = "listening"; draw();
    try { await openMic(); } catch (e) { phase = "waiting"; draw(); note("I need microphone access to hear you. Allow the microphone for this site, or type instead."); }
  }

  mic.onclick = tap;
  endBtn.onclick = () => stop();
  addEventListener("pagehide", stop);
})();
