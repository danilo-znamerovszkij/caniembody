// Every evidence URL must resolve. Exit 1 on dead links; writes link-report.json for the issue bot.
// Run: node scripts/check-links.ts [--json out.json]
import { writeFileSync } from 'node:fs';
import { evidenceUrls } from './lib.ts';

const UA = 'caniembody-linkcheck/1.0 (+https://github.com/danilo-znamerovszkij/caniembody)';
const urls = evidenceUrls();
const dead: { url: string; status: string; files: string[] }[] = [];
const limited: string[] = []; // 429 after retries: unverified this run, NOT evidence of rot
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function check(url: string): Promise<string | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    for (const method of ['HEAD', 'GET']) {
      try {
        const r = await fetch(url, { method, redirect: 'follow', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) });
        if (r.ok) return null;
        if (r.status === 429) { await sleep(1000 * (+(r.headers.get('retry-after') ?? 0) || 5 * 2 ** attempt)); break; }
        if (method === 'GET') return String(r.status); // some hosts reject HEAD; only a failed GET counts
      } catch (e) { if (method === 'GET') return (e as Error).name; }
    }
  }
  return '429';
}

// ponytail: one worker per host, 6 hosts at a time — enough to stay under HF/GitHub anonymous rate limits.
const byHost = Object.values(Object.groupBy([...urls.keys()], (u) => new URL(u).host)) as string[][];
let h = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (h < byHost.length) {
    for (const url of byHost[h++]) {
      const status = await check(url);
      if (status === '429') limited.push(url);
      else if (status) dead.push({ url, status, files: [...urls.get(url)!] });
      await sleep(250);
    }
  }
}));

const out = process.argv.indexOf('--json');
if (out > 0) writeFileSync(process.argv[out + 1], JSON.stringify(dead, null, 2));
console.log(`${urls.size} evidence URLs checked, ${dead.length} dead, ${limited.length} rate-limited (unverified, not failing)`);
for (const d of dead) console.log(`✗ ${d.status} ${d.url}\n    ${d.files.join('\n    ')}`);
process.exit(dead.length ? 1 : 0);
