/* Runs inside a Web Worker, after doom-engine.js (createDoomModule) and the bot code (DoomBot).
   doomgeneric_Tick busy-waits for the next game tic (~24 ms), so it must stay off the main thread.
   Each frame is sent with the engine's state export, read straight from WebAssembly memory. */
let M = null, running = false, fb = 0, W = 0, H = 0;
let mouseDx = 0; // mouse turning since the last tick: DOOM keeps one mouse event per tic, so it's summed here

function b64ToBytes(b64) {
  const bin = atob(b64), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function frame() {
  if (!running) return;
  if (mouseDx) { M._DG_PushMouse(mouseDx); mouseDx = 0; }
  M._doomgeneric_Tick();
  const state = DoomBot.readState(M.HEAP32, M.HEAPF32, M._DG_GetState());
  const px = W * H, src = M.HEAPU32, base = fb >> 2, out = new Uint8ClampedArray(px * 4);
  for (let i = 0, o = 0; i < px; i++, o += 4) {
    const v = src[base + i];
    out[o] = (v >> 16) & 255; out[o + 1] = (v >> 8) & 255; out[o + 2] = v & 255; out[o + 3] = 255;
  }
  const bitmap = await createImageBitmap(new ImageData(out, W, H));
  self.postMessage({ type: "frame", bitmap, state }, [bitmap]);
  setTimeout(frame, 0);
}

self.onmessage = async e => {
  const m = e.data;
  if (m.type === "init") {
    // The page sends the files as ArrayBuffers; base64 strings (the sandboxed sketch) still work.
    const bytes = x => (typeof x === "string" ? b64ToBytes(x) : new Uint8Array(x));
    const wad = bytes(m.wad);
    const wasmBytes = bytes(m.wasm);
    M = await createDoomModule({
      // Hand the engine its WebAssembly directly: the sandbox can't fetch doom.wasm by URL.
      instantiateWasm(imports, done) {
        WebAssembly.instantiate(wasmBytes, imports).then(r => done(r.instance));
        return {};
      },
      preRun: [mod => { mod.FS_createPath("/", "doom", true, true); mod.FS_createDataFile("/doom", "doom1.wad", wad, true, false); }],
    });
    // E1M1 (Hangar) on skill 3, "Hurt me plenty", the same as the published sketch.
    const args = ["doom", "-iwad", "/doom/doom1.wad", "-warp", "1", "1", "-skill", "3"];
    const ptrs = args.map(a => {
      const p = M._malloc(a.length + 1);
      for (let i = 0; i < a.length; i++) M.HEAPU8[p + i] = a.charCodeAt(i);
      M.HEAPU8[p + a.length] = 0;
      return p;
    });
    const argv = M._malloc(ptrs.length * 4);
    ptrs.forEach((p, i) => { M.HEAPU32[(argv >> 2) + i] = p; });
    M._doomgeneric_Create(args.length, argv);
    fb = M._DG_GetFrameBuffer(); W = M._DG_GetScreenWidth(); H = M._DG_GetScreenHeight();
    self.postMessage({ type: "ready", width: W, height: H });
  } else if (m.type === "key" && M) {
    M._DG_PushKeyEvent(m.down ? 1 : 0, m.key);
  } else if (m.type === "mouse" && M) {
    mouseDx += m.dx | 0;
  } else if (m.type === "run" && M) {
    if (m.on && !running) { running = true; frame(); }
    if (!m.on) running = false;
  }
};
