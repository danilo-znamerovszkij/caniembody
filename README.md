# caniembody

**Can this policy run on this robot, with this hardware, at a useful control rate?**

A `caniuse`-style compatibility reference for embodied AI, where every cell is **sourced, versioned,
runtime-specific and correctable**. Site: https://caniembody.pages.dev · JSON API: `/api/v1/` · Data: CC BY 4.0

## Scope, claimed exactly

<!-- stats:start -->
- **v1 covers LeRobot-centric robot learning.** Robots natively supported by or plugged into LeRobot; the policies
  LeRobot ships at v0.6.1 plus upstream-only OpenVLA / OpenVLA-OFT and openpi.
- Coverage numbers are generated at build time: see [/coverage](https://caniembody.pages.dev/coverage) and
  [`/api/v1/meta.json`](https://caniembody.pages.dev/api/v1/meta.json). Run `npm run stats` for the current numbers locally.
- `unknown` is the default. A cell changes only when someone links evidence, so most of the grid is unknown today
  and the coverage page says so.
<!-- stats:end -->

**Not covered:** autonomous driving, drones, industrial PLCs, surgical and soft robotics, closed commercial humanoids
(no public interface to verify), and **benchmark success rates of any kind**.

## Non-goals

- Success rates and rankings. Use LeRobot eval, RoboArena or vla-eval for those.
- Reviews, "best of" lists or star ratings.
- Hosting weights, datasets or tutorials. Every cell links to the upstream instructions.
- Accounts, tracking cookies or a paywall.

## How it stays correct

- Six cell states (`works`, `works-with-caveats`, `partial`, `not-supported`, `planned`, `unknown`) and four evidence
  tiers (T1 upstream-documented → T4 inferred). `works` requires T1 or T2. T1 requires a verbatim quote.
- Every measured number carries runtime, precision and camera count, and keeps model-call rate separate from
  control rate. CI rejects anything else.
- Evidence URLs are link-checked; cells older than 180 days are flagged stale; a daily job watches upstream releases.
- Every cell page has a Dispute button, and an open dispute shows on the cell.

Full contract: [methodology](https://caniembody.pages.dev/methodology) · [docs/DATA-MODEL.md](docs/DATA-MODEL.md).

## Develop

```bash
nvm use        # Node ≥ 22.23 (Astro 7); .nvmrc pins 24
npm ci
npm run validate
npm run dev
npm run build  # validate + static build to dist/ (incl. /api/v1, badges, embeds, OG images)
```

```
data/        the product: one YAML file per robot, policy, compute target, cell, run, glossary term
schema/      JSON Schema, enforced in CI
scripts/     validate · check-links · freshness · version-watch · hub-sync · issue-to-yaml
src/         Astro site; the matrix is a single Preact island
```

## Contribute

Reports of failure are as valuable as reports of success. You don't need to write YAML: see [CONTRIBUTING.md](CONTRIBUTING.md).

## Cite

See [CITATION.cff](CITATION.cff). Cite the dataset version you used; URLs are permanent.

## License

Code [MIT](LICENSE). Data [CC BY 4.0](LICENSE-DATA).
