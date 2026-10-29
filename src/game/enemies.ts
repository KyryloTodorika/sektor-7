import { Mesh, MeshBuilder, Scene, TransformNode, Vector3 } from "./babylon";
import type { StandardMaterial } from "./babylon";
import { ENEMY_SPAWNS, canOccupy, findPath, lineClear } from "./level";
import type { DoorDefinition, Point } from "./level";
export interface Enemy {
  root: TransformNode;
  health: number;
  active: boolean;
  cooldown: number;
  path: Point[];
  pathTimer: number;
  legs: TransformNode[];
  walk: number;
  flash: number;
  visor: Mesh;
  dying: number;
}
export function createEnemies(
  scene: Scene,
  materials: Record<string, StandardMaterial>
): Enemy[] {
  return ENEMY_SPAWNS.map((spawn, index) => {
    const root = new TransformNode(`sentry-${index}`, scene);
    root.position.set(spawn.x, 0, spawn.z);
    const part = (
      name: string,
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      material: StandardMaterial,
      parent: TransformNode = root
    ) => {
      const m = MeshBuilder.CreateBox(
        name,
        { width: w, height: h, depth: d },
        scene
      );
      m.parent = parent;
      m.position.set(x, y, z);
      m.material = material;
      m.metadata = { enemy: index };
      return m;
    };
    part("torso", 0.7, 0.65, 0.45, 0, 1.13, 0, materials.enemy);
    part("chest", 0.5, 0.32, 0.08, 0, 1.17, 0.26, materials.enemyDark);
    part("battery", 0.12, 0.17, 0.03, 0, 1.17, 0.31, materials.amber);
    part("helmet", 0.54, 0.43, 0.48, 0, 1.69, 0, materials.enemyDark);
    const visor = part(
      "visor",
      0.46,
      0.11,
      0.035,
      0,
      1.72,
      0.25,
      materials.red
    );
    part("helmet-top", 0.58, 0.08, 0.53, 0, 1.94, 0, materials.enemy);
    part("neck", 0.2, 0.13, 0.2, 0, 1.44, 0, materials.metal);
    part("hip", 0.47, 0.24, 0.35, 0, 0.69, 0, materials.enemyDark);
    const legs: TransformNode[] = [];
    for (const side of [-1, 1]) {
      part("shoulder", 0.27, 0.24, 0.36, side * 0.47, 1.38, 0, materials.enemy);
      part(
        "arm",
        0.19,
        0.5,
        0.23,
        side * 0.47,
        1.05,
        0.07,
        materials.enemyDark
      );
      part(
        "gauntlet",
        0.23,
        0.24,
        0.28,
        side * 0.47,
        0.87,
        0.14,
        materials.enemy
      );
      const leg = new TransformNode("leg-pivot", scene);
      leg.parent = root;
      leg.position.set(side * 0.2, 0.64, 0);
      legs.push(leg);
      part("leg", 0.23, 0.48, 0.27, 0, -0.22, 0, materials.enemy, leg);
      part("boot", 0.27, 0.18, 0.44, 0, -0.52, 0.07, materials.enemyDark, leg);
    }
    part("sentry-weapon", 0.17, 0.17, 0.65, 0.46, 0.96, 0.45, materials.metal);
    part(
      "sentry-barrel",
      0.11,
      0.1,
      0.2,
      0.46,
      0.96,
      0.84,
      materials.enemyDark
    );
    return {
      root,
      health: 90,
      active: false,
      cooldown: 1.2 + index * 0.2,
      path: [],
      pathTimer: 0,
      legs,
      walk: index,
      flash: 0,
      visor,
      dying: 0,
    };
  });
}
export function updateEnemy(
  enemy: Enemy,
  player: Vector3,
  doors: DoorDefinition[],
  dt: number,
  shoot: (origin: Vector3, direction: Vector3) => void
) {
  if (enemy.health <= 0) {
    if (enemy.dying < 1) {
      enemy.dying = Math.min(1, enemy.dying + dt * 2.5);
      enemy.root.rotation.x = (enemy.dying * Math.PI) / 2;
      enemy.root.position.y = -enemy.dying * 0.17;
    }
    return;
  }
  const p = enemy.root.position,
    distance = Math.hypot(player.x - p.x, player.z - p.z);
  const sees = distance < 23 && lineClear(p, player, doors);
  if (sees) enemy.active = true;
  if (!enemy.active) return;
  enemy.root.rotation.y = Math.atan2(player.x - p.x, player.z - p.z);
  enemy.cooldown -= dt;
  enemy.pathTimer -= dt;
  if (sees && distance < 17) {
    if (enemy.cooldown <= 0) {
      const origin = p.add(
        new Vector3(
          Math.cos(enemy.root.rotation.y) * 0.4,
          1.02,
          -Math.sin(enemy.root.rotation.y) * 0.4
        )
      );
      const target = player.add(
        new Vector3(
          (Math.random() - 0.5) * 0.7,
          -0.45,
          (Math.random() - 0.5) * 0.7
        )
      );
      shoot(origin, target.subtract(origin).normalize());
      enemy.cooldown = 1.35 + Math.random() * 0.6;
      enemy.flash = 0.12;
    }
  }
  let destination: Point | undefined;
  if (sees && distance > 7) destination = player;
  else if (!sees) {
    if (enemy.pathTimer <= 0) {
      enemy.path = findPath(p, player, doors);
      enemy.pathTimer = 0.8 + Math.random() * 0.3;
    }
    destination = enemy.path[0];
    if (
      destination &&
      Math.hypot(destination.x - p.x, destination.z - p.z) < 0.3
    ) {
      enemy.path.shift();
      destination = enemy.path[0];
    }
  }
  if (destination) {
    const length = Math.hypot(destination.x - p.x, destination.z - p.z);
    if (length > 0.05) {
      const speed = 1.65 * dt,
        dx = ((destination.x - p.x) / length) * speed,
        dz = ((destination.z - p.z) / length) * speed;
      if (canOccupy(p.x + dx, p.z, 0.35, doors)) p.x += dx;
      if (canOccupy(p.x, p.z + dz, 0.35, doors)) p.z += dz;
      enemy.walk += dt * 9;
      enemy.legs.forEach(
        (leg, i) => (leg.rotation.x = Math.sin(enemy.walk + i * Math.PI) * 0.5)
      );
    }
  } else
    enemy.legs.forEach((leg) => (leg.rotation.x *= Math.max(0, 1 - dt * 10)));
  enemy.flash = Math.max(0, enemy.flash - dt);
  enemy.visor.scaling.y = enemy.flash > 0 ? 2 : 1;
}
