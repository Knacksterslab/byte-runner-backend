export interface ScoredEntry {
  user_id: string;
  score: number;
  distance: number;
}

/**
 * Reduces an array of scored entries to one best entry per user.
 * Ties on score are broken by distance (higher wins).
 */
export function getBestScorePerUser<T extends ScoredEntry>(entries: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const entry of entries) {
    const existing = map.get(entry.user_id);
    if (
      !existing ||
      entry.score > existing.score ||
      (entry.score === existing.score && entry.distance > existing.distance)
    ) {
      map.set(entry.user_id, entry);
    }
  }
  return map;
}

/**
 * Sorts best-per-user entries by score desc, then distance desc.
 */
export function rankEntries<T extends ScoredEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.distance - a.distance;
  });
}
