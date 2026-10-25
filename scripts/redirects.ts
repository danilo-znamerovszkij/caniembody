// Post-build: dist/_redirects (Cloudflare Pages / Netlify). Every alias of a robot/policy/compute 301s to its id,
// so renamed ids and framework type strings (so101_follower, pi05, …) keep resolving forever (spec §4.6).
import { writeFileSync } from 'node:fs';
import { loadAll } from '../src/lib/data.ts';
const all = loadAll();
const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/π/g, 'pi').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const lines = new Set<string>();
const ids = { robot: new Set(all.robots.map((r) => r.id)), policy: new Set(all.policies.map((p) => p.id)), compute: new Set(all.compute.map((c) => c.id)) };
for (const [kind, xs] of [['robot', all.robots], ['policy', all.policies], ['compute', all.compute]] as const)
  for (const x of xs) for (const a of x.aliases ?? []) {
    for (const s of new Set([a, slug(a)])) if (/^[\w.-]+$/.test(s) && s !== x.id && !ids[kind].has(s)) lines.add(`/${kind}/${s} /${kind}/${x.id} 301`);
  }
writeFileSync('dist/_redirects', [...lines].join('\n') + '\n');
console.log(`_redirects: ${lines.size} alias redirects`);
