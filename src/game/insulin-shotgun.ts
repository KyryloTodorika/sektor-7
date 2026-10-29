import { MeshBuilder, TransformNode } from "./babylon";
import type { Camera, Mesh, Scene, StandardMaterial } from "./babylon";
export function createSyringe(scene: Scene, materials: Record<string, StandardMaterial>): Mesh {
  const root = MeshBuilder.CreateCylinder("insulin-syringe", { height: 0.32, diameter: 0.07, tessellation: 8 }, scene);
  root.material = materials.white;
  const part = (name: string, height: number, diameter: number, y: number, material: string) => {
    const mesh = MeshBuilder.CreateCylinder(name, { height, diameter, tessellation: 8 }, scene);
    mesh.parent = root;
    mesh.position.y = y;
    mesh.material = materials[material];
    mesh.isPickable = false;
  };
  part("syringe-insulin", 0.2, 0.075, 0, "insulin");
  part("syringe-needle", 0.22, 0.013, 0.27, "metal");
  part("syringe-plunger", 0.13, 0.035, -0.22, "metal");
  part("syringe-thumb-pad", 0.025, 0.11, -0.29, "insulin");
  part("syringe-finger-flange", 0.025, 0.13, -0.15, "white");
  for (let i = 0; i < 4; i++) part("syringe-graduation", 0.012, 0.08, -0.08 + i * 0.05, "dark");
  root.isPickable = false;
  return root;
}
export class InsulinShotgun {
  root: TransformNode;
  private pump: Mesh;
  private kick = 0;
  constructor(scene: Scene, camera: Camera, materials: Record<string, StandardMaterial>) {
    this.root = new TransformNode("insulin-shotgun", scene);
    this.root.parent = camera;
    const box = (name: string, w: number, h: number, d: number, x: number, y: number, z: number, mat: string) => {
      const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
      m.parent = this.root;
      m.position.set(x, y, z);
      m.material = materials[mat];
      m.isPickable = false;
      m.renderingGroupId = 1;
      return m;
    };
    box("shotgun-receiver", 0.22, 0.2, 0.5, 0, 0, 0, "metal");
    box("shotgun-stock", 0.18, 0.23, 0.5, 0, -0.05, -0.43, "trim");
    box("shotgun-grip", 0.13, 0.28, 0.16, 0, -0.2, -0.12, "dark");
    for (const y of [0.06, -0.07]) {
      const barrel = MeshBuilder.CreateCylinder("shotgun-barrel", { height: 0.94, diameter: 0.11, tessellation: 12 }, scene);
      barrel.parent = this.root;
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, y, 0.6);
      barrel.material = materials.enemyDark;
      barrel.isPickable = false;
      barrel.renderingGroupId = 1;
    }
    this.pump = box("shotgun-pump", 0.22, 0.17, 0.36, 0, -0.08, 0.46, "trim");
    for (let i = 0; i < 5; i++) {
      const rib = box("shotgun-pump-rib", 0.23, 0.18, 0.02, 0, 0, -0.14 + i * 0.07, "dark");
      rib.parent = this.pump;
    }
    box("shotgun-sight", 0.04, 0.06, 0.04, 0, 0.15, 1, "insulin");
    box("shotgun-insulin-strip", 0.225, 0.06, 0.32, 0, 0.01, 0, "insulin");
    box("shotgun-glove", 0.18, 0.18, 0.2, 0, -0.23, -0.14, "enemy");
    box("shotgun-support-glove", 0.26, 0.15, 0.2, 0, -0.2, 0.5, "enemy");
    for (let i = 0; i < 3; i++) {
      const syringe = createSyringe(scene, materials);
      syringe.parent = this.root;
      syringe.position.set(0.15, 0.02, -0.12 + i * 0.14);
      syringe.scaling.setAll(0.65);
      for (const mesh of [syringe, ...syringe.getChildMeshes()]) mesh.renderingGroupId = 1;
    }
    this.update(0, 0, 0, 0);
  }
  fire() { this.kick = 1; }
  update(dt: number, time: number, speed: number, reloadProgress: number) {
    this.kick = Math.max(0, this.kick - dt * 2.3);
    this.root.position.set(0.3, -0.29 + Math.sin(time * 10) * speed * 0.008 - Math.sin(reloadProgress * Math.PI) * 0.4, 0.58 - this.kick * 0.18);
    this.root.rotation.set(-this.kick * 0.18 - Math.sin(reloadProgress * Math.PI) * 0.45, 0, 0);
    this.pump.position.z = 0.46 - Math.sin(this.kick * Math.PI) * 0.2;
  }
  setVisible(visible: boolean) { this.root.setEnabled(visible); }
}
