"use client";

import { useEffect } from "react";
import { mountDoomLab } from "../lab/doom-lab";

// The game screen and the model's HUD; app/lab/doom-lab.js loads the game and model and drives both.
export default function DoomLab() {
  useEffect(() => mountDoomLab(), []);
  return (
    <div className="lab-shell">
      <div className="panel" id="panel-doom">
        <div className="controls" aria-label="Controls">
          <span className="desktop-only"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move</span>
          <span className="desktop-only"><kbd>←</kbd><kbd>→</kbd> turn the crosshair</span>
          <span className="desktop-only"><kbd>Space</kbd> open doors, respawn, next level</span>
          <span className="desktop-only"><kbd>P</kbd> pause</span>
          <span className="desktop-only"><kbd>F</kbd> full screen</span>
          <span className="touch-only"><kbd>Left stick</kbd> move</span>
          <span className="touch-only"><kbd>Drag on the game</kbd> turn the crosshair</span>
          <span className="touch-only"><kbd>USE</kbd> open doors, respawn, next level</span>
          <span className="touch-only"><kbd>Tap the game</kbd> show the full screen button</span>
          <span className="touch-only"><kbd>Tap outside</kbd> pause</span>
        </div>
        <div className="doom" id="doom-wrap">
          <div className="doom-screen" id="doom-screen" tabIndex={0} role="application"
            aria-label="DOOM. Move with W, A, S and D, and turn with the left and right arrow keys.">
            <canvas id="lab-canvas" width={640} height={400} />
            {/* Touch controls, shown only on touchscreens while the game runs: a fixed stick to move, a drag anywhere
                else to turn, and a button to use. */}
            <div className="touch-ui" aria-hidden="true">
              <div className="stick" id="doom-stick"><span className="stick-knob" id="doom-knob" /></div>
              <div className="touch-use" id="doom-use">USE</div>
            </div>
            <div className="play-cover" id="play-cover" hidden>Click to play</div>
            <button type="button" className="fs-btn" id="doom-fs" aria-label="Full screen (f)" title="Full screen (f)">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path className="fs-enter" d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
                <path className="fs-exit" d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" />
              </svg>
            </button>
          </div>
          <aside className="hud" aria-label="Model output">
            <section className="hud-block">
              <div className="hud-head"><span className="k">fire? · Noul</span><b className="hud-val" id="fire-p">—</b></div>
              <div className="meter" aria-hidden="true"><i id="fire-fill" /><span className="mid" /></div>
              <div className="meter-labels"><span id="fire-no" className="on">no</span><span className="k">0.5</span><span id="fire-yes">fire</span></div>
            </section>
            <section className="hud-block aim-block">
              <div className="hud-head"><span className="k">turn? · Choice</span><b className="hud-val" id="turn-pick">—</b></div>
              <div className="aim" id="doom-probs" />
            </section>
            <section className="hud-block">
              <div className="hud-head"><span className="k">last 24 decisions</span><span className="k">newest →</span></div>
              <div className="tape" id="doom-tape" aria-hidden="true" />
            </section>
            <div className="hud-stats">
              <div><span className="k">decisions/s</span><b id="doom-rate">—</b></div>
              <div><span className="k">latency p50</span><b id="doom-lat">—</b></div>
              <div><span className="k">cost</span><b>$0</b></div>
            </div>
          </aside>
        </div>
        <div className="feed">
          <span className="k">state sent to the model</span>
          <p id="doom-state">—</p>
        </div>
        <p className="muted small" style={{ maxWidth: "none" }}>
          Inspired by TypeSafe&apos;s Jev, we make a model perform quick actions without reasoning. Every four game tics, it
          reads the state of play as a single English sentence and answers two questions, whether to fire (a Noul) and
          which way to turn (a Choice).
        </p>
        <p className="mono muted">Game: DOOM (shareware episode) by id Software</p>
      </div>
    </div>
  );
}
