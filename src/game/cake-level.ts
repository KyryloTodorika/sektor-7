import { world, tileAt } from "./level";
import type { PickupDefinition } from "./level";
import { createNavigation } from "./navigation";
export const cakeGrid = Array.from({ length: 19 }, (_, z) =>
  Array.from({ length: 17 }, (_, x) => x > 0 && x < 16 && z > 0 && z < 18)
);
export const CAKE_COUNTERS = [[5, 6], [11, 6], [5, 11], [11, 11]].map(([x, z]) => world(x, z));
export const cakeNavigation = createNavigation(cakeGrid, CAKE_COUNTERS.map(p => ({ ...p, radius: 1.65 })));
export const CAKE_SPAWN = world(8, 16);
export const CAKE_EXIT = world(14, 16);
export const CAKE_ENEMIES = [[8, 12], [3, 13], [13, 13], [8, 9], [3, 8], [13, 8], [8, 5], [3, 3], [6, 3], [10, 3], [13, 3], [14, 10]].map(([x, z]) => world(x, z));
export const CAKE_PICKUPS: PickupDefinition[] = [
  { ...world(8, 2), kind: "card" },
  ...[[7, 15], [2, 10], [14, 5], [8, 7]].map(([x, z]) => ({ ...world(x, z), kind: "ammo" as const })),
  ...[[2, 5], [14, 14]].map(([x, z]) => ({ ...world(x, z), kind: "health" as const })),
];
export function cakeLocation(p: { x: number; z: number }) {
  const { z } = tileAt(p);
  return z < 5 ? "REZEPTARCHIV" : z < 12 ? "ZUCKERSCHOCK · BACKSTUBE" : "KONDITOREI · LIEFERAUSGANG";
}
