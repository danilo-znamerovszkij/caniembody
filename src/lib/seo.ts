import { SITE } from '../site.ts';
export const crumbs = (items: [string, string][]) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: new URL(path, SITE.url).href })),
});
/** Brand suffix only when it fits; search results truncate around 60–65 chars and the topic matters more. */
export const pageTitle = (t: string) => (t.length + SITE.title.length + 3 <= 65 ? `${t} | ${SITE.title}` : t);
/** Meta descriptions: cut at a word boundary so search results show a whole sentence fragment, not a mid-word ellipsis. */
export const clip = (s: string, n = 155) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1)).replace(/[,;:·(]$/, '') + '…');
/** Cell titles: keep the question whole; add the keyword suffix only while the title stays under ~65 chars. */
export const fitTitle = (q: string, suffixes: string[]) => q + (suffixes.find((x) => (q + x).length <= 65) ?? '');
export const cellTitle = (policy: string, robot: string) =>
  fitTitle(`Does ${policy} run on ${robot}?`, [' Compatibility, VRAM, control rate', ' Compatibility and evidence']);
