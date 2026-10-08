import { GameAudio } from "./audio";
import { Engine } from "./engine";
import { Input } from "./input";
import { Juice } from "./juice";
import { applyRun, appendHistory, loadRecords } from "./records";
import { Renderer } from "./renderer";
import { COLS, VISIBLE_ROWS } from "./types";
import { clearLabel, useTris } from "./store";
import type { Settings } from "./types";

export type Controller = {
  destroy: () => void;
  start: () => void;
  restart: () => void;
  pause: () => void;
  resume: () => void;
  quit: () => void;
  applySettings: (s: Settings) => void;
  beginRebind: (action: keyof Settings["bindings"]) => void;
  cancelRebind: () => void;
  setEnabled: (v: boolean) => void;
  resize: () => void;
  engine: Engine;
  input: Input;
  audio: GameAudio;
};

import { beginLeaderboardRun, newRunId } from "./leaderboard";

export function createController(opts: {
  canvas: HTMLCanvasElement;
  stage: HTMLElement;
}): Controller {
  let settings = useTris.getState().settings;
  const engine = new Engine(settings);
  const input = new Input(engine, settings);
  const audio = new GameAudio(settings);
  const juice = new Juice();
  juice.apply({ reduced: settings.reducedMotion, shake: settings.screenShake });
  const renderer = new Renderer(opts.canvas);

  let raf = 0;
  let last = performance.now();
  let hudAcc = 0;
  let running = true;
  let labelTimer = 0;
  let toastTimer = 0;
  let bestPulse = 0;
  let lastBestScore = useTris.getState().records.highScore;
  let bestCrossMs: number | null = null;

  const syncHud = (force = false) => {
    const snap = engine.snapshot();
    const st = useTris.getState();
    if (
      !force &&
      st.phase === snap.phase &&
      st.score === snap.score &&
      st.lines === snap.lines &&
      st.level === snap.level &&
      st.hold === snap.hold &&
      Math.floor(st.timeMs / 250) === Math.floor(snap.timeMs / 250)
    ) {
      useTris.getState().patch({ timeMs: snap.timeMs, pieces: snap.pieces });
      return;
    }
    useTris.getState().patch({
      phase: snap.phase,
      score: snap.score,
      lines: snap.lines,
      level: snap.level,
      timeMs: snap.timeMs,
      hold: snap.hold,
      holdLocked: snap.holdLocked,
      next: snap.next,
      combo: snap.combo,
      b2b: snap.b2b,
      pieces: snap.pieces,
    });
  };

  engine.on((e) => {
    if (e.type === "move") audio.move();
    if (e.type === "rotate") audio.rotate();
    if (e.type === "hold") audio.hold();
    if (e.type === "lock") {
      juice.hit(e.hard ? "hard" : "lock");
      if (e.hard) audio.hardDrop();
      else audio.lock();
    }
    if (e.type === "clear") {
      const difficult = e.event.tspin !== "none" || e.event.lines >= 4;
      juice.hit(e.event.lines >= 4 ? "tetris" : "clear");
      audio.lineClear(e.event.lines, difficult);
      if (e.event.combo >= 1) audio.combo(e.event.combo);
      const label = clearLabel(e.event.kind, e.event.b2b, e.event.combo);
      useTris.getState().patch({ lastClearLabel: `${label} +${e.event.scoreGain}`, clearSerial: useTris.getState().clearSerial + 1 });
      labelTimer = 1.1;
      if (engine.mode === "endless" && engine.score > lastBestScore && lastBestScore > 0) {
        const rec = useTris.getState().records;
        if (engine.score > rec.highScore) {
          useTris.getState().patch({ newBest: true });
          audio.newBest();
          bestPulse = 2.2;
        }
      }
    }
    if (e.type === "level") {
      audio.levelUp();
      audio.setIntensity(e.level);
      useTris.getState().patch({ levelToast: e.level, level: e.level });
      toastTimer = 1.4;
    }
    if (e.type === "over") {
      if (e.completed) audio.levelUp(); else audio.gameOver();
      input.enabled = false;
      input.clearHeld();
      const rec = loadRecords(engine.mode);
      const { records, flags } = applyRun(rec, {
        score: engine.score,
        timeMs: engine.timeMs,
        level: engine.level,
        lines: engine.lines,
        completed: e.completed,
      }, engine.mode);
      lastBestScore = records.highScore;
      const pieces = engine.pieces;
      const pps = engine.timeMs > 0 ? pieces / (engine.timeMs / 1000) : 0;
      const history = appendHistory({
        at: Date.now(),
        mode: engine.mode,
        completed: !!e.completed,
        score: engine.score,
        lines: engine.lines,
        level: engine.level,
        timeMs: engine.timeMs,
        pieces,
        pps,
        bestCrossMs,
      });
      useTris.getState().patch({
        phase: "over",
        lastRun: history[0],
        records,
        history,
        pieces,
        bestCrossMs,
        completed: !!e.completed,
        deathReason: e.completed ? null : e.reason,
        newBest: engine.mode === "sprint" ? flags.sprint : flags.score && engine.score > 0,
        overlay: null,
      });
      if (engine.mode === "sprint" ? flags.sprint : flags.score) audio.newBest();
      syncHud(true);
    }
    if (e.type === "start") {
      const runId = newRunId();
      useTris.getState().patch({ rankedRunId: runId, rankedState: "pending", lastRun: null, submittedRunId: null });
      beginLeaderboardRun(runId, engine.mode).then(() => {
        if (running && useTris.getState().rankedRunId === runId) useTris.getState().patch({ rankedState: "ready" });
      }).catch(() => {
        if (running && useTris.getState().rankedRunId === runId) useTris.getState().patch({ rankedState: "offline" });
      });
      audio.unlock();
      audio.startMusic();
      audio.setIntensity(1);
      useTris.getState().patch({
        newBest: false,
        completed: false,
        lastClearLabel: null,
        levelToast: null,
        overlay: null,
        deathReason: null,
        pieces: 0,
        bestCrossMs: null,
      });
      lastBestScore = useTris.getState().records.highScore;
      bestCrossMs = null;
      syncHud(true);
    }
    if (e.type === "score" && engine.mode === "endless") {
      const rec = useTris.getState().records;
      if (e.total > rec.highScore && rec.highScore > 0 && bestCrossMs == null) {
        bestCrossMs = engine.timeMs;
      }
      if (e.total > rec.highScore && rec.highScore > 0 && !useTris.getState().newBest) {
        useTris.getState().patch({ newBest: true, bestCrossMs });
        bestPulse = 2.2;
      }
    }
    hudAcc = 1;
  });

  const layout = () => {
    const stage = opts.stage;
    const parent = stage.parentElement;
    const style = getComputedStyle(parent ?? stage);
    const h = Math.max(80, (parent?.clientHeight ?? stage.clientHeight) - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom));
    const parentW = parent?.clientWidth ?? document.documentElement.clientWidth;
    const railW = parent
      ? Array.from(parent.querySelectorAll(".rail")).reduce((sum, el) => sum + (el as HTMLElement).offsetWidth, 0)
      : 280;
    const gap = (parseFloat(style.columnGap) || 0) * 2 + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + 2;
    const maxW = Math.max(80, parentW - railW - gap);
    const cell = Math.max(8, Math.floor(Math.min(maxW / COLS, (h - 4) / VISIBLE_ROWS)));
    renderer.resize(cell * COLS, cell * VISIBLE_ROWS);
  };

  const loop = (now: number) => {
    if (!running) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    input.pollPad(now);
    if (input.padPause && !useTris.getState().overlay) {
      input.padPause = false;
      if (engine.phase === "playing") pause();
      else if (engine.phase === "paused") resume();
    }
    input.tick(now);
    engine.step(dt, input.softHeld());
    juice.update(dt);
    if (labelTimer > 0) {
      labelTimer -= dt;
      if (labelTimer <= 0) useTris.getState().patch({ lastClearLabel: null });
    }
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) useTris.getState().patch({ levelToast: null });
    }
    if (bestPulse > 0) {
      bestPulse -= dt;
      if (bestPulse <= 0 && engine.phase === "playing") {
        /* keep badge until run ends if still beating */
      }
    }
    renderer.draw(engine.snapshot(), settings, juice);
    hudAcc += dt;
    if (hudAcc >= 0.05) {
      hudAcc = 0;
      syncHud();
    }
    raf = requestAnimationFrame(loop);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.metaKey && e.code !== "MetaLeft" && e.code !== "MetaRight") return;
    if (e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    if (!input.rebinding && target?.closest("input, select, textarea, [contenteditable=true]")) return;
    if (!input.rebinding && target?.closest("button") && (e.code === "Space" || e.code === "Enter")) return;
    audio.unlock();
    if (input.rebinding) {
      e.preventDefault();
      if (e.code === "Escape") {
        input.rebinding = null;
        useTris.getState().patch({ rebinding: null });
        return;
      }
      const action = input.rebinding;
      const next = { ...settings, bindings: { ...settings.bindings } };
      next.bindings[action] = [e.code];
      // remove from other actions
      (Object.keys(next.bindings) as (keyof Settings["bindings"])[]).forEach((k) => {
        if (k === action) return;
        next.bindings[k] = next.bindings[k].filter((c) => c !== e.code);
      });
      input.rebinding = null;
      useTris.getState().patch({ rebinding: null });
      useTris.getState().setSettings(next);
      applySettings(next);
      return;
    }

    const overlay = useTris.getState().overlay;
    const phase = engine.phase;
    const action = input.actionFor(e.code);

    if (e.repeat) {
      if (action || e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
      return;
    }

    if (overlay === "help" || overlay === "settings" || overlay === "leaderboard") {
      if (action === "pause" || e.code === "Escape") {
        e.preventDefault();
        useTris.getState().setOverlay(null);
        if (input.rebinding) {
          input.rebinding = null;
          useTris.getState().patch({ rebinding: null });
        }
      }
      return;
    }

    if (e.code === "Enter" && phase === "over") {
      e.preventDefault();
      useTris.getState().setOverlay(overlay === "results" ? null : "results");
      return;
    }

    if (action === "restart" && phase !== "ready") {
      e.preventDefault();
      restart();
      return;
    }

    if (phase === "ready") {
      if (overlay) return;
      if (e.code === "Space" || action === "hard") {
        e.preventDefault();
        start();
      }
      return;
    }

    if (action === "pause" || e.code === "Escape") {
      e.preventDefault();
      if (phase === "playing") pause();
      else if (phase === "paused") resume();
      else if (phase === "over") useTris.getState().setOverlay(null);
      return;
    }

    if (phase === "paused" || phase === "over") return;

    if (action || e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
    input.onKeyDown(e.code);
  };

  const onKeyUp = (e: KeyboardEvent) => {
    input.onKeyUp(e.code);
  };

  const onBlur = () => {
    input.clearHeld();
    if (engine.phase === "playing") pause();
  };

  const onVis = () => {
    if (document.hidden) {
      input.clearHeld();
      if (engine.phase === "playing") pause();
    } else {
      audio.resume();
    }
  };

  function start() {
    audio.unlock();
    engine.mode = useTris.getState().mode;
    useTris.getState().patch({ records: loadRecords(engine.mode) });
    engine.start();
    input.enabled = true;
    input.resetDas();
    useTris.getState().patch({ phase: "playing", overlay: null });
    syncHud(true);
  }

  function restart() {
    audio.unlock();
    engine.restart();
    input.enabled = true;
    input.resetDas();
    input.clearHeld();
    useTris.getState().patch({ phase: "playing", overlay: null, newBest: false });
    syncHud(true);
  }

  function pause() {
    if (engine.phase !== "playing") return;
    engine.pause();
    input.enabled = false;
    input.clearHeld();
    input.buffer = null;
    useTris.getState().patch({ phase: "paused" });
  }

  function resume() {
    if (engine.phase !== "paused") return;
    engine.resume();
    input.enabled = true;
    const t = performance.now();
    last = t;
    input.stamp(t);
    useTris.getState().patch({ phase: "playing", overlay: null });
  }

  function quit() {
    engine.toReady();
    input.enabled = true;
    input.clearHeld();
    useTris.getState().patch({
      phase: "ready",
      overlay: null,
      score: 0,
      lines: 0,
      level: 1,
      timeMs: 0,
      hold: null,
      next: engine.peekNext(6),
      lastClearLabel: null,
      levelToast: null,
      newBest: false,
    });
    syncHud(true);
  }

  function applySettings(s: Settings) {
    settings = s;
    engine.applySettings(s);
    input.applySettings(s);
    audio.applySettings(s);
    juice.apply({ reduced: s.reducedMotion, shake: s.screenShake });
    if (s.fullscreen) {
      if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => {});
    } else if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => {});
    }
  }

  function beginRebind(action: keyof Settings["bindings"]) {
    input.rebinding = action;
    useTris.getState().patch({ rebinding: action });
  }

  function cancelRebind() {
    input.rebinding = null;
    useTris.getState().patch({ rebinding: null });
  }

  const onResize = () => layout();
  layout();
  renderer.draw(engine.snapshot(), settings, juice);
  useTris.getState().patch({ next: engine.peekNext(6), records: loadRecords() });

  window.addEventListener("keydown", onKeyDown, { capture: true });
  window.addEventListener("keyup", onKeyUp, { capture: true });
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("resize", onResize);
  const ro = new ResizeObserver(layout);
  ro.observe(opts.stage);

  last = performance.now();
  raf = requestAnimationFrame(loop);

  const api: Controller = {
    destroy: () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown, { capture: true } as AddEventListenerOptions);
      window.removeEventListener("keyup", onKeyUp, { capture: true } as AddEventListenerOptions);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      audio.destroy();
    },
    start,
    restart,
    pause,
    resume,
    quit,
    applySettings,
    beginRebind,
    cancelRebind,
    setEnabled: (v) => {
      input.enabled = v;
      if (!v) input.clearHeld();
    },
    resize: layout,
    engine,
    input,
    audio,
  };

  (window as unknown as { __tris: unknown }).__tris = {
    get phase() {
      return engine.phase;
    },
    get score() {
      return engine.score;
    },
    get level() {
      return engine.level;
    },
    get lines() {
      return engine.lines;
    },
    get pieceX() {
      return engine.active?.x ?? null;
    },
    get pieceY() {
      return engine.active?.y ?? null;
    },
    get arrMs() {
      return input.settings.arrMs;
    },
    get dasMs() {
      return input.settings.dasMs;
    },
    start,
    restart,
    pause,
    resume,
    quit,
    engine,
    input,
  };

  return api;
}
