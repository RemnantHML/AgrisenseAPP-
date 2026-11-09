// Rule-based evaluation for SOIL TEMPERATURE (°C).
// Follows the paper: Sections 3.3.3.4 (Rules 1-3) and 3.3.3.5 (amendment rules).
// Pure if/else logic: no ML, no scoring, no ranking. Works fully offline.

export const TEMP_STATUS = { WITHIN: 'WITHIN', BELOW: 'BELOW', ABOVE: 'ABOVE' };

import { TH } from '../data';

// Ranges are NOT duplicated here. They come from the threshold table (TH in data.js),
// or from a thresholds object fetched from Firebase and passed in as `thresholds`.
const rangeOf = (thresholds, crop) => thresholds?.[crop]?.T;

// Rules 1-3: classify the AVERAGED temperature against the crop's range.
// Boundaries are inclusive (>= min and <= max counts as Within Threshold).
export function classifyTemperature(avgTemp, crop, thresholds = TH) {
  const range = rangeOf(thresholds, crop);
  if (!range || typeof avgTemp !== 'number' || isNaN(avgTemp)) return null;
  const [min, max] = range;

  if (avgTemp < min) {
    return TEMP_STATUS.BELOW;   // Rule 2
  } else if (avgTemp > max) {
    return TEMP_STATUS.ABOVE;   // Rule 3
  } else {
    return TEMP_STATUS.WITHIN;  // Rule 1
  }
}

// Section 3.3.3.5: builds the 8 fields the paper lists for each amendment
// (crop, parameter, value, range, direction, why, action, expected improvement).
// Returns null when temperature is Within Threshold (no suggestion is generated).
export function temperatureAmendment(avgTemp, crop, thresholds = TH) {
  const status = classifyTemperature(avgTemp, crop, thresholds);
  if (status === null || status === TEMP_STATUS.WITHIN) return null;
  const [min, max] = rangeOf(thresholds, crop);

  const base = { crop, k: 'T', parameter: 'Soil temperature', value: avgTemp, range: [min, max], status };

  if (status === TEMP_STATUS.BELOW) {
    return {
      ...base,
      low: true,
      why: `The averaged soil temperature (${avgTemp} °C) is below the ${min} °C minimum for ${crop}. ` +
           'Low soil temperature can slow seed germination and nutrient mineralization.',
      tip: 'Repeat the soil-temperature measurement at a consistent time and soil depth. ' +
           'Consider seasonal and weather conditions, crop-growth stage, irrigation, suitable mulching, ' +
           'or other crop-specific management practices.',
      improvement: `A more reliable assessment of soil temperature and, when an appropriate management action is applied, movement toward the ${min} °C minimum for ${crop}.`,
    };
  } else {
    return {
      ...base,
      low: false,
      why: `The averaged soil temperature (${avgTemp} °C) is above the ${max} °C maximum for ${crop}. ` +
           'High soil temperature can increase soil moisture loss, damage root tissues, and reduce microbial efficiency.',
      tip: 'Repeat the soil-temperature measurement at a consistent time and soil depth. ' +
           'Consider suitable mulching, irrigation, shading, or other crop-specific temperature-management practices.',
      improvement: `A more reliable assessment of soil temperature and, when an appropriate management action is applied, movement toward the ${max} °C maximum for ${crop}.`,
    };
  }
}