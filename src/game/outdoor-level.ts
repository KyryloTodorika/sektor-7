import { CELL, tileAt, world } from "./level";
import type { PickupDefinition } from "./level";
import { createNavigation } from "./navigation";
export const OUTDOOR_WIDTH = 39,
  OUTDOOR_DEPTH = 36;
export const outdoorGrid: boolean[][] = Array.from(
  { length: OUTDOOR_DEPTH },
  () => Array(OUTDOOR_WIDTH).fill(false)
);
const carve = (x1: number, z1: number, x2: number, z2: number) => {
  for (let z = z1; z <= z2; z++)
    for (let x = x1; x <= x2; x++) outdoorGrid[z][x] = true;
};
// A winding coastal route, with a square and a side street rather than one arena.
carve(3, 27, 11, 33); // evacuation staging area
carve(6, 18, 11, 29); // south boulevard
carve(5, 14, 21, 20); // palm square
carve(17, 6, 23, 17); // northern avenue
carve(21, 5, 35, 10); // seafront promenade
carve(30, 9, 35, 15); // safehouse forecourt
carve(11, 24, 20, 27); // optional supply alley
carve(17, 19, 20, 25); // connects back to the square
export const OUTDOOR_SPAWN = world(7, 31),
  OUTDOOR_EXIT = world(33, 15);
export const CARS = [
  { ...world(9, 28), yaw: 0.08, burning: true, color: "#7b453a" },
  { ...world(7, 23), yaw: -0.12, burning: false, color: "#587a78" },
  {
    ...world(14, 17),
    yaw: Math.PI / 2 + 0.15,
    burning: true,
    color: "#8f8158",
  },
  { ...world(20, 12), yaw: 0.2, burning: true, color: "#424c59" },
  { ...world(27, 8), yaw: Math.PI / 2 - 0.2, burning: false, color: "#7a7d68" },
  { ...world(32, 6), yaw: Math.PI / 2 + 0.1, burning: true, color: "#7c4236" },
];
export const PALMS = [
  [3, 28],
  [11, 31],
  [6, 27],
  [11, 23],
  [5, 15],
  [9, 15],
  [17, 19],
  [21, 17],
  [17, 9],
  [23, 12],
  [23, 6],
  [28, 5],
  [29, 10],
  [35, 8],
  [30, 14],
  [35, 13],
].map(([x, z]) => world(x, z));
export const BARRICADES = [
  [4, 30],
  [10, 30],
  [17, 15],
  [22, 6],
  [31, 12],
].map(([x, z]) => world(x, z));
export const LAMPS = [
  [5, 24],
  [12, 19],
  [22, 10],
  [30, 9],
].map(([x, z]) => world(x, z));
export const OUTDOOR_OBSTACLES = [
  ...CARS.map((p) => ({ ...p, radius: 2.25 })),
  ...PALMS.map((p) => ({ ...p, radius: 0.35 })),
  ...BARRICADES.map((p) => ({ ...p, radius: 1.05 })),
  ...LAMPS.map((p) => ({ ...p, radius: 0.18 })),
];
export const outdoorNavigation = createNavigation(
  outdoorGrid,
  OUTDOOR_OBSTACLES
);
export const OUTDOOR_ENEMIES = [
  [7, 26],
  [10, 22],
  [8, 19],
  [12, 16],
  [16, 18],
  [19, 16],
  [22, 14],
  [18, 11],
  [21, 9],
  [24, 7],
  [26, 6],
  [28, 9],
  [30, 7],
  [34, 9],
  [32, 11],
  [35, 14],
  [16, 25],
  [20, 23],
].map(([x, z]) => world(x, z));
export const OUTDOOR_PICKUPS: PickupDefinition[] = [
  { ...world(4, 31), kind: "ammo" },
  { ...world(10, 19), kind: "health" },
  { ...world(14, 25), kind: "ammo" },
  { ...world(22, 7), kind: "card" },
  { ...world(18, 8), kind: "ammo" },
  { ...world(31, 10), kind: "health" },
  { ...world(34, 12), kind: "ammo" },
];
export function outdoorLocation(p: { x: number; z: number }) {
  const { x, z } = tileAt(p);
  if (z >= 27) return "EVAKUIERUNGSZONE · SÜD";
  if (z >= 23 && x > 11) return "VERSORGUNGSGASSE";
  if (z >= 21) return "PALM BOULEVARD";
  if (z >= 14 && x < 22) return "PALMENPLATZ";
  if (x >= 30 && z >= 10) return "SAFEHOUSE · HOTEL MIRAMAR";
  if (z <= 10) return "KÜSTENPROMENADE";
  return "KONTROLLPUNKT NORD";
}
