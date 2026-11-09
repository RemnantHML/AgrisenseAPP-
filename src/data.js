export const N_AREAS = 5; // 5 sampling points per hectare (zigzag/W pattern)

export const PARAMS = [
  { k: 'N', label: 'Nitrogen (N)', unit: 'mg/kg', max: 1999 },
  { k: 'P', label: 'Phosphorus (P)', unit: 'mg/kg', max: 1999 },
  { k: 'K', label: 'Potassium (K)', unit: 'mg/kg', max: 1999 },
  { k: 'pH', label: 'pH level', unit: '', max: 14 },
  { k: 'M', label: 'Moisture', unit: '%', max: 100 },
  { k: 'T', label: 'Temperature', unit: '°C', max: 50 },
];

// Preliminary thresholds (Section 3.3.3.2) -> [min, max]
export const TH = {
  Rice:      { N: [150, 250], P: [30, 60], K: [82, 246],  pH: [5.5, 7.0], M: [60, 80], T: [21, 35] },
  Corn:      { N: [150, 250], P: [20, 50], K: [100, 180], pH: [5.5, 7.0], M: [50, 70], T: [18, 32] },
  Banana:    { N: [180, 280], P: [20, 40], K: [200, 300], pH: [5.5, 6.5], M: [60, 75], T: [25, 35] },
  Mango:     { N: [100, 200], P: [20, 45], K: [120, 200], pH: [5.5, 7.5], M: [40, 60], T: [24, 35] },
  Pineapple: { N: [100, 200], P: [15, 35], K: [180, 280], pH: [4.5, 6.5], M: [45, 65], T: [20, 30] },
};
export const ICON = { Rice: '🌾', Corn: '🌽', Banana: '🍌', Mango: '🥭', Pineapple: '🍍' };

// [if below min, if above max] (Section 3.3.3.5)
export const SUG = {
  N: ['Apply nitrogen fertilizer (e.g., Urea)', 'Reduce nitrogen inputs; avoid over-fertilization'],
  P: ['Apply phosphorus fertilizer (e.g., Superphosphate)', 'Reduce phosphorus application'],
  K: ['Apply potassium fertilizer (e.g., Muriate of Potash)', 'Reduce potassium inputs'],
  pH: ['Apply agricultural lime to raise soil pH', 'Apply elemental sulfur to lower soil pH'],
  M: ['Improve irrigation or water retention', 'Improve field drainage'],
  T: ['Consider mulching to retain soil warmth', 'Apply mulching or shade practices to reduce soil temperature'],
};
