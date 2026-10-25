// Information-carrying OG images (spec §13.4): the state and verification date, not branding.
import sharp from 'sharp';
import { loadAll, pagePairs, stats, inferredPair } from '../../lib/data.ts';
import { STATE_META, TIER_META, fmtParams } from '../../lib/ui.ts';
import { SITE } from '../../site.ts';

const C: Record<string, [string, string]> = {
  works: ['#2f8f5b', '#e1f1e6'], 'works-with-caveats': ['#6d8f2a', '#edf2dc'], partial: ['#b7791f', '#f8ecd4'],
  'not-supported': ['#b83a3a', '#f6dfdc'], planned: ['#4a6fb5', '#e2e9f6'], untested: ['#67665f', '#efede6'], unknown: ['#8a8880', '#efede6'],
};
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
type Card = { kicker: string; title: string; state?: string; lines: string[] };

function wrap(s: string, max: number) {
  const out: string[] = []; let cur = '';
  for (const w of s.split(' ')) { if ((cur + ' ' + w).trim().length > max) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  return [...out, cur].slice(0, 3);
}
function svg({ kicker, title, state, lines }: Card) {
  const t = wrap(title, 30);
  const [fg, bg] = C[state ?? 'unknown'];
  const ty = 250;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#faf9f5"/>
  <rect x="0" y="0" width="1200" height="6" fill="#d97757"/>
  <g transform="translate(72,64)"><rect width="20" height="20" rx="4" fill="#141413"/><rect x="24" width="20" height="20" rx="4" fill="#d97757"/><rect x="1" y="25" width="18" height="18" rx="3.5" fill="none" stroke="#a3a19a" stroke-width="2" stroke-dasharray="4 3"/><rect x="24" y="24" width="20" height="20" rx="4" fill="#73726c" opacity=".55"/>
  <text x="64" y="30" font-family="DejaVu Sans Mono, Menlo, monospace" font-size="26" font-weight="700" fill="#141413">${SITE.name}</text></g>
  <text x="72" y="168" font-family="DejaVu Sans Mono, Menlo, monospace" font-size="24" fill="#73726c" letter-spacing="1">${esc(kicker)}</text>
  ${t.map((l, i) => `<text x="72" y="${ty + i * 72}" font-family="Helvetica, Arial, DejaVu Sans, sans-serif" font-size="64" font-weight="700" fill="#141413" letter-spacing="-1.5">${esc(l)}</text>`).join('')}
  ${state ? `<g transform="translate(72,${ty + t.length * 72 + 10})"><rect width="${88 + STATE_META[state].label.length * 22}" height="64" rx="12" fill="${bg}"/><text x="24" y="44" font-family="DejaVu Sans Mono, Menlo, monospace" font-size="32" font-weight="700" fill="${fg}">${esc(STATE_META[state].glyph)} ${esc(STATE_META[state].label)}</text></g>` : ''}
  ${lines.map((l, i) => `<text x="72" y="${560 - (lines.length - 1 - i) * 36}" font-family="DejaVu Sans Mono, Menlo, monospace" font-size="24" fill="#3d3d3a">${esc(l)}</text>`).join('')}
</svg>`;
}

export function getStaticPaths() {
  const all = loadAll();
  const s = stats();
  const paths: { params: { path: string }; props: Card }[] = [
    { params: { path: 'index' }, props: { kicker: 'Robot × policy × compute', title: 'Can this policy run on this robot?', lines: [`${s.known} of ${s.total} cells sourced · last full review ${s.last_full_review}`, SITE.url.replace('https://', '')] } },
  ];
  for (const r of all.robots) {
    const n = all.compat.filter((c) => c.robot === r.id).length;
    paths.push({ params: { path: `robot/${r.id}` }, props: { kicker: `Robot · ${r.maker ?? r.class}`, title: `${r.name}: supported policies`, lines: [r.in_grid === false ? 'Not in the main matrix; see page' : `${n} policies with sourced evidence`, `verified ${r.verified_on}`] } });
  }
  for (const p of all.policies) {
    const n = all.runs.filter((x) => x.policy === p.id).length;
    const v = p.requirements?.inference?.vram_gb;
    paths.push({ params: { path: `policy/${p.id}` }, props: { kicker: `Policy · ${p.family}${p.params ? ` · ${fmtParams(p.params)} params` : ''}`, title: p.name, lines: [`${v?.min != null ? `inference ≥${v.min} GB · ` : ''}${n} measured runs`, `verified ${p.verified_on}`] } });
  }
  for (const c of all.compute) {
    const n = all.runs.filter((x) => x.compute === c.id).length;
    paths.push({ params: { path: `compute/${c.id}` }, props: { kicker: `Compute · ${c.memory_gb ? `${c.memory_gb} GB${c.unified ? ' unified' : ''}` : 'CPU'}`, title: `What can I run on ${c.name.replace(/^NVIDIA /, '')}?`, lines: [`${n} measured runs · runtime, precision, cameras on every number`] } });
  }
  for (const { r, p } of pagePairs()) {
    const c = all.cell(r.id, p.id);
    paths.push({ params: { path: `compat/${r.id}/${p.id}` }, props: {
      kicker: 'Compatibility', title: `Does ${p.name} run on ${r.name}?`, state: c?.state ?? (inferredPair(r, p) ? 'untested' : 'unknown'),
      lines: [c ? `${c.tier ? `${TIER_META[c.tier].short} ${TIER_META[c.tier].label} · ` : ''}verified ${c.verified_on} · ${c.evidence.length} source${c.evidence.length === 1 ? '' : 's'}` : (inferredPair(r, p) ? 'No published run · both supported in LeRobot (inferred)' : 'No sourced evidence yet')],
    } });
  }
  return paths;
}

export async function GET({ props }: { props: Card }) {
  const png = await sharp(Buffer.from(svg(props))).png({ compressionLevel: 9, palette: true }).toBuffer();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
}
