import { loadAll, stats, gridRobots, gridPolicies } from '../../../lib/data.ts';
import { SITE } from '../../../site.ts';
export const json = (body: unknown) =>
  new Response(JSON.stringify(body, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
export const envelope = (data: unknown) => ({
  schema_version: SITE.schemaVersion, license: 'CC-BY-4.0', attribution: `${SITE.title} (${SITE.url})`,
  dataset_version: stats().dataset_version, generated: new Date().toISOString().slice(0, 10), data,
});
export const cellOut = (c: ReturnType<typeof loadAll>['compat'][number]) => {
  const { file, ...rest } = c;
  return { ...rest, url: `${SITE.url}/compat/${c.robot}/${c.policy}` };
};
export { loadAll, stats, gridRobots, gridPolicies };
