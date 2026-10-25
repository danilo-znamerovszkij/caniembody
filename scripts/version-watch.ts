// Daily: compare each framework's latest GitHub release with data/frameworks/*.yaml.
// On a new release, print an issue body listing cells tested against older versions. Exit 2 = new release found.
import { loadAll, semver } from '../src/lib/data.ts';
const all = loadAll();
const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'caniembody-version-watch' };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
const bodies: string[] = [];
for (const f of all.frameworks.filter((f) => f.versioning === 'releases')) {
  const r = await fetch(`https://api.github.com/repos/${f.repo}/releases/latest`, { headers });
  if (!r.ok) { console.error(`${f.repo}: HTTP ${r.status}`); continue; }
  const rel = (await r.json()) as { tag_name: string; published_at: string; html_url: string };
  const latest = rel.tag_name.replace(/^v/, '');
  if (latest === f.current_version.replace(/^v/, '')) continue;
  const cells = all.compat.filter((c) => c.framework === f.id && semver(c.framework_version_tested) && semver(latest) && c.framework_version_tested !== latest);
  bodies.push([
    `### ${f.name} ${rel.tag_name} released (${rel.published_at.slice(0, 10)})`, '', rel.html_url, '',
    `\`data/frameworks/${f.id}.yaml\` says ${f.current_version}. ${cells.length} cell(s) were tested against older versions and need review:`, '',
    ...cells.map((c) => `- [ ] \`${c.file}\` (tested ${c.framework_version_tested})`), '',
    `Also: update \`current_version\` / \`current_version_date\`, re-read the release notes for new/removed robots and policies, and check renamed \`policy.type\` / \`robot.type\` strings.`,
  ].join('\n'));
}
if (bodies.length) { console.log(bodies.join('\n\n')); process.exit(2); }
console.log('All tracked frameworks current.');
