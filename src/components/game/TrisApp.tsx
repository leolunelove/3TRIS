import { useEffect, useRef, useState } from "react";
import { createController, type Controller } from "@/lib/game/controller";
import { formatScore, formatTime, formatSprintTime, useTris } from "@/lib/game/store";
import { MiniPiece } from "./MiniPiece";
import { ChromeOverlays, PlayOverlays, PrefersReducedSync, TouchBar } from "./Overlays";

export function TrisApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [ctrl, setCtrl] = useState<Controller | null>(null);

  const mode = useTris((s) => s.mode);
  const phase = useTris((s) => s.phase);
  const score = useTris((s) => s.score);
  const lines = useTris((s) => s.lines);
  const level = useTris((s) => s.level);
  const pieces = useTris((s) => s.pieces);
  const timeMs = useTris((s) => s.timeMs);
  const hold = useTris((s) => s.hold);
  const holdLocked = useTris((s) => s.holdLocked);
  const next = useTris((s) => s.next);
  const newBest = useTris((s) => s.newBest);
  const records = useTris((s) => s.records);
  const settings = useTris((s) => s.settings);
  const overlay = useTris((s) => s.overlay);

  useEffect(() => {
    if (!canvasRef.current || !stageRef.current) return;
    const c = createController({ canvas: canvasRef.current, stage: stageRef.current });
    setCtrl(c);
    return () => c.destroy();
  }, []);

  useEffect(() => {
    if (!ctrl) return;
    if (overlay && useTris.getState().phase === "playing") ctrl.pause();
    if (overlay !== "settings") ctrl.cancelRebind();
  }, [overlay, ctrl]);

  const nextShown = settings.showNext ? next.slice(0, settings.nextCount) : [];

  return (
    <div className="tris-root">
      <PrefersReducedSync />
      <div className="bezel" />
      <header className="tris-top">
        <h1 className="wordmark" aria-label="3TRIS">
          <span className="wordmark-3">3</span>
          <span>TRIS</span>
        </h1>
        <span className="edition-label">{mode === "sprint" ? "40 LINES / SPRINT" : "ENDLESS / SURVIVAL"}</span>
        <nav className="top-nav" aria-label="Game controls">
          {phase === "playing" || phase === "paused" ? <button type="button" className="text-link pause-link" onClick={() => phase === "playing" ? ctrl?.pause() : ctrl?.resume()}>{phase === "playing" ? "Pause" : "Resume"}</button> : null}
          <button type="button" className="text-link" onClick={() => useTris.getState().setOverlay(overlay === "help" ? null : "help")}>
            How to play
          </button>
          <button type="button" className="text-link" onClick={() => useTris.getState().setOverlay(overlay === "settings" ? null : "settings")}>
            Settings
          </button>
        </nav>
      </header>

      <main className="tris-stage">
        <aside className="rail rail-left">
          <section className="slot">
            <p className="slot-label">Hold <span className="key-hint">C</span></p>
            <div className="slot-box">
              <MiniPiece id={hold} dimmed={holdLocked} size={16} palette={settings.palette} />
            </div>
          </section>
          <section className="stat-block">
            <p className="slot-label">
              Score
              {newBest && phase !== "ready" ? <span className="best-inline">NEW BEST</span> : null}
            </p>
            <p className="stat-num stat-score">{formatScore(score)}</p>
            {mode === "sprint" ? <p className="stat-sub">BEST {records.sprintBestMs ? formatSprintTime(records.sprintBestMs) : "—"}</p> : records.highScore > 0 ? <p className="stat-sub">BEST {formatScore(records.highScore)}</p> : null}
          </section>
          <div className="stat-row">
            <section>
              <p className="slot-label">Level</p>
              <p className="stat-num">{String(level).padStart(2, "0")}</p>
            </section>
            <section>
              <p className="slot-label">Lines</p>
              <p className="stat-num">{mode === "sprint" ? `${Math.min(lines, 40)}/40` : String(lines).padStart(3, "0")}</p>
            </section>
          </div>
          <div className="stat-row">
            <section>
              <p className="slot-label">Time</p>
              <p className="stat-num">{formatTime(timeMs)}</p>
            </section>
            <section>
              <p className="slot-label">Pace</p>
              <p className="stat-num">{timeMs > 400 ? (pieces / (timeMs / 1000)).toFixed(2) : "—"}</p>
              <p className="stat-sub">{pieces} pcs</p>
            </section>
          </div>
        </aside>

        <div className="well-wrap" ref={stageRef}>
          <div className="well">
            <canvas ref={canvasRef} className="playfield" aria-label="3TRIS game board. Use arrow keys to move, Z and X to rotate, and Space to drop." />
            {mode === "sprint" && phase !== "ready" ? <div className="sprint-progress" role="progressbar" aria-label="Sprint lines cleared" aria-valuenow={Math.min(lines, 40)} aria-valuemin={0} aria-valuemax={40}><span style={{ width: `${Math.min(lines / 40, 1) * 100}%` }} /></div> : null}
            <PlayOverlays ctrl={ctrl} />
          </div>
        </div>

        <aside className="rail rail-right">
          <section className="slot">
            <p className="slot-label">Next</p>
            <div className="next-stack">
              {nextShown.length === 0 ? (
                <div className="slot-box muted" />
              ) : (
                nextShown.map((id, i) => (
                  <div className="slot-box next-item" key={`${id}-${i}`}>
                    <MiniPiece id={id} size={i === 0 ? 16 : 12} palette={settings.palette} />
                  </div>
                ))
              )}
            </div>
          </section>
          <div className="control-guide"><p className="slot-label">Quick controls</p><p><kbd>← →</kbd> Move</p><p><kbd>Z X</kbd> Rotate</p><p><kbd>SPACE</kbd> Drop</p><p><kbd>ESC</kbd> Pause</p></div>
        </aside>
      </main>

      <div className="mobile-stats">
        <section>
          <p className="slot-label">Score</p>
          <p className="stat-num">{formatScore(score)}</p>
        </section>
        <section>
          <p className="slot-label">Level</p>
          <p className="stat-num">{String(level).padStart(2, "0")}</p>
        </section>
        <section>
          <p className="slot-label">Lines</p>
          <p className="stat-num">{mode === "sprint" ? `${Math.min(lines, 40)}/40` : String(lines).padStart(3, "0")}</p>
        </section>
        <section>
          <p className="slot-label">Time</p>
          <p className="stat-num">{formatTime(timeMs)}</p>
        </section>
      </div>

      <TouchBar ctrl={ctrl} />
      <ChromeOverlays ctrl={ctrl} />

      <footer className="tris-foot">
        {phase === "ready" ? (
          <p className="foot-copy">Place blocks. Clear lines. Don’t die.</p>
        ) : phase === "playing" ? (
          <p className="foot-copy muted-copy">R restart · ESC pause</p>
        ) : (
          <p className="foot-copy muted-copy">3TRIS</p>
        )}
      </footer>
    </div>
  );
}
