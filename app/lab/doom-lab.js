// The Lab: real DOOM in a worker, with a small language model in a second worker acting as an aimbot.
// Mounted by app/components/DoomLab.tsx onto the elements it renders; returns a cleanup function.
/* ---------- Real DOOM (doomgeneric + state export, shareware E1M1) ----------
   The aimbot: you move, and the model answers the reference agent's two questions for the aim and the trigger.
   The game loads first, then the model; progress is drawn on the game screen. */
/* doom-bot.js declares DoomBot at the top level, so it must run only once per page. React mounts twice in
   development and Fast Refresh remounts on edits, so reuse the script tag if it's already there, loaded or not. */
const loadScript = src => new Promise((resolve, reject) => {
  if (window.DoomBot) return resolve();
  let el = document.querySelector(`script[data-src="${src}"]`);
  if (!el) {
    el = document.createElement("script");
    el.src = src;
    el.dataset.src = src;
    document.head.appendChild(el);
  }
  el.addEventListener("load", () => resolve(), { once: true });
  el.addEventListener("error", () => reject(new Error(src)), { once: true });
});

export function mountDoomLab() {
  let cleanup = null, cancelled = false;
  loadScript("/lab/doom/doom-bot.js").then(() => { if (!cancelled) cleanup = start(); }, err => console.error(err));
  return () => { cancelled = true; if (cleanup) cleanup(); };
}

function start() {
  const K = { up: 0xad, down: 0xaf, left: 0xac, right: 0xae, fire: 0xa3, use: 0xa2, strafeLeft: 0xa0, strafeRight: 0xa1 };
  const TIC_MS = 1000 / 35, SLOT_MS = 4 * TIC_MS; // a decision every 4 tics, 8.75 per second
  // Files under public/lab, with their sizes for the progress bar. The workers load their own scripts.
  // The .v1 in a name is its version: bump it when the file changes, since these are cached for a year (next.config.ts).
  const GAME_FILES = ["/lab/doom/doom.v1.wasm", "/lab/doom/doom1.wad"], GAME_BYTES = 385956 + 4196020;
  const MODEL_FILES = ["/lab/needle/needle.v1.wasm", "/lab/needle/needle3-4L.v1.cact", "/lab/needle/heads-4L.v1.json"];
  const MODEL_BYTES = 923348 + 15390548 + 465945;
  const DoomBot = window.DoomBot; // loaded from /lab/doom/doom-bot.js by mountDoomLab

  const $ = id => document.getElementById(id);
  const canvas = $("lab-canvas"), ctx = canvas.getContext("2d");
  const screenEl = $("doom-screen"), cover = $("play-cover");
  const stateEl = $("doom-state"), probsEl = $("doom-probs"), tapeEl = $("doom-tape");

  let priming = false;
  let worker = null, model = null, ready = false, running = false, inView = false, focused = false, paused = false;
  let engineState = null, busy = false, pending = null, reqId = 0;
  const lats = [];
  let decisions = 0, skipped = 0, rateStart = 0, t0 = 0;

  /* Your keys and the model's are tracked apart, and sync() decides what DOOM sees: a key is down if the model
     holds it, or you do and the model isn't aiming. While it aims, it overrides turning and the trigger; moving stays yours. */
  let held = new Set(), aimActive = false;
  const tapTimers = {}, userDown = new Set(), sentDown = new Set();
  const AIM_KEYS = new Set([K.left, K.right, K.fire]);
  const modelDown = k => held.has(k) || !!tapTimers[k];
  function sync(k) {
    if (!worker) return;
    const want = modelDown(k) || (userDown.has(k) && !(aimActive && AIM_KEYS.has(k)));
    if (want === sentDown.has(k)) return;
    worker.postMessage({ type: "key", key: k, down: want });
    want ? sentDown.add(k) : sentDown.delete(k);
  }
  const syncAll = () => { for (const k of Object.values(K)) sync(k); };
  function setHeld(names) { held = new Set(names.map(n => K[n])); syncAll(); }
  function tap(name, tics) {
    const k = K[name];
    clearTimeout(tapTimers[k]);
    tapTimers[k] = setTimeout(() => { delete tapTimers[k]; sync(k); }, tics * TIC_MS);
    sync(k);
  }

  function setAimActive(on) {
    aimActive = on;
    syncAll();
  }
  /* Only the answer's aim and fire are used, after the map guards. advance, hold and scan are yours to play. */
  function aimKeys(s, a) {
    const g = DoomBot.guard(s, a), t = g.turn, taps = [];
    if (t === "left" || t === "right") taps.push([t, 4]);
    if (t === "nudge_left") taps.push(["left", 2]);
    if (t === "nudge_right") taps.push(["right", 2]);
    setAimActive(t !== "scan");
    return { fire: g.fire, turn: t, why: t === "scan" ? "you control" : "model aims", held: g.fire ? ["fire"] : [], taps };
  }

  /* The loading screen, drawn on the game's own canvas. */
  function hud(text, progress = null) {
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#c9c9c9"; ctx.font = "22px ui-monospace, Menlo, monospace";
    ctx.textAlign = "center"; ctx.fillText(text, w / 2, h / 2 - 8);
    if (progress === null) return;
    const bw = w * .5, bx = (w - bw) / 2, by = h / 2 + 16;
    ctx.strokeStyle = "#555"; ctx.strokeRect(bx + .5, by + .5, bw, 10);
    ctx.fillStyle = "#c9c9c9"; ctx.fillRect(bx + 2, by + 2, (bw - 3) * Math.min(1, progress), 7);
  }

  function showStats() {
    $("doom-rate").textContent = (decisions / ((performance.now() - rateStart) / 1000)).toFixed(2);
    const sorted = [...lats].sort((a, b) => a - b);
    $("doom-lat").textContent = sorted.length ? sorted[sorted.length >> 1].toFixed(0) + " ms" : "—";
  }

  function apply(d, lat) {
    setHeld(d.held);
    for (const [name, tics] of d.taps) tap(name, tics);
    decisions++; lats.push(lat); if (lats.length > 60) lats.shift();
    pushTape(d);
    showStats();
  }

  /* You do the moving, so the model's movement answers (advance: walk closer; scan: nothing in sight) both
     show as "wait". The model still answers with its seven options; this only changes what's displayed. */
  const shown = t => (t === "advance" || t === "scan" ? "wait" : t);
  function mergedProbs(probs) {
    const out = {};
    for (const [o, q] of Object.entries(probs)) out[shown(o)] = (out[shown(o)] || 0) + q;
    return out;
  }

  /* The turn Choice as a histogram laid out the way the crosshair moves, with wait set apart. The columns are
     fixed, so only the bars change while you play. */
  const AIM = [["left", "«", "left"], ["nudge_left", "‹", "nudge"], ["hold", "•", "hold"],
               ["nudge_right", "›", "nudge"], ["right", "»", "right"], ["wait", "–", "wait"]];
  const GLYPH = Object.fromEntries(AIM.map(([o, g]) => [o, g]));
  const cols = {};
  for (const [o, glyph, name] of AIM) {
    const el = document.createElement("div");
    el.className = "aim-col" + (o === "wait" ? " wait" : "");
    el.innerHTML = `<span class="aim-pct">0%</span><span class="aim-well"><i></i></span><span class="aim-glyph">${glyph}</span><span class="aim-name">${name}</span>`;
    probsEl.appendChild(el);
    cols[o] = { el, bar: el.querySelector("i"), pct: el.firstElementChild };
  }
  const fireFill = $("fire-fill"), fireP = $("fire-p"), fireNo = $("fire-no"), fireYes = $("fire-yes"), turnPick = $("turn-pick");
  /* What's drawn follows a running average over about a tenth of a second, and the highlighted turn changes only
     after the new leader has led for 2 answers in a row. The keys still follow every raw answer; this only calms the
     display, which would otherwise flip up to 8.75 times a second. */
  const SMOOTH_MS = 90, HOLD = 2;
  let smFire = 0, smTurn = null, lastShown = 0, pickShown = null, challenger = null, challengerRuns = 0;
  function showAnswer(m) {
    const now = performance.now(), a = smTurn ? 1 - Math.exp(-(now - lastShown) / SMOOTH_MS) : 1;
    lastShown = now;
    const merged = mergedProbs(m.turn.probs);
    smFire += a * (m.fire.p - smFire);
    smTurn = smTurn || {};
    for (const [o] of AIM) smTurn[o] = (smTurn[o] || 0) + a * ((merged[o] || 0) - (smTurn[o] || 0));

    const fire = smFire >= .5;
    fireFill.style.width = (smFire * 100).toFixed(1) + "%";
    fireNo.classList.toggle("on", !fire); fireYes.classList.toggle("on", fire);
    fireP.textContent = smFire.toFixed(2);

    const leader = AIM.map(([o]) => o).reduce((x, y) => (smTurn[y] > smTurn[x] ? y : x));
    if (!pickShown) pickShown = leader;
    else if (leader !== pickShown) {
      challengerRuns = leader === challenger ? challengerRuns + 1 : 1;
      challenger = leader;
      if (challengerRuns >= HOLD) { pickShown = leader; challengerRuns = 0; }
    } else challengerRuns = 0;
    turnPick.textContent = pickShown;
    for (const [o] of AIM) {
      const q = smTurn[o], c = cols[o];
      c.bar.style.height = (q * 100).toFixed(1) + "%";
      c.pct.textContent = Math.round(q * 100) + "%";
      c.el.classList.toggle("top", o === pickShown);
    }
  }

  /* The last 24 decisions as played, newest on the right: the turn as a glyph, a filled cell when it fired. */
  const TAPE = 24, tapeCells = [];
  for (let i = 0; i < TAPE; i++) tapeCells.push(tapeEl.appendChild(document.createElement("span")));
  const tape = [];
  function pushTape(d) {
    const t = shown(d.turn);
    tape.push({ glyph: GLYPH[t] || "·", fire: d.fire, aim: t !== "wait" });
    if (tape.length > TAPE) tape.shift();
    const off = TAPE - tape.length;
    tapeCells.forEach((cell, i) => {
      const x = tape[i - off];
      cell.textContent = x ? x.glyph : "";
      cell.className = x ? (x.aim ? "aiming" : "") + (x.fire ? " fire" : "") : "";
    });
  }

  function slot() {
    const s = engineState;
    if (!s) return;
    if (!s.valid || s.dead) {
      setAimActive(false); setHeld([]);
      stateEl.textContent = s.dead ? "You died. Press Space to respawn." : "Loading the level.";
      return;
    }
    if (busy) { skipped++; showStats(); return; } // the previous keys stay applied
    const text = DoomBot.describe(s);
    stateEl.textContent = text;
    busy = true;
    pending = { id: ++reqId, s, start: performance.now() };
    model.postMessage({ type: "decide", id: pending.id, text });
  }

  function onAnswer(e) {
    const m = e.data;
    if (m.type === "error") { busy = false; pending = null; console.error(m.message); return; }
    if (m.type !== "answer" || !pending || m.id !== pending.id) return;
    const { s, start } = pending;
    busy = false; pending = null;
    if (!running) return;
    showAnswer(m);
    apply(aimKeys(s, { fire: m.fire.p >= .5, turn: m.turn.choice }), performance.now() - start);
  }

  /* The game runs only while it has focus and is on screen; otherwise it waits behind "Click to play". */
  let decideTimer = null;
  function syncRun() {
    if (ready) {
      cover.hidden = focused && !paused;
    }
    const want = ready && !paused && focused && inView && !document.hidden;
    if (want === running) return;
    running = want;
    worker.postMessage({ type: "run", on: want });
    if (want) {
      if (!t0) t0 = performance.now();
      rateStart = performance.now(); decisions = 0;
      decideTimer = setInterval(slot, SLOT_MS);
    } else {
      clearInterval(decideTimer); setHeld([]); setAimActive(false);
    }
  }
  document.addEventListener("visibilitychange", syncRun);
  const observer = new IntersectionObserver(es => { inView = es[0].isIntersecting; syncRun(); });
  observer.observe(screenEl);

  /* Fetches the files as ArrayBuffers, reporting progress over the whole group. */
  async function fetchAll(urls, total, onProgress) {
    let got = 0;
    const show = () => onProgress(Math.min(1, got / total));
    show();
    return Promise.all(urls.map(async url => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${url} (${r.status})`);
      if (!r.body) { const b = await r.arrayBuffer(); got += b.byteLength; show(); return b; }
      const reader = r.body.getReader(), parts = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value); got += value.length; show();
      }
      return await new Blob(parts).arrayBuffer();
    }));
  }

  async function loadGame() {
    const [wasm, wad] = await fetchAll(GAME_FILES, GAME_BYTES,
      p => hud(`Loading game… ${Math.round(p * 100)}%`, p));
    hud("Starting game…");
    worker = new Worker("/lab/doom/worker.js");
    await new Promise((resolve, reject) => {
      worker.onerror = err => reject(new Error(err.message || "the game worker failed"));
      worker.onmessage = e => {
        const m = e.data;
        if (m.type === "ready") resolve();
        else if (m.type === "frame") {
          engineState = m.state;
          ctx.drawImage(m.bitmap, 0, 0, canvas.width, canvas.height);
          m.bitmap.close();
          // Priming: stop on the first frame of the level, so the start of the game shows behind "Click to play".
          if (priming && m.state.valid && !running) { priming = false; worker.postMessage({ type: "run", on: false }); }
        }
      };
      worker.postMessage({ type: "init", wasm, wad }, [wasm, wad]);
    });
  }

  async function loadModel() {
    const [wasm, cact, headsBuf] = await fetchAll(MODEL_FILES, MODEL_BYTES,
      p => hud(`Loading model… ${Math.round(p * 100)}%`, p));
    hud("Starting model…");
    model = new Worker("/lab/needle/model-worker.js");
    await new Promise((resolve, reject) => {
      model.onerror = err => reject(new Error(err.message || "the model worker failed"));
      model.onmessage = e => {
        if (e.data.type === "ready") resolve();
        else if (e.data.type === "error") reject(new Error(e.data.message));
      };
      const heads = JSON.parse(new TextDecoder().decode(headsBuf));
      model.postMessage({ type: "init", wasm, cact, heads }, [wasm, cact]);
    });
    model.onmessage = onAnswer;
  }

  let disposed = false;
  async function boot() {
    let step = "game";
    try {
      await loadGame();
      if (disposed) return;
      step = "model";
      await loadModel();
      if (disposed) return;
    } catch (err) {
      console.error(err);
      hud(`Couldn't load the ${step}. Reload the page to try again.`);
      return;
    }
    // Run the engine just until the level is on screen, then hold that frame behind "Click to play".
    priming = true;
    worker.postMessage({ type: "run", on: true });
    ready = true;
    syncRun();
  }

  /* Your keys reach the game only while it has focus, so the page still scrolls normally. */
  const MANUAL = { w: K.up, s: K.down, a: K.strafeLeft, d: K.strafeRight, arrowup: K.up, arrowdown: K.down,
    arrowleft: K.left, arrowright: K.right, " ": K.use };
  for (const type of ["keydown", "keyup"]) screenEl.addEventListener(type, e => {
    if (e.key === "Escape") {
      if (ready && type === "keydown" && !e.repeat) { e.preventDefault(); setPaused(!paused); }
      return;
    }
    const k = MANUAL[e.key.toLowerCase()];
    if (!ready || paused || k === undefined) return;
    e.preventDefault();
    if (e.repeat) return;
    type === "keydown" ? userDown.add(k) : userDown.delete(k);
    sync(k);
  });
  /* Esc pauses the game and the model together; Esc again or a click on the game resumes. */
  function setPaused(p) {
    paused = p;
    if (!p) screenEl.focus();
    syncRun();
  }
  screenEl.addEventListener("pointerdown", () => { if (paused && ready) setPaused(false); else screenEl.focus(); });
  screenEl.addEventListener("focus", () => { focused = true; syncRun(); });
  screenEl.addEventListener("blur", () => { focused = false; userDown.clear(); syncAll(); syncRun(); });

  hud("Loading game…", 0);
  const idle = window.requestIdleCallback ? requestIdleCallback(boot, { timeout: 1500 }) : setTimeout(boot, 300);

  return () => {
    disposed = true;
    if (window.cancelIdleCallback) cancelIdleCallback(idle); else clearTimeout(idle);
    document.removeEventListener("visibilitychange", syncRun);
    observer.disconnect();
    clearInterval(decideTimer);
    for (const t of Object.values(tapTimers)) clearTimeout(t);
    if (worker) worker.terminate();
    if (model) model.terminate();
  };
}
