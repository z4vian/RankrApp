export const SCORE_UNLOCK_COUNT = 10;

export function getScoreProgress(count: number) {
  const total = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const remaining = Math.max(0, SCORE_UNLOCK_COUNT - total);
  return { total, remaining, unlocked: remaining === 0, progress: Math.min(total, SCORE_UNLOCK_COUNT) };
}

/** Preview mirrors guest import's existing evenly spaced score calculation. */
export function guestScore(index: number, count: number): number | null {
  if (!getScoreProgress(count).unlocked || index < 0 || index >= count) return null;
  return Number((10 - index * (9 / Math.max(count - 1, 1))).toFixed(2));
}
