// Turns an "add-compat" issue form into a draft cell (or appends evidence to an existing one).
// Env: ISSUE_BODY, ISSUE_NUMBER, ISSUE_URL, ISSUE_USER. Prints the written path. The PR is a draft: a maintainer
// reviews tier and state. Contributor submissions are always community-reported; never upgraded automatically.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';
import { DATA } from '../src/lib/data.ts';

export function parseForm(body: string) {
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/^###\s+(.+?)\s*\n+([\s\S]*?)(?=\n###\s|$)/gm)) {
    const v = m[2].trim();
    out[m[1].trim()] = v === '_No response_' ? '' : v;
  }
  return out;
}
const pick = (f: Record<string, string>, prefix: string) => Object.entries(f).find(([k]) => k.startsWith(prefix))?.[1] ?? '';
const typeOf = (url: string) =>
  /huggingface\.co\/(?!datasets|docs|spaces)[^/]+\/[^/]+/.test(url) ? 'hub-checkpoint'
  : /github\.com\/.+\/issues\//.test(url) ? 'github-issue'
  : /github\.com\/.+\/pull\//.test(url) ? 'github-pr' : 'community-post';
function versions(s: string) {
  const v: Record<string, string> = {};
  for (const part of s.split(/[,;]/)) { const m = part.trim().match(/^([\w.-]+)[\s=@:]+v?([\w.+-]+)$/); if (m) v[m[1].toLowerCase()] = m[2]; }
  return v;
}
function measurement(s: string, ref: string) {
  if (!s) return undefined;
  const kv = Object.fromEntries(s.split('|').map((p) => p.split(':').map((x) => x.trim())).filter((p) => p.length === 2));
  if (!kv.compute || !kv.runtime || !kv.precision || !kv.cameras) return undefined; // spec §4.3: dropped without all three
  const m: any = { compute: kv.compute, runtime: kv.runtime, precision: kv.precision, cameras: +kv.cameras, source_ref: ref };
  if (kv.p50_ms) { m.inference_latency_ms = { p50: +kv.p50_ms }; m.inference_hz = +(1000 / +kv.p50_ms).toFixed(2); }
  if (kv.control_rate_hz) m.control_rate_hz = +kv.control_rate_hz;
  return m;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const f = parseForm(process.env.ISSUE_BODY ?? '');
  const robot = pick(f, 'Robot id'), policy = pick(f, 'Policy id');
  if (!/^[a-z0-9-]+$/.test(robot) || !/^[a-z0-9-]+$/.test(policy)) throw new Error('invalid robot/policy id');
  const today = new Date().toISOString().slice(0, 10);
  const ref = `ev-issue-${process.env.ISSUE_NUMBER}`;
  const url = pick(f, 'Evidence URL');
  if (!/^https:\/\//.test(url)) throw new Error('evidence URL must be https');
  const ev = { id: ref, tier: 'community-reported', type: typeOf(url), url, verified_on: today, versions: versions(pick(f, 'Exact versions')), summary: `${pick(f, 'One-line summary')} (reported by @${process.env.ISSUE_USER} in ${process.env.ISSUE_URL})` };
  const path = join(DATA, 'compat', `${robot}__${policy}.yaml`);
  const cell: any = existsSync(path) ? parse(readFileSync(path, 'utf8')) : { robot, policy, state: pick(f, 'What happened'), framework: 'lerobot', evidence: [] };
  cell.evidence.push(ev);
  const caveats = pick(f, 'Caveats').split('\n').map((s) => s.trim()).filter(Boolean);
  if (!existsSync(path)) {
    if (cell.state === 'not-supported') cell.reason = caveats.join(' ') || 'See evidence.';
    else if (cell.state === 'partial') cell.partial_scope = caveats.join(' ') || 'See evidence.';
    else if (caveats.length) cell.caveats = caveats;
    // T3-only evidence cannot support "works" (spec §3.1): record it as works-with-caveats pending maintainer review
    if (cell.state === 'works') { cell.state = 'works-with-caveats'; cell.caveats = [...(cell.caveats ?? []), 'Community-reported only; not yet documented upstream or maintainer-tested.']; }
    cell.capabilities = Object.fromEntries(pick(f, 'What did you do').split(',').map((s) => s.trim()).filter(Boolean)
      .map((cap) => [cap, { state: cell.state === 'not-supported' ? 'not-supported' : 'works', evidence: [ref] }]));
  }
  const m = measurement(pick(f, 'Measurement'), ref);
  if (m) (cell.measured ??= []).push(m);
  writeFileSync(path, stringify(cell, { lineWidth: 0 }));
  console.log(path);
}
