import { useEffect, useRef } from "react";
import type { Controller } from "@/lib/game/controller";
import { DEFAULT_SETTINGS, ACTION_LABELS, HANDLING_PRESETS, codesLabel, saveSettings } from "@/lib/game/settings";
import { formatScore, formatTime, formatSprintTime, useTris, type SettingsTab } from "@/lib/game/store";
import { loadRecords } from "@/lib/game/records";
import type { Action, Settings } from "@/lib/game/types";

function OverlayFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="overlay overlay-dim">
      <div className="overlay-panel">{children}</div>
    </div>
  );
}

export function PlayOverlays({ ctrl }: { ctrl: Controller | null }) {
  const phase = useTris((s) => s.phase);
  const mode = useTris((s) => s.mode);
  const completed = useTris((s) => s.completed);
  const clearSerial = useTris((s) => s.clearSerial);
  const overlay = useTris((s) => s.overlay);
  const score = useTris((s) => s.score);
  const lines = useTris((s) => s.lines);
  const level = useTris((s) => s.level);
  const timeMs = useTris((s) => s.timeMs);
  const newBest = useTris((s) => s.newBest);
  const records = useTris((s) => s.records);
  const lastClearLabel = useTris((s) => s.lastClearLabel);
  const levelToast = useTris((s) => s.levelToast);
  const deathReason = useTris((s) => s.deathReason);
  const pieces = useTris((s) => s.pieces);
  const bestCrossMs = useTris((s) => s.bestCrossMs);
  const history = useTris((s) => s.history);

  return (
    <>
      {lastClearLabel && phase === "playing" ? (
        <div key={clearSerial} className="float-tag float-clear" role="status">
          {lastClearLabel}
        </div>
      ) : null}
      {levelToast && phase === "playing" ? (
        <div className="float-tag float-level" aria-hidden>
          LEVEL {String(levelToast).padStart(2, "0")}
        </div>
      ) : null}

      {phase === "ready" && overlay === null ? (
        <div className="ready-hint">
          <p className="ready-eyebrow">ONE MORE RUN.</p>
          <h2 className="ready-title">Find your<br />flow.</h2>
          <p className="ready-copy">{mode === "sprint" ? "40 lines. Your fastest time." : "Stack. Clear. Keep going."}</p>
          <div className="mode-picker" aria-label="Game mode">
            {(["endless", "sprint"] as const).map((m) => <button key={m} type="button" aria-pressed={mode === m} onClick={() => useTris.getState().patch({ mode: m, records: loadRecords(m) })}>{m === "endless" ? "Endless" : "40-line sprint"}</button>)}
          </div>
          <p className="ready-record">{mode === "sprint" ? records.sprintBestMs ? `BEST ${formatSprintTime(records.sprintBestMs)}` : "SET YOUR FIRST TIME" : records.highScore ? `BEST ${formatScore(records.highScore)}` : "SET YOUR FIRST BEST"}</p>
          <button type="button" className="start-cta" disabled={!ctrl} onClick={(e) => { ctrl?.start(); e.currentTarget.blur(); }}>
            Start playing <span aria-hidden="true">↗</span>
          </button>
          <p className="start-shortcut">or press SPACE</p>
        </div>
      ) : null}

      {phase === "paused" && overlay === null ? (
        <OverlayFrame>
          <p className="kicker">Paused</p>
          <div className="menu-stack">
            <button type="button" className="menu-btn primary" onClick={() => ctrl?.resume()}>
              Resume
            </button>
            <button type="button" className="menu-btn" onClick={() => ctrl?.restart()}>
              Restart
            </button>
            <button type="button" className="menu-btn" onClick={() => useTris.getState().setOverlay("settings")}>
              Settings
            </button>
            <button type="button" className="menu-btn" onClick={() => ctrl?.quit()}>
              Quit
            </button>
          </div>
        </OverlayFrame>
      ) : null}

      {phase === "over" && overlay !== "results" && overlay !== "settings" && overlay !== "help" ? (
        <OverlayFrame>
          <p className="kicker">{completed ? "Sprint complete" : "Run over"}</p>
          {newBest ? <p className="best-mark">{mode === "sprint" ? "NEW FASTEST TIME" : "NEW PERSONAL BEST"}</p> : <p className="summary-best">{mode === "sprint" ? records.sprintBestMs ? `BEST ${formatSprintTime(records.sprintBestMs)}` : "Finish 40 lines to set a time" : `BEST ${formatScore(records.highScore)}`}</p>}
          {deathReason ? <p className="help-copy">{deathReason}. Outlined cells closed the well.</p> : null}
          <dl className="result-grid">
            <div>
              <dt>Score</dt>
              <dd>{formatScore(score)}</dd>
            </div>
            <div>
              <dt>Lines</dt>
              <dd>{lines}</dd>
            </div>
            <div>
              <dt>Level</dt>
              <dd>{String(level).padStart(2, "0")}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{mode === "sprint" ? formatSprintTime(timeMs) : formatTime(timeMs)}</dd>
            </div>
          </dl>
          <p className="hint-row">
            <button type="button" className="text-link" onClick={() => ctrl?.restart()}>
              R — AGAIN
            </button>
            <button type="button" className="text-link" onClick={() => useTris.getState().setOverlay("results")}>
              ENTER — RESULTS
            </button>
          </p>
          <button type="button" className="text-link mode-menu" onClick={() => ctrl?.quit()}>Change mode</button>
        </OverlayFrame>
      ) : null}

      {overlay === "results" ? (
        <OverlayFrame>
          <p className="kicker">Results</p>
          <table className="records-table">
            <thead>
              <tr>
                <th />
                <th>Run</th>
                <th>Best</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>Score</th>
                <td>{formatScore(score)}</td>
                <td>{formatScore(records.highScore)}</td>
              </tr>
              <tr>
                <th>Lines</th>
                <td>{lines}</td>
                <td>{records.mostLines}</td>
              </tr>
              <tr>
                <th>Level</th>
                <td>{String(level).padStart(2, "0")}</td>
                <td>{String(records.highestLevel).padStart(2, "0")}</td>
              </tr>
              <tr>
                <th>Time</th>
                <td>{mode === "sprint" ? formatSprintTime(timeMs) : formatTime(timeMs)}</td>
                <td>{mode === "sprint" ? records.sprintBestMs ? formatSprintTime(records.sprintBestMs) : "—" : formatTime(records.longestMs)}</td>
              </tr>
              <tr>
                <th>Pieces</th>
                <td>{pieces}</td>
                <td>{timeMs > 0 ? `${(pieces / (timeMs / 1000)).toFixed(2)} /s` : "—"}</td>
              </tr>
              <tr>
                <th>Best at</th>
                <td>{bestCrossMs != null ? formatTime(bestCrossMs) : "—"}</td>
                <td>{bestCrossMs != null ? "passed" : "missed"}</td>
              </tr>
            </tbody>
          </table>
          {history.length > 0 ? (
            <div className="history-block">
              <p className="slot-label">Recent</p>
              <ol className="history-list">
                {history.filter((r) => (r.mode ?? "endless") === mode).slice(0, 5).map((run) => (
                  <li key={run.at}>
                    <span>{formatScore(run.score)}</span>
                    <span>L{String(run.level).padStart(2, "0")}</span>
                    <span>{formatTime(run.timeMs)}</span>
                    <span>{run.pps.toFixed(2)}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          <p className="hint-row">
            <button type="button" className="text-link" onClick={() => ctrl?.restart()}>
              R — AGAIN
            </button>
            <button type="button" className="text-link" onClick={() => useTris.getState().setOverlay(null)}>
              ESC — CLOSE
            </button>
          </p>
          <button type="button" className="text-link mode-menu" onClick={() => ctrl?.quit()}>Change mode</button>
        </OverlayFrame>
      ) : null}
    </>
  );
}

export function ChromeOverlays({ ctrl }: { ctrl: Controller | null }) {
  const overlay = useTris((s) => s.overlay);
  if (overlay === "help") return <HelpOverlay />;
  if (overlay === "settings") return <SettingsOverlay ctrl={ctrl} />;
  return null;
}

function HelpOverlay() {
  return (
    <div className="overlay overlay-dim overlay-chrome">
      <div className="overlay-panel">
        <p className="kicker">How to play</p>
        <p className="help-lead">Place blocks. Clear lines. Don’t die.</p>
        <p className="help-copy">Endless: survive as gravity rises. Sprint: clear 40 lines at a steady speed, as fast as you can. Bests are saved on this device.</p>
        <dl className="help-keys">
          <div>
            <dt>Move</dt>
            <dd>← →</dd>
          </div>
          <div>
            <dt>Soft drop</dt>
            <dd>↓</dd>
          </div>
          <div>
            <dt>Hard drop</dt>
            <dd>SPACE</dd>
          </div>
          <div>
            <dt>Rotate</dt>
            <dd>Z / X / Q</dd>
          </div>
          <div>
            <dt>Also</dt>
            <dd>WASD · pad</dd>
          </div>
          <div>
            <dt>Hold</dt>
            <dd>C</dd>
          </div>
          <div>
            <dt>Restart</dt>
            <dd>R</dd>
          </div>
          <div>
            <dt>Pause</dt>
            <dd>ESC</dd>
          </div>
        </dl>
        <button type="button" className="menu-btn primary" onClick={() => useTris.getState().setOverlay(null)}>
          Close
        </button>
      </div>
    </div>
  );
}

const ACTIONS: Action[] = ["left", "right", "soft", "hard", "rotCCW", "rotCW", "rot180", "hold", "restart", "pause"];

function SettingsOverlay({ ctrl }: { ctrl: Controller | null }) {
  const settings = useTris((s) => s.settings);
  const rebinding = useTris((s) => s.rebinding);
  const tab = useTris((s) => s.settingsTab);

  const set = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    useTris.getState().setSettings(next);
    ctrl?.applySettings(next);
  };

  return (
    <div className="overlay overlay-dim overlay-settings">
      <div className="settings-panel" role="dialog" aria-label="Settings">
        <header className="settings-head">
          <p className="kicker">Settings</p>
          <button type="button" className="text-link" onClick={() => useTris.getState().setOverlay(null)}>
            Close
          </button>
        </header>
        <div className="settings-tabs" role="tablist">
          {(["controls", "video", "audio", "game"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={tab === t ? "tab on" : "tab"}
              onClick={() => useTris.getState().patch({ settingsTab: t as SettingsTab })}
            >
              {t}
            </button>
          ))}
        </div>
        <SettingsBody tab={tab} set={set} settings={settings} rebinding={rebinding} ctrl={ctrl} />
        <footer className="settings-foot">
          <button
            type="button"
            className="menu-btn"
            onClick={() => {
              const next: Settings = {
                ...DEFAULT_SETTINGS,
                bindings: {
                  left: [...DEFAULT_SETTINGS.bindings.left],
                  right: [...DEFAULT_SETTINGS.bindings.right],
                  soft: [...DEFAULT_SETTINGS.bindings.soft],
                  hard: [...DEFAULT_SETTINGS.bindings.hard],
                  rotCCW: [...DEFAULT_SETTINGS.bindings.rotCCW],
                  rotCW: [...DEFAULT_SETTINGS.bindings.rotCW],
                  hold: [...DEFAULT_SETTINGS.bindings.hold],
                  restart: [...DEFAULT_SETTINGS.bindings.restart],
                  pause: [...DEFAULT_SETTINGS.bindings.pause],
                  rot180: [...DEFAULT_SETTINGS.bindings.rot180],
                },
              };
              saveSettings(next);
              useTris.getState().setSettings(next);
              ctrl?.applySettings(next);
            }}
          >
            Reset to defaults
          </button>
        </footer>
      </div>
    </div>
  );
}

function SettingsBody({
  tab,
  set,
  settings,
  rebinding,
  ctrl,
}: {
  tab: SettingsTab;
  set: (p: Partial<Settings>) => void;
  settings: Settings;
  rebinding: Action | null;
  ctrl: Controller | null;
}) {
  if (tab === "controls") {
    return (
      <div className="settings-body">
        <ul className="bind-list">
          {ACTIONS.map((a) => (
            <li key={a}>
              <span>{ACTION_LABELS[a]}</span>
              <button
                type="button"
                className={rebinding === a ? "bind-key waiting" : "bind-key"}
                onClick={() => ctrl?.beginRebind(a)}
              >
                {rebinding === a ? "Press a key" : codesLabel(settings.bindings[a])}
              </button>
            </li>
          ))}
        </ul>
        <p className="slider-hint">Presets change timing only. Your key bindings stay the same.</p>
        <div className="preset-row">
          {HANDLING_PRESETS.map((p) => {
            const on =
              settings.dasMs === p.dasMs &&
              settings.arrMs === p.arrMs &&
              settings.sdf === p.sdf &&
              settings.sdfInf === p.sdfInf;
            return (
              <button
                key={p.id}
                type="button"
                className={on ? "bind-key waiting" : "bind-key"}
                onClick={() => set({ dasMs: p.dasMs, arrMs: p.arrMs, sdf: p.sdf, sdfInf: p.sdfInf })}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <Slider
          label="DAS"
          hint="Delay before auto-shift"
          min={0}
          max={400}
          step={1}
          value={settings.dasMs}
          suffix="ms"
          onChange={(v) => set({ dasMs: v })}
        />
        <Slider
          label="ARR"
          hint="Time between shifts · 0 is fastest"
          min={0}
          max={80}
          step={1}
          value={settings.arrMs}
          suffix="ms"
          display={settings.arrMs <= 0 ? "FAST" : undefined}
          onChange={(v) => set({ arrMs: v })}
        />
        <div className="slider-row">
          <div>
            <p className="slider-label">Soft drop</p>
            <p className="slider-hint">Speed multiplier</p>
          </div>
          <div className="slider-ctrl">
            <input
              type="range"
              min={1}
              max={60}
              step={1}
              disabled={settings.sdfInf}
              value={settings.sdf}
              onChange={(e) => set({ sdf: Number(e.target.value), sdfInf: false })}
            />
            <button
              type="button"
              className={settings.sdfInf ? "bind-key waiting" : "bind-key"}
              onClick={() => set({ sdfInf: !settings.sdfInf })}
            >
              {settings.sdfInf ? "INF" : `${settings.sdf}×`}
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (tab === "video") {
    return (
      <div className="settings-body">
        <Toggle label="Fullscreen" on={settings.fullscreen} onChange={(v) => set({ fullscreen: v })} />
        <Toggle label="Screen shake" on={settings.screenShake} onChange={(v) => set({ screenShake: v })} />
        <Toggle label="Reduced motion" on={settings.reducedMotion} onChange={(v) => set({ reducedMotion: v })} />
        <Toggle label="Grid" on={settings.gridVisible} onChange={(v) => set({ gridVisible: v })} />
        <Toggle label="Contrast pieces" on={settings.palette === "contrast"} onChange={(v) => set({ palette: v ? "contrast" : "standard" })} />
        <Slider
          label="Ghost piece"
          hint="Opacity"
          min={0}
          max={100}
          step={5}
          value={Math.round(settings.ghostOpacity * 100)}
          suffix="%"
          onChange={(v) => set({ ghostOpacity: v / 100 })}
        />
      </div>
    );
  }
  if (tab === "audio") {
    return (
      <div className="settings-body">
        <Slider label="Master" min={0} max={100} step={1} value={Math.round(settings.master * 100)} suffix="%" onChange={(v) => set({ master: v / 100 })} />
        <Slider label="Music" min={0} max={100} step={1} value={Math.round(settings.music * 100)} suffix="%" onChange={(v) => set({ music: v / 100 })} />
        <Slider label="SFX" min={0} max={100} step={1} value={Math.round(settings.sfx * 100)} suffix="%" onChange={(v) => set({ sfx: v / 100 })} />
      </div>
    );
  }
  return (
    <div className="settings-body">
      <Toggle label="Show next pieces" on={settings.showNext} onChange={(v) => set({ showNext: v })} />
      <Slider
        label="Next queue"
        hint="Pieces displayed"
        min={1}
        max={6}
        step={1}
        value={settings.nextCount}
        suffix=""
        onChange={(v) => set({ nextCount: v })}
      />
    </div>
  );
}

function Slider({
  label,
  hint,
  min,
  max,
  step,
  value,
  suffix,
  display,
  onChange,
}: {
  label: string;
  hint?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  suffix: string;
  display?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="slider-row">
      <div>
        <p className="slider-label">{label}</p>
        {hint ? <p className="slider-hint">{hint}</p> : null}
      </div>
      <div className="slider-ctrl">
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        <span className="slider-val">
          {display ?? `${value}${suffix}`}
        </span>
      </div>
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" className="toggle-row" role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span>{label}</span>
      <span className={on ? "switch on" : "switch"} />
    </button>
  );
}

export function TouchBar({ ctrl }: { ctrl: Controller | null }) {
  const phase = useTris((s) => s.phase);
  const overlay = useTris((s) => s.overlay);
  if (phase === "ready" || phase === "over") return null;
  const down = (action: Action) => (e: React.PointerEvent) => {
    e.preventDefault();
    if (phase !== "playing" || overlay) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const code = ctrl?.input.settings.bindings[action][0];
    if (code) ctrl?.input.onKeyDown(code);
  };
  const up = (action: Action) => (e: React.PointerEvent) => {
    e.preventDefault();
    const code = ctrl?.input.settings.bindings[action][0];
    if (code) ctrl?.input.onKeyUp(code);
  };
  return (
    <fieldset disabled={phase !== "playing" || !!overlay} className="touch-bar" aria-label="Touch controls" onContextMenu={(e) => e.preventDefault()}>
      <button type="button" className="touch-btn" onPointerDown={down("hold")} onPointerUp={up("hold")} onPointerCancel={up("hold")}>
        HOLD
      </button>
      <button type="button" className="touch-btn" aria-label="Move left" onPointerDown={down("left")} onPointerUp={up("left")} onPointerCancel={up("left")}>
        ←
      </button>
      <button type="button" className="touch-btn" aria-label="Move right" onPointerDown={down("right")} onPointerUp={up("right")} onPointerCancel={up("right")}>
        →
      </button>
      <button type="button" className="touch-btn" aria-label="Rotate 180 degrees" onPointerDown={down("rot180")} onPointerUp={up("rot180")} onPointerCancel={up("rot180")}>
        180
      </button>
      <button type="button" className="touch-btn" aria-label="Rotate counterclockwise" onPointerDown={down("rotCCW")} onPointerUp={up("rotCCW")} onPointerCancel={up("rotCCW")}>
        CCW
      </button>
      <button type="button" className="touch-btn" aria-label="Rotate clockwise" onPointerDown={down("rotCW")} onPointerUp={up("rotCW")} onPointerCancel={up("rotCW")}>
        CW
      </button>
      <button type="button" className="touch-btn" aria-label="Soft drop" onPointerDown={down("soft")} onPointerUp={up("soft")} onPointerCancel={up("soft")}>
        ↓
      </button>
      <button type="button" className="touch-btn hard" onPointerDown={down("hard")} onPointerUp={up("hard")} onPointerCancel={up("hard")}>
        DROP
      </button>
    </fieldset>
  );
}

export function PrefersReducedSync() {
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches && !useTris.getState().settings.reducedMotion) {
      const s = { ...useTris.getState().settings, reducedMotion: true };
      useTris.getState().setSettings(s);
    }
  }, []);
  return null;
}
