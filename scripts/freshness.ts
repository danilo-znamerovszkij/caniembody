// Weekly digest: stale cells (>180 d) and version drift, grouped by robot. Prints Markdown for the digest issue.
import { loadAll, STALE_DAYS } from '../src/lib/data.ts';
const all = loadAll();
const stale = all.compat.filter((c) => c.stale || c.version_drift);
const groups = Object.groupBy(stale, (c) => c.robot);
const lines = [`## Freshness digest`, '', `${stale.length} of ${all.compat.length} non-unknown cells need review (stale = newest evidence > ${STALE_DAYS} days; drift = tested > 2 minor releases behind).`, ''];
for (const [robot, cells] of Object.entries(groups)) {
  lines.push(`### ${all.byId.robot[robot]?.name ?? robot}`);
  for (const c of cells!) lines.push(`- [ ] \`${c.file}\` — ${c.state}, verified ${c.verified_on} (${c.age_days} d)${c.stale ? ' **stale**' : ''}${c.version_drift ? ` **drift** (tested ${c.framework} ${c.framework_version_tested})` : ''}`);
  lines.push('');
}
console.log(lines.join('\n'));
