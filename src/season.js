// Advisory only. The season is worked out from the phone's current date and is
// never saved, never used in threshold comparisons, and never sent to Firebase.
// Wet Season = May to October, Dry Season = November to April.
export const WET_SEASON = 'Wet Season';
export const DRY_SEASON = 'Dry Season';

export function currentSeason(date = new Date()) {
  const month = date.getMonth(); // 0 = January ... 11 = December
  return month >= 4 && month <= 9 ? WET_SEASON : DRY_SEASON; // 4 = May ... 9 = October
}