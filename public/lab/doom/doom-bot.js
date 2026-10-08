/* DOOM bot: reads the engine's state export, decides every 4 tics.
   The model's input and labels are exactly the reference agent's (by William Petit, MIT, see LICENSE-MIT.txt): readState()
   builds their Observation the way their observe() does from ViZDoom's labels, and describe() and scripted() are
   their state.py and policies.py, ported unchanged. Everything else is ours and outside the model: the explorer
   (when the answer is "scan"), doors, respawn, and optional guards for DOOM's maps (see create()). */
const DoomBot = (() => {
  const KINDS = [null, "Zombieman", "ShotgunGuy", "ChaingunGuy", "DoomImp", "Demon", "Spectre", "Cacodemon", "LostSoul", "BaronOfHell"];
  const FRAC = 65536;

  /* Layout of dg_state_t in dg_state.c: every field is 4 bytes. The enemies are ViZDoom-style labels: first column
     drawn and column span. Offset, distance and lined_up follow the reference agent's observe() exactly, in doubles:
       middle = x + width / 2; offset = (middle - centre) / centre; lined_up = x <= centre <= x + width;
       distance = ((mx - px) ** 2 + (my - py) ** 2) ** 0.5; enemies sorted by distance (stable). */
  function readState(heap32, heapf32, ptr) {
    const i = ptr >> 2;
    const s = {
      valid: !!heap32[i], health: heap32[i + 1], ammo: heap32[i + 2], dead: !!heap32[i + 3], weapon: heap32[i + 4],
      x: heapf32[i + 5], y: heapf32[i + 6], angle: heapf32[i + 7],
      rays: Array.from(heapf32.subarray(i + 8, i + 16)), doors: Array.from(heap32.subarray(i + 16, i + 24)),
      enemies: [],
    };
    const centre = heap32[i + 24] / 2, px = heap32[i + 25] / FRAC, py = heap32[i + 26] / FRAC;
    s.z = heap32[i + 27] / FRAC;
    const n = heap32[i + 28];
    // The raw export, as ViZDoom would hand it to observe(): for tests against the reference agent's Python.
    // y and height (rows drawn) are for display only: the reference agent reads columns.
    s.raw = { width: heap32[i + 24], x: heap32[i + 25], y: heap32[i + 26], labels: [] };
    for (let k = 0; k < n; k++) {
      const o = i + 29 + k * 12, x = heap32[o + 1], width = heap32[o + 2];
      s.raw.labels.push({ name: KINDS[heap32[o]], x, width, y: heap32[o + 3], height: heap32[o + 4], mx: heap32[o + 5], my: heap32[o + 6] });
      const dx = heap32[o + 5] / FRAC - px, dy = heap32[o + 6] / FRAC - py;
      s.enemies.push({ name: KINDS[heap32[o]], offset: (x + width / 2 - centre) / centre,
        distance: Math.sqrt(dx * dx + dy * dy), linedUp: x <= centre && centre <= x + width,
        z: heap32[o + 7] / FRAC, id: heap32[o + 8],
        hittable: !!heap32[o + 9], reachable: !!heap32[o + 10], health: heap32[o + 11] });
    }
    s.enemies.sort((a, b) => a.distance - b.distance);
    return s;
  }

  /* ---- Reference agent: state.py describe() and policies.py scripted(), unchanged ---- */
  const NAMES = { Zombieman: "a zombie", ShotgunGuy: "a shotgun zombie", ChaingunGuy: "a chaingun zombie",
    DoomImp: "an imp", Demon: "a demon", Spectre: "a spectre", Cacodemon: "a cacodemon", LostSoul: "a lost soul",
    BaronOfHell: "a baron of hell", HellKnight: "a hell knight" };
  const DISTANCES = [[200, "very close"], [400, "close"], [650, "at mid range"]];
  const howFar = d => (DISTANCES.find(([lim]) => d < lim) || [0, "far away"])[1];
  const sideOf = e => (e.offset < 0 ? "left" : "right");
  const slightlyOff = e => !e.linedUp && Math.abs(e.offset) <= .15;
  const isClose = e => e.distance < 400;
  function where(e) {
    if (e.linedUp) return "lined up with the crosshair";
    const a = Math.abs(e.offset), s = sideOf(e);
    if (a <= .15) return `slightly to the ${s} of the crosshair`;
    if (a <= .5) return `to the ${s} of the crosshair`;
    return `far to the ${s} of the crosshair`;
  }
  function plainName(name) {
    if (name.startsWith("Marine")) return name.includes("Chainsaw") ? "a marine with a chainsaw" : "a marine";
    return NAMES[name] || "an enemy";
  }
  function describe(obs) {
    const parts = [`Health ${obs.health}%, ${obs.ammo} bullets left.`];
    const n = obs.enemies.length;
    if (!n) return parts.concat("No enemy in sight.").join(" ");
    parts.push(n === 1 ? "One enemy in sight." : `${n} enemies in sight.`);
    const shown = obs.enemies.slice(0, 3);
    shown.forEach((e, i) => parts.push(`${i ? "Another" : "The nearest"}, ${plainName(e.name)}, is ${howFar(e.distance)} and ${where(e)}.`));
    if (obs.enemies.some(e => e.linedUp) && !shown.some(e => e.linedUp)) parts.push("An enemy further back is lined up with the crosshair.");
    return parts.join(" ");
  }
  function scripted(obs) {
    const e = obs.enemies[0];
    let turn;
    if (!e) turn = "scan";
    else if (e.linedUp) turn = isClose(e) ? "hold" : "advance";
    else if (slightlyOff(e)) turn = "nudge_" + sideOf(e);
    else turn = sideOf(e);
    return { fire: obs.enemies.some(x => x.linedUp), turn };
  }

  /* ---- Guards (ours, outside the model): fixes for DOOM's maps, applied to the answer after it is made ----
     - "unseen": no monster in view can be walked to or shot (behind a window, across a ledge): explore instead.
     - "no hit": fire, but DOOM's own aim test says no lined-up monster would be hit: don't fire.
     - "punch": fists or chainsaw, hold, but the nearest lined-up monster is out of reach: advance.
     - "no path": advance, but the nearest monster can't be walked to: hold (shoot from here). With fists or the
       chainsaw there's nothing to shoot with, so explore instead. */
  const FIST = 0, CHAINSAW = 7;
  function guard(s, a) {
    const applied = [], e = s.enemies[0], melee = s.weapon === FIST || s.weapon === CHAINSAW;
    if (e && !s.enemies.some(m => m.reachable || m.hittable)) return { fire: false, turn: "scan", guards: ["unseen"] };
    let { fire, turn } = a;
    if (fire && !s.enemies.some(m => m.hittable)) { fire = false; applied.push("no hit"); }
    if (e && turn === "hold" && e.linedUp && !e.hittable && melee) { turn = "advance"; applied.push("punch"); }
    if (e && turn === "advance" && !e.reachable) { turn = melee ? "scan" : "hold"; applied.push("no path"); }
    return { fire, turn, guards: applied };
  }

  /* ---- Explorer (ours): head for open space not visited yet ---- */
  /* guards: apply the map fixes above (default). Off, the bot plays exactly what the answer says. */
  function create({ guards = true } = {}) {
    const visits = new Map();
    const cell = (x, y) => `${Math.floor(x / 96)},${Math.floor(y / 96)}`;
    let target = null, sinceChoice = 99, lastPos = null, still = 0, lastTurn = null;

    const angleDiff = (a, b) => ((a - b + 540) % 360) - 180; // a - b in (-180, 180]

    function choose(s, avoidAhead) {
      let best = -Infinity, bestI = 0;
      for (let i = 0; i < 8; i++) {
        const d = s.rays[i];
        if (d < 80 && !s.doors[i]) continue;
        if (i === 0 && avoidAhead) continue;
        const a = (s.angle + i * 45) * Math.PI / 180, probe = Math.min(d - 40, 192);
        const v = visits.get(cell(s.x + Math.cos(a) * probe, s.y + Math.sin(a) * probe)) || 0;
        const score = Math.min(d, 512) / 512 + 2 / (1 + v) + (s.doors[i] ? .6 : 0) + (i === 0 ? .2 : 0) - (i === 4 ? .3 : 0) + Math.random() * .2;
        if (score > best) { best = score; bestI = i; }
      }
      target = (s.angle + bestI * 45) % 360;
      sinceChoice = 0;
    }

    function explore(s) {
      const here = cell(s.x, s.y);
      visits.set(here, (visits.get(here) || 0) + 1);
      if (lastPos && lastTurn === "advance" && Math.hypot(s.x - lastPos[0], s.y - lastPos[1]) < 2) still++; else still = 0;
      lastPos = [s.x, s.y];

      // doors[0]: 1 closed, press use; 2 already opening, wait (pressing use again would close it). Locked doors
      // without the key read as 0, walls, so the explorer goes elsewhere.
      if (s.doors[0] === 1 && s.rays[0] < 100) return { turn: "advance", use: true, nav: null, why: "door" };
      if (s.doors[0] === 2 && s.rays[0] < 100) return { turn: "hold", nav: null, why: "door" };
      // Commit to a heading until facing it; only then re-plan (blocked, or every ~1.4 s to keep exploring).
      const aligned = target !== null && Math.abs(angleDiff(target, s.angle)) <= 12;
      if (still >= 2) { still = 0; visits.set(here, (visits.get(here) || 0) + 5); choose(s, true); }
      else if (target === null || (aligned && (s.rays[0] < 72 || sinceChoice >= 12))) choose(s, s.rays[0] < 72);
      sinceChoice++;

      const diff = angleDiff(target, s.angle);
      if (Math.abs(diff) > 12) return { turn: diff > 0 ? "left" : "right", nav: diff > 0 ? "left" : "right", why: "explore" };
      return { turn: "advance", nav: null, why: "explore" };
    }

    /* One decision. `answer` is the model's {fire, turn} for describe(s); without one, the scripted policy answers
       (that's also what labels the training data). "scan" hands over to the explorer. Returns what to press: `held`
       keys stay down until the next decision, `taps` are pressed for a number of tics. Fight turns are short taps
       (DOOM's slow turn, no acceleration overshoot, as in the reference agent). Explore turns hold the key. */
    function decide(s, answer = null) {
      let d;
      if (!s.valid) d = { fire: false, turn: "hold", why: "loading" };
      else if (s.dead) d = { fire: false, turn: "hold", use: true, why: "respawn" };
      else {
        const a = answer || scripted(s), g = guards ? guard(s, a) : { ...a, guards: [] };
        if (g.turn === "scan") d = { fire: g.fire, ...explore(s), answer: a, guards: g.guards };
        else { d = { fire: g.fire, turn: g.turn, why: "fight", answer: a, guards: g.guards }; target = null; }
      }
      lastTurn = d.turn;

      const held = [], taps = [];
      if (d.fire) held.push("fire");
      if (d.turn === "advance" || d.turn === "scan") held.push("up");
      if (d.nav) held.push(d.nav);
      else {
        // A key held N tics turns (N - 1) x 1.76 degrees at DOOM's slow turn speed (measured).
        if (d.turn === "left" || d.turn === "right") taps.push([d.turn, 4]);   // about 5 degrees per decision
        if (d.turn === "nudge_left") taps.push(["left", 2]);                   // about 1.8 degrees
        if (d.turn === "nudge_right") taps.push(["right", 2]);
        if (d.turn === "scan") taps.push(["right", 3]);                        // about 3.5 degrees
      }
      if (d.use) taps.push(["use", 2]);
      const text = s.valid ? describe(s) : "Loading the level.";
      return { ...d, use: !!d.use, guards: d.guards || [], held, taps, text };
    }

    return { decide };
  }

  return { readState, describe, scripted, guard, create, KINDS };
})();
if (typeof module !== "undefined") module.exports = DoomBot;
if (typeof self !== "undefined") self.DoomBot = DoomBot;
