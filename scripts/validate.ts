// Schema + referential integrity + the epistemic contract (spec §3, §9.1).
// Exit 1 on any error. Run: node scripts/validate.ts
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';
import { DATA, ROOT, TIERS, fileBase, type Evidence } from '../src/lib/data.ts';

const errors: string[] = [];
const err = (file: string, msg: string) => errors.push(`${file}: ${msg}`);

// ---------- 1. JSON Schema ----------
const ajv = new Ajv2020({ allErrors: true, strict: false, useDefaults: false });
addFormats(ajv);
for (const f of readdirSync(join(ROOT, 'schema'))) ajv.addSchema(JSON.parse(readFileSync(join(ROOT, 'schema', f), 'utf8')));

const DIRS: Record<string, string> = {
  robots: 'robot', policies: 'policy', compute: 'compute', sensors: 'sensor',
  frameworks: 'framework', compat: 'compat', runs: 'run', glossary: 'glossary',
};
const raw: Record<string, { file: string; d: any }[]> = {};
for (const [dir, schema] of Object.entries(DIRS)) {
  const validate = ajv.getSchema(`${schema}.schema.json`)!;
  raw[dir] = [];
  let files: string[] = [];
  try { files = readdirSync(join(DATA, dir)).filter((f) => /\.ya?ml$/.test(f)); } catch {}
  for (const f of files.sort()) {
    const file = `data/${dir}/${f}`;
    let d: any;
    // yaml parses unquoted ISO dates as strings by default (core schema) — good, schema expects strings.
    try { d = parse(readFileSync(join(DATA, dir, f), 'utf8')); } catch (e) { err(file, `YAML parse: ${(e as Error).message}`); continue; }
    if (!validate(d)) for (const e of validate.errors!) err(file, `schema ${e.instancePath || '/'} ${e.message}${e.params && 'allowedValues' in e.params ? ' ' + JSON.stringify(e.params.allowedValues) : ''}${e.params && 'additionalProperty' in e.params ? ` (${e.params.additionalProperty})` : ''}`);
    raw[dir].push({ file, d });
  }
}

// ---------- 2. Identity ----------
const ids: Record<string, Set<string>> = {};
for (const dir of ['robots', 'policies', 'compute', 'sensors', 'frameworks', 'glossary', 'runs']) {
  ids[dir] = new Set();
  for (const { file, d } of raw[dir]) {
    if (!d?.id) continue;
    if (fileBase(file) !== d.id) err(file, `filename must equal id "${d.id}"`);
    if (ids[dir].has(d.id)) err(file, `duplicate id ${d.id}`);
    ids[dir].add(d.id);
  }
}
// aliases must not collide with any other robot/policy id or alias
for (const dir of ['robots', 'policies']) {
  const seen = new Map<string, string>();
  for (const { file, d } of raw[dir]) for (const a of [d.id, ...(d.aliases ?? [])]) {
    const k = String(a).toLowerCase();
    if (seen.has(k) && seen.get(k) !== file) err(file, `alias/id "${a}" collides with ${seen.get(k)}`);
    seen.set(k, file);
  }
}

// ---------- 3. Evidence contract ----------
// Which evidence types may carry which tier. This is the assertion that stops computed/inferred claims
// from being promoted to T1 (spec §9): T1 must point at an upstream artefact, T2 at a maintainer run.
const TIER_TYPES: Record<string, string[]> = {
  'upstream-documented': ['official-docs', 'release-notes', 'source-code', 'model-card', 'paper', 'vendor-docs'],
  'maintainer-tested': ['maintainer-run'],
  'community-reported': ['github-issue', 'github-pr', 'community-post', 'blog', 'hub-checkpoint', 'paper', 'source-code', 'model-card'],
  'inferred': ['spec-derivation'],
};
function checkEvidence(file: string, ev: Evidence[] | undefined) {
  const seen = new Set<string>();
  for (const e of ev ?? []) {
    if (seen.has(e.id)) err(file, `duplicate evidence id ${e.id}`);
    seen.add(e.id);
    if (!TIER_TYPES[e.tier]?.includes(e.type)) err(file, `${e.id}: tier ${e.tier} cannot be backed by type ${e.type}`);
    if (e.date && e.date > e.verified_on) err(file, `${e.id}: source date ${e.date} is after verified_on ${e.verified_on}`);
    if (e.verified_on > new Date().toISOString().slice(0, 10)) err(file, `${e.id}: verified_on is in the future`);
  }
  return seen;
}
function refs(file: string, evIds: Set<string>, obj: any, path = '') {
  // every *source_ref anywhere in the record must resolve to an evidence id in the same file
  if (!obj || typeof obj !== 'object') return;
  for (const [k, v] of Object.entries(obj)) {
    if ((k === 'source_ref' || k.endsWith('_source_ref')) && typeof v === 'string' && !evIds.has(v))
      err(file, `${path}${k} → "${v}" does not resolve to an evidence id in this file`);
    else if (k !== 'sources' && k !== 'evidence') refs(file, evIds, v, `${path}${k}.`);
  }
}
const fwIds = ids.frameworks;
for (const dir of ['robots', 'policies', 'compute']) for (const { file, d } of raw[dir]) {
  const evIds = checkEvidence(file, d.sources);
  refs(file, evIds, d);
  for (const f of Object.keys(d.frameworks ?? {})) if (!fwIds.has(f)) err(file, `unknown framework ${f}`);
  for (const s of [...(d.sensors_supported ?? []), ...(d.sensors_builtin ?? [])]) if (!ids.sensors.has(s)) err(file, `unknown sensor ${s}`);
}
// Numbers need sources (spec §4.3): a robot with physical specs must cite them.
for (const { file, d } of raw.robots) {
  if ((d.dof || d.payload_g || d.repeatability_mm || d.actuators) && !d.specs_source_ref) err(file, 'physical specs present without specs_source_ref');
  if (d.in_grid === false && !d.out_of_grid_reason) err(file, 'in_grid: false requires out_of_grid_reason');
}
for (const { file, d } of raw.policies) {
  if (d.params && !d.params_source_ref) err(file, 'params present without params_source_ref');
  if ((d.backbone || d.action_output || d.rtc_compatible !== undefined || d.peft_supported !== undefined) && !d.arch_source_ref)
    err(file, 'architecture fields present without arch_source_ref');
}
for (const { file, d } of raw.glossary) {
  checkEvidence(file, d.sources);
  for (const r of d.related ?? []) if (!ids.glossary.has(r)) err(file, `related term ${r} not found`);
  for (const p of d.policies ?? []) if (!ids.policies.has(p)) err(file, `policy ${p} not found`);
  const words = d.body?.split(/\s+/).length ?? 0;
  if (words < 120 || words > 380) err(file, `body is ${words} words (target 150–300)`);
  for (const m of d.body?.matchAll(/\]\(\/(robot|policy|compute|glossary)\/([a-z0-9-]+)\)/g) ?? []) {
    const set = { robot: ids.robots, policy: ids.policies, compute: ids.compute, glossary: ids.glossary }[m[1] as 'robot'];
    if (!set.has(m[2])) err(file, `internal link /${m[1]}/${m[2]} does not resolve`);
  }
}

// ---------- 4. Compat cells ----------
const grid = (dir: string) => new Set(raw[dir].filter(({ d }) => d.in_grid !== false).map(({ d }) => d.id));
for (const { file, d } of raw.compat) {
  if (fileBase(file) !== `${d.robot}__${d.policy}`) err(file, `filename must be ${d.robot}__${d.policy}.yaml`);
  if (!ids.robots.has(d.robot)) err(file, `unknown robot ${d.robot}`);
  if (!ids.policies.has(d.policy)) err(file, `unknown policy ${d.policy}`);
  if (!fwIds.has(d.framework)) err(file, `unknown framework ${d.framework}`);
  // Cells for out-of-grid robots are allowed (shown on the robot page, not in the matrix or coverage stats).
  const evIds = checkEvidence(file, d.evidence);
  refs(file, evIds, d);
  if (d.state === 'unknown') err(file, 'do not commit unknown cells — absence of a file IS unknown');
  // works requires T1 or T2 (spec §3.1)
  if (d.state === 'works' && !d.evidence?.some((e: Evidence) => e.tier === 'upstream-documented' || e.tier === 'maintainer-tested'))
    err(file, 'state "works" requires upstream-documented or maintainer-tested evidence');
  // inferred-only cells can never claim works / works-with-caveats
  if (d.evidence?.length && d.evidence.every((e: Evidence) => e.tier === 'inferred') && /^works/.test(d.state))
    err(file, `inferred-only evidence cannot support "${d.state}"`);
  for (const [cap, c] of Object.entries<any>(d.capabilities ?? {})) {
    for (const r of c.evidence ?? []) if (!evIds.has(r)) err(file, `capabilities.${cap} evidence ${r} not found`);
    if (c.state !== 'unknown' && !c.evidence?.length) err(file, `capabilities.${cap} is ${c.state} without evidence ids`);
  }
  for (const m of d.measured ?? []) if (!ids.compute.has(m.compute)) err(file, `unknown compute ${m.compute}`);
  for (const s of [...(d.sensors_required ?? []), ...(d.sensors_optional ?? [])]) if (!ids.sensors.has(s)) err(file, `unknown sensor ${s}`);
}
for (const { file, d } of raw.runs) {
  const evIds = checkEvidence(file, d.evidence);
  refs(file, evIds, d);
  if (!ids.policies.has(d.policy)) err(file, `unknown policy ${d.policy}`);
  if (!ids.compute.has(d.compute)) err(file, `unknown compute ${d.compute}`);
  if (d.inference_hz && d.inference_latency_ms?.p50) {
    const implied = 1000 / d.inference_latency_ms.p50;
    if (Math.abs(implied - d.inference_hz) / implied > 0.25) err(file, `inference_hz ${d.inference_hz} inconsistent with p50 ${d.inference_latency_ms.p50} ms (≈${implied.toFixed(2)} Hz)`);
  }
  if (d.evidence?.some((e: Evidence) => e.tier === 'upstream-documented')) err(file, 'runs are measurements: tier must be maintainer-tested or community-reported');
}

// ---------- 5. Acceptance tests (spec §9.1) — known errors in existing tables ----------
const P = Object.fromEntries(raw.policies.map(({ d }) => [d.id, d]));
const accept = (cond: boolean, msg: string) => { if (!cond) errors.push(`acceptance: ${msg}`); };
if (P.pi0) {
  accept(P.pi0.frameworks?.openpi?.support === 'upstream-repo', 'π0 must list openpi as its upstream-repo (official PI release, not a reimplementation)');
  accept(P.pi0.open_weights === true, 'π0 has open weights (openpi) — it is not API-only');
}
if (P.pi05) accept(P.pi05.frameworks?.openpi?.support === 'upstream-repo', 'π0.5 must list openpi as upstream-repo');
if (P.smolvla) accept(P.smolvla.action_output === 'flow-matching', 'SmolVLA action head is flow-matching, not diffusion');
const groot = raw.policies.find(({ d }) => d.id.startsWith('groot'))?.d;
if (groot) accept(/N1\.7/.test(groot.name) && groot.frameworks?.lerobot?.policy_type === 'groot', 'GR00T in LeRobot (>=0.6.0) is N1.7 with --policy.type=groot');
for (const { file, d } of raw.compat)
  if (['pi0', 'pi05'].includes(d.policy) && ['so100', 'so101'].includes(d.robot) && d.state === 'not-supported')
    err(file, 'acceptance: π0/π0.5 train on SO-100/101 data through LeRobot; not-supported is wrong');
// "No edge latency figure may be stated without runtime" — enforced by schema (measurement.required), asserted here too
for (const { file, d } of [...raw.compat, ...raw.runs.map((r) => ({ file: r.file, d: { measured: [r.d] } }))])
  for (const m of d.measured ?? []) if (!m.runtime || !m.precision || m.cameras === undefined) err(file, 'measurement without runtime/precision/cameras');

// ---------- report ----------
const n = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v.length]));
if (errors.length) {
  console.error(errors.map((e) => '✗ ' + e).join('\n'));
  console.error(`\n${errors.length} error(s)`);
  process.exit(1);
}
console.log(`✓ data valid — ${Object.entries(n).map(([k, v]) => `${v} ${k}`).join(', ')}; tiers: ${TIERS.join(' > ')}`);
