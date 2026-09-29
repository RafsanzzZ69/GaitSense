import { MATCHING, matchSyntheticMotionEvents } from './motion-matching.ts';
import type { MatchingManifest } from './motion-matching.ts';

export const COHORT_VERSION = 'synthetic-motion-cohort-1';
export type Trial = { id: string; status: 'completed' | 'failed' | 'unattempted'; reason: string | null;
  attempts: { id: string; replaces: string | null; approval: string | null }[] };
export type Participant = { id: string; partition: 'pilot' | 'evaluation'; trials: Trial[] };
export type CohortLedger = { schemaVersion: typeof COHORT_VERSION; evidenceKind: 'synthetic';
  participants: Participant[]; matching: MatchingManifest };
export class CohortInputError extends Error {
  code: string; path: string;
  constructor(code: string, path: string) { super(`${code}: ${path}`); this.code = code; this.path = path; }
}
function check(ok: unknown, code: string, path: string): asserts ok {
  if (!ok) throw new CohortInputError(code, path);
}
function shape(v: unknown, keys: string[], path: string): asserts v is Record<string, unknown> {
  check(v !== null && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === keys.length &&
    keys.every(k => Object.hasOwn(v, k)), 'invalid_shape', path);
}
const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0 && v.length <= 500;
const order = (a: { id: string }, b: { id: string }) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const divide = (n: number, d: number) => d ? n / d : null;
const mean = (xs: number[]) => divide(sum(xs), xs.length);
type Report = ReturnType<typeof matchSyntheticMotionEvents>;
type Attempt = Report['attempts'][number];
type Person = Participant & { reports: Attempt[] };

/** Validate raw matching input with the existing matcher, then consume its reports only. */
function prepare(input: unknown): { people: Person[]; report: Report } {
  shape(input, ['schemaVersion', 'evidenceKind', 'participants', 'matching'], 'ledger');
  check(input.schemaVersion === COHORT_VERSION && input.evidenceKind === 'synthetic', 'unsupported_version', 'ledger');
  check(Array.isArray(input.participants), 'invalid_shape', 'participants');
  const report = matchSyntheticMotionEvents(input.matching);
  const reports = new Map(report.attempts.map(a => [a.attemptId, a]));
  const ids = new Set<string>(), used = new Set<string>();
  function unique(v: unknown, path: string) {
    check(typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(v), 'invalid_id', path);
    check(!ids.has(v), 'duplicate_id', path); ids.add(v);
  }
  const people: Person[] = input.participants.map((value: unknown, i: number) => {
    const path = `participants[${i}]`;
    shape(value, ['id', 'partition', 'trials'], path); unique(value.id, `${path}.id`);
    check(value.partition === 'pilot' || value.partition === 'evaluation', 'invalid_partition', path);
    check(Array.isArray(value.trials) && value.trials.length > 0, 'invalid_trials', path);
    const p = value as unknown as Participant;
    for (const [j, trial] of p.trials.entries()) {
      const tp = `${path}.trials[${j}]`;
      shape(trial, ['id', 'status', 'reason', 'attempts'], tp); unique(trial.id, `${tp}.id`);
      check(Array.isArray(trial.attempts) && trial.attempts.length <= 2, 'invalid_attempts', tp);
      for (const [k, link] of trial.attempts.entries()) {
        const lp = `${tp}.attempts[${k}]`;
        shape(link, ['id', 'replaces', 'approval'], lp);
        check(typeof link.id === 'string' && reports.has(link.id), 'missing_report', lp);
        check(!used.has(link.id), 'duplicate_attempt', lp); used.add(link.id);
        check(reports.get(link.id)!.participantId === p.id, 'ownership_mismatch', lp);
      }
      const originals = trial.attempts.filter(a => a.replaces === null);
      check(!trial.attempts.length || originals.length === 1, 'invalid_replacement', tp);
      for (const link of trial.attempts) {
        check(link.replaces === null ? link.approval === null :
          link.replaces === originals[0]?.id && link.id !== link.replaces && text(link.approval), 'invalid_replacement', tp);
      }
      const hasRecorded = trial.attempts.some(a => reports.get(a.id)!.attemptStatus === 'recorded');
      const expected = !trial.attempts.length ? 'unattempted' : hasRecorded ? 'completed' : 'failed';
      check(trial.status === expected && (expected === 'completed' ? trial.reason === null : text(trial.reason)), 'contradictory_status', tp);
    }
    const trials = p.trials.map(t => ({ ...t, attempts: [...t.attempts].sort(order) })).sort(order);
    return { ...p, trials, reports: trials.flatMap(t => t.attempts.map(a => reports.get(a.id)!))
      .sort((a, b) => order({ id: a.attemptId }, { id: b.attemptId })) };
  }).sort(order);
  check(used.size === reports.size, 'unlinked_attempt', 'matching.attempts');
  return { people, report };
}

function metrics(people: Person[], polarity: number) {
  const attempted = people.filter(p => p.reports.length > 0);
  const allAttempted = people.length > 0 && attempted.length === people.length;
  const byPerson = people.map(p => p.reports.map(a => a.polarities[polarity]));
  const flat = byPerson.flat();
  const totals = Object.fromEntries(['S', 'Q', 'V', 'R', 'D', 'T', 'misses', 'extras'].map(key =>
    [key, sum(flat.map(a => a.counts[key as keyof typeof a.counts]))])) as Record<'S'|'Q'|'V'|'R'|'D'|'T'|'misses'|'extras', number>;
  const balancedCount = (key: 'T' | 'R' | 'D') => sum(byPerson.filter(a => a.length).map(as => mean(as.map(a => a.counts[key]))!));
  const descriptiveRecall = divide(balancedCount('T'), balancedCount('R'));
  const descriptivePrecision = divide(balancedCount('T'), balancedCount('D'));
  const coverage = (key: 'Q' | 'V') => allAttempted ? mean(byPerson.map(as => sum(as.map(a => a.counts[key])) / (30 * as.length))) : null;
  const reference = coverage('Q'), joint = coverage('V');
  const matched = byPerson.map(as => as.filter(a => a.pairs.length)).filter(as => as.length);
  const weighted = matched.flatMap(as => as.flatMap(a => a.pairs.map(pair => ({
    signed: pair.signedErrorMs, absolute: pair.absoluteErrorMs, weight: 1 / (matched.length * as.length * a.pairs.length),
    denominator: BigInt(matched.length) * BigInt(as.length) * BigInt(a.pairs.length),
  }))));
  function quantile(numerator: number, denominator: number) {
    if (!weighted.length) return null;
    const xs = [...weighted].sort((a, b) => a.absolute - b.absolute);
    // Exact reciprocal weights avoid jumping past an exact CDF boundary due to rounding.
    const gcd = (a: bigint, b: bigint): bigint => b === BigInt(0) ? a : gcd(b, a % b);
    const unit = xs.reduce((lcm, x) => lcm / gcd(lcm, x.denominator) * x.denominator, BigInt(1));
    const total = xs.reduce((s, x) => s + unit / x.denominator, BigInt(0));
    let cumulative = BigInt(0);
    for (const x of xs) {
      cumulative += unit / x.denominator;
      if (cumulative * BigInt(denominator) >= total * BigInt(numerator)) return x.absolute;
    }
    return xs.at(-1)!.absolute;
  }
  return { counts: totals, recall: allAttempted ? descriptiveRecall : null,
    precision: allAttempted ? descriptivePrecision : null,
    attemptedParticipantDescriptive: { participants: attempted.length, recall: descriptiveRecall, precision: descriptivePrecision },
    pooledDescriptive: { recall: divide(totals.T, totals.R), precision: divide(totals.T, totals.D),
      referenceCoverage: divide(totals.Q, totals.S), jointSignalCoverage: divide(totals.V, totals.S) },
    coverage: { reference, jointSignal: joint, conditionalSignal: reference === null || joint === null ? null : divide(joint, reference) },
    timing: { maeMs: weighted.length ? sum(weighted.map(x => x.absolute * x.weight)) : null,
      biasMs: weighted.length ? sum(weighted.map(x => x.signed * x.weight)) : null,
      medianAbsoluteMs: quantile(1, 2), p95AbsoluteMs: quantile(19, 20),
      maximumAbsoluteMs: weighted.length ? Math.max(...weighted.map(x => x.absolute)) : null },
    participantsWithoutAttempts: people.length - attempted.length,
    participantsWithoutMatches: people.length - matched.length,
    attemptsWithoutMatches: flat.filter(a => !a.pairs.length).length,
    unscorableReferences: sum(flat.map(a => a.unscorableReferences.length)),
    unscorableCandidates: sum(flat.map(a => a.unscorableCandidates.length)),
    unscorableRegions: sum(people.map(p => sum(p.reports.map(a => a.regions.filter(r => r.status !== 'evaluable').length)))) };
}

const endpointNames = ['recall', 'precision', 'referenceCoverage', 'jointSignalCoverage', 'maeMs', 'biasMs', 'p95AbsoluteMs'] as const;
function endpoints(m: ReturnType<typeof metrics>) {
  return [m.recall, m.precision, m.coverage.reference, m.coverage.jointSignal, m.timing.maeMs, m.timing.biasMs, m.timing.p95AbsoluteMs];
}
function bootstrap(people: Person[], polarity: number) {
  let seed = 20260929;
  // mulberry32-v1, unsigned 32-bit arithmetic; cluster copies remain separate people.
  function random() {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  const values: number[][] = endpointNames.map(() => []);
  for (let i = 0; i < 2000; i++) {
    const draw = Array.from({ length: people.length }, () => people[Math.floor(random() * people.length)]);
    endpoints(metrics(draw, polarity)).forEach((v, j) => { if (v !== null) values[j].push(v); });
  }
  return Object.fromEntries(endpointNames.map((name, i) => {
    const xs = values[i].sort((a, b) => a - b), undefinedDraws = 2000 - xs.length;
    return [name, { undefinedDraws, interval: undefinedDraws ? null : { lower: xs[Math.ceil(.025 * xs.length) - 1], upper: xs[Math.ceil(.975 * xs.length) - 1] } }];
  }));
}

export function evaluateSyntheticMotionCohort(input: unknown) {
  const { people, report } = prepare(input);
  const partitions = (['pilot', 'evaluation'] as const).map(partition => {
    const cohort = people.filter(p => p.partition === partition);
    return { partition, participants: cohort.map(p => ({ id: p.id, trials: p.trials,
      collectionStatus: p.trials.some(t => t.status === 'unattempted') ? 'incomplete' : 'complete',
      successfulTrials: p.trials.filter(t => t.status === 'completed').length,
      failedTrials: p.trials.filter(t => t.status === 'failed').length,
      unattemptedTrials: p.trials.filter(t => t.status === 'unattempted').length,
      attempts: p.reports, polarities: [0, 1].map(i => ({ polarity: i === 0 ? 'maximum' : 'minimum', ...metrics([p], i) })) })),
      collectionStatus: !cohort.length ? 'empty' : cohort.some(p => p.trials.some(t => t.status === 'unattempted')) ? 'incomplete' : 'complete',
      polarities: [0, 1].map(i => ({ polarity: i === 0 ? 'maximum' : 'minimum', ...metrics(cohort, i),
        uncertainty: partition === 'evaluation' ? bootstrap(cohort, i) : null })) };
  });
  return { schemaVersion: COHORT_VERSION, evidenceKind: 'synthetic', scientificDecision: 'NOT_EVALUATED',
    scientificValidation: 'not-validated', authenticity: 'not-established',
    zeroAttemptPolicy: 'full-cohort-rates-null-pending-supervisor-approval',
    matchingConfiguration: MATCHING, timestampProvenance: report.timestampProvenance,
    bootstrap: { draws: 2000, seed: 20260929, prng: 'mulberry32-v1', cluster: 'participant' }, partitions };
}
