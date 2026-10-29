import { MeshBuilder, TransformNode } from "./babylon";
import type { Scene, StandardMaterial, Mesh } from "./babylon";
import type { Enemy } from "./enemies";
import type { Point } from "./level";
export function createCakes(scene: Scene, materials: Record<string, StandardMaterial>, spawns: Point[]): Enemy[] {
  return spawns.map((spawn, index) => {
    const root = new TransformNode(`angry-cake-${index}`, scene);
    root.position.set(spawn.x, 0, spawn.z);
    const finish = (mesh: Mesh, x: number, y: number, z: number, material: string) => {
      mesh.parent = root;
      mesh.position.set(x, y, z);
      mesh.material = materials[material];
      mesh.metadata = { enemy: index };
      return mesh;
    };
    const box = (name: string, x: number, y: number, z: number, w: number, h: number, d: number, mat: string) =>
      finish(MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene), x, y, z, mat);
    for (let layer = 0; layer < 3; layer++) {
      finish(MeshBuilder.CreateCylinder("cake-sponge", { diameter: 1.5, height: 0.34, tessellation: 20 }, scene), 0, 0.38 + layer * 0.4, 0, index % 2 ? "chocolate" : "sponge");
      finish(MeshBuilder.CreateCylinder("cake-frosting", { diameter: 1.57, height: 0.1, tessellation: 20 }, scene), 0, 0.59 + layer * 0.4, 0, index % 2 ? "strawberry" : "frosting");
    }
    for (let i = 0; i < 10; i++) {
      const angle = i * Math.PI / 5;
      const dollop = finish(MeshBuilder.CreateSphere("cake-icing", { diameter: 0.22, segments: 6 }, scene), Math.sin(angle) * 0.65, 1.46, Math.cos(angle) * 0.65, "frosting");
      dollop.scaling.y = 1.4;
    }
    let visor!: Mesh;
    for (const side of [-1, 1]) {
      box("cake-eye-white", side * 0.28, 1.08, 0.72, 0.32, 0.25, 0.09, "white");
      visor = box("cake-angry-eye", side * 0.26, 1.07, 0.78, 0.11, 0.17, 0.04, "dark");
      const brow = box("cake-angry-brow", side * 0.28, 1.25, 0.78, 0.4, 0.09, 0.07, "chocolate");
      brow.rotation.z = side * 0.4;
      const fist = finish(MeshBuilder.CreateSphere("cake-fist", { diameter: 0.34, segments: 6 }, scene), side * 0.9, 0.74, 0.15, "strawberry");
      fist.scaling.y = 1.2;
    }
    box("cake-scowl", 0, 0.78, 0.77, 0.5, 0.13, 0.07, "dark");
    for (const x of [-0.16, 0, 0.16]) box("cake-tooth", x, 0.8, 0.82, 0.12, 0.08, 0.03, "white");
    box("cake-candle", 0, 1.72, 0, 0.1, 0.5, 0.1, "insulin");
    finish(MeshBuilder.CreateSphere("cake-flame", { diameter: 0.16, segments: 5 }, scene), 0, 2.02, 0, "amber");
    const legs = [-1, 1].map(side => {
      const foot = box("cake-foot", side * 0.4, 0.12, 0.15, 0.35, 0.24, 0.55, "chocolate");
      return foot;
    });
    return { root, health: 100, active: false, cooldown: 0.7 + index * 0.05, path: [], pathTimer: 0, legs, walk: index, flash: 0, visor, dying: 0 };
  });
}
