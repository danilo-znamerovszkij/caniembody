import { loadAll, pagePairs, inferredPair } from '../../../lib/data.ts';
import { STATE_META, TIER_META } from '../../../lib/ui.ts';
// Shields-style badge. Colours are fixed (badges render on arbitrary backgrounds, outside our theme).
const COLOR: Record<string, string> = {
  works: '#1d7a4b', 'works-with-caveats': '#1d7a4b', partial: '#94590a', 'not-supported': '#b93a30', planned: '#2457d6', untested: '#6b7785', unknown: '#6b7785',
};
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const w = (s: string) => Math.round(s.length * 6.2 + 12); // ponytail: Verdana 11px average advance; fine for ASCII labels
export const getStaticPaths = () =>
  pagePairs().map(({ r, p }) => ({ params: { robot: r.id, policy: p.id }, props: { r: r.name, p: p.name, rid: r.id, pid: p.id } }));
export const GET = ({ props }: { props: { r: string; p: string; rid: string; pid: string } }) => {
  const c = loadAll().cell(props.rid, props.pid);
  const all = loadAll();
  const s = c?.state ?? (inferredPair(all.byId.robot[props.rid], all.byId.policy[props.pid]) ? 'untested' : 'unknown');
  const left = `${props.p} on ${props.r}`;
  const right = `${STATE_META[s].label}${c?.tier ? ` · ${TIER_META[c.tier].short}` : ''}`;
  const lw = w(left), rw = w(right), W = lw + rw;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="20" role="img" aria-label="${esc(left)}: ${esc(right)}"><title>${esc(left)}: ${esc(right)}</title><linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient><clipPath id="r"><rect width="${W}" height="20" rx="3" fill="#fff"/></clipPath><g clip-path="url(#r)"><rect width="${lw}" height="20" fill="#18212b"/><rect x="${lw}" width="${rw}" height="20" fill="${COLOR[s]}"/><rect width="${W}" height="20" fill="url(#s)"/></g><g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11"><text x="${lw / 2}" y="14" fill="#010101" fill-opacity=".3">${esc(left)}</text><text x="${lw / 2}" y="13">${esc(left)}</text><text x="${lw + rw / 2}" y="14" fill="#010101" fill-opacity=".3">${esc(right)}</text><text x="${lw + rw / 2}" y="13">${esc(right)}</text></g></svg>`;
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml' } });
};
