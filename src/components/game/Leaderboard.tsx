import { useEffect, useRef, useState } from "react";
import { getLeaderboard, postLeaderboardRun, savedNickname, type LeaderboardEntry } from "@/lib/game/leaderboard";
import { formatScore, formatSprintTime, useTris } from "@/lib/game/store";
import type { GameMode } from "@/lib/game/types";

export function Leaderboard() {
  const initialMode = useTris(s => s.mode);
  const [mode, setMode] = useState<GameMode>(initialMode);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [status, setStatus] = useState("loading");
  const [refresh, setRefresh] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    let active = true;
    const timeout = setTimeout(() => abort.abort(), 12000);
    setStatus("loading"); setEntries([]);
    getLeaderboard(mode, abort.signal).then(data => {
      if (active && !abort.signal.aborted) { setEntries(data.entries.slice(0, 10)); setStatus("ready"); }
    }).catch(() => { if (active) setStatus("error"); }).finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); abort.abort(); };
  }, [mode, refresh]);
  return <div className="overlay overlay-dim overlay-chrome leaderboard-overlay">
    <div className="leaderboard-panel" role="dialog" aria-modal="true" aria-labelledby="leaderboard-title" ref={panelRef} onKeyDown={e => {
      if (e.key !== "Tab") return;
      const controls = panelRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }}>
      <header className="leaderboard-head"><div><p className="ready-eyebrow">WORLDWIDE / TOP 10</p><h2 id="leaderboard-title">Leaderboard</h2></div><button ref={closeRef} type="button" className="text-link" onClick={() => useTris.getState().setOverlay(null)}>Close</button></header>
      <div className="mode-picker" aria-label="Leaderboard mode">{(["endless", "sprint"] as const).map(m => <button type="button" key={m} aria-pressed={m === mode} onClick={() => setMode(m)}>{m === "endless" ? "Endless" : "40-line sprint"}</button>)}</div>
      <p className="leaderboard-note">{mode === "endless" ? "Highest scores. One personal best per player." : "Fastest finishes. One personal best per player."}</p>
      <div aria-live="polite" className="leaderboard-content">
        {status === "loading" ? <p className="leaderboard-empty">Loading the top 10…</p> : status === "error" ? <div className="leaderboard-empty"><p>Couldn’t load the leaderboard.</p><button type="button" className="menu-btn" onClick={() => setRefresh(n => n + 1)}>Try again</button></div> : entries.length === 0 ? <div className="leaderboard-empty"><strong>The first spot is yours to chase.</strong><p>{mode === "sprint" ? "Finish 40 lines, then post your time." : "Finish a run, then post your score."}</p></div> : <table className="leaderboard-table"><caption className="sr-only">Top 10 {mode === "endless" ? "scores" : "sprint times"}</caption><thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">{mode === "endless" ? "Score" : "Time"}</th></tr></thead><tbody>{entries.map((entry, index) => <tr key={entry.id}><td className="rank-number">{String(index + 1).padStart(2, "0")}</td><th scope="row">{entry.nickname}</th><td>{mode === "endless" ? formatScore(entry.score) : formatSprintTime(entry.time_ms)}</td></tr>)}</tbody></table>}
      </div>
      <p className="leaderboard-foot">Play a run · Set your name · Make the top 10</p>
    </div>
  </div>;
}

export function SubmitScore() {
  const run = useTris(s => s.lastRun);
  const runId = useTris(s => s.rankedRunId);
  const session = useTris(s => s.rankedState);
  const [nickname, setNickname] = useState(savedNickname);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const submitted = useTris(s => s.submittedRunId);
  const locked = useRef(false);
  if (!run || !runId || run.score <= 0 || (run.mode === "sprint" && !run.completed)) return null;
  return <div className="submit-score">
    {submitted === runId || status === "done" ? <p className="submission-message" role="status">{message || "Your result has been posted."}</p> : session === "offline" ? <p className="submission-message">This run couldn’t connect to the leaderboard. Your local record is saved.</p> : <form onSubmit={async e => {
      e.preventDefault();
      if (locked.current || session !== "ready") return;
      locked.current = true; setStatus("sending"); setMessage("");
      try {
        const result = await postLeaderboardRun(runId, run, nickname);
        useTris.getState().patch({ submittedRunId: runId });
        setStatus("done");
        setMessage(result.rank ? `${result.improved ? "You made" : "Your best holds"} #${result.rank} in the top 10.` : "This run didn’t make the top 10. Your local personal best is saved.");
      } catch (error) { setStatus("error"); setMessage(error instanceof Error ? error.message : "Couldn’t post. Please try again."); }
      finally { locked.current = false; }
    }}>
      <label htmlFor="leaderboard-name">Your leaderboard name</label>
      <input id="leaderboard-name" value={nickname} onChange={e => setNickname(e.target.value)} minLength={2} maxLength={16} pattern={"[A-Za-z0-9 _\\-]{2,16}"} title="2–16 letters, numbers, spaces, underscores or hyphens" placeholder="Player name" autoComplete="nickname" required disabled={status === "sending"} />
      <button className="menu-btn primary" type="submit" disabled={session !== "ready" || status === "sending"}>{status === "sending" ? "Posting…" : session === "pending" ? "Connecting…" : run.mode === "sprint" ? "Post time" : "Post score"}</button>
      <p className="submission-message" role="status">{message || "Your name and result will be public."}</p>
    </form>}
    <button type="button" className="text-link" onClick={() => useTris.getState().setOverlay("leaderboard")}>View top 10</button>
  </div>;
}
