import { PARAMS, TH, SUG, N_AREAS } from './data';

// Process 2.0: reject null / non-numeric / out-of-range readings
export function validate(r) {
  if (!r) return false;
  return PARAMS.every(({ k, max }) => typeof r[k] === 'number' && !isNaN(r[k]) && r[k] >= 0 && r[k] <= max);
}

// Arithmetic mean per parameter across all sampling points
export function average(areas) {
  const valid = areas.filter(Boolean);
  if (valid.length < N_AREAS) return null;
  const avg = {};
  PARAMS.forEach(({ k }) => {
    const m = valid.reduce((s, a) => s + a[k], 0) / valid.length;
    avg[k] = k === 'pH' || k === 'T' ? +m.toFixed(1) : Math.round(m);
  });
  return avg;
}

// Deterministic rule matching: all six must be within range
export const failed = (avg, crop) =>
  PARAMS.map(p => p.k).filter(k => avg[k] < TH[crop][k][0] || avg[k] > TH[crop][k][1]);

export const compatibleCrops = avg => Object.keys(TH).filter(c => failed(avg, c).length === 0);

export const amendments = (avg, crop) =>
  failed(avg, crop).map(k => {
    const low = avg[k] < TH[crop][k][0];
    return { k, low, value: avg[k], range: TH[crop][k], tip: SUG[k][low ? 0 : 1] };
  });
