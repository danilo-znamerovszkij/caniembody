// Loads /data/**/*.yaml and derives the computed fields (tier, age, stale, drift).
// Shared by the Astro site and the CI scripts, so it only uses node: builtins + yaml.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parse } from 'yaml';

export const ROOT = process.cwd();
export const DATA = join(ROOT, 'data');
export const STALE_DAYS = 180;
export const TODAY = process.env.BUILD_DATE ?? new Date().toISOString().slice(0, 10);

export type Tier = 'upstream-documented' | 'maintainer-tested' | 'community-reported' | 'inferred';
export type State = 'works' | 'works-with-caveats' | 'partial' | 'not-supported' | 'planned' | 'unknown';

export const TIERS: Tier[] = ['upstream-documented', 'maintainer-tested', 'community-reported', 'inferred'];
export const STATES: State[] = ['works', 'works-with-caveats', 'partial', 'not-supported', 'planned', 'unknown'];
export const TIER_SHORT: Record<Tier, string> = {
  'upstream-documented': 'T1', 'maintainer-tested': 'T2', 'community-reported': 'T3', 'inferred': 'T4',
};

export interface Evidence {
  id: string; tier: Tier; type: string; url: string; date?: string; verified_on: string;
  versions?: Record<string, string>; summary: string; quote?: string; archived_url?: string;
}
export interface Measurement {
  compute: string; runtime: string; runtime_note?: string; precision: string; cameras: number; resolution?: string;
  batch_size?: number; inference_latency_ms?: { p50?: number; p95?: number; mean?: number };
  inference_hz?: number; control_rate_hz?: number; action_chunk?: number; vram_gb?: number;
  rtc_enabled?: boolean; outcome?: 'runs' | 'oom' | 'too-slow' | 'error'; platform?: Record<string, string>;
  note?: string; source_ref: string;
}
export interface FrameworkSupport {
  support: string; since?: string; until?: string; robot_type?: string[]; policy_type?: string; package?: string;
  repo_url?: string; docs_url?: string; note?: string; source_ref: string;
}
export interface Robot {
  id: string; name: string; maker?: string; aliases?: string[]; class: string; in_grid?: boolean; out_of_grid_reason?: string;
  summary?: string; dof?: number; dof_note?: string; arms?: number; actuators?: string;
  payload_g?: { min?: number; max?: number }; repeatability_mm?: { min?: number; max?: number };
  open_source: boolean; license?: string; bom_url?: string; homepage?: string;
  price_usd?: { low?: number; high?: number; note?: string; source_ref: string }; specs_source_ref?: string;
  frameworks: Record<string, FrameworkSupport>; sensors_supported?: string[]; sensors_builtin?: string[];
  teleop_options?: string[]; notes?: string; verified_on: string; sources: Evidence[];
}
export interface Requirement {
  vram_gb?: { min?: number; max?: number; measured?: number }; precision?: string; batch_size?: number;
  condition?: string; reference_time?: string; source_ref: string;
}
export interface Policy {
  id: string; name: string; aliases?: string[]; family: string; in_grid?: boolean; summary?: string; authors?: string;
  paper_url?: string; params?: number; params_note?: string; params_source_ref?: string; backbone?: string;
  action_output?: string; action_chunking?: boolean; rtc_compatible?: boolean; peft_supported?: boolean;
  arch_source_ref?: string; license?: string; weights_license?: string; open_weights?: boolean;
  frameworks: Record<string, FrameworkSupport>; checkpoints?: { hub_id: string; note?: string }[];
  requirements?: { train?: Requirement; inference?: Requirement };
  observation_space?: { cameras?: { min?: number; typical?: number; max?: number }; state?: string; language?: string; depth?: string; tactile?: string; source_ref?: string };
  notes?: string; verified_on: string; sources: Evidence[];
}
export interface Compute {
  id: string; name: string; aliases?: string[]; class: string; memory_gb: number; unified?: boolean; arch?: string;
  ai_tops?: string; power_w?: string; price_usd_approx?: number; price_note?: string; notes?: string;
  verified_on: string; sources: Evidence[];
}
export interface Sensor { id: string; name: string; description: string; examples?: string[]; lerobot_support?: string; sources?: Evidence[] }
export interface Framework {
  id: string; name: string; maintainer?: string; repo: string; docs_url?: string; license?: string;
  current_version: string; current_version_date: string; versioning?: string; notes?: string;
}
export interface Capability { state: State; notes?: string; evidence?: string[] }
export interface CompatRaw {
  robot: string; policy: string; state: State; partial_scope?: string; reason?: string; framework: string;
  framework_version_tested?: string;
  capabilities?: Partial<Record<'train' | 'inference_sim' | 'inference_real' | 'teleop_record', Capability>>;
  measured?: Measurement[]; sensors_required?: string[]; sensors_optional?: string[]; caveats?: string[];
  dispute?: string; evidence: Evidence[];
}
export interface Compat extends CompatRaw {
  tier: Tier | null; verified_on: string | null; age_days: number | null; stale: boolean; version_drift: boolean; file: string;
}
export interface Run extends Measurement { id: string; policy: string; checkpoint?: string; date: string; evidence: Evidence[]; file: string }
export interface GlossaryEntry {
  id: string; term: string; aka?: string[]; short: string; body: string; related?: string[]; policies?: string[]; sources: Evidence[];
}

export function readDir<T>(dir: string): (T & { __file: string })[] {
  const d = join(DATA, dir);
  if (!existsSync(d)) return [];
  return readdirSync(d)
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
    .sort()
    .map((f) => ({ ...(parse(readFileSync(join(d, f), 'utf8')) as T), __file: `data/${dir}/${f}` }));
}

const strip = <T extends { __file?: string }>(x: T) => { const { __file, ...rest } = x; return rest as Omit<T, '__file'>; };

export const tierRank = (t: Tier) => TIERS.indexOf(t);
export function highestTier(ev: Evidence[]): Tier | null {
  if (!ev.length) return null;
  return ev.map((e) => e.tier).sort((a, b) => tierRank(a) - tierRank(b))[0];
}
export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}
/** "0.6.1" -> [0, 6, 1]; non-numeric -> null */
export function semver(v?: string): number[] | null {
  const m = v?.match(/^v?(\d+)\.(\d+)(?:\.(\d+))?/);
  return m ? [+m[1], +m[2], +(m[3] ?? 0)] : null;
}
/** More than two minor releases behind current (same major), or any major behind. */
export function isDrifted(tested?: string, current?: string) {
  const t = semver(tested), c = semver(current);
  if (!t || !c) return false;
  return t[0] < c[0] ? true : c[1] - t[1] > 2;
}

let cache: ReturnType<typeof build> | null = null;
export function loadAll() { return (cache ??= build()); }

function build() {
  const frameworks = readDir<Framework>('frameworks').map(strip);
  const fw = Object.fromEntries(frameworks.map((f) => [f.id, f]));
  const robots = readDir<Robot>('robots').map(strip);
  const policies = readDir<Policy>('policies').map(strip);
  const compute = readDir<Compute>('compute').map(strip);
  const sensors = readDir<Sensor>('sensors').map(strip);
  const glossary = readDir<GlossaryEntry>('glossary').map(strip);
  const runs: Run[] = readDir<Run>('runs').map((r) => ({ ...strip(r), file: r.__file }));

  const compat: Compat[] = readDir<CompatRaw>('compat').map((c) => {
    const verified_on = c.evidence?.length ? c.evidence.map((e) => e.verified_on).sort().at(-1)! : null;
    const age_days = verified_on ? daysBetween(verified_on, TODAY) : null;
    return {
      ...strip(c),
      file: c.__file,
      tier: highestTier(c.evidence ?? []),
      verified_on,
      age_days,
      stale: age_days !== null && age_days > STALE_DAYS,
      version_drift: isDrifted(c.framework_version_tested, fw[c.framework]?.current_version),
    };
  });

  const order = <T extends { id: string }>(xs: T[]) => Object.fromEntries(xs.map((x) => [x.id, x]));
  return {
    frameworks, robots, policies, compute, sensors, glossary, runs, compat,
    byId: {
      framework: fw, robot: order(robots), policy: order(policies), compute: order(compute),
      sensor: order(sensors), glossary: order(glossary),
    },
    cell: (r: string, p: string) => compat.find((c) => c.robot === r && c.policy === p),
  };
}

export const gridRobots = () => loadAll().robots.filter((r) => r.in_grid !== false);
export const gridPolicies = () => loadAll().policies.filter((p) => p.in_grid !== false);
export const compatFileName = (robot: string, policy: string) => `${robot}__${policy}.yaml`;
export const fileBase = (f: string) => basename(f).replace(/\.ya?ml$/, '');

export function meta() {
  return parse(readFileSync(join(DATA, 'meta.yaml'), 'utf8')) as { last_full_review: string; dataset_version: string };
}

/** Coverage numbers for header, /coverage and meta.json. Never hand-maintained. */
export function stats() {
  const { compat } = loadAll();
  const R = gridRobots(), P = gridPolicies();
  const inGrid = compat.filter((c) => R.some((r) => r.id === c.robot) && P.some((p) => p.id === c.policy));
  const total = R.length * P.length;
  const byState = Object.fromEntries(STATES.map((s) => [s, s === 'unknown' ? total - inGrid.length : inGrid.filter((c) => c.state === s).length]));
  const byTier = Object.fromEntries(TIERS.map((t) => [t, inGrid.filter((c) => c.tier === t).length]));
  const stale = inGrid.filter((c) => c.stale).length;
  const t12 = inGrid.filter((c) => c.evidence.some((e) => e.tier === 'upstream-documented' || e.tier === 'maintainer-tested')).length;
  return {
    total, known: inGrid.length, robots: R.length, policies: P.length, byState, byTier, stale,
    pctKnown: total ? (100 * inGrid.length) / total : 0,
    pctStale: inGrid.length ? (100 * stale) / inGrid.length : 0,
    pctT12: inGrid.length ? (100 * t12) / inGrid.length : 0,
    drift: inGrid.filter((c) => c.version_drift).length,
    inferred: inferredCount(), // unknown cells where both sides are in LeRobot (T4, display-only)
    ages: inGrid.map((c) => c.age_days ?? 0),
    ...meta(),
  };
}

/** git log for a path: [{date, hash, subject, author}] — empty when not in a repo / no history yet. */
import { execFileSync } from 'node:child_process';
export function gitLog(path: string, limit = 200) {
  try {
    const out = execFileSync('git', ['log', `-n${limit}`, '--date=short', '--format=%h%x09%ad%x09%an%x09%s', '--', path], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.trim().split('\n').filter(Boolean).map((l) => { const [hash, date, author, subject] = l.split('\t'); return { hash, date, author, subject }; });
  } catch { return []; }
}
/** Last commit date touching a file; falls back to undefined (never fake freshness). */
export const gitDate = (path: string) => gitLog(path, 1)[0]?.date;

/** Every (robot, policy) pair that gets a page/badge/embed/OG image: the full grid plus evidenced out-of-grid cells. */
export function pagePairs() {
  const all = loadAll();
  const pairs = gridRobots().flatMap((r) => gridPolicies().map((p) => ({ r, p })));
  const seen = new Set(pairs.map(({ r, p }) => `${r.id}|${p.id}`));
  for (const c of all.compat) if (!seen.has(`${c.robot}|${c.policy}`)) pairs.push({ r: all.byId.robot[c.robot], p: all.byId.policy[c.policy] });
  return pairs;
}

/**
 * T4 inference for a pair with no evidence: both sides are integrated in LeRobot (robot native/plugin, policy native, both in
 * a release). That makes the toolchain connect them; it says nothing about whether anyone has run it. Display-only — never
 * stored as a cell and never counted as evidence.
 */
export function inferredPair(r: Robot, p: Policy) {
  const rs = r.frameworks?.lerobot, ps = p.frameworks?.lerobot;
  if (!rs || !ps || !['native', 'plugin'].includes(rs.support) || ps.support !== 'native') return null;
  if (rs.since === 'main' || ps.since === 'main') return null;
  const how = rs.support === 'plugin' ? `through the third-party plugin${rs.package ? ` ${rs.package}` : ''}` : `natively${rs.since ? ` since ${rs.since}` : ''}`;
  return {
    basis: `Inferred: LeRobot supports ${r.name} ${how} and ${p.name} as --policy.type=${ps.policy_type ?? p.id}${ps.since ? ` since ${ps.since}` : ''}, so its tools connect them. No run has been published. Check action and state dimensions, camera count and compute before relying on it.`,
    sources: [rs.source_ref, ps.source_ref],
  };
}
export const inferredCount = () => {
  const all = loadAll();
  return gridRobots().reduce((n, r) => n + gridPolicies().filter((p) => !all.cell(r.id, p.id) && inferredPair(r, p)).length, 0);
};
