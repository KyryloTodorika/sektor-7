/** The same grid drives geometry, collision and enemy navigation. Coordinates are in metres. */
export const CELL = 2.8;
export const HEIGHT = 3.8;
export const WIDTH = 31;
export const DEPTH = 25;
export interface Point {
  x: number;
  z: number;
}
export interface DoorDefinition {
  id: string;
  x: number;
  z: number;
  width: number;
  axis: "x" | "z";
  label: string;
}
export interface PickupDefinition extends Point {
  elevation?: number;
  kind: "health" | "ammo" | "card";
}
export const grid: boolean[][] = Array.from({ length: DEPTH }, () =>
  Array(WIDTH).fill(false)
);
function room(x1: number, z1: number, x2: number, z2: number) {
  for (let z = z1; z <= z2; z++)
    for (let x = x1; x <= x2; x++) grid[z][x] = true;
}
room(2, 18, 9, 22); // arrival
room(5, 11, 6, 18); // service corridor
room(2, 5, 12, 12); // reactor hall
room(12, 9, 19, 10); // transfer corridor
room(19, 3, 28, 12); // security laboratory
room(24, 12, 25, 18); // east corridor
room(18, 18, 28, 22); // extraction hall
room(10, 19, 18, 20); // returning shortcut
export function world(x: number, z: number): Point {
  return { x: (x + 0.5) * CELL, z: (z + 0.5) * CELL };
}
export const SPAWN = world(5, 20);
export const EXIT = world(27, 20);
export const DOORS: DoorDefinition[] = [
  {
    id: "maintenance",
    x: 6 * CELL,
    z: 15.5 * CELL,
    width: 2 * CELL,
    axis: "x",
    label: "WARTUNG",
  },
  {
    id: "lab",
    x: 16.5 * CELL,
    z: 10 * CELL,
    width: 2 * CELL,
    axis: "z",
    label: "SICHERHEIT",
  },
  {
    id: "east",
    x: 25 * CELL,
    z: 15.5 * CELL,
    width: 2 * CELL,
    axis: "x",
    label: "LAGER",
  },
  {
    id: "shortcut",
    x: 14.5 * CELL,
    z: 20 * CELL,
    width: 2 * CELL,
    axis: "z",
    label: "TRANSIT",
  },
];
export const CRATE_TILES = [
  [8, 21],
  [2, 21],
  [2, 5],
  [11, 5],
  [20, 3],
  [28, 11],
  [18, 21],
  [28, 18],
  [28, 21],
];
export const OBSTACLES = [
  { ...world(7, 8), radius: 1.3 },
  { ...world(26, 3), radius: 1.85 },
  ...CRATE_TILES.map(([x, z]) => ({ ...world(x, z), radius: 0.86 })),
];
export const ENEMY_SPAWNS = [
  [5, 10],
  [10, 6],
  [20, 10],
  [26, 7],
  [23, 4],
  [23, 20],
  [19, 21],
].map(([x, z]) => world(x, z));
export const PICKUPS: PickupDefinition[] = [
  { ...world(3, 19), kind: "ammo" },
  { ...world(3, 7), kind: "health" },
  { ...world(11, 11), kind: "ammo" },
  { ...world(27, 4), kind: "card" },
  { ...world(27, 10), kind: "health" },
  { ...world(20, 19), kind: "ammo" },
];
export function tileAt(p: Point): Point {
  return { x: Math.floor(p.x / CELL), z: Math.floor(p.z / CELL) };
}
export function floorAt(x: number, z: number): boolean {
  return grid[z]?.[x] === true;
}
export function doorBlocks(
  x: number,
  z: number,
  door: DoorDefinition,
  radius = 0.0
): boolean {
  return door.axis === "x"
    ? Math.abs(x - door.x) < door.width / 2 + radius &&
        Math.abs(z - door.z) < 0.18 + radius
    : Math.abs(z - door.z) < door.width / 2 + radius &&
        Math.abs(x - door.x) < 0.18 + radius;
}
export function canOccupy(
  x: number,
  z: number,
  radius: number,
  closedDoors: DoorDefinition[] = []
): boolean {
  const minX = Math.floor((x - radius) / CELL),
    maxX = Math.floor((x + radius) / CELL);
  const minZ = Math.floor((z - radius) / CELL),
    maxZ = Math.floor((z + radius) / CELL);
  for (let tz = minZ; tz <= maxZ; tz++)
    for (let tx = minX; tx <= maxX; tx++) {
      if (floorAt(tx, tz)) continue;
      const closestX = Math.max(tx * CELL, Math.min(x, (tx + 1) * CELL));
      const closestZ = Math.max(tz * CELL, Math.min(z, (tz + 1) * CELL));
      if ((x - closestX) ** 2 + (z - closestZ) ** 2 < radius ** 2 + 0.00001)
        return false;
    }
  return (
    !closedDoors.some((door) => doorBlocks(x, z, door, radius)) &&
    !OBSTACLES.some(
      (obstacle) =>
        Math.hypot(x - obstacle.x, z - obstacle.z) < radius + obstacle.radius
    )
  );
}
export function lineClear(
  a: Point,
  b: Point,
  closedDoors: DoorDefinition[] = []
): boolean {
  const length = Math.hypot(b.x - a.x, b.z - a.z),
    steps = Math.max(1, Math.ceil(length / 0.18));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps,
      x = a.x + (b.x - a.x) * t,
      z = a.z + (b.z - a.z) * t;
    if (
      !floorAt(Math.floor(x / CELL), Math.floor(z / CELL)) ||
      closedDoors.some((door) => doorBlocks(x, z, door)) ||
      OBSTACLES.some(
        (obstacle) =>
          Math.hypot(x - obstacle.x, z - obstacle.z) < obstacle.radius
      )
    )
      return false;
  }
  return true;
}
export function findPath(
  from: Point,
  to: Point,
  closedDoors: DoorDefinition[] = []
): Point[] {
  const start = tileAt(from),
    target = tileAt(to),
    key = (p: Point) => p.z * WIDTH + p.x;
  const queue = [start],
    previous = new Map<number, Point | null>([[key(start), null]]);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    if (p.x === target.x && p.z === target.z) {
      const path: Point[] = [];
      let current: Point | null = p;
      while (current) {
        path.unshift(world(current.x, current.z));
        current = previous.get(key(current)) ?? null;
      }
      return path.slice(1);
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const next = { x: p.x + dx, z: p.z + dz };
      if (previous.has(key(next)) || !floorAt(next.x, next.z)) continue;
      const a = world(p.x, p.z),
        b = world(next.x, next.z);
      if (
        !canOccupy(b.x, b.z, 0.35, closedDoors) ||
        !lineClear(a, b, closedDoors)
      )
        continue;
      previous.set(key(next), p);
      queue.push(next);
    }
  }
  return [];
}
export function locationName(p: Point): string {
  const { x, z } = tileAt(p);
  if (z >= 18 && x < 11) return "WARTUNGSTRAKT B–07";
  if (x >= 18 && z < 13) return "SICHERHEITSLABOR C–02";
  if (z >= 18 && x >= 18) return "FRACHTSCHLEUSE D–04";
  if (x <= 12 && z <= 12) return "REAKTORHALLE A–01";
  return "VERSORGUNGSGANG";
}
