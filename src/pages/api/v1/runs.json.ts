import { json, envelope, loadAll } from './_shared.ts';
export const GET = () => json(envelope(loadAll().runs.map(({ file, ...r }) => r)));
