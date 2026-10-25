// Collect every evidence URL with the files that cite it.
import { loadAll } from '../src/lib/data.ts';
export function evidenceUrls() {
  const all = loadAll();
  const m = new Map<string, Set<string>>();
  const add = (url: string, where: string) => (m.get(url) ?? m.set(url, new Set()).get(url)!).add(where);
  for (const r of all.robots) r.sources.forEach((e) => add(e.url, `data/robots/${r.id}.yaml`));
  for (const p of all.policies) p.sources.forEach((e) => add(e.url, `data/policies/${p.id}.yaml`));
  for (const c of all.compute) c.sources.forEach((e) => add(e.url, `data/compute/${c.id}.yaml`));
  for (const g of all.glossary) g.sources.forEach((e) => add(e.url, `data/glossary/${g.id}.yaml`));
  for (const c of all.compat) c.evidence.forEach((e) => add(e.url, c.file));
  for (const r of all.runs) r.evidence.forEach((e) => add(e.url, r.file));
  return m;
}
