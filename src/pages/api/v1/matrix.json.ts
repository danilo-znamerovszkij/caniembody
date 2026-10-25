import { json, envelope, loadAll, gridRobots, gridPolicies, cellOut } from './_shared.ts';
import { inferredPair } from '../../../lib/data.ts';
// One object per non-unknown cell. Any (robot, policy) pair from the grid that is absent is unknown.
export const GET = () => json(envelope({
  robots: gridRobots().map((r) => r.id), policies: gridPolicies().map((p) => p.id),
  cells: loadAll().compat.map(cellOut),
  // T4, display-only: no evidence; both sides integrated in LeRobot. Not compatibility claims.
  inferred_untested: gridRobots().flatMap((r) => gridPolicies().filter((p) => !loadAll().cell(r.id, p.id) && inferredPair(r, p))
    .map((p) => ({ robot: r.id, policy: p.id, tier: 'inferred', basis: inferredPair(r, p)!.basis }))),
}));
