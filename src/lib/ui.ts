// Presentation vocabulary. No node imports — shipped to the browser with the matrix island.
export const STATE_META: Record<string, { label: string; glyph: string; desc: string }> = {
  works: { label: 'works', glyph: '✓', desc: 'Verified running, as documented' },
  'works-with-caveats': { label: 'works with caveats', glyph: '✓', desc: 'Runs, with a named limitation' },
  partial: { label: 'partial', glyph: '◐', desc: 'Some capability only' },
  'not-supported': { label: 'not supported', glyph: '✕', desc: 'Known incompatible, with a stated reason' },
  planned: { label: 'planned', glyph: '→', desc: 'Upstream has publicly committed' },
  untested: { label: 'untested', glyph: '○', desc: 'No evidence, but both sides are integrated in LeRobot (inferred, T4). Display-only' },
  unknown: { label: 'not yet verified', glyph: '·', desc: 'No evidence found yet; no claim either way' },
};
export const TIER_META: Record<string, { short: string; label: string; desc: string }> = {
  'upstream-documented': { short: 'T1', label: 'upstream documented', desc: 'Official docs, model card or release notes state it' },
  'maintainer-tested': { short: 'T2', label: 'maintainer tested', desc: 'A maintainer ran it and recorded config + result' },
  'community-reported': { short: 'T3', label: 'community reported', desc: 'Public, reproducible third-party report' },
  inferred: { short: 'T4', label: 'inferred', desc: 'Derived from specifications, not observed' },
};
export const FAMILY_LABEL: Record<string, string> = {
  bc: 'Imitation', diffusion: 'Imitation', flow: 'Imitation', vla: 'VLA', 'world-model': 'World model', rl: 'RL', 'reward-model': 'Reward model',
};
export const FAMILY_ORDER = ['Imitation', 'RL', 'VLA', 'World model', 'Reward model'];
export const CLASS_LABEL: Record<string, string> = {
  arm: 'Arms', bimanual: 'Bimanual', 'mobile-manipulator': 'Mobile manipulators', 'mobile-base': 'Mobile bases',
  humanoid: 'Humanoids', 'desktop-social': 'Desktop / social',
};
export const CLASS_ORDER = ['arm', 'bimanual', 'mobile-manipulator', 'mobile-base', 'humanoid', 'desktop-social'];
export const COMPUTE_CLASS_LABEL: Record<string, string> = {
  edge: 'Edge', 'apple-silicon': 'Apple Silicon', 'consumer-gpu': 'Consumer GPU', workstation: 'Workstation',
  datacenter: 'Datacenter', cloud: 'Cloud', 'cpu-only': 'CPU only',
};
export const COMPUTE_CLASS_ORDER = ['edge', 'apple-silicon', 'consumer-gpu', 'workstation', 'datacenter', 'cloud', 'cpu-only'];
export const CAP_LABEL: Record<string, string> = {
  train: 'Train / fine-tune', inference_real: 'Real-robot inference', inference_sim: 'Simulation inference', teleop_record: 'Teleop + record',
};
export const RUNTIME_LABEL: Record<string, string> = {
  'pytorch-eager': 'PyTorch eager', 'torch-compile': 'torch.compile', onnx: 'ONNX', 'onnx-split': 'ONNX (split)',
  tensorrt: 'TensorRT', 'vla-cpp': 'vla.cpp', 'llama-cpp': 'llama.cpp', mlx: 'MLX', other: 'other',
};

export function fmtParams(n?: number) {
  if (!n) return '—';
  return n >= 1e9 ? `${+(n / 1e9).toFixed(2)}B` : `${Math.round(n / 1e6)}M`;
}
export const fmtHz = (hz?: number) => (hz == null ? '—' : `${hz >= 10 ? Math.round(hz) : +hz.toFixed(2)} Hz`);
export function fmtAge(days: number | null) {
  if (days == null) return '';
  if (days < 1) return 'today';
  if (days < 45) return `${days}d ago`;
  if (days < 540) return `${Math.round(days / 30)}mo ago`;
  return `${+(days / 365).toFixed(1)}y ago`;
}
export const cellLabel = (policy: string, robot: string, state: string, tier?: string | null) =>
  `${policy} on ${robot}: ${STATE_META[state].label}${tier ? `, ${TIER_META[tier].label}` : ''}`;
export const shortCompute = (name: string) => name.replace(/^NVIDIA (GeForce )?/, '');
export const fmtGB = (gb?: number) => (gb == null ? '—' : gb < 1 ? `${Math.round(gb * 1000)} MB` : `${+gb.toFixed(2)} GB`);
/** Platform keys worth showing inline; the rest go behind "conditions". */
export const PLATFORM_KEYS = ['chip', 'jetpack', 'power_mode', 'cuda', 'torch', 'lerobot', 'tensorrt'];
