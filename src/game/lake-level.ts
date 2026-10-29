import { CELL, tileAt, world } from "./level";
import type { PickupDefinition, Point } from "./level";
import { createNavigation } from "./navigation";
export const LAKE_WIDTH = 36,
  LAKE_DEPTH = 35,
  UPPER_FLOOR = 3.4;
export const lakeGrid: boolean[][] = Array.from({ length: LAKE_DEPTH }, () =>
  Array(LAKE_WIDTH).fill(false)
);
function rectangle(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  open = true
) {
  for (let z = z1; z <= z2; z++)
    for (let x = x1; x <= x2; x++) lakeGrid[z][x] = open;
}
rectangle(3, 3, 32, 24);
// The lakeside estate: central two-storey house, garage to the west, construction to the east.
rectangle(14, 12, 23, 22, false);
rectangle(15, 13, 22, 21);
rectangle(18, 12, 19, 12);
rectangle(14, 13, 14, 14);
rectangle(18, 22, 19, 22);
rectangle(19, 13, 19, 16, false);
rectangle(19, 18, 19, 21, false);
rectangle(6, 14, 10, 19, false);
rectangle(7, 15, 9, 18);
rectangle(7, 19, 9, 19);
rectangle(27, 15, 31, 20, false);
rectangle(28, 16, 30, 19);
rectangle(29, 15, 29, 15);
rectangle(27, 17, 27, 18);
// Timber pier and its T-shaped end, with water on both sides.
rectangle(18, 25, 19, 31);
rectangle(16, 30, 23, 31);
export const LAKE_SPAWN = world(18, 5),
  LAKE_EXIT = world(22, 31);
export const STAIR_BOTTOM = world(16, 14),
  STAIR_TOP = world(16, 21),
  STAIR_APPROACH = world(17, 13),
  STAIR_EXIT = world(18, 21);
export const LAKE_TREES = [
  [4, 5],
  [8, 4],
  [13, 4],
  [24, 4],
  [30, 5],
  [4, 11],
  [11, 10],
  [29, 11],
  [32, 13],
  [4, 21],
  [10, 23],
  [26, 23],
  [32, 23],
].map(([x, z]) => world(x, z));
export const LAKE_ROCKS = [
  [7, 9],
  [25, 8],
  [12, 21],
  [29, 24],
  [5, 23],
].map(([x, z], i) => ({ ...world(x, z), radius: 1.05 + (i % 2) * 0.25 }));
export const LAKE_CAR = world(8, 16);
export const LAKE_OBSTACLES = [
  ...LAKE_TREES.map((p) => ({ ...p, radius: 0.3 })),
  ...LAKE_ROCKS,
  { ...LAKE_CAR, radius: 1.85 },
];
export const lakeNavigation = createNavigation(lakeGrid, LAKE_OBSTACLES);
export const LAKE_RAILINGS = [
  { x: 56, z: 69.8, width: 16.6, depth: 0.12 },
  { x: 47.7, z: 65.6, width: 0.12, depth: 8.3 },
  { x: 64.25, z: 65.6, width: 0.12, depth: 8.3 },
  { x: 47.5, z: 48.5, width: 0.12, depth: 17 },
];
export const LAKE_ENEMIES = [
  { ...world(16, 10) },
  { ...world(24, 11) },
  { ...world(11, 17) },
  { ...world(8, 21) },
  { ...world(29, 18) },
  { ...world(25, 22) },
  { ...world(18, 18) },
  { ...world(21, 19) },
  { ...world(18, 16), elevation: UPPER_FLOOR },
  { ...world(21, 14), elevation: UPPER_FLOOR },
  { ...world(21, 20), elevation: UPPER_FLOOR },
  { ...world(18, 27) },
  { ...world(17, 30) },
  { ...world(23, 31) },
];
export const LAKE_PICKUPS: PickupDefinition[] = [
  { ...world(17, 6), kind: "ammo" },
  { ...world(7, 18), kind: "ammo" },
  { ...world(29, 17), kind: "health" },
  { ...world(18, 20), kind: "ammo" },
  { ...world(21, 15), kind: "card", elevation: UPPER_FLOOR },
  { ...world(18, 23), kind: "health" },
  { ...world(20, 30), kind: "ammo" },
];
export function onLakeStairs(p: Point) {
  return (
    p.x >= 15 * CELL && p.x < 17 * CELL && p.z >= 13 * CELL && p.z < 22 * CELL
  );
}
export function lakeGroundHeight(x: number, z: number, feet: number): number {
  if (onLakeStairs({ x, z }))
    return Math.max(0, Math.min(1, (z - 14 * CELL) / (7 * CELL))) * UPPER_FLOOR;
  const loft =
    x >= 17 * CELL && x < 23 * CELL && z >= 13 * CELL && z < 25 * CELL;
  return loft && feet >= UPPER_FLOOR - 0.42 ? UPPER_FLOOR : 0;
}
/** Height-aware constraints apply only to Lakehouse; earlier levels stay on their original grid. */
export function lakeCanStand(
  x: number,
  z: number,
  feet: number,
  radius: number
): boolean {
  if (lakeGroundHeight(x, z, feet) > feet + 0.38) return false;
  if (feet + 1.8 > UPPER_FLOOR && feet < UPPER_FLOOR + 1.15) {
    if (
      LAKE_RAILINGS.some(
        (rail) =>
          Math.abs(x - rail.x) < rail.width / 2 + radius &&
          Math.abs(z - rail.z) < rail.depth / 2 + radius
      )
    )
      return false;
  }
  return true;
}
export function lakeEnemyTarget(
  enemy: { x: number; y: number; z: number },
  player: { x: number; y: number; z: number }
): Point {
  const playerFeet = player.y - 1.65;
  if (playerFeet > 2.7 && onLakeStairs(enemy))
    return enemy.y < UPPER_FLOOR - 0.12 ? STAIR_TOP : STAIR_EXIT;
  if (playerFeet < 0.5 && onLakeStairs(enemy))
    return enemy.y > 0.25 ? STAIR_BOTTOM : STAIR_APPROACH;
  if (playerFeet > enemy.y + 0.5 && playerFeet > 0.5)
    return onLakeStairs(enemy)
      ? STAIR_TOP
      : enemy.z < 14 * CELL + 0.4
      ? STAIR_BOTTOM
      : STAIR_APPROACH;
  if (enemy.y > playerFeet + 0.5 && enemy.y > 0.5)
    return onLakeStairs(enemy) ? STAIR_BOTTOM : STAIR_TOP;
  return player;
}
export function lakeLocation(p: Point, feet = 0): string {
  const { x, z } = tileAt(p);
  if (z >= 25) return "BOOTSTEG · LAKEHOUSE";
  if (x >= 14 && x <= 23 && z >= 12 && z <= 24)
    return feet > 2.5
      ? "SEEHAUS · OBERGESCHOSS & BALKON"
      : "SEEHAUS · ERDGESCHOSS";
  if (x <= 11 && z >= 13) return "GARAGE & SEITENHOF";
  if (x >= 26 && z >= 14) return "BAUSTELLE";
  return "SEEGRUNDSTÜCK · ZUFAHRT";
}
