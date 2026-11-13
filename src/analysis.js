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

// Status labels from SystemRules.docx (Rules 1-3). Exported so later code can
// compare against these constants instead of retyping the text.
export const THRESHOLD_STATUS = {
  WITHIN: 'Within Threshold',
  BELOW: 'Below Threshold',
  ABOVE: 'Above Threshold',
};

// Evaluates EVERY crop in TH against the supplied averages, one parameter at a
// time, and keeps the full details. Pure: reads its input, changes nothing, has
// no side effects. Does not round: it compares exactly the numbers it receives.
// Returns null when the averages are missing or invalid (same convention as
// average(), which returns null until all sampling areas are collected).
export function evaluateCrops(avg) {
  if (!avg) return null;
  const hasAllValues = PARAMS.every(({ k }) => typeof avg[k] === 'number' && Number.isFinite(avg[k]));
  if (!hasAllValues) return null;

  return Object.keys(TH).map(crop => {
    const parameters = PARAMS.map(({ k, label, unit }) => {
      const [minimum, maximum] = TH[crop][k];
      const measuredValue = avg[k];

      let status = THRESHOLD_STATUS.WITHIN; // minimum <= value <= maximum
      if (measuredValue < minimum) {
        status = THRESHOLD_STATUS.BELOW;
      } else if (measuredValue > maximum) {
        status = THRESHOLD_STATUS.ABOVE;
      }

      return { key: k, label, unit, measuredValue, minimum, maximum, status };
    });

    const failedParameters = parameters.filter(p => p.status !== THRESHOLD_STATUS.WITHIN);

    return { crop, compatible: failedParameters.length === 0, parameters, failedParameters };
  });
}