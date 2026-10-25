# 001 — Matrix motion: stop animating the high-frequency path

Status: DONE (2026-10-24, executed in the same session) · Source: improve-animations audit

## Findings addressed

1. **HIGH** Tooltip re-fades on every cell during mouse sweeps and arrow-key navigation (`src/components/Matrix.tsx` onMouseLeave/onBlur → `setTip(null)`; `src/styles/matrix.css` `.mx-tip { animation: tip … }`).
2. **HIGH** `.mx-cell:hover` / `:focus-visible` scale(1.12) on a grid people scan constantly.
3. **MEDIUM** `prefers-reduced-motion` kills every transition, including colour feedback (`src/styles/global.css`).
4. **LOW** Ad-hoc durations (.1s/.12s/.15s/.16s) and a weak curve (`--ease: cubic-bezier(.2,.8,.2,1)`).
5. Missed opportunity: compute-target change teleports cell states.

## Target values (copy exactly)

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--dur-1: 120ms;   /* hover colour, press */
--dur-2: 160ms;   /* tooltip/popover entry */
```

## Steps

1. global.css: replace `--ease` with `--ease-out` + `--dur-1`/`--dur-2`; point every `transition`/`animation` at the tokens.
2. Matrix.tsx: hide the tooltip on leave/blur with a 60 ms grace timer instead of immediately; if a new cell is entered within the
   grace window, reposition without remounting. Add `data-anim` only when the tooltip appears from hidden **via mouse**;
   keyboard-initiated tooltips never animate.
3. matrix.css: `.mx-tip[data-anim] { animation: tip var(--dur-2) var(--ease-out) }`; remove `transform: scale` from
   `.mx-cell:hover` and `:focus-visible`; wrap the hover ring in `@media (hover: hover) and (pointer: fine)`.
4. matrix.css: `.mx-cell { transition: color var(--dur-2) ease, box-shadow var(--dur-1) ease, background-color var(--dur-2) ease }`.
5. global.css reduced motion: remove transforms + keyframe movement only; keep opacity/colour transitions.

## Verify

- Sweep the mouse across a row: tooltip appears once (faded), then follows with no flicker.
- Arrow-key across the grid: no fade, no scale, focus ring only.
- DevTools → Rendering → emulate `prefers-reduced-motion: reduce`: filter panel opens without scale; hover colour still eases.
- Switch compute to Jetson Orin Nano: header numbers and demoted cells change in place; no layout shift.
