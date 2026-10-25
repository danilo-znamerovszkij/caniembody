import { json, stats, loadAll } from './_shared.ts';
import { SITE } from '../../../site.ts';
export const GET = () => {
  const { ages, ...s } = stats();
  return json({
    schema_version: SITE.schemaVersion, build_date: new Date().toISOString(), ...s,
    frameworks: loadAll().frameworks.map((f) => ({ id: f.id, current_version: f.current_version, current_version_date: f.current_version_date })),
    endpoints: ['robots', 'policies', 'compute', 'runs', 'glossary', 'matrix', 'meta', 'compat/<robot>__<policy>'].map((e) => `${SITE.url}/api/v1/${e}.json`),
  });
};
