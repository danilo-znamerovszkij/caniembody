# Contributing

Reports of failure count as much as reports of success. A `not-supported` cell with a reason is a real contribution.

## The fastest way: an issue form (no YAML)

- **[Report compatibility](../../issues/new?template=add-compat.yml)**: policy X does or does not run on robot Y. A bot
  turns it into a draft pull request.
- **[Dispute a cell](../../issues/new?template=dispute-cell.yml)**: every cell page has a pre-filled button. The cell
  shows a "disputed" marker while the issue is open.
- [Add a robot](../../issues/new?template=add-robot.yml) · [Add a policy](../../issues/new?template=add-policy.yml)

All you need is **one public link someone else can check**: an issue, PR, Hub checkpoint, blog post, video, or log.

## Editing data directly

Every record is one small YAML file in `/data`. See [docs/DATA-MODEL.md](docs/DATA-MODEL.md).

```bash
nvm use            # Node 24 (see .nvmrc)
npm ci
npm run validate   # schema + referential integrity + epistemic contract
npm run dev        # http://localhost:4321
```

Rules the validator enforces (and reviewers check):

1. **No claim without a source.** Every non-unknown cell has ≥1 evidence record with URL, date, versions and summary.
   Every number has a `source_ref`.
2. **`works` needs T1 or T2.** Upstream docs/model card/release notes (with a verbatim quote), or a maintainer run.
   Community reports are T3 and support `works-with-caveats` or `partial`.
3. **Every measurement states runtime, precision and camera count.** Keep `inference_hz` (model calls/s) and
   `control_rate_hz` (executed actions/s after chunking) separate.
4. **Inferred is labelled.** Arithmetic from specs is T4 `inferred`, and can never support `works`.
5. **No vendor content pages or unsourced comparison tables**, not even as T4.
6. **Never write "should work" or "probably".**

One file per cell keeps diffs tiny and makes `git blame` the provenance record.

## Contributors

Everyone who lands a data change is listed. Thank you.
