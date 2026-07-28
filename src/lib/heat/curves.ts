/**
 * Archetype curves. Each archetype has one 24-hour base shape (its weekend
 * shape, 0-100), scaled by a day-shape factor. Storing one shape plus four
 * factors rather than nine shapes x four days keeps the data hand-editable.
 */
import { Archetype, DayShape } from "@/lib/heat/types";

/** Hours before this belong to the previous night. */
const NIGHT_ROLLOVER_HOUR = 5;

/** The day whose *night* we are in: 1 AM Sunday is still Saturday night. */
export function nightlifeDay(now: Date): number {
  const d = now.getDay();
  return now.getHours() < NIGHT_ROLLOVER_HOUR ? (d + 6) % 7 : d;
}

export function dayShape(day: number): DayShape {
  if (day === 5 || day === 6) return "weekend";
  if (day === 4) return "thu";
  if (day === 0) return "sun";
  return "midweek";
}

export const DAY_SHAPE_FACTOR: Record<DayShape, number> = {
  weekend: 1.0,
  thu: 0.8,
  sun: 0.6,
  midweek: 0.5,
};

/**
 * Base curves, indexed by hour 0-23. Index 0-4 are the small hours of that
 * same night, so a dance club is still high at index 1 (1 AM).
 */
const CURVES: Record<Archetype, number[]> = {
  //              0   1   2   3  4  5-11 (all zero)     12 13 14 15 16 17 18 19 20 21 22 23
  dive:          [58, 45, 22, 5, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 8, 10, 15, 25, 32, 42, 52, 64, 74, 80],
  party_bar:     [62, 42, 18, 4, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 6, 10, 18, 30, 42, 55, 68, 80, 88, 84],
  dance_club:    [88, 92, 70, 30, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 8, 14, 22, 34, 52, 72, 84],
  cocktail_room: [74, 52, 26, 8, 0, 0, 0, 0, 0, 0, 0, 0, 5, 7, 9, 13, 20, 32, 46, 60, 72, 80, 86, 88],
  rooftop:       [10, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 14, 20, 28, 38, 52, 68, 82, 88, 80, 64, 40, 22],
  pub:           [64, 38, 14, 3, 0, 0, 0, 0, 0, 0, 0, 0, 12, 14, 18, 24, 32, 42, 54, 64, 74, 80, 86, 88],
  music_venue:   [48, 30, 12, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 8, 14, 26, 44, 64, 80, 84, 70],
  karaoke:       [66, 50, 26, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 6, 10, 18, 30, 44, 60, 76, 86, 80],
  activity_bar:  [56, 30, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 10, 14, 20, 28, 40, 54, 66, 76, 82, 84, 78],
};

export function curveValue(archetype: Archetype, hour: number): number {
  const curve = CURVES[archetype];
  return curve[((hour % 24) + 24) % 24];
}
