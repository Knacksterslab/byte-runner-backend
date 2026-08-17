/**
 * Phish Kit resolver — deterministic lure resolution.
 *
 * Same (dateKey, partIds) ALWAYS yields the same office outcome and score on
 * both backend and frontend. The backend is the source of truth for scoring
 * (clients submit part IDs, never scores). Duplicated in the frontend at
 * lib/game/phishKit/resolver.ts — keep both copies identical.
 */
import {
  LURE_PARTS,
  OFFICE_PERSONAS,
  POOL_SIZES,
  type LurePart,
  type LureSlot,
  type OfficePersona,
} from './phish-kit.catalog';

export interface PersonaOutcome {
  persona: OfficePersona;
  fell: boolean;
  reported: boolean;
  hookedByPartId: string | null;
  fallProbability: number;
}

export interface Resolution {
  outcomes: PersonaOutcome[];
  score: number;
  falls: number;
  reports: number;
  dominantLever: string | null;
}

function fnv1a(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SLOTS: LureSlot[] = ['sender', 'pretext', 'pressure', 'payload'];

function shuffled<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Today's part pool — deterministic subset per slot from the day-seed. */
export function poolForDate(dateKey: string): Record<LureSlot, LurePart[]> {
  const rng = mulberry32(fnv1a(`${dateKey}:pool`));
  const pool = {} as Record<LureSlot, LurePart[]>;
  for (const slot of SLOTS) {
    const inSlot = LURE_PARTS.filter((p) => p.slot === slot);
    pool[slot] = shuffled(inSlot, rng).slice(0, POOL_SIZES[slot]);
  }
  return pool;
}

export class InvalidLureError extends Error {}

/**
 * Resolve a composed lure against the office. Throws InvalidLureError if the
 * parts are malformed or not in today's pool.
 */
export function resolveLure(dateKey: string, partIds: string[]): Resolution {
  const pool = poolForDate(dateKey);
  const parts: LurePart[] = [];
  for (const slot of SLOTS) {
    const part = pool[slot].find((p) => partIds.includes(p.id));
    if (!part) throw new InvalidLureError(`Missing/invalid ${slot} part for ${dateKey}`);
    parts.push(part);
  }
  if (parts.length !== partIds.filter(Boolean).length) {
    throw new InvalidLureError('Unexpected extra parts.');
  }

  const outcomes: PersonaOutcome[] = OFFICE_PERSONAS.map((persona) => {
    const rng = mulberry32(fnv1a(`${dateKey}:${persona.id}:${partIds.join('|')}`));
    const hookParts = parts.filter((p) => p.levers.some((l) => persona.weaknesses.includes(l)));
    const blindCount = parts.filter((p) => persona.blindSpots.includes(p.tell)).length;
    const hookWeight = hookParts.reduce((sum, p) => sum + p.subtlety, 0);
    const fallProbability = Math.min(
      0.95,
      Math.max(0.05, 0.1 + 0.18 * hookWeight + 0.07 * blindCount - 0.12 * persona.vigilance),
    );
    const fell = rng() < fallProbability;
    const reported = !fell && rng() < 0.05 + 0.12 * persona.vigilance;
    const hookedBy = [...hookParts].sort((a, b) => b.subtlety - a.subtlety)[0] ??
      [...parts].sort((a, b) => b.subtlety - a.subtlety)[0]!;
    return { persona, fell, reported, hookedByPartId: fell ? hookedBy.id : null, fallProbability };
  });

  // Scoring: 100 × subtlety per fall; ≥3 falls sharing a lever ×1.5; −50 per report.
  const leverCounts = new Map<string, number>();
  for (const o of outcomes) {
    if (!o.fell) continue;
    const part = parts.find((p) => p.id === o.hookedByPartId)!;
    const lever = part.levers[0]!;
    leverCounts.set(lever, (leverCounts.get(lever) ?? 0) + 1);
  }
  let dominantLever: string | null = null;
  let maxCount = 0;
  for (const [lever, count] of leverCounts) {
    if (count > maxCount) {
      maxCount = count;
      dominantLever = lever;
    }
  }
  const comboActive = maxCount >= 3;

  let score = 0;
  let falls = 0;
  let reports = 0;
  for (const o of outcomes) {
    if (o.fell) {
      const part = parts.find((p) => p.id === o.hookedByPartId)!;
      let pts = 100 * part.subtlety;
      if (comboActive && part.levers[0] === dominantLever) pts = Math.round(pts * 1.5);
      score += pts;
      falls++;
    } else if (o.reported) {
      score -= 50;
      reports++;
    }
  }

  return { outcomes, score: Math.max(0, score), falls, reports, dominantLever: comboActive ? dominantLever : null };
}
