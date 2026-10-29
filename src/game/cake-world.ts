import { Color3, Color4, DynamicTexture, HemisphericLight, MeshBuilder, StandardMaterial, TransformNode, Vector3 } from "./babylon";
import type { Scene } from "./babylon";
import type { World } from "./world";
import { CELL } from "./level";
import { CAKE_COUNTERS, CAKE_EXIT } from "./cake-level";
export function createCakeWorld(scene: Scene): World {
  scene.clearColor = new Color4(0.15, 0.08, 0.13, 1);
  const light = new HemisphericLight("bakery-light", new Vector3(0.3, 1, -0.2), scene);
  light.intensity = 1.1;
  const materials: Record<string, StandardMaterial> = {};
  for (const [name, hex] of Object.entries({ wall: "#c989a0", floor: "#f3dfc4", pinkTile: "#ce8da3", metal: "#a4c4ce", trim: "#487d80", dark: "#342736", enemyDark: "#382a30", enemy: "#587779", amber: "#ffbe59", red: "#ff4a66", white: "#fff9e9", ammo: "#60ddd3", health: "#7bd991", card: "#f7c55c", sponge: "#dcaa64", chocolate: "#72402f", frosting: "#fff0db", strawberry: "#f08cab", insulin: "#43dedb" })) {
    const mat = new StandardMaterial(`bakery-${name}`, scene);
    mat.diffuseColor = Color3.FromHexString(hex);
    if (["insulin", "card", "amber"].includes(name)) mat.emissiveColor = mat.diffuseColor.scale(0.35);
    materials[name] = mat;
  }
  const box = (name: string, x: number, y: number, z: number, w: number, h: number, d: number, material: string) => {
    const mesh = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
    mesh.position.set(x, y, z);
    mesh.material = materials[material];
    return mesh;
  };
  for (let z = 1; z < 18; z++) for (let x = 1; x < 16; x++)
    box("bakery-tile", (x + 0.5) * CELL, -0.1, (z + 0.5) * CELL, CELL, 0.2, CELL, (x + z) % 2 ? "floor" : "pinkTile");
  box("bakery-wall", CELL - 0.2, 3, 9.5 * CELL, 0.4, 6, 17 * CELL, "wall");
  box("bakery-wall", 16 * CELL + 0.2, 3, 9.5 * CELL, 0.4, 6, 17 * CELL, "wall");
  for (const z of [CELL - 0.2, 18 * CELL + 0.2]) box("bakery-wall", 8.5 * CELL, 3, z, 15 * CELL, 6, 0.4, "wall");
  for (const p of CAKE_COUNTERS) {
    const counter = MeshBuilder.CreateCylinder("bakery-counter", { diameter: 3.2, height: 1.1, tessellation: 24 }, scene);
    counter.position.set(p.x, 0.55, p.z);
    counter.material = materials.trim;
    const top = MeshBuilder.CreateCylinder("bakery-counter-top", { diameter: 3.25, height: 0.12, tessellation: 24 }, scene);
    top.position.set(p.x, 1.16, p.z);
    top.material = materials.white;
    box("baking-tray", p.x, 1.25, p.z, 1.5, 0.06, 0.8, "metal");
    for (let i = -1; i <= 1; i++) box("pastry", p.x + i * 0.4, 1.36, p.z, 0.28, 0.18, 0.4, "sponge");
  }
  for (const x of [10, 23.8, 37.6]) {
    box("bakery-pendant", x, 5.2, 26, 3, 0.15, 0.8, "amber");
    box("bakery-cable", x, 5.6, 26, 0.04, 0.8, 0.04, "dark");
  }
  const sign = (text: string, x: number, z: number, width: number) => {
    const texture = new DynamicTexture(`sign-${text}`, { width: 1024, height: 256 }, scene, false);
    texture.drawText(text, null, 160, "bold 76px sans-serif", "#fff2da", "#49303c", true);
    const mat = new StandardMaterial(`sign-${text}`, scene);
    mat.diffuseTexture = texture;
    mat.emissiveColor = new Color3(0.5, 0.5, 0.5);
    const mesh = MeshBuilder.CreatePlane(`sign-${text}`, { width, height: 2 }, scene);
    mesh.position.set(x, 3.5, z);
    mesh.rotation.y = z < 10 ? Math.PI : 0;
    mesh.material = mat;
    mesh.isPickable = false;
  };
  sign("SUGAR RUSH", 23.8, CELL + 0.08, 12);
  sign("LIEFERAUSGANG", CAKE_EXIT.x, 18 * CELL - 0.1, 7);
  box("bakery-exit", CAKE_EXIT.x, 1.4, 18 * CELL - 0.08, 3, 2.8, 0.1, "trim");
  const exit = new TransformNode("bakery-exit-marker", scene);
  exit.position.set(CAKE_EXIT.x, 0, CAKE_EXIT.z);
  return { doors: [], exit, materials, animate() {} };
}
