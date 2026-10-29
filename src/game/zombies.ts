import { MeshBuilder, TransformNode } from "./babylon";
import type { Scene, StandardMaterial, Vector3 } from "./babylon";
import type { Enemy } from "./enemies";
import type { Navigation } from "./navigation";
import type { Point } from "./level";
export function createZombies(
  scene: Scene,
  materials: Record<string, StandardMaterial>,
  spawns: Point[]
): Enemy[] {
  return spawns.map((spawn, index) => {
    const root = new TransformNode(`zombie-${index}`, scene);
    root.position.set(spawn.x, 0, spawn.z);
    const skin = index % 3 ? materials.zombieSkin : materials.zombiePale,
      shirt = index % 2 ? materials.zombieShirt : materials.zombieBlue;
    const part = (
      name: string,
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      m: StandardMaterial,
      parent: TransformNode = root
    ) => {
      const mesh = MeshBuilder.CreateBox(
        name,
        { width: w, height: h, depth: d },
        scene
      );
      mesh.parent = parent;
      mesh.position.set(x, y, z);
      mesh.material = m;
      mesh.metadata = { enemy: index };
      return mesh;
    };
    part("torn-shirt", 0.62, 0.65, 0.36, 0, 1.11, 0, shirt);
    part(
      "shirt-tear",
      0.2,
      0.28,
      0.025,
      0.13,
      1.13,
      0.2,
      materials.zombieBlood
    );
    part("zombie-neck", 0.18, 0.15, 0.19, 0, 1.47, 0.03, skin);
    const head = part("zombie-head", 0.41, 0.43, 0.37, 0, 1.72, 0.055, skin);
    head.rotation.z = index % 2 ? 0.12 : -0.1;
    const visor = part(
      "zombie-eyes",
      0.29,
      0.045,
      0.025,
      0,
      1.78,
      0.25,
      materials.amber
    );
    part("zombie-jaw", 0.28, 0.12, 0.04, 0, 1.56, 0.265, materials.zombieBlood);
    part("zombie-hip", 0.47, 0.22, 0.32, 0, 0.68, 0, materials.zombiePants);
    const legs: TransformNode[] = [];
    for (const side of [-1, 1]) {
      const arm = new TransformNode("outstretched-arm", scene);
      arm.parent = root;
      arm.position.set(side * 0.38, 1.35, 0.03);
      arm.rotation.x = -0.8;
      arm.rotation.z = -side * 0.13;
      part("torn-sleeve", 0.22, 0.3, 0.25, 0, -0.12, 0, shirt, arm);
      part("zombie-forearm", 0.15, 0.42, 0.15, 0, -0.43, 0, skin, arm);
      part("zombie-hand", 0.18, 0.18, 0.12, 0, -0.7, 0.01, skin, arm);
      const leg = new TransformNode("zombie-leg-pivot", scene);
      leg.parent = root;
      leg.position.set(side * 0.17, 0.64, 0);
      legs.push(leg);
      part(
        "zombie-trouser-leg",
        0.23,
        0.49,
        0.27,
        0,
        -0.22,
        0,
        materials.zombiePants,
        leg
      );
      part(
        "zombie-shoe",
        0.25,
        0.15,
        0.38,
        0,
        -0.53,
        0.065,
        materials.dark,
        leg
      );
    }
    return {
      root,
      health: 68,
      active: false,
      cooldown: 0.8,
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
export function updateZombie(
  enemy: Enemy,
  player: Vector3,
  navigation: Navigation,
  dt: number,
  damage: (amount: number) => void
) {
  if (enemy.health <= 0) {
    if (enemy.dying < 1) {
      enemy.dying = Math.min(1, enemy.dying + dt * 2);
      enemy.root.rotation.x = (-enemy.dying * Math.PI) / 2;
      enemy.root.position.y = -enemy.dying * 0.12;
    }
    return;
  }
  const p = enemy.root.position,
    distance = Math.hypot(player.x - p.x, player.z - p.z);
  const sees = distance < 29 && navigation.lineClear(p, player);
  if (sees || distance < 6) enemy.active = true;
  if (!enemy.active) return;
  enemy.cooldown -= dt;
  enemy.pathTimer -= dt;
  enemy.root.rotation.y = Math.atan2(player.x - p.x, player.z - p.z);
  if (
    sees &&
    distance < 1.35 &&
    Math.abs(player.y - 1.65) < 0.65 &&
    enemy.cooldown <= 0
  ) {
    damage(12);
    enemy.cooldown = 1.1;
    enemy.flash = 0.2;
  }
  let destination: Point | undefined;
  if (sees && distance > 1.05) destination = player;
  else if (!sees || distance > 1.35) {
    if (enemy.pathTimer <= 0) {
      enemy.path = navigation.findPath(p, player);
      enemy.pathTimer = 1.15 + (enemy.walk % 1) * 0.3;
    }
    destination = enemy.path[0];
    if (
      destination &&
      Math.hypot(destination.x - p.x, destination.z - p.z) < 0.35
    ) {
      enemy.path.shift();
      destination = enemy.path[0];
    }
  }
  if (destination) {
    const length = Math.hypot(destination.x - p.x, destination.z - p.z);
    if (length > 0.05) {
      const step = (2.05 + (enemy.walk % 3) * 0.12) * dt,
        dx = ((destination.x - p.x) / length) * step,
        dz = ((destination.z - p.z) / length) * step;
      if (navigation.canOccupy(p.x + dx, p.z, 0.32)) p.x += dx;
      if (navigation.canOccupy(p.x, p.z + dz, 0.32)) p.z += dz;
      enemy.walk += dt * 7;
      enemy.legs.forEach(
        (leg, i) => (leg.rotation.x = Math.sin(enemy.walk + i * Math.PI) * 0.4)
      );
    }
  }
  enemy.flash = Math.max(0, enemy.flash - dt);
  enemy.root.rotation.z =
    Math.sin(enemy.walk * 0.5) * 0.035 + (enemy.flash > 0 ? 0.12 : 0);
}
