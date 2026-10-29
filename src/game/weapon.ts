import {
  Mesh,
  MeshBuilder,
  PointLight,
  Scene,
  TransformNode,
  Vector3,
} from "./babylon";
import type { Camera, StandardMaterial } from "./babylon";
export class Weapon {
  root: TransformNode;
  private slide: Mesh;
  private flash: Mesh;
  private flashLight: PointLight;
  private kick = 0;
  constructor(
    scene: Scene,
    camera: Camera,
    materials: Record<string, StandardMaterial>
  ) {
    this.root = new TransformNode("PX-9", scene);
    this.root.parent = camera;
    const box = (
      name: string,
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      m: StandardMaterial
    ) => {
      const mesh = MeshBuilder.CreateBox(
        name,
        { width: w, height: h, depth: d },
        scene
      );
      mesh.parent = this.root;
      mesh.position.set(x, y, z);
      mesh.material = m;
      mesh.isPickable = false;
      mesh.renderingGroupId = 1;
      return mesh;
    };
    box("pistol-frame", 0.14, 0.13, 0.43, 0, 0, 0, materials.enemyDark);
    this.slide = box(
      "pistol-slide",
      0.16,
      0.12,
      0.47,
      0,
      0.085,
      0.015,
      materials.metal
    );
    box("pistol-top", 0.12, 0.025, 0.44, 0, 0.158, 0.015, materials.enemyDark);
    box("rear-sight", 0.11, 0.045, 0.045, 0, 0.18, -0.16, materials.dark);
    box("front-sight", 0.035, 0.035, 0.025, 0, 0.185, 0.2, materials.amber);
    box("barrel", 0.075, 0.07, 0.075, 0, 0.08, 0.27, materials.dark);
    const grip = box(
      "pistol-grip",
      0.12,
      0.26,
      0.14,
      0,
      -0.15,
      -0.125,
      materials.dark
    );
    grip.rotation.x = -0.2;
    box(
      "trigger-guard",
      0.035,
      0.14,
      0.15,
      0.055,
      -0.12,
      0.03,
      materials.metal
    );
    box("glove", 0.17, 0.17, 0.18, -0.015, -0.17, -0.15, materials.enemy);
    const sleeve = box(
      "sleeve",
      0.2,
      0.2,
      0.58,
      -0.015,
      -0.21,
      -0.48,
      materials.trim
    );
    sleeve.rotation.x = -0.13;
    for (let i = 0; i < 5; i++)
      box(
        "slide-groove",
        0.164,
        0.07,
        0.009,
        0,
        0.1,
        -0.12 + i * 0.023,
        materials.trim
      );
    this.flash = MeshBuilder.CreateSphere(
      "muzzle-flash",
      { diameter: 0.2, segments: 4 },
      scene
    );
    this.flash.parent = this.root;
    this.flash.position.set(0, 0.09, 0.34);
    this.flash.scaling.set(0.55, 0.55, 2);
    this.flash.material = materials.amber;
    this.flash.isPickable = false;
    this.flash.renderingGroupId = 1;
    this.flash.setEnabled(false);
    this.flashLight = new PointLight("muzzle-light", Vector3.Zero(), scene);
    this.flashLight.parent = this.root;
    this.flashLight.position.set(0, 0.2, 0.5);
    this.flashLight.diffuse = materials.amber.diffuseColor;
    this.flashLight.range = 4;
    this.flashLight.intensity = 0;
    this.root.position.set(0.29, -0.25, 0.6);
  }
  fire() {
    this.kick = 1;
  }
  update(dt: number, time: number, speed: number, reloadProgress: number) {
    this.kick = Math.max(0, this.kick - dt * 9);
    const bob = Math.sin(time * 10) * Math.min(1, speed) * 0.008;
    this.root.position.set(
      0.29 + Math.sin(time * 5) * speed * 0.004,
      -0.25 + Math.abs(bob) - Math.sin(reloadProgress * Math.PI) * 0.36,
      0.6 - this.kick * 0.065
    );
    this.root.rotation.set(
      -this.kick * 0.15 - Math.sin(reloadProgress * Math.PI) * 0.5,
      0,
      -Math.sin(reloadProgress * Math.PI) * 0.4
    );
    this.slide.position.z = 0.015 - this.kick * 0.06;
    this.flash.setEnabled(this.kick > 0.65);
    this.flash.rotation.z = time * 100;
    this.flashLight.intensity = this.kick > 0.65 ? 1.5 : 0;
  }
  setVisible(visible: boolean) {
    this.root.setEnabled(visible);
  }
}
