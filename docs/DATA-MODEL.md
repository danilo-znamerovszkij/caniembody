# Data model & contribution rules

The data in `/data` is the product; the site only renders it. Every file is validated against `/schema/*.schema.json`
plus the contract checks in `scripts/validate.ts` (`npm run validate`). This page is the human-readable version of both.

## Layout

```
data/robots/<id>.yaml        one embodiment
data/policies/<id>.yaml      one policy (reward models: in_grid: false)
data/compute/<id>.yaml       one compute target
data/sensors/<id>.yaml       one sensor class
data/frameworks/<id>.yaml    lerobot, openpi, isaac-groot, openvla, openvla-oft, ros2
data/compat/<robot>__<policy>.yaml   one file per NON-unknown cell. No file = unknown.
data/runs/<id>.yaml          one robot-independent measured inference run (policy × compute)
data/glossary/<id>.yaml      one glossary entry
```

IDs are lowercase kebab-case, permanent, never reused. Renames add the old name to `aliases[]`.

## Evidence — the epistemic contract

Every record carries `sources:` (robots, policies, compute, glossary) or `evidence:` (compat, runs): a list of

```yaml
- id: ev-lerobot-readme          # ^ev-[a-z0-9-]+$, unique in the file
  tier: upstream-documented      # see tiers below
  type: official-docs            # official-docs | release-notes | source-code | model-card | paper | vendor-docs |
                                 # maintainer-run | github-issue | github-pr | community-post | blog | hub-checkpoint | spec-derivation
  url: https://github.com/huggingface/lerobot/blob/v0.6.1/README.md
  date: 2026-08-03               # when the SOURCE was published/released (omit if unknown — never guess)
  verified_on: 2026-10-24        # when someone last read the source and confirmed it says this
  versions: {lerobot: "0.6.1"}   # exact versions the claim applies to
  summary: "One line, what the source establishes."
  quote: "Verbatim excerpt, copied exactly, ≤ 300 chars."   # REQUIRED for upstream-documented
```

| Tier | Allowed `type`s | Meaning |
|---|---|---|
| `upstream-documented` (T1) | official-docs, release-notes, source-code, model-card, paper, vendor-docs | The upstream project/vendor states it. Must carry a verbatim `quote`. |
| `maintainer-tested` (T2) | maintainer-run | A project maintainer ran it and recorded config + result in `data/runs` or a cell's `measured[]`. |
| `community-reported` (T3) | github-issue, github-pr, community-post, blog, hub-checkpoint, paper, source-code, model-card | Public, linkable third-party report. |
| `inferred` (T4) | spec-derivation | Computed from specs, not observed. Always labelled "inferred" on the site. Can never support `works*`. |

Rules the validator enforces:

- Every `source_ref` / `*_source_ref` field resolves to an evidence `id` in the same file.
  Numbers without a source are a bug: `params` needs `params_source_ref`, physical specs need `specs_source_ref`,
  requirements need `source_ref`, every measurement needs `source_ref`.
- Every measurement states `runtime`, `precision` and `cameras`. `inference_hz` = model calls/s; `control_rate_hz` =
  executed actions/s after chunking. Never conflate them. If a source does not report one of the two, omit it.
- A compat cell in state `works` needs ≥1 T1 or T2 evidence. `works-with-caveats` needs `caveats[]`, `partial` needs
  `partial_scope`, `not-supported` needs `reason`.
- Prefer version-pinned URLs: `github.com/huggingface/lerobot/blob/v0.6.1/...` over `main`. The HF docs site
  (`huggingface.co/docs/lerobot/...`) tracks `main` — fine as `docs_url`, but pin evidence to a tag where you can.
- Never import numbers from vendor content pages, SEO comparison tables or anything without a primary source,
  not even as T4. If it cannot be traced to a primary source, it stays unknown.
- Never write "should work" or "probably". If it is reasoning, it is `inferred` and labelled.

## Cell states

| State | Use when |
|---|---|
| `works` | T1/T2 evidence that this policy runs on this robot (e.g. an official tutorial fine-tuning SmolVLA on SO-101). |
| `works-with-caveats` | Runs, with a concrete named limitation (one sentence each in `caveats[]`). |
| `partial` | Only some capabilities are evidenced or possible; `partial_scope` says which. |
| `not-supported` | A source states it is incompatible; `reason` says why. |
| `planned` | Upstream has publicly committed. |
| `unknown` | Default. Represented by the absence of a file. |

`capabilities` breaks a cell into `train`, `inference_sim`, `inference_real`, `teleop_record`, each with its own
state and the evidence ids backing it.

## Framework support values

`native` (in the framework's own source tree), `plugin` (third-party package auto-discovered by the framework),
`community` (third-party integration that is not a framework plugin), `upstream-repo` (the originator's own
official codebase: the policy authors' repo, e.g. openpi for π0, or a robot vendor's own driver), `removed` (was native; set `until`), `planned`.
`since` is the first *released* version containing it; use `"main"` for merged-but-unreleased.
