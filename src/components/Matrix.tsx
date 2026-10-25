import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  STATE_META, TIER_META, FAMILY_LABEL, FAMILY_ORDER, CLASS_LABEL, CLASS_ORDER, COMPUTE_CLASS_LABEL, COMPUTE_CLASS_ORDER,
  RUNTIME_LABEL, fmtAge, cellLabel,
} from '../lib/ui.ts';
import { fitFor, demotes, fitText, type Fit, type FitRun, type FitCompute, type Need } from '../lib/fit.ts';

export interface MRobot { id: string; name: string; class: string; aliases: string[]; open_source: boolean; price?: number; frameworks: string[]; sensors: string[] }
export interface MPolicy { id: string; name: string; family: string; aliases: string[]; open_weights?: boolean; frameworks: string[]; need?: Need }
export interface MCell { r: string; p: string; s: string; t: string | null; v: string | null; age: number | null; n: number; stale: boolean; drift: boolean; dispute: boolean; caveat?: string }
export interface MData {
  robots: MRobot[]; policies: MPolicy[]; cells: MCell[]; compute: (FitCompute & { class: string })[];
  runs: Record<string, Record<string, FitRun[]>>; // policy -> compute -> runs
  frameworks: { id: string; name: string }[]; sensors: { id: string; name: string }[];
}

const TIER_ORDER = ['upstream-documented', 'maintainer-tested', 'community-reported', 'inferred'];
const SHOWN_STATES = ['works', 'works-with-caveats', 'partial', 'not-supported', 'planned'];
const NO_EVIDENCE = new Set(['untested', 'unknown']);
type Filters = { q: string; compute: string; r: string; p: string; fw: string; cls: string; fam: string; oss: boolean; price: string; hide: boolean; tier: string; sensor: string };
const DEFAULTS: Filters = { q: '', compute: '', r: '', p: '', fw: '', cls: '', fam: '', oss: false, price: '', hide: false, tier: '', sensor: '' };
const FILTER_KEYS = ['fw', 'cls', 'fam', 'oss', 'price', 'hide', 'tier', 'sensor'] as const;

function readUrl(): Filters {
  const u = new URLSearchParams(location.search);
  const f = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS) as (keyof Filters)[]) {
    const v = u.get(k);
    if (v != null) (f as any)[k] = typeof DEFAULTS[k] === 'boolean' ? v === '1' : v;
  }
  return f;
}
function writeUrl(f: Filters) {
  const u = new URLSearchParams();
  for (const k of Object.keys(DEFAULTS) as (keyof Filters)[]) if (f[k] !== DEFAULTS[k]) u.set(k, typeof f[k] === 'boolean' ? '1' : String(f[k]));
  const s = u.toString();
  history.replaceState(null, '', s ? `?${s}` : location.pathname);
}
const norm = (s: string) => s.toLowerCase().replace(/[\s_.\-π]/g, (c) => (c === 'π' ? 'pi' : ''));
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Matrix({ data }: { data: MData }) {
  const [f, setF] = useState<Filters>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<{ r: string; p: string } | null>(null);
  const [focus, setFocus] = useState<[number, number]>([0, 0]);
  const tableRef = useRef<HTMLTableElement>(null);
  const inspectorRef = useRef<HTMLElement>(null);

  useEffect(() => { setF(readUrl()); setReady(true); }, []);
  useEffect(() => { if (ready) writeUrl(f); }, [f, ready]);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((o) => ({ ...o, [k]: v }));

  const cellMap = useMemo(() => new Map(data.cells.map((c) => [`${c.r}|${c.p}`, c])), [data]);
  const robotById = useMemo(() => new Map(data.robots.map((r) => [r.id, r])), [data]);
  const policyById = useMemo(() => new Map(data.policies.map((p) => [p.id, p])), [data]);
  const compute = data.compute.find((c) => c.id === f.compute);
  const fits = useMemo(() => {
    const m = new Map<string, Fit>();
    if (compute) for (const p of data.policies) m.set(p.id, fitFor(p.need, compute, data.runs[p.id]?.[compute.id] ?? []));
    return m;
  }, [compute, data]);

  /** State as displayed: a "works" cell is shown as partial when the selected hardware demonstrably can't run it. */
  const view = (r: string, p: string) => {
    const c = cellMap.get(`${r}|${p}`);
    const fit = fits.get(p);
    const demoted = !!(c && fit && /^works/.test(c.s) && demotes(fit));
    return { c, fit, s: demoted ? 'partial' : c?.s ?? 'unknown', demoted };
  };

  // ---- filtering ----
  const q = norm(f.q);
  const matches = (x: { name: string; id: string; aliases: string[] }) => [x.name, x.id, ...x.aliases].some((s) => norm(s).includes(q));
  let robots = data.robots.filter((r) =>
    (!f.fw || r.frameworks.includes(f.fw)) && (!f.cls || r.class === f.cls) && (!f.oss || r.open_source) &&
    (!f.price || (r.price != null && r.price <= +f.price)) && (!f.sensor || r.sensors.includes(f.sensor)));
  let policies = data.policies.filter((p) =>
    (!f.fw || p.frameworks.includes(f.fw)) && (!f.fam || FAMILY_LABEL[p.family] === f.fam) && (!f.oss || p.open_weights));
  if (q) {
    const rq = robots.filter(matches), pq = policies.filter(matches);
    if (rq.length || pq.length) { if (rq.length) robots = rq; if (pq.length) policies = pq; }
    else { robots = []; policies = []; }
  }
  const known = (r: string, p: string) => { const c = cellMap.get(`${r}|${p}`); return !!c && !NO_EVIDENCE.has(c.s); };
  if (f.hide) {
    robots = robots.filter((r) => policies.some((p) => known(r.id, p.id)));
    policies = policies.filter((p) => robots.some((r) => known(r.id, p.id)));
  }
  const groups = CLASS_ORDER.map((c) => ({ c, rows: robots.filter((r) => r.class === c) })).filter((g) => g.rows.length);
  const fams = FAMILY_ORDER.map((fam) => ({ fam, cols: policies.filter((p) => FAMILY_LABEL[p.family] === fam) })).filter((g) => g.cols.length);
  const cols = fams.flatMap((g) => g.cols);
  const rows = groups.flatMap((g) => g.rows);
  const firstOfFam = new Set(fams.slice(1).map((g) => g.cols[0].id));
  const minTier = f.tier ? TIER_ORDER.indexOf(f.tier) : 99;
  const total = rows.length * cols.length;
  const counts: Record<string, number> = {};
  for (const r of rows) for (const p of cols) { const s = view(r.id, p.id).s; counts[s] = (counts[s] ?? 0) + 1; }
  const withEvidence = total - (counts.unknown ?? 0) - (counts.untested ?? 0);

  // crosshair: hovered cell wins, else the selected one
  const hl = hover ?? (f.r || f.p ? { r: f.r, p: f.p } : null);

  // ---- selection ----
  const select = (r: string, p: string) => {
    setF((o) => ({ ...o, r, p }));
    // On narrow screens the inspector sits above the grid; bring it into view.
    if (!matchMedia('(min-width: 1180px)').matches) inspectorRef.current?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
  };
  const onCellClick = (e: MouseEvent, r: string, p: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // let new-tab clicks through to the cell page
    e.preventDefault();
    select(r, p);
  };

  // ---- keyboard: roving tabindex over the grid ----
  const move = (e: KeyboardEvent) => {
    const keys: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    let [r, c] = focus;
    if (keys[e.key]) { r += keys[e.key][0]; c += keys[e.key][1]; }
    else if (e.key === 'Home') c = e.ctrlKey ? (r = 0, 0) : 0;
    else if (e.key === 'End') c = e.ctrlKey ? (r = rows.length - 1, cols.length - 1) : cols.length - 1;
    else if (e.key === 'Escape') { setF((o) => ({ ...o, r: '', p: '' })); return; }
    else return;
    e.preventDefault();
    r = Math.max(0, Math.min(rows.length - 1, r)); c = Math.max(0, Math.min(cols.length - 1, c));
    setFocus([r, c]);
    (tableRef.current?.querySelector(`a[data-rc="${r}-${c}"]`) as HTMLElement | null)?.focus();
  };

  const fitMini = (p: MPolicy) => {
    const fit = fits.get(p.id);
    if (!fit || !compute) return null;
    const t = fitText(fit, compute);
    if (fit.kind === 'measured') return <span class="fit ok" title={t}>{fit.run.inference_hz != null ? +fit.run.inference_hz.toFixed(1) : '✓'}</span>;
    if (fit.kind === 'fails') return <span class="fit bad" title={t}>{fit.run.outcome === 'oom' ? 'OOM' : '✕'}</span>;
    if (fit.kind === 'exceeds') return <span class="fit inf" title={t}>&gt;mem</span>;
    return <span class="fit none" title={t}>–</span>;
  };

  const activeFilters = FILTER_KEYS.filter((k) => f[k] !== DEFAULTS[k]).length;
  const selR = robotById.get(f.r), selP = policyById.get(f.p);

  return (
    <div class="mx">
      <div class="mx-layout">
        <aside class="mx-inspector" ref={inspectorRef} aria-label="Answer">
          <div class="mx-ask">
            <Pick label="Robot" v={f.r} on={(v) => set('r', v)} any="Any robot"
              groups={CLASS_ORDER.map((c) => [CLASS_LABEL[c], data.robots.filter((r) => r.class === c).map((r) => [r.id, r.name])])} />
            <Pick label="Policy" v={f.p} on={(v) => set('p', v)} any="Any policy"
              groups={FAMILY_ORDER.map((fm) => [fm, data.policies.filter((p) => FAMILY_LABEL[p.family] === fm).map((p) => [p.id, p.name])])} />
            <Pick label="Hardware" v={f.compute} on={(v) => set('compute', v)} any="Any hardware"
              groups={COMPUTE_CLASS_ORDER.map((cl) => [COMPUTE_CLASS_LABEL[cl], data.compute.filter((c) => c.class === cl).map((c) => [c.id, c.name])])} />
          </div>
          <div class="mx-answer" aria-live="polite">
            {selR && selP ? <CellAnswer v={view(selR.id, selP.id)} r={selR} p={selP} compute={compute} />
              : selR ? <ListAnswer title={`Policies on ${selR.name}`} items={data.policies.map((p) => ({ id: p.id, name: p.name, ...view(selR.id, p.id) }))} pick={(id) => select(selR.id, id)} noun="policies" href={`/robot/${selR.id}`} />
              : selP ? <ListAnswer title={`Robots running ${selP.name}`} items={data.robots.map((r) => ({ id: r.id, name: r.name, ...view(r.id, selP.id) }))} pick={(id) => select(id, selP.id)} noun="robots" href={`/policy/${selP.id}`} />
              : (
                <div class="mx-hint">
                  <p>Pick a robot and a policy, or click any cell in the matrix.</p>
                  <p class="mx-hint-eg">Try <button type="button" class="linkish" onClick={() => select('so101', 'smolvla')}>SmolVLA on SO-101</button>, <button type="button" class="linkish" onClick={() => select('aloha', 'pi0')}>π0 on ALOHA</button> or <button type="button" class="linkish" onClick={() => { set('compute', 'jetson-orin-nano-8gb'); }}>everything on a Jetson Orin Nano</button>.</p>
                </div>
              )}
            {compute && !(selR && selP) && (
              <p class="mx-hw">Matrix re-checked for <b>{compute.name}</b>. Header numbers are measured model calls per second. <span class="fit inf">&gt;mem</span> means an upstream-stated minimum exceeds its {compute.memory_gb} GB (inferred). <a href={`/compute/${compute.id}`}>All runs on this hardware</a></p>
            )}
          </div>
        </aside>

        <div class="mx-main">
          <div class="mx-toolbar" role="search">
            <label class="mx-search">
              <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M7 1.5a5.5 5.5 0 1 0 3.4 9.83l3.13 3.14a.75.75 0 1 0 1.06-1.06l-3.13-3.14A5.5 5.5 0 0 0 7 1.5ZM3 7a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"/></svg>
              <span class="sr-only">Filter rows and columns by name</span>
              <input type="search" placeholder="Filter robots and policies" value={f.q} onInput={(e) => set('q', (e.target as HTMLInputElement).value)} />
              <kbd aria-hidden="true">/</kbd>
            </label>
            <details class="mx-filters">
              <summary>Filters{activeFilters ? <span class="count">{activeFilters}</span> : null}</summary>
              <div class="mx-panel">
                <Sel label="Framework" v={f.fw} on={(v) => set('fw', v)} opts={data.frameworks.map((x) => [x.id, x.name])} />
                <Sel label="Robot class" v={f.cls} on={(v) => set('cls', v)} opts={CLASS_ORDER.filter((c) => data.robots.some((r) => r.class === c)).map((c) => [c, CLASS_LABEL[c]])} />
                <Sel label="Policy family" v={f.fam} on={(v) => set('fam', v)} opts={FAMILY_ORDER.filter((x) => data.policies.some((p) => FAMILY_LABEL[p.family] === x)).map((x) => [x, x])} />
                <Sel label="Minimum evidence tier" v={f.tier} on={(v) => set('tier', v)} opts={TIER_ORDER.slice(0, 3).map((t) => [t, `${TIER_META[t].short} · ${TIER_META[t].label}`])} />
                <Sel label="Sensor" v={f.sensor} on={(v) => set('sensor', v)} opts={data.sensors.map((s) => [s.id, s.name])} />
                <label class="mx-field"><span>Max robot price (USD)</span>
                  <input type="number" min="0" step="50" inputMode="numeric" placeholder="any" value={f.price} onInput={(e) => set('price', (e.target as HTMLInputElement).value)} />
                </label>
                <label class="mx-check"><input type="checkbox" checked={f.oss} onChange={(e) => set('oss', (e.target as HTMLInputElement).checked)} /> Open hardware and open weights only</label>
                <label class="mx-check"><input type="checkbox" checked={f.hide} onChange={(e) => set('hide', (e.target as HTMLInputElement).checked)} /> Hide rows and columns with no evidence</label>
                {f.price ? <p class="mx-note">Robots without a sourced price are hidden while a price ceiling is set.</p> : null}
                <button type="button" class="btn" onClick={() => setF((o) => ({ ...o, fw: '', cls: '', fam: '', oss: false, price: '', hide: false, tier: '', sensor: '' }))}>Reset filters</button>
              </div>
            </details>
          </div>

          <div class="mx-legend" aria-label="Legend">
            {[...SHOWN_STATES, 'untested', 'unknown'].map((s) => (
              <span class={counts[s] ? '' : 'zero'}><i class="mx-sw" data-s={s} aria-hidden="true">{STATE_META[s].glyph}</i>{s === 'unknown' ? 'not yet verified' : s === 'untested' ? 'untested, both in LeRobot' : STATE_META[s].label}<b>{counts[s] ?? 0}</b></span>
            ))}
            <span class="mx-total">{withEvidence} of {total} with evidence</span>
          </div>

          {rows.length && cols.length ? (
            <div class="mx-scroll" tabIndex={-1} onMouseLeave={() => setHover(null)}>
              <table class="mx-table" ref={tableRef} role="grid" aria-label="Robot × policy compatibility" aria-rowcount={rows.length + 2} aria-colcount={cols.length + 1} onKeyDown={move as any}>
                <thead>
                  <tr class="mx-fam">
                    <th class="mx-corner" rowSpan={compute ? 3 : 2} scope="col"><span class="mx-axis"><span>Policy →</span><span>Robot ↓</span></span></th>
                    {fams.map((g) => <th colSpan={g.cols.length} scope="colgroup" class="mx-famh">{g.fam}</th>)}
                  </tr>
                  <tr class="mx-pol">
                    {cols.map((p) => (
                      <th scope="col" class={`mx-colh${firstOfFam.has(p.id) ? ' gstart' : ''}${hl?.p === p.id ? ' hl' : ''}`}>
                        <a href={`/policy/${p.id}`} tabIndex={-1}><span>{p.name}</span></a>
                      </th>
                    ))}
                  </tr>
                  {compute && (
                    <tr class="mx-fitrow">
                      {cols.map((p) => <th scope="col" class={`${firstOfFam.has(p.id) ? 'gstart' : ''}${hl?.p === p.id ? ' hl' : ''}`}>{fitMini(p)}</th>)}
                    </tr>
                  )}
                </thead>
                {groups.map((g) => (
                  <tbody>
                    <tr class="mx-group"><th scope="rowgroup" colSpan={cols.length + 1}><span>{CLASS_LABEL[g.c]}</span></th></tr>
                    {g.rows.map((r) => {
                      const ri = rows.indexOf(r);
                      const rowHl = hl?.r === r.id;
                      return (
                        <tr class={rowHl ? 'hl' : undefined}>
                          <th scope="row" class={`mx-rowh${rowHl ? ' hl' : ''}`}><a href={`/robot/${r.id}`} tabIndex={-1}>{r.name}</a></th>
                          {cols.map((p, ci) => {
                            const { c, s, demoted } = view(r.id, p.id);
                            const dim = c?.t ? TIER_ORDER.indexOf(c.t) > minTier : false;
                            const sel = f.r === r.id && f.p === p.id;
                            return (
                              <td class={`${firstOfFam.has(p.id) ? 'gstart' : ''}${dim ? ' dim' : ''}${hl?.p === p.id ? ' colhl' : ''}`}>
                                <a
                                  class={`mx-cell${sel ? ' sel' : ''}`} data-s={s} data-rc={`${ri}-${ci}`} href={`/compat/${r.id}/${p.id}`}
                                  tabIndex={focus[0] === ri && focus[1] === ci ? 0 : -1}
                                  aria-label={cellLabel(p.name, r.name, s, c?.t) + (demoted ? `, demoted for ${compute!.name}` : '') + (c?.stale ? ', stale' : '')}
                                  aria-current={sel ? 'true' : undefined}
                                  title={`${p.name} on ${r.name}: ${s === 'unknown' ? 'not yet verified' : STATE_META[s].label}`}
                                  onMouseEnter={() => setHover({ r: r.id, p: p.id })}
                                  onFocus={() => { setFocus([ri, ci]); setHover({ r: r.id, p: p.id }); }}
                                  onClick={(e) => onCellClick(e as unknown as MouseEvent, r.id, p.id)}
                                  onKeyDown={(e) => { if (e.key === 'Enter' && !sel) { e.preventDefault(); select(r.id, p.id); } }}
                                >
                                  <span aria-hidden="true">{STATE_META[s].glyph}</span>
                                  {(c?.stale || c?.drift) && <span class="stale" aria-hidden="true" />}
                                  {c?.dispute && <span class="disp" aria-hidden="true" />}
                                </a>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                ))}
              </table>
            </div>
          ) : (
            <div class="empty">Nothing matches. <button type="button" class="btn" onClick={() => setF({ ...DEFAULTS, compute: f.compute })}>Clear filter and search</button></div>
          )}
          <p class="mx-foot">Click a cell for its answer and evidence. Arrow keys move through the grid; Enter selects. <span class="stale-key" aria-hidden="true" /> stale or version drift · <span class="disp-key" aria-hidden="true" /> open dispute.</p>
        </div>
      </div>
    </div>
  );
}

function CellAnswer({ v, r, p, compute }: { v: ReturnType<any>; r: MRobot; p: MPolicy; compute?: FitCompute }) {
  const { c, s, demoted, fit } = v as { c?: MCell; s: string; demoted: boolean; fit?: Fit };
  return (
    <div class="mx-cellans">
      <p class="mx-q">Does <a href={`/policy/${p.id}`}>{p.name}</a> run on <a href={`/robot/${r.id}`}>{r.name}</a>?</p>
      <div class="mx-verdict">
        <i class="mx-sw big" data-s={s} aria-hidden="true">{STATE_META[s].glyph}</i>
        <div>
          <div class="mx-vstate">{s === 'unknown' ? 'Not yet verified' : s === 'untested' ? 'Untested' : STATE_META[s].label[0].toUpperCase() + STATE_META[s].label.slice(1)}</div>
          {c?.t && <div class="mx-vtier"><span class="tier" data-t={c.t}>{TIER_META[c.t].short} · {TIER_META[c.t].label}</span></div>}
        </div>
      </div>
      {demoted && <p class="mx-line warn">Shown as partial: “{STATE_META[c!.s].label}” in general, but not on {compute!.name}.</p>}
      {c?.caveat && <p class={`mx-line${s === 'untested' ? ' inferred' : ''}`}>{c.caveat}</p>}
      {!c && <p class="mx-line muted">No published evidence found yet, so this makes no claim either way.</p>}
      {compute && fit && (
        <p class={`mx-line num${fit.kind === 'exceeds' ? ' inf' : ''}`}>
          {fit.kind === 'measured' ? `${fit.run.inference_hz != null ? `${+fit.run.inference_hz.toFixed(2)} Hz model calls` : 'Runs'} on ${compute.name} · ${RUNTIME_LABEL[fit.run.runtime] ?? fit.run.runtime} · ${fit.run.precision} · ${fit.run.cameras} cam` : fitText(fit, compute)}
        </p>
      )}
      {c && c.n > 0 && <p class="mx-line meta">{c.n} source{c.n === 1 ? '' : 's'} · newest {c.v} ({fmtAge(c.age)}){c.stale ? ' · stale' : ''}{c.drift ? ' · version drift' : ''}{c.dispute ? ' · disputed' : ''}</p>}
      <a class="btn primary mx-go" href={`/compat/${r.id}/${p.id}`}>{c && c.n > 0 ? 'Evidence and details' : 'Add evidence'} →</a>
    </div>
  );
}

function ListAnswer({ title, items, pick, noun, href }: { title: string; items: { id: string; name: string; s: string }[]; pick: (id: string) => void; noun: string; href: string }) {
  const unknown = items.filter((x) => x.s === 'unknown').length;
  const untested = items.filter((x) => x.s === 'untested');
  return (
    <div class="mx-list">
      <p class="mx-q"><a href={href}>{title}</a></p>
      {SHOWN_STATES.map((s) => {
        const xs = items.filter((x) => x.s === s);
        return xs.length ? (
          <div class="mx-lgroup">
            <div class="mx-lhead"><i class="mx-sw" data-s={s} aria-hidden="true">{STATE_META[s].glyph}</i>{STATE_META[s].label} <b>{xs.length}</b></div>
            <div class="mx-chips">{xs.map((x) => <button type="button" class="chip" onClick={() => pick(x.id)}>{x.name}</button>)}</div>
          </div>
        ) : null;
      })}
      {untested.length > 0 && (
        <div class="mx-lgroup">
          <div class="mx-lhead"><i class="mx-sw" data-s="untested" aria-hidden="true">○</i>untested, both in LeRobot <b>{untested.length}</b></div>
          <div class="mx-chips">{untested.map((x) => <button type="button" class="chip quiet" onClick={() => pick(x.id)}>{x.name}</button>)}</div>
        </div>
      )}
      {unknown > 0 && <p class="mx-line muted">{unknown} {noun} not yet verified.</p>}
    </div>
  );
}

function Pick({ label, v, on, any, groups }: { label: string; v: string; on: (v: string) => void; any: string; groups: [string, [string, string][]][] }) {
  return (
    <label class="mx-pick">
      <span>{label}</span>
      <select value={v} onChange={(e) => on((e.target as HTMLSelectElement).value)}>
        <option value="">{any}</option>
        {groups.filter(([, xs]) => xs.length).map(([g, xs]) => <optgroup label={g}>{xs.map(([id, name]) => <option value={id}>{name}</option>)}</optgroup>)}
      </select>
    </label>
  );
}

function Sel({ label, v, on, opts }: { label: string; v: string; on: (v: string) => void; opts: [string, string][] }) {
  return (
    <label class="mx-field">
      <span>{label}</span>
      <select value={v} onChange={(e) => on((e.target as HTMLSelectElement).value)}>
        <option value="">Any</option>
        {opts.map(([id, name]) => <option value={id}>{name}</option>)}
      </select>
    </label>
  );
}
