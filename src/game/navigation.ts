import { CELL, doorBlocks, tileAt, world } from "./level";
import type { DoorDefinition, Point } from "./level";
export interface Obstacle extends Point {
  radius: number;
}
export interface Navigation {
  canOccupy: (
    x: number,
    z: number,
    radius: number,
    doors?: DoorDefinition[]
  ) => boolean;
  lineClear: (a: Point, b: Point, doors?: DoorDefinition[]) => boolean;
  findPath: (from: Point, to: Point, doors?: DoorDefinition[]) => Point[];
}
/** A separate navigation instance keeps each level's geometry isolated. */
export function createNavigation(
  grid: boolean[][],
  obstacles: Obstacle[]
): Navigation {
  const width = grid[0].length;
  const floorAt = (x: number, z: number) => grid[z]?.[x] === true;
  const canOccupy: Navigation["canOccupy"] = (x, z, radius, doors = []) => {
    for (
      let tz = Math.floor((z - radius) / CELL);
      tz <= Math.floor((z + radius) / CELL);
      tz++
    )
      for (
        let tx = Math.floor((x - radius) / CELL);
        tx <= Math.floor((x + radius) / CELL);
        tx++
      ) {
        if (floorAt(tx, tz)) continue;
        const cx = Math.max(tx * CELL, Math.min(x, (tx + 1) * CELL)),
          cz = Math.max(tz * CELL, Math.min(z, (tz + 1) * CELL));
        if ((x - cx) ** 2 + (z - cz) ** 2 < radius ** 2 + 0.00001) return false;
      }
    return (
      !doors.some((d) => doorBlocks(x, z, d, radius)) &&
      !obstacles.some((o) => Math.hypot(x - o.x, z - o.z) < radius + o.radius)
    );
  };
  const lineClear: Navigation["lineClear"] = (a, b, doors = []) => {
    const steps = Math.max(
      1,
      Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.18)
    );
    for (let i = 0; i <= steps; i++) {
      const t = i / steps,
        x = a.x + (b.x - a.x) * t,
        z = a.z + (b.z - a.z) * t;
      if (
        !floorAt(Math.floor(x / CELL), Math.floor(z / CELL)) ||
        doors.some((d) => doorBlocks(x, z, d)) ||
        obstacles.some((o) => Math.hypot(x - o.x, z - o.z) < o.radius)
      )
        return false;
    }
    return true;
  };
  const findPath: Navigation["findPath"] = (from, to, doors = []) => {
    const start = tileAt(from),
      target = tileAt(to),
      key = (p: Point) => p.z * width + p.x;
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
        if (!floorAt(next.x, next.z) || previous.has(key(next))) continue;
        const a = world(p.x, p.z),
          b = world(next.x, next.z);
        if (!canOccupy(b.x, b.z, 0.35, doors) || !lineClear(a, b, doors))
          continue;
        previous.set(key(next), p);
        queue.push(next);
      }
    }
    return [];
  };
  return { canOccupy, lineClear, findPath };
}
