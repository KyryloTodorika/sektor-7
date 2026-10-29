import { MeshBuilder, TransformNode } from "./babylon";
import type { Mesh, Scene, StandardMaterial, Vector3 } from "./babylon";
import type { Enemy } from "./enemies";
import type { LevelDefinition } from "./levels";
export function createDucks(
  scene: Scene,
  materials: Record<string, StandardMaterial>,
  spawns: LevelDefinition["enemySpawns"]
): Enemy[] {
  return spawns.map((spawn, index) => {
    const root = new TransformNode(`rubber-duck-${index}`, scene);
    root.position.set(spawn.x, spawn.elevation ?? 0, spawn.z);
    const sphere = (
      name: string,
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
      m: StandardMaterial,
      parent: TransformNode = root
    ): Mesh => {
      const mesh = MeshBuilder.CreateSphere(
        name,
        { diameter: 1, segments: 10 },
        scene
      );
      mesh.parent = parent;
      mesh.position.set(x, y, z);
      mesh.scaling.set(sx, sy, sz);
      mesh.material = m;
      mesh.metadata = { enemy: index };
      return mesh;
    };
    sphere("duck-body", 0, 0.45, -0.08, 1.05, 0.8, 1.3, materials.duckYellow);
    sphere("duck-head", 0, 0.99, 0.37, 0.69, 0.7, 0.66, materials.duckYellow);
    sphere("duck-beak", 0, 0.94, 0.77, 0.61, 0.18, 0.47, materials.duckOrange);
    sphere(
      "duck-beak-line",
      0,
      0.935,
      0.982,
      0.48,
      0.018,
      0.025,
      materials.duckDark
    );
    let visor!: Mesh;
    for (const side of [-1, 1]) {
      const eye = sphere(
        "duck-eye",
        side * 0.233,
        1.09,
        0.58,
        0.105,
        0.12,
        0.085,
        materials.duckDark
      );
      if (side === 1) visor = eye;
      sphere(
        "duck-eye-glint",
        side * 0.24,
        1.115,
        0.622,
        0.031,
        0.032,
        0.02,
        materials.white
      );
    }
    const tail = MeshBuilder.CreateCylinder(
      "duck-tail",
      { height: 0.5, diameterBottom: 0.38, diameterTop: 0.05, tessellation: 6 },
      scene
    );
    tail.parent = root;
    tail.position.set(0, 0.68, -0.65);
    tail.rotation.x = -0.7;
    tail.material = materials.duckYellow;
    tail.metadata = { enemy: index };
    const wings: TransformNode[] = [];
    for (const side of [-1, 1]) {
      const wing = new TransformNode("duck-wing-pivot", scene);
      wing.parent = root;
      wing.position.set(side * 0.44, 0.53, -0.06);
      wings.push(wing);
      sphere(
        "duck-wing",
        side * 0.02,
        0,
        0,
        0.23,
        0.44,
        0.7,
        materials.duckWing,
        wing
      );
    }
    return {
      root,
      health: 68,
      active: false,
      cooldown: 0.65 + index * 0.07,
      path: [],
      pathTimer: 0,
      legs: wings,
      walk: index * 0.37,
      flash: 0,
      visor,
      dying: 0,
    };
  });
}
export function updateDuck(
  enemy: Enemy,
  player: Vector3,
  level: LevelDefinition,
  dt: number,
  damage: (amount: number) => void,
  quack: () => void
) {
  if (enemy.health <= 0) {
    enemy.dying = Math.min(1, enemy.dying + dt * 2);
    enemy.root.scaling.y = 1 - enemy.dying * 0.75;
    enemy.root.rotation.z = enemy.dying * 1.1;
    return;
  }
  const p = enemy.root.position,
    nav = level.navigation,
    distance = Math.hypot(player.x - p.x, player.z - p.z);
  const visible = distance < 27 && nav.lineClear(p, player);
  if (visible || distance < 5) enemy.active = true;
  if (!enemy.active) return;
  enemy.cooldown -= dt;
  enemy.pathTimer -= dt;
  const destination = level.enemyTarget?.(p, player) ?? player;
  enemy.root.rotation.y = Math.atan2(destination.x - p.x, destination.z - p.z);
  if (
    visible &&
    distance < 1.45 &&
    Math.abs(p.y - (player.y - 1.65)) < 1.15 &&
    enemy.cooldown <= 0
  ) {
    damage(10);
    quack();
    enemy.cooldown = 1.15;
    enemy.flash = 0.22;
  }
  let target = destination;
  if (!nav.lineClear(p, destination)) {
    if (enemy.pathTimer <= 0) {
      enemy.path = nav.findPath(p, destination);
      enemy.pathTimer = 0.85;
    }
    if (
      enemy.path[0] &&
      Math.hypot(enemy.path[0].x - p.x, enemy.path[0].z - p.z) < 0.28
    )
      enemy.path.shift();
    target = enemy.path[0] ?? p;
  }
  const length = Math.hypot(target.x - p.x, target.z - p.z);
  if (length > 0.1 && (distance > 1.05 || destination !== player)) {
    const step = 2.3 * dt,
      dx = ((target.x - p.x) / length) * step,
      dz = ((target.z - p.z) / length) * step;
    const canStep = (x: number, z: number) =>
      nav.canOccupy(x, z, 0.36) && (level.canStand?.(x, z, p.y, 0.36) ?? true);
    if (canStep(p.x + dx, p.z)) p.x += dx;
    if (canStep(p.x, p.z + dz)) p.z += dz;
    enemy.walk += dt * 8;
  }
  const floor = level.groundHeight?.(p.x, p.z, p.y) ?? 0;
  p.y = floor >= p.y - 0.4 ? floor : Math.max(floor, p.y - dt * 6);
  enemy.root.rotation.z = Math.sin(enemy.walk) * 0.09;
  enemy.legs.forEach(
    (wing, i) =>
      (wing.rotation.z =
        (i ? 1 : -1) * (0.12 + Math.sin(enemy.walk * 1.7) * 0.17))
  );
  enemy.flash = Math.max(0, enemy.flash - dt);
  enemy.root.rotation.x = enemy.flash > 0 ? -0.16 : 0;
}
