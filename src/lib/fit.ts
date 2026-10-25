// Will policy P run on compute C? Evidence first, arithmetic second, and arithmetic is always labelled "inferred".
// No node imports: used by the matrix island in the browser and by /compute pages at build time.
export interface FitRun {
  id: string; runtime: string; precision: string; cameras: number; inference_hz?: number; control_rate_hz?: number;
  p50?: number; vram_gb?: number; outcome: 'runs' | 'oom' | 'too-slow' | 'error';
}
export interface FitCompute { id: string; name: string; memory_gb: number; unified?: boolean }
export type Fit =
  | { kind: 'measured'; run: FitRun; runs: FitRun[] }
  | { kind: 'fails'; run: FitRun; runs: FitRun[] }
  | { kind: 'exceeds'; needGb: number; haveGb: number; precision?: string; inferred: true }
  | { kind: 'none' };

/**
 * need: the policy's upstream-stated MINIMUM inference memory (requirements.inference.vram_gb.min) and its precision.
 * Never a measured peak: a measurement at fp32 says nothing about bf16/int8 fit, so it must not drive a demotion.
 */
export interface Need { gb?: number; precision?: string }
export function fitFor(need: Need | undefined, compute: FitCompute, runs: FitRun[]): Fit {
  const ok = runs.filter((r) => r.outcome === 'runs');
  if (ok.length) {
    // ponytail: "best" = highest model-call rate; a per-runtime view lives on the compute page
    const best = [...ok].sort((a, b) => (b.inference_hz ?? 0) - (a.inference_hz ?? 0))[0];
    return { kind: 'measured', run: best, runs };
  }
  if (runs.length) return { kind: 'fails', run: runs[0], runs };
  // cpu-only has memory_gb 0 (system RAM varies): no memory arithmetic there
  if (need?.gb && compute.memory_gb > 0 && need.gb > compute.memory_gb)
    return { kind: 'exceeds', needGb: need.gb, haveGb: compute.memory_gb, precision: need.precision, inferred: true };
  return { kind: 'none' };
}

export const demotes = (f: Fit) => f.kind === 'fails' || f.kind === 'exceeds';

export function fitText(f: Fit, compute: FitCompute): string {
  switch (f.kind) {
    case 'measured': {
      const r = f.run;
      const hz = r.inference_hz != null ? `${+r.inference_hz.toFixed(2)} Hz inference` : 'runs';
      return `${hz} on ${compute.name} (${r.runtime}, ${r.precision}, ${r.cameras} cam)`;
    }
    case 'fails': return `Measured ${f.run.outcome} on ${compute.name} (${f.run.runtime}, ${f.run.precision})`;
    case 'exceeds': return `Inferred: upstream states ≥${f.needGb} GB for inference${f.precision ? ` at ${f.precision}` : ''}; ${compute.name} has ${f.haveGb} GB${compute.unified ? ' shared' : ''}`;
    default: return `No measurement on ${compute.name} yet`;
  }
}

export const needOf = (p: { requirements?: { inference?: { vram_gb?: { min?: number }; precision?: string } } }): Need | undefined =>
  p.requirements?.inference?.vram_gb?.min != null ? { gb: p.requirements.inference.vram_gb.min, precision: p.requirements.inference.precision } : undefined;
