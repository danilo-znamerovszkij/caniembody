// Audits the built site in dist/: titles, descriptions, canonicals, h1s, OG images, JSON-LD, internal links, sitemap.
// Run after `astro build`: node scripts/seo-audit.ts. Exit 1 on errors; warnings are printed but don't fail.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { SITE } from '../src/site.ts';

const DIST = join(process.cwd(), 'dist');
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = walk(DIST);
const html = files.filter((f) => f.endsWith('.html'));
const route = (f: string) => '/' + relative(DIST, f).replace(/(^|\/)index\.html$/, '').replace(/\.html$/, '');
const exists = (path: string) => {
  const p = decodeURIComponent(path.split(/[?#]/)[0]).replace(/\/$/, '') || '/';
  return p === '/' || existsSync(join(DIST, p)) && statSync(join(DIST, p)).isFile() || existsSync(join(DIST, p + '.html')) || existsSync(join(DIST, p, 'index.html'));
};
const redirects = new Set(existsSync(join(DIST, '_redirects')) ? readFileSync(join(DIST, '_redirects'), 'utf8').split('\n').map((l) => l.split(' ')[0]) : []);
const sitemap = files.filter((f) => /sitemap-\d+\.xml$/.test(f)).map((f) => readFileSync(f, 'utf8')).join('');
const inSitemap = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname.replace(/\/$/, '') || '/'));

const errors: string[] = [], warns: string[] = [];
const titles = new Map<string, string[]>(), descs = new Map<string, string[]>();
const attr = (s: string, re: RegExp) => s.match(re)?.[1]?.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
let checkedLinks = 0;

for (const f of html) {
  const r = route(f);
  const s = readFileSync(f, 'utf8');
  const noindex = /<meta name="robots" content="noindex/.test(s);
  const title = attr(s, /<title>([^<]*)<\/title>/);
  const desc = attr(s, /<meta name="description" content="([^"]*)"/);
  const canon = attr(s, /<link rel="canonical" href="([^"]*)"/);
  const h1 = (s.match(/<h1[\s>]/g) ?? []).length;
  if (!title) errors.push(`${r}: missing <title>`);
  if (!noindex) {
    (titles.get(title!) ?? titles.set(title!, []).get(title!)!).push(r);
    (descs.get(desc!) ?? descs.set(desc!, []).get(desc!)!).push(r);
    if (title && title.length > 70) warns.push(`${r}: title ${title.length} chars`);
    if (!desc) errors.push(`${r}: missing meta description`);
    else if (desc.length < 50 || desc.length > 170) warns.push(`${r}: description ${desc.length} chars`);
    if (canon !== new URL(r, SITE.url).href) errors.push(`${r}: canonical ${canon} ≠ ${new URL(r, SITE.url).href}`);
    if (h1 !== 1) errors.push(`${r}: ${h1} h1 elements`);
    if (!inSitemap.has(r) && r !== '/404') errors.push(`${r}: indexable but not in sitemap`);
    const og = attr(s, /<meta property="og:image" content="([^"]*)"/);
    if (!og) warns.push(`${r}: no og:image`);
    else if (!exists(new URL(og).pathname)) errors.push(`${r}: og:image ${og} not built`);
  }
  for (const m of s.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch { errors.push(`${r}: invalid JSON-LD`); }
  }
  for (const m of s.matchAll(/(?:href|src)="(\/[^"#]*)/g)) {
    const u = m[1];
    if (u.startsWith('//') || u.startsWith('/_astro/')) continue;
    checkedLinks++;
    if (!exists(u) && !redirects.has(u.split('?')[0])) errors.push(`${r}: broken internal link ${u}`);
  }
}
for (const [t, rs] of titles) if (rs.length > 1) errors.push(`duplicate title "${t}" on ${rs.slice(0, 3).join(', ')}${rs.length > 3 ? ` +${rs.length - 3}` : ''}`);
for (const [d, rs] of descs) if (rs.length > 1) warns.push(`duplicate description on ${rs.length} pages: ${rs.slice(0, 3).join(', ')}`);

const uniq = (xs: string[]) => [...new Set(xs)];
console.log(`${html.length} pages · ${inSitemap.size} sitemap URLs · ${checkedLinks} internal links checked`);
for (const w of uniq(warns).slice(0, 40)) console.log('⚠', w);
if (uniq(warns).length > 40) console.log(`⚠ … ${uniq(warns).length - 40} more warnings`);
for (const e of uniq(errors).slice(0, 60)) console.log('✗', e);
console.log(`${uniq(errors).length} errors, ${uniq(warns).length} warnings`);
process.exit(errors.length ? 1 : 0);
