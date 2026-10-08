importScripts("needle.js");

/* The model in a worker, after needle.js (createNeedle). Its wasm engine embeds the state sentence (needle_embed),
   then the two heads answer the reference agent's questions: fire = sigmoid((w.v + b) / T), turn = softmax((W v + b) / T).
   In: {type: "init", wasm, cact, heads} (ArrayBuffers and the heads object), {type: "decide", id, text}.
   Out: {type: "ready", dim}, {type: "answer", id, fire: {p}, turn: {choice, probs}}, {type: "error", message}. */
let M = null, heads = null, dim = 0, outPtr = 0, strPtr = 0, strCap = 0;

function cstr(text) {
  const bytes = new TextEncoder().encode(text + "\0");
  if (bytes.length > strCap) { if (strPtr) M._free(strPtr); strCap = bytes.length * 2; strPtr = M._malloc(strCap); }
  M.HEAPU8.set(bytes, strPtr);
  return strPtr;
}

async function init(m) {
  // needle.js would look for needle.wasm next to the worker; hand it the bytes instead.
  M = await createNeedle({ wasmBinary: new Uint8Array(m.wasm), print: () => {}, printErr: () => {} });
  const bytes = new Uint8Array(m.cact), p = M._malloc(bytes.length);
  M.HEAPU8.set(bytes, p);
  if (M._needle_load(p, BigInt(bytes.length)) < 0) throw new Error("needle_load failed");
  dim = M._needle_embed(cstr("x"), 0, 0, 0, 0);
  const h = m.heads;
  if (dim !== h.dim) throw new Error(`engine dim ${dim} != heads dim ${h.dim}`);
  outPtr = M._malloc(dim * 4);
  heads = { fireW: Float32Array.from(h.fire.w), fireB: h.fire.b, fireT: h.fire.temperature,
            turnW: h.turn.w.map(r => Float32Array.from(r)), turnB: h.turn.b, turnT: h.turn.temperature,
            options: h.turn.options };
}

const dot = (a, v) => { let s = 0; for (let i = 0; i < v.length; i++) s += a[i] * v[i]; return s; };

function decide(text) {
  const rc = M._needle_embed(cstr(text), 0, 0, outPtr, dim);
  if (rc !== dim) throw new Error("needle_embed failed " + rc);
  const v = new Float32Array(M.HEAPU8.buffer, outPtr, dim);
  const zf = (dot(heads.fireW, v) + heads.fireB) / heads.fireT;
  const zt = heads.turnW.map((w, k) => (dot(w, v) + heads.turnB[k]) / heads.turnT);
  const top = Math.max(...zt), e = zt.map(z => Math.exp(z - top)), sum = e.reduce((a, b) => a + b, 0);
  const probs = Object.fromEntries(heads.options.map((o, k) => [o, e[k] / sum]));
  return { fire: { p: 1 / (1 + Math.exp(-zf)) }, turn: { choice: heads.options[zt.indexOf(top)], probs } };
}

self.onmessage = async e => {
  const m = e.data;
  try {
    if (m.type === "init") { await init(m); self.postMessage({ type: "ready", dim }); }
    else if (m.type === "decide") self.postMessage({ type: "answer", id: m.id, ...decide(m.text) });
  } catch (err) {
    self.postMessage({ type: "error", message: String(err && err.message || err) });
  }
};
