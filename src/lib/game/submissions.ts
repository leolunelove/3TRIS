import { postLeaderboardRun, savedNickname } from "./leaderboard";
import { useTris, type HudState } from "./store";
import type { RunRecord } from "./types";

const pending = new Map<string, Promise<void>>();

export function eligibleForLeaderboard(run: RunRecord): boolean {
  return run.score > 0 && (run.mode !== "sprint" || !!run.completed);
}

// The job owns a snapshot of the finished run, so restarting or closing the
// results panel cannot cancel it or replace its score with the next run's data.
export function submitScore(runId: string, run: RunRecord, nickname: string, ticket?: Promise<unknown>): Promise<void> {
  const existing = pending.get(runId);
  if (existing) return existing;
  if (!eligibleForLeaderboard(run) || useTris.getState().submittedRunId === runId) return Promise.resolve();
  const update = (patch: Partial<HudState>) => {
    if (useTris.getState().rankedRunId === runId) useTris.getState().patch(patch);
  };
  update({ submissionStatus: "sending", submissionMessage: "Posting your result…" });
  const job = (async () => {
    try {
      if (ticket) await ticket;
      const result = await postLeaderboardRun(runId, run, nickname);
      update({
        submittedRunId: runId,
        submissionStatus: "done",
        submissionMessage: result.rank
          ? `${result.improved ? "You made" : "Your best holds"} #${result.rank} in the top 10.`
          : "This run didn’t make the top 10. Your local personal best is saved.",
      });
    } catch (error) {
      update({ submissionStatus: "error", submissionMessage: error instanceof Error ? error.message : "Couldn’t post. Please try again." });
    } finally {
      pending.delete(runId);
    }
  })();
  pending.set(runId, job);
  return job;
}

export function autoSubmitScore(runId: string | null, run: RunRecord, ticket: Promise<unknown>): void {
  const nickname = savedNickname();
  if (runId && nickname && eligibleForLeaderboard(run)) void submitScore(runId, run, nickname, ticket);
}
