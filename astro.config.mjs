import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import { SITE } from './src/site.ts';
import { loadAll } from './src/lib/data.ts';

// Sitemap: evidenced pages only. Unknown cells stay crawlable (noindex, follow) but are not advertised as content.
const all = loadAll();
const lastmod = new Map([
  ...all.compat.map((c) => [`/compat/${c.robot}/${c.policy}`, c.verified_on]),
  ...all.robots.map((r) => [`/robot/${r.id}`, r.verified_on]),
  ...all.policies.map((p) => [`/policy/${p.id}`, p.verified_on]),
  ...all.compute.map((c) => [`/compute/${c.id}`, c.verified_on]),
]);

export default defineConfig({
  site: SITE.url,
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [preact(), sitemap({
    filter: (p) => { const path = new URL(p).pathname.replace(/\/$/, ''); return !path.startsWith('/embed/') && (!path.startsWith('/compat/') || lastmod.has(path)); },
    serialize: (item) => { const d = lastmod.get(new URL(item.url).pathname.replace(/\/$/, '')); return d ? { ...item, lastmod: d } : item; },
  })],
});
