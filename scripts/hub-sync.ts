// Weekly: re-read Hub metadata for every checkpoint; report license drift and missing checkpoints as Markdown.
// Param counts are reported for review only (checkpoint tensor counts often differ from the authors' stated size).
import { loadAll } from '../src/lib/data.ts';
const lines: string[] = [];
for (const p of loadAll().policies) for (const c of p.checkpoints ?? []) {
  const r = await fetch(`https://huggingface.co/api/models/${c.hub_id}`, { headers: { 'User-Agent': 'caniembody-hub-sync' } });
  if (!r.ok) { lines.push(`- [ ] **${p.name}** \`${c.hub_id}\`: HTTP ${r.status} (removed, renamed or gated?)`); continue; }
  const m = (await r.json()) as { cardData?: { license?: string }; safetensors?: { total?: number } };
  const lic = m.cardData?.license;
  if (lic && p.weights_license && lic.toLowerCase() !== p.weights_license.toLowerCase())
    lines.push(`- [ ] **${p.name}** \`${c.hub_id}\`: model card license \`${lic}\` ≠ recorded weights_license \`${p.weights_license}\``);
  const n = m.safetensors?.total;
  if (n && p.params && Math.abs(n - p.params) / p.params > 0.15)
    lines.push(`- [ ] **${p.name}** \`${c.hub_id}\`: checkpoint has ${n.toLocaleString()} params vs recorded ${p.params.toLocaleString()} (review; may be expected)`);
}
console.log(lines.length ? `## Hub metadata drift\n\n${lines.join('\n')}` : 'No drift.');
process.exit(lines.length ? 2 : 0);
