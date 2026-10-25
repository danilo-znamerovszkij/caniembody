import { json, envelope, loadAll, cellOut } from '../_shared.ts';
export const getStaticPaths = () => loadAll().compat.map((c) => ({ params: { cell: `${c.robot}__${c.policy}` }, props: { c } }));
export const GET = ({ props }: { props: { c: ReturnType<typeof loadAll>['compat'][number] } }) => json(envelope(cellOut(props.c)));
