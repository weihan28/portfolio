// Mounted by app/components/MlaFlow.tsx into its <figure>; returns a cleanup function.
/* ---------- Hero background: DeepSeek-V2 Multi-Head Latent Attention as a flowing diagram ----------
   Originally an experiment (app/experiments/mla-2d), now drawn in the page's own colours.
   Trapezoids are weight matrices (wide side = larger dimension), bars are vectors. Each cycle, copies of the bars
   travel through the matrices. Accent bars are what gets cached during generation (c^KV and k^R); the warm part is
   RoPE. It only animates while the hero is on screen, and shows a single still frame for reduced motion. */
export function mountMla(host) {
  const NS = "http://www.w3.org/2000/svg";
  const VIOLET = "var(--accent)", INK = "var(--ink)", CACHE = "var(--accent)", ROPE = "var(--fire)", PLAIN = "var(--line)";
  const HEADS = 4, GAP = 0.06, BAR = 0.34, EMPTY_TINT = 0.16;
  const CYCLE = 13.5, FADE_START = 12.4, FROZEN_AT = 11.5;
  const UNIT = 60, LEFT = -9, TOP = 7.6, VB_W = 18 * UNIT, VB_H = 15.9 * UNIT;
  const X = x => (x - LEFT) * UNIT, Y = y => (TOP - y) * UNIT;

  const gapBefore = (parts, i) => (i === 0 ? 0 : (parts[i].gap ?? GAP));
  const totalGaps = parts => parts.reduce((a, _, i) => a + gapBefore(parts, i), 0);
  const totalWidth = parts => parts.reduce((a, p) => a + p.w, 0) + totalGaps(parts);
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  const clamp01 = t => Math.min(1, Math.max(0, t));
  const lerp = (a, b, t) => a + (b - a) * t;
  const segments = s => {
    let cursor = s.x - totalWidth(s.parts) / 2;
    return s.parts.map((p, i) => { cursor += gapBefore(s.parts, i); const seg = { cx: cursor + p.w / 2, w: p.w }; cursor += p.w; return seg; });
  };
  const heads = (width, color) => Array.from({ length: HEADS }, () => ({ w: (width - GAP * (HEADS - 1)) / HEADS, color }));
  const headW = (3.4 - GAP * (HEADS - 1)) / HEADS, ropeW = (2.4 - GAP * (HEADS - 1)) / HEADS;
  const pairs = rope => Array.from({ length: HEADS }, (_, i) => [
    { w: headW, color: PLAIN, gap: i === 0 ? 0 : 0.14 }, { w: ropeW, color: rope, gap: 0 }]).flat();
  const slot = (x, y, parts, label, place = "above") => ({ x, y, parts, label, place, fillAt: Infinity });
  const weight = (x, y, topW, botW, label, h = 1.2) => ({ x, y, topW, botW, h, label });

  const h = slot(0, 5.6, [{ w: 4, color: PLAIN }], "<b>h</b><sub>t</sub> ∈ ℝ<sup>d</sup>"); h.fillAt = 0;
  const wDQ = weight(-4.6, 3.9, 4, 1.4, "W<sup>DQ</sup> ∈ ℝ<sup>d′<sub>c</sub>×d</sup>");
  const cQ = slot(-4.6, 2.75, [{ w: 1.4, color: PLAIN }], "<b>c</b><sup>Q</sup><sub>t</sub> ∈ ℝ<sup>d′<sub>c</sub></sup>", "right");
  const wUQ = weight(-6.9, 1.25, 1.4, 3.4, "W<sup>UQ</sup>"), wQR = weight(-3.0, 1.25, 1.4, 2.4, "W<sup>QR</sup>");
  const qC = slot(-6.9, -0.1, heads(3.4, PLAIN), "<b>q</b><sup>C</sup><sub>t</sub> = [<b>q</b><sup>C</sup><sub>t,1</sub>; …; <b>q</b><sup>C</sup><sub>t,n<sub>h</sub></sub>]", "below");
  const qR = slot(-3.0, -0.1, heads(2.4, ROPE), "<b>q</b><sup>R</sup><sub>t</sub> = RoPE(W<sup>QR</sup><b>c</b><sup>Q</sup><sub>t</sub>)", "below");
  const wKR = weight(0, 3.9, 4, 0.8, "W<sup>KR</sup> ∈ ℝ<sup>d<sup>R</sup><sub>h</sub>×d</sup>");
  const kR = slot(0, 2.75, [{ w: 0.8, color: CACHE, cached: true }], "<b>k</b><sup>R</sup><sub>t</sub> = RoPE(W<sup>KR</sup><b>h</b><sub>t</sub>)", "right");
  const wDKV = weight(4.6, 3.9, 4, 1.4, "W<sup>DKV</sup> ∈ ℝ<sup>d<sub>c</sub>×d</sup>");
  const cKV = slot(4.6, 2.75, [{ w: 1.4, color: CACHE, cached: true }], "<b>c</b><sup>KV</sup><sub>t</sub> ∈ ℝ<sup>d<sub>c</sub></sup>", "right");
  const wUK = weight(3.0, 1.25, 1.4, 3.4, "W<sup>UK</sup>"), wUV = weight(6.9, 1.25, 1.4, 3.4, "W<sup>UV</sup>");
  const kC = slot(3.0, -0.1, heads(3.4, PLAIN), "<b>k</b><sup>C</sup><sub>t</sub>", "below");
  const vC = slot(6.9, -0.1, heads(3.4, PLAIN), "<b>v</b><sup>C</sup><sub>t</sub>", "below");
  const qi = slot(-6.0, -2.4, pairs(ROPE), "<b>q</b><sub>t,i</sub> = [<b>q</b><sup>C</sup><sub>t,i</sub>; <b>q</b><sup>R</sup><sub>t,i</sub>]", "below");
  const ki = slot(0.9, -2.4, pairs(CACHE), "<b>k</b><sub>t,i</sub> = [<b>k</b><sup>C</sup><sub>t,i</sub>; <b>k</b><sup>R</sup><sub>t</sub>]", "below");
  const vi = slot(6.6, -2.4, heads(3.4, PLAIN), "<b>v</b><sup>C</sup><sub>t,i</sub>", "below");
  const ATTN = { x: 0, y: -4.6, w: 8.5, h: 1.3 };
  const wO = weight(0, -6.3, 3.4, 4, "W<sup>O</sup> ∈ ℝ<sup>d×d<sub>h</sub>n<sub>h</sub></sup>", 1.0);
  const u = slot(0, -7.35, [{ w: 4, color: PLAIN }], "<b>u</b><sub>t</sub> = W<sup>O</sup>[<b>o</b><sub>t,1</sub>; …; <b>o</b><sub>t,n<sub>h</sub></sub>]", "below");
  const SLOTS = [h, cQ, qC, qR, kR, cKV, kC, vC, qi, ki, vi, u];
  const WEIGHTS = [wDQ, wUQ, wQR, wKR, wDKV, wUK, wUV, wO];
  const WEIGHT_NAMES = ["query compression", "query expansion", "query RoPE", "shared key RoPE",
    "KV compression", "key expansion", "value expansion", "output projection"];

  const ROUTES = [];
  const whole = s => ({ x: s.x, y: s.y, w: totalWidth(s.parts) });
  const seg = (s, i) => ({ x: segments(s)[i].cx, y: s.y, w: s.parts[i].w });
  const through = (src, via, dst, start, dur) => {
    ROUTES.push({ from: whole(src), via, to: whole(dst), inParts: src.parts, outParts: dst.parts, start, dur });
    dst.fillAt = Math.min(dst.fillAt, start + dur);
  };
  const move = (src, i, dst, j, start, dur) => {
    ROUTES.push({ from: seg(src, i), to: seg(dst, j), inParts: [src.parts[i]], outParts: [dst.parts[j]], start, dur });
    dst.fillAt = start + dur;
  };
  const attnIn = (src, x, start, dur) =>
    ROUTES.push({ from: whole(src), to: { x, y: ATTN.y, w: 0.3, edge: ATTN.h / 2 }, inParts: src.parts, outParts: src.parts, start, dur, fadeOut: true });

  through(h, wDQ, cQ, 0.8, 2.4); through(h, wKR, kR, 0.8, 2.4); through(h, wDKV, cKV, 0.8, 2.4);
  through(cQ, wUQ, qC, 3.6, 2.4); through(cQ, wQR, qR, 3.6, 2.4); through(cKV, wUK, kC, 3.6, 2.4); through(cKV, wUV, vC, 3.6, 2.4);
  for (let i = 0; i < HEADS; i++) {
    const start = 6.2 + i * 0.12;
    move(qC, i, qi, 2 * i, start, 1.4); move(qR, i, qi, 2 * i + 1, start, 1.4);
    move(kC, i, ki, 2 * i, start, 1.4); move(kR, 0, ki, 2 * i + 1, start, 1.4);
    move(vC, i, vi, i, start, 1.4);
  }
  const ATTN_IN = 8.1;
  attnIn(qi, -1.4, ATTN_IN, 1.0); attnIn(ki, 0.6, ATTN_IN, 1.0); attnIn(vi, 2.6, ATTN_IN, 1.0);
  ROUTES.push({ from: { x: ATTN.x, y: ATTN.y, w: 3.4, edge: ATTN.h / 2 }, via: wO, to: whole(u),
    inParts: heads(3.4, PLAIN), outParts: u.parts, start: 9.4, dur: 2.0, fadeIn: true });
  u.fillAt = 11.4;

  const legsOf = r => {
    const fromEdge = r.from.edge ?? BAR / 2, toEdge = r.to.edge ?? BAR / 2;
    if (!r.via) return [{ a: [r.from.x, r.from.y], b: [r.to.x, r.to.y], curved: true, w0: r.from.w, w1: r.to.w, span: 1, trimA: fromEdge, trimB: toEdge }];
    const top = r.via.y + r.via.h / 2, bottom = r.via.y - r.via.h / 2;
    return [
      { a: [r.from.x, r.from.y], b: [r.via.x, top], curved: true, w0: r.from.w, w1: r.via.topW, span: 0.36, trimA: fromEdge, trimB: 0 },
      { a: [r.via.x, top], b: [r.via.x, bottom], curved: false, w0: r.via.topW, w1: r.via.botW, span: 0.28, trimA: 0, trimB: 0 },
      { a: [r.via.x, bottom], b: [r.to.x, r.to.y], curved: true, w0: r.via.botW, w1: r.to.w, span: 0.36, trimA: 0, trimB: toEdge },
    ];
  };
  const pointOn = (leg, t) => {
    const [ax, ay] = leg.a, [bx, by] = leg.b;
    if (!leg.curved) return [lerp(ax, bx, t), lerp(ay, by, t)];
    const my = (ay + by) / 2, s = 1 - t;
    return [s * s * s * ax + 3 * s * s * t * ax + 3 * s * t * t * bx + t * t * t * bx,
            s * s * s * ay + 3 * s * s * t * my + 3 * s * t * t * my + t * t * t * by];
  };
  const pathOf = leg => {
    const ax = leg.a[0], ay = leg.a[1] - leg.trimA, bx = leg.b[0], by = leg.b[1] + leg.trimB, my = Y((ay + by) / 2);
    return `M${X(ax)} ${Y(ay)} C${X(ax)} ${my} ${X(bx)} ${my} ${X(bx)} ${Y(by)}`;
  };
  const LEGS = ROUTES.map(legsOf);
  const trapezoid = w => {
    const t = Y(w.y + w.h / 2), b = Y(w.y - w.h / 2);
    return `${X(w.x - w.topW / 2)},${t} ${X(w.x + w.topW / 2)},${t} ${X(w.x + w.botW / 2)},${b} ${X(w.x - w.botW / 2)},${b}`;
  };

  /* Build the SVG. Colours go through style so the theme tokens apply. */
  const el = (tag, attrs = {}, style = {}) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    Object.assign(e.style, style);
    return e;
  };
  const stage = document.createElement("div");
  stage.className = "flow-stage";
  stage.setAttribute("role", "img");
  stage.setAttribute("aria-label", "Multi-Head Latent Attention, animated");
  const svg = el("svg", { viewBox: `0 0 ${VB_W} ${VB_H}`, "aria-hidden": "true", preserveAspectRatio: "xMidYMid meet" });
  const guides = el("g", { fill: "none", "stroke-width": "1.5" }, { stroke: VIOLET, strokeOpacity: ".18" });
  LEGS.flat().filter(l => l.curved).forEach(l => guides.appendChild(el("path", { d: pathOf(l) })));
  svg.appendChild(guides);

  const slotEls = SLOTS.map(s => segments(s).map((sg, j) => {
    const r = el("rect", { x: X(sg.cx - sg.w / 2), y: Y(s.y + BAR / 2), width: sg.w * UNIT, height: BAR * UNIT, rx: 4,
      "fill-opacity": EMPTY_TINT, "stroke-opacity": .35, "stroke-width": 1.2, class: s.parts[j].cached ? "cached" : "" },
      { fill: s.parts[j].color, stroke: INK });
    svg.appendChild(r);
    return r;
  }));
  const movers = ROUTES.map(r => ["in", "out"].map(side => {
    const g = el("g", { opacity: 0 });
    (side === "in" ? r.inParts : r.outParts).forEach(p =>
      g.appendChild(el("rect", { height: BAR * UNIT, rx: 4, class: p.cached ? "cached" : "" }, { fill: p.color })));
    svg.appendChild(g);
    return g;
  }));
  const weightEls = WEIGHTS.map(w => {
    const p = el("polygon", { points: trapezoid(w), "fill-opacity": .1, "stroke-width": 2, "stroke-linejoin": "round" }, { fill: VIOLET, stroke: VIOLET });
    svg.appendChild(p);
    return p;
  });
  const attnEl = el("rect", { "data-attn": "", x: X(ATTN.x - ATTN.w / 2), y: Y(ATTN.y + ATTN.h / 2), width: ATTN.w * UNIT, height: ATTN.h * UNIT,
    rx: 22, "fill-opacity": .08, "stroke-width": 2 }, { fill: VIOLET, stroke: VIOLET });
  svg.appendChild(attnEl);
  stage.appendChild(svg);

  /* Labels, as in the experiment, placed in % of the stage so they track the diagram at any size. */
  const LABELS = [
    // Each matrix carries a plain name above its symbol, revealed while the matrix is hovered.
    ...WEIGHTS.map((w, i) => ({ html: `<span class="wname">${WEIGHT_NAMES[i]}</span><span class="wsym">${w.label}</span>`, x: w.x, y: w.y, cls: w.topW < w.botW ? "weight under" : "weight" })),
    ...SLOTS.map(s => {
      const half = totalWidth(s.parts) / 2;
      if (s.place === "right") return { html: s.label, x: s.x + half + 0.2, y: s.y, cls: "vector", left: true };
      return { html: s.label, x: s.x, y: s.place === "below" ? s.y - 0.5 : s.y + 0.5, cls: "vector" };
    }),
    { html: `<span class="wname">softmax attention</span><span class="wsym"><b>o</b><sub>t,i</sub> = Σ<sub>j≤t</sub> Softmax<sub>j</sub>(<b>q</b><sub>t,i</sub><sup>⊤</sup><b>k</b><sub>j,i</sub> / √(d<sub>h</sub>+d<sup>R</sup><sub>h</sub>)) <b>v</b><sup>C</sup><sub>j,i</sub></span>`, x: ATTN.x, y: ATTN.y, cls: "formula weight under" },
    { html: "Multi-Head Latent Attention (DeepSeek-V2)", x: 0, y: 7.3, cls: "note" },
    { html: '<span class="key"><i class="sw cache"></i>cached during generation</span><span class="key"><i class="sw rope"></i>rotary (RoPE) part</span>', x: 0, y: 6.8, cls: "note legend" },
  ];
  const labelLayer = document.createElement("div");
  labelLayer.className = "flow-labels";
  for (const l of LABELS) {
    const d = document.createElement("div");
    d.className = `flow-label ${l.cls}${l.left ? " left" : ""}`;
    d.style.left = (X(l.x) / VB_W * 100) + "%";
    d.style.top = (Y(l.y) / VB_H * 100) + "%";
    d.innerHTML = l.html;
    labelLayer.appendChild(d);
  }
  stage.appendChild(labelLayer);
  // Hovering a matrix names it: the name fades in above the symbol, which steps down to make room.
  const nameOnHover = (shape, label) => {
    shape.addEventListener("mouseenter", () => label.classList.add("named"));
    shape.addEventListener("mouseleave", () => label.classList.remove("named"));
  };
  weightEls.forEach((p, i) => nameOnHover(p, labelLayer.children[i]));
  nameOnHover(attnEl, labelLayer.querySelector(".flow-label.formula"));
  // The GitHub link to the implementation sits in the corner, like the links on the project cards.
  const hint = document.createElement("a");
  hint.className = "flow-hint";
  hint.href = "https://github.com/weihan28/paper_arch_implementations/tree/main/core/nn/deepseekv2";
  hint.target = "_blank";
  hint.rel = "noopener";
  hint.textContent = "GitHub ↗";
  hint.setAttribute("aria-label", "View the Multi-Head Latent Attention implementation on GitHub");
  stage.appendChild(hint); // inside the stage, so it fades in and out with the diagram
  host.appendChild(stage);

  const layout = (g, parts, cx, cy, width) => {
    const nominal = parts.reduce((a, p) => a + p.w, 0);
    const k = Math.max(0.02, (width - totalGaps(parts)) / nominal);
    let cursor = cx - width / 2;
    parts.forEach((p, i) => {
      cursor += gapBefore(parts, i);
      const w = p.w * k, r = g.children[i];
      r.setAttribute("x", X(cursor)); r.setAttribute("y", Y(cy + BAR / 2)); r.setAttribute("width", w * UNIT);
      cursor += w;
    });
  };

  const render = t => {
    const glow = new Array(WEIGHTS.length).fill(0);
    let attnGlow = 0;
    ROUTES.forEach((r, i) => {
      const [inG, outG] = movers[i], local = (t - r.start) / r.dur;
      if (local < 0 || local >= 1) { inG.setAttribute("opacity", 0); outG.setAttribute("opacity", 0); return; }
      const legs = LEGS[i], e = ease(local);
      let acc = 0, legIndex = legs.length - 1, legT = 1;
      for (let j = 0; j < legs.length; j++) {
        if (e <= acc + legs[j].span) { legIndex = j; legT = (e - acc) / legs[j].span; break; }
        acc += legs[j].span;
      }
      const leg = legs[legIndex], [cx, cy] = pointOn(leg, legT), width = lerp(leg.w0, leg.w1, legT);
      const mix = r.via ? (legIndex === 0 ? 0 : legIndex === 2 ? 1 : clamp01((legT - 0.2) / 0.6)) : clamp01((e - 0.4) / 0.2);
      let alpha = 1;
      if (r.fadeIn) alpha = Math.min(alpha, clamp01(local / 0.15));
      if (r.fadeOut) alpha = Math.min(alpha, clamp01((1 - local) / 0.3));
      layout(inG, r.inParts, cx, cy, width); layout(outG, r.outParts, cx, cy, width);
      inG.setAttribute("opacity", alpha * (1 - mix)); outG.setAttribute("opacity", alpha * mix);
      if (r.via && legIndex === 1) glow[WEIGHTS.indexOf(r.via)] = Math.sin(Math.PI * legT);
      if (r.fadeOut) attnGlow = Math.max(attnGlow, clamp01((local - 0.5) * 2));
    });
    weightEls.forEach((p, i) => p.setAttribute("fill-opacity", 0.1 + 0.22 * glow[i]));
    const after = t - (ATTN_IN + 1);
    attnEl.setAttribute("fill-opacity", 0.08 + 0.2 * (after > 0 ? Math.max(0, 1 - after / 1.2) : attnGlow));
    const fade = 1 - clamp01((t - FADE_START) / (CYCLE - FADE_START - 0.2));
    SLOTS.forEach((s, i) => {
      const filled = clamp01((t - s.fillAt) / 0.2) * (s === h ? clamp01(t / 0.5) : 1) * fade;
      slotEls[i].forEach(r => r.setAttribute("fill-opacity", lerp(EMPTY_TINT, 1, filled)));
    });
  };

  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let elapsed = still ? FROZEN_AT : 0, last = performance.now(), visible = true;
  render(elapsed % CYCLE);
  if (still) return () => host.replaceChildren();
  const observer = new IntersectionObserver(es => { visible = es[0].isIntersecting; });
  observer.observe(host);
  let raf = 0;
  const tick = now => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (!visible || document.hidden) return;
    elapsed += dt;
    render(elapsed % CYCLE);
  };
  raf = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(raf); observer.disconnect(); host.replaceChildren(); };
}
