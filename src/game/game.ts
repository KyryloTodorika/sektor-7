import {
  Engine,
  FreeCamera,
  Mesh,
  MeshBuilder,
  Ray,
  Scene,
  Vector3,
} from "./babylon";
import { GameAudio } from "./audio";
import { createEnemies, updateEnemy } from "./enemies";
import type { Enemy } from "./enemies";
import { LEVELS, nextLevel } from "./levels";
import { createDucks, updateDuck } from "./ducks";
import type { LevelDefinition, LevelId } from "./levels";
import { createZombies, updateZombie } from "./zombies";
import type { DoorDefinition } from "./level";
import type { Door, World } from "./world";
import { Weapon } from "./weapon";
import { createCakes } from "./cakes";
import { createSyringe, InsulinShotgun } from "./insulin-shotgun";
import { Railgun } from "./railgun";
import { createRobots } from "./robots";
import { createHippos, updateHippo } from "./hippos";
import { CarrotHand, createCarrot } from "./carrot";
export type Phase =
  | "menu"
  | "playing"
  | "paused"
  | "dead"
  | "won"
  | "transition";
export interface Status {
  phase: Phase;
  levelId: LevelId;
  nextLevelId: LevelId | null;
  transitionSeconds: number;
  health: number;
  ammo: number;
  reserve: number;
  kills: number;
  total: number;
  hasCard: boolean;
  reloading: boolean;
  location: string;
  seconds: number;
  fps: number;
}
interface Pickup {
  mesh: Mesh;
  kind: "health" | "ammo" | "card";
  baseY: number;
  elevation: number;
  collected: boolean;
}
interface Projectile {
  mesh: Mesh;
  velocity: Vector3;
  life: number;
  player?: boolean;
}
interface Effect {
  mesh: Mesh;
  velocity?: Vector3;
  life: number;
  maxLife: number;
}
export interface GameHooks {
  status: (status: Status) => void;
  notify: (message: string) => void;
  interaction: (message: string) => void;
  hit: () => void;
  damage: () => void;
}
const MAGAZINE = 12,
  RELOAD_TIME = 1.35;
export class Game {
  readonly engine: Engine;
  scene!: Scene;
  camera!: FreeCamera;
  world!: World;
  readonly audio = new GameAudio();
  weapon!: Weapon | InsulinShotgun | Railgun | CarrotHand;
  level: LevelDefinition = LEVELS.station;
  phase: Phase = "menu";
  health = 100;
  ammo = MAGAZINE;
  reserve = 72;
  kills = 0;
  hasCard = false;
  seconds = 0;
  sensitivity = 1;
  private enemies: Enemy[] = [];
  private pickups: Pickup[] = [];
  private projectiles: Projectile[] = [];
  private effects: Effect[] = [];
  private keys = new Set<string>();
  private velocity = Vector3.Zero();
  private verticalVelocity = 0;
  private grounded = true;
  private shotTimer = 0;
  private reloadTimer = 0;
  private renderTime = 0;
  private footstepTimer = 0;
  private statusTimer = 0;
  private interactionTarget: Door | "exit" | null = null;
  private stepAccumulator = 0;
  private interactionMessage = "";
  private resetting = false;
  private pendingLevel: LevelId | null = null;
  private transitionSeconds = 0;
  private pausedFrom: "playing" | "transition" = "playing";
  private readonly canvas: HTMLCanvasElement;
  private readonly hooks: GameHooks;
  constructor(
    canvas: HTMLCanvasElement,
    hooks: GameHooks,
    engine?: Engine,
    levelId: LevelId = "station"
  ) {
    this.canvas = canvas;
    this.hooks = hooks;
    this.engine =
      engine ??
      new Engine(
        canvas,
        true,
        { stencil: true, powerPreference: "high-performance" },
        true
      );
    this.engine.setHardwareScalingLevel(
      1 / Math.min(window.devicePixelRatio || 1, 1.5)
    );
    this.loadLevel(levelId);
    this.bindInput();
    this.engine.runRenderLoop(() => this.frame());
    window.addEventListener("resize", () => this.engine.resize());
  }
  private get magazine() { return this.level.kind === "cake" ? 6 : this.level.kind === "robot" ? 4 : MAGAZINE; }
  private get reloadTime() { return this.level.kind === "cake" ? 2.1 : this.level.kind === "robot" ? 1.8 : RELOAD_TIME; }
  private loadLevel(id: LevelId) {
    this.scene?.dispose();
    this.level = LEVELS[id];
    this.enemies = [];
    this.pickups = [];
    this.projectiles = [];
    this.effects = [];
    this.keys.clear();
    this.velocity.setAll(0);
    this.stepAccumulator = 0;
    this.pendingLevel = null;
    this.transitionSeconds = 0;
    this.verticalVelocity = 0;
    this.grounded = true;
    this.health = 100;
    this.ammo = this.magazine;
    this.reserve = this.level.initialReserve;
    this.kills = 0;
    this.hasCard = false;
    this.seconds = 0;
    this.reloadTimer = 0;
    this.shotTimer = 0;
    this.interactionTarget = null;
    this.interactionMessage = "";
    this.scene = new Scene(this.engine);
    this.camera = new FreeCamera(
      "player",
      this.level.menuCamera.clone(),
      this.scene
    );
    this.camera.minZ = 0.035;
    this.camera.maxZ = this.level.kind !== "sentry" ? 240 : 110;
    this.camera.fov = 1.1;
    this.camera.rotation.y = this.level.menuYaw;
    this.camera.inputs.clear();
    this.scene.activeCamera = this.camera;
    this.world = this.level.createWorld(this.scene);
    this.weapon = this.level.kind === "hippo"
      ? new CarrotHand(this.scene, this.camera, this.world.materials)
      : this.level.kind === "robot"
      ? new Railgun(this.scene, this.camera, this.world.materials)
      : this.level.kind === "cake"
      ? new InsulinShotgun(this.scene, this.camera, this.world.materials)
      : new Weapon(this.scene, this.camera, this.world.materials);
    this.weapon.setVisible(false);
    this.createActors();
    this.scene.setRenderingAutoClearDepthStencil(1, true, true, true);
  }
  selectLevel(id: LevelId) {
    this.phase = "menu";
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.loadLevel(id);
    this.hooks.interaction("");
    this.emitStatus();
  }
  returnToMenu() {
    this.selectLevel(this.level.id);
  }
  private createActors() {
    this.enemies =
      this.level.kind === "hippo"
        ? createHippos(this.scene, this.world.materials, this.level.enemySpawns)
        : this.level.kind === "robot"
        ? createRobots(this.scene, this.world.materials, this.level.enemySpawns)
        : this.level.kind === "cake"
        ? createCakes(this.scene, this.world.materials, this.level.enemySpawns)
        : this.level.kind === "duck"
        ? createDucks(this.scene, this.world.materials, this.level.enemySpawns)
        : this.level.kind === "zombie"
        ? createZombies(
            this.scene,
            this.world.materials,
            this.level.enemySpawns
          )
        : createEnemies(this.scene, this.world.materials);
    this.pickups = this.level.pickups.map((definition, index) => {
      const card = definition.kind === "card";
      const mesh = MeshBuilder.CreateBox(
        `pickup-${index}`,
        {
          width: card ? 0.48 : 0.55,
          height: card ? (this.level.kind === "zombie" ? 0.36 : 0.07) : 0.3,
          depth: card ? 0.3 : 0.4,
        },
        this.scene
      );
      mesh.position.set(
        definition.x,
        (definition.elevation ?? 0) + (card ? 1.1 : 0.5),
        definition.z
      );
      mesh.material = this.world.materials[definition.kind];
      mesh.isPickable = false;
      const mark = MeshBuilder.CreateBox(
        "pickup-mark",
        { width: 0.3, height: 0.045, depth: 0.06 },
        this.scene
      );
      mark.parent = mesh;
      mark.position.y = card ? 0.06 : 0.17;
      mark.material = this.world.materials.white;
      mark.isPickable = false;
      if (card && this.level.kind === "duck") {
        mesh.scaling.set(0.55, 1, 0.4);
        const ring = MeshBuilder.CreateTorus(
          "boat-key-ring",
          { diameter: 0.32, thickness: 0.07, tessellation: 12 },
          this.scene
        );
        ring.parent = mesh;
        ring.position.z = -0.7;
        ring.material = this.world.materials.card;
        ring.isPickable = false;
        const stem = MeshBuilder.CreateBox(
          "boat-key-stem",
          { width: 0.09, height: 0.06, depth: 0.7 },
          this.scene
        );
        stem.parent = mesh;
        stem.position.z = 0.15;
        stem.material = this.world.materials.card;
        stem.isPickable = false;
      }
      if (definition.kind === "health") {
        const vertical = MeshBuilder.CreateBox(
          "health-cross",
          { width: 0.06, height: 0.045, depth: 0.25 },
          this.scene
        );
        vertical.parent = mesh;
        vertical.position.y = 0.17;
        vertical.material = this.world.materials.white;
        vertical.isPickable = false;
      }
      return {
        mesh,
        kind: definition.kind,
        baseY: mesh.position.y,
        elevation: definition.elevation ?? 0,
        collected: false,
      };
    });
  }
  private bindInput() {
    document.addEventListener("keydown", (event) => {
      if (this.phase !== "playing") return;
      if (
        [
          "Space",
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
        ].includes(event.code)
      )
        event.preventDefault();
      this.keys.add(event.code);
      if (event.repeat) return;
      if (event.code === "KeyR") this.reload();
      if (event.code === "KeyE") this.interact();
      if (event.code === "Space" && this.grounded) {
        this.verticalVelocity = 5.7;
        this.grounded = false;
      }
    });
    document.addEventListener("keyup", (event) => this.keys.delete(event.code));
    document.addEventListener("mousemove", (event) => {
      if (
        this.phase !== "playing" ||
        document.pointerLockElement !== this.canvas
      )
        return;
      this.camera.rotation.y += event.movementX * 0.002 * this.sensitivity;
      this.camera.rotation.x = Math.max(
        -1.38,
        Math.min(
          1.38,
          this.camera.rotation.x + event.movementY * 0.002 * this.sensitivity
        )
      );
    });
    this.canvas.addEventListener("mousedown", (event) => {
      if (
        event.button === 0 &&
        this.phase === "playing" &&
        document.pointerLockElement === this.canvas
      )
        this.shoot();
    });
    this.canvas.addEventListener("contextmenu", (event) =>
      event.preventDefault()
    );
    document.addEventListener("pointerlockchange", () => {
      if (
        document.pointerLockElement !== this.canvas &&
        (this.phase === "playing" || this.phase === "transition")
      )
        this.pause();
    });
    window.addEventListener("blur", () => {
      this.keys.clear();
      if (this.phase === "playing" || this.phase === "transition") this.pause();
    });
    document.addEventListener("visibilitychange", () => {
      if (
        document.hidden &&
        (this.phase === "playing" || this.phase === "transition")
      )
        this.pause();
    });
  }
  start() {
    this.reset();
    this.play();
  }
  resume() {
    if (this.phase === "paused") this.play(this.pausedFrom);
  }
  private play(target: "playing" | "transition" = "playing") {
    this.audio.init();
    this.phase = target;
    this.weapon.setVisible(target === "playing");
    this.emitStatus();
    this.canvas.focus();
    try {
      if (document.pointerLockElement === this.canvas) return;
      const request = this.canvas.requestPointerLock();
      if (request)
        request.catch(() => {
          this.pause();
          this.hooks.notify(
            "Mausfreigabe blockiert. Öffne das Spiel direkt im Desktop-Browser."
          );
        });
    } catch {
      this.pause();
      this.hooks.notify("Dieser Browser unterstützt die Maussteuerung nicht.");
    }
  }
  pause() {
    if (this.phase !== "playing" && this.phase !== "transition") return;
    this.pausedFrom = this.phase;
    this.phase = "paused";
    this.keys.clear();
    this.velocity.setAll(0);
    this.hooks.interaction("");
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.emitStatus();
  }
  private reset() {
    this.resetting = true;
    this.pendingLevel = null;
    this.transitionSeconds = 0;
    this.pausedFrom = "playing";
    this.health = 100;
    this.ammo = this.magazine;
    this.reserve = this.level.initialReserve;
    this.kills = 0;
    this.hasCard = false;
    this.seconds = 0;
    this.reloadTimer = 0;
    this.shotTimer = 0;
    this.camera.position.set(this.level.spawn.x, 1.65, this.level.spawn.z);
    this.camera.rotation.set(0, this.level.spawnYaw, 0);
    this.velocity.setAll(0);
    this.verticalVelocity = 0;
    this.grounded = true;
    this.keys.clear();
    for (const enemy of this.enemies) enemy.root.dispose();
    for (const pickup of this.pickups) pickup.mesh.dispose();
    for (const projectile of this.projectiles) projectile.mesh.dispose();
    this.projectiles = [];
    for (const effect of this.effects) effect.mesh.dispose();
    this.effects = [];
    for (const door of this.world.doors) {
      door.openness = 0;
      door.target = 0;
      door.mesh.position.y = 1.65;
    }
    this.stepAccumulator = 0;
    this.createActors();
    this.interactionTarget = null;
    this.interactionMessage = "";
    this.resetting = false;
    this.hooks.notify(`Einsatz gestartet · ${this.level.objectiveBefore}`);
  }
  private closedDoors(): DoorDefinition[] {
    return this.world.doors
      .filter((door) => door.openness < 0.86)
      .map((door) => door.definition);
  }
  private frame() {
    const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.05);
    this.renderTime += dt;
    if (this.phase === "playing") {
      // Fixed physics steps keep movement, projectiles and collisions stable across frame rates.
      this.stepAccumulator = Math.min(this.stepAccumulator + dt, 0.1);
      while (this.stepAccumulator >= 1 / 120) {
        this.update(1 / 120);
        this.stepAccumulator -= 1 / 120;
      }
      this.world.animate(this.renderTime, dt);
    } else if (this.phase === "transition") {
      this.advanceTransition(dt);
      this.world.animate(this.renderTime, dt);
    } else if (this.phase === "menu") {
      this.camera.rotation.y =
        this.level.menuYaw + Math.sin(this.renderTime * 0.13) * 0.08;
      this.camera.rotation.x = 0.015 + Math.sin(this.renderTime * 0.2) * 0.015;
      this.world.animate(this.renderTime, dt);
    }
    for (const pickup of this.pickups)
      if (!pickup.collected) {
        pickup.mesh.rotation.y = this.renderTime * 0.7;
        pickup.mesh.position.y =
          pickup.baseY + Math.sin(this.renderTime * 2) * 0.07;
      }
    const moving = Math.hypot(this.velocity.x, this.velocity.z);
    this.weapon.update(
      dt,
      this.renderTime,
      this.phase === "playing" ? moving / 6 : 0,
      this.reloadTimer > 0 ? 1 - this.reloadTimer / this.reloadTime : 0
    );
    this.statusTimer -= dt;
    if (this.statusTimer <= 0) {
      this.emitStatus();
      this.statusTimer = 0.1;
    }
    this.scene.render();
  }
  private update(dt: number) {
    if (this.phase !== "playing" || this.resetting) return;
    this.seconds += dt;
    this.shotTimer = Math.max(0, this.shotTimer - dt);
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const amount = Math.min(this.magazine - this.ammo, this.reserve);
        this.ammo += amount;
        this.reserve -= amount;
        this.audio.reload();
      }
    }
    this.move(dt);
    const doors = this.closedDoors();
    for (const enemy of this.enemies) {
      if (this.level.kind === "hippo") updateHippo(enemy, this.camera.position, dt, amount => {
        this.takeDamage(amount);
        this.hooks.notify("Kuschel-Alarm! −8 Gesundheit · Schnell mit Karotten füttern");
      });
      else if (this.level.kind === "duck" || this.level.kind === "robot")
        updateDuck(
          enemy,
          this.camera.position,
          this.level,
          dt,
          (amount) => this.takeDamage(amount),
          () => this.level.kind === "duck" ? this.audio.quack() : this.audio.enemyShot()
        );
      else if (this.level.kind === "zombie" || this.level.kind === "cake")
        updateZombie(
          enemy,
          this.camera.position,
          this.level.navigation,
          dt,
          (amount) => this.takeDamage(amount)
        );
      else
        updateEnemy(
          enemy,
          this.camera.position,
          doors,
          dt,
          (origin, direction) => this.enemyShoot(origin, direction)
        );
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (p.player) {
        const step = p.velocity.scale(dt);
        const hit = this.scene.pickWithRay(new Ray(p.mesh.position.clone(), step.normalizeToNew(), step.length()), mesh => {
          const index = mesh.metadata?.enemy;
          return index !== undefined ? this.enemies[index]?.health > 0 : mesh.isPickable && mesh.isEnabled();
        });
        if (hit?.hit) {
          p.life = 0;
          const index = hit.pickedMesh?.metadata?.enemy;
          if (index !== undefined) {
            const enemy = this.enemies[index];
            enemy.health -= 26;
            enemy.active = true;
            this.hooks.hit();
            this.audio.hit();
            if (enemy.health <= 0) {
              this.kills++;
              this.hooks.notify(`Kuchen ausgeschaltet · ${this.kills}/${this.enemies.length}`);
              for (const mesh of enemy.root.getChildMeshes()) mesh.isPickable = false;
            }
          }
        }
      }
      p.mesh.position.addInPlace(p.velocity.scale(dt));
      p.life -= dt;
      const position = p.mesh.position;
      if (
        !p.player && Vector3.Distance(
          position,
          this.camera.position.add(new Vector3(0, -0.45, 0))
        ) < 0.65
      ) {
        this.takeDamage(13);
        p.life = 0;
      }
      if (
        !this.level.navigation.canOccupy(position.x, position.z, 0.05, doors) ||
        p.life <= 0
      ) {
        p.mesh.dispose();
        this.projectiles.splice(i, 1);
      }
    }
    if (this.phase !== "playing") return;
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.life -= dt;
      if(effect.velocity) effect.mesh.position.addInPlace(effect.velocity.scale(dt));
      effect.mesh.scaling.setAll(Math.max(0.01, effect.life / effect.maxLife));
      if (effect.life <= 0) {
        effect.mesh.dispose();
        this.effects.splice(i, 1);
      }
    }
    for (const pickup of this.pickups) {
      if (
        pickup.collected ||
        Math.abs(this.camera.position.y - 1.65 - pickup.elevation) > 1.05 ||
        Math.hypot(
          pickup.mesh.position.x - this.camera.position.x,
          pickup.mesh.position.z - this.camera.position.z
        ) > 1.15
      )
        continue;
      if (pickup.kind === "health" && this.health >= 100) continue;
      if (pickup.kind === "health") {
        this.health = Math.min(100, this.health + 35);
        this.hooks.notify("+35 Gesundheit");
      }
      if (pickup.kind === "ammo") {
        this.reserve += 24;
        this.hooks.notify(this.level.kind === "cake" ? "+24 Insulin-Schrotladungen" : "+24 Schuss · 9 mm");
      }
      if (pickup.kind === "card") {
        this.hasCard = true;
        this.hooks.notify(
          `${this.level.itemLabel} erhalten · ${this.level.objectiveAfter}`
        );
      }
      pickup.collected = true;
      pickup.mesh.setEnabled(false);
      this.audio.pickup();
    }
    this.updateInteraction();
  }
  private move(dt: number) {
    const forward =
      (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0) -
      (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0);
    const strafe =
      (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0);
    const speed =
      this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") ? 8.2 : 5.2;
    const yaw = this.camera.rotation.y,
      normalizer = Math.max(1, Math.hypot(forward, strafe));
    const desiredX =
      ((Math.sin(yaw) * forward + Math.cos(yaw) * strafe) / normalizer) * speed;
    const desiredZ =
      ((Math.cos(yaw) * forward - Math.sin(yaw) * strafe) / normalizer) * speed;
    const acceleration = Math.min(1, dt * (forward || strafe ? 13 : 18));
    this.velocity.x += (desiredX - this.velocity.x) * acceleration;
    this.velocity.z += (desiredZ - this.velocity.z) * acceleration;
    const p = this.camera.position,
      doors = this.closedDoors(),
      radius = 0.32;
    const stand = (x: number, z: number) =>
      this.level.navigation.canOccupy(x, z, radius, doors) &&
      (this.level.canStand?.(x, z, p.y - 1.65, radius) ?? true) &&
      !this.enemies.some(
        (enemy) =>
          enemy.health > 0 &&
          Math.abs(enemy.root.position.y - (p.y - 1.65)) < 1.2 &&
          Math.hypot(x - enemy.root.position.x, z - enemy.root.position.z) <
            0.64
      );
    if (stand(p.x + this.velocity.x * dt, p.z)) p.x += this.velocity.x * dt;
    else this.velocity.x = 0;
    if (stand(p.x, p.z + this.velocity.z * dt)) p.z += this.velocity.z * dt;
    else this.velocity.z = 0;
    if (this.keys.has("ArrowLeft")) this.camera.rotation.y -= dt * 1.6;
    if (this.keys.has("ArrowRight")) this.camera.rotation.y += dt * 1.6;
    this.verticalVelocity -= 17 * dt;
    p.y += this.verticalVelocity * dt;
    const floorHeight = this.level.groundHeight?.(p.x, p.z, p.y - 1.65) ?? 0;
    const floor = floorHeight + 1.65;
    if (p.y <= floor) {
      p.y = floor;
      this.verticalVelocity = 0;
      this.grounded = true;
    } else this.grounded = false;
    const moving = Math.hypot(this.velocity.x, this.velocity.z);
    this.footstepTimer -= dt;
    if (moving > 1 && this.grounded && this.footstepTimer <= 0) {
      this.audio.footstep();
      this.footstepTimer = speed > 6 ? 0.26 : 0.38;
    }
  }
  private shoot() {
    if (this.shotTimer > 0 || this.reloadTimer > 0) return;
    if (this.level.kind === "hippo") {
      this.feedHippo();
      return;
    }
    if (this.ammo <= 0) {
      this.audio.empty();
      this.shotTimer = 0.25;
      this.hooks.notify(
        this.reserve > 0
          ? "Magazin leer · R zum Nachladen"
          : "Keine Munition · Suche gelbe Munitionspakete"
      );
      return;
    }
    if (this.level.kind === "cake") {
      this.shootInsulin();
      return;
    }
    this.ammo--;
    this.shotTimer = this.level.kind === "robot" ? 0.7 : 0.19;
    this.weapon.fire();
    this.audio.shoot();
    const direction = this.camera.getDirection(Vector3.Forward());
    const ray = new Ray(this.camera.position.clone(), direction, this.level.kind === "robot" ? 150 : 85);
    const hit = this.scene.pickWithRay(ray, (mesh) => {
      if (mesh.metadata?.enemy !== undefined)
        return this.enemies[mesh.metadata.enemy]?.health > 0;
      return (
        mesh.isPickable &&
        mesh.isEnabled() &&
        (!mesh.name.startsWith("door-") || mesh.position.y < 4)
      );
    });
    if (this.level.kind === "robot") {
      const length = hit?.pickedPoint ? Vector3.Distance(this.camera.position, hit.pickedPoint) : 150;
      const beam = MeshBuilder.CreateBox("railgun-beam", {width:0.045,height:0.045,depth:length}, this.scene);
      beam.position.copyFrom(this.camera.position.add(direction.scale(length/2)));
      beam.lookAt(beam.position.add(direction));
      beam.material = this.world.materials.ammo;
      beam.isPickable = false;
      this.effects.push({mesh:beam,life:0.12,maxLife:0.12});
      this.audio.enemyShot();
    }
    if (hit?.hit && hit.pickedPoint) {
      const index = hit.pickedMesh?.metadata?.enemy;
      if (index !== undefined) {
        const enemy = this.enemies[index];
        enemy.health -= this.level.kind === "robot" ? 110 : 34;
        enemy.active = true;
        enemy.cooldown = Math.max(0.4, enemy.cooldown);
        this.hooks.hit();
        this.audio.hit();
        if (enemy.health <= 0) {
          if (this.level.kind === "duck") this.audio.quack();
          this.kills++;
          this.hooks.notify(
            `${
              this.level.kind === "duck"
                ? "Gummiente"
                : this.level.kind === "zombie"
                ? "Zombie"
                : this.level.kind === "robot"
                ? "Killerroboter"
                : "Wachdrohne"
            } ausgeschaltet · ${this.kills}/${this.level.enemySpawns.length}`
          );
          for (const mesh of enemy.root.getChildMeshes())
            mesh.isPickable = false;
        }
      }
      const spark = MeshBuilder.CreateSphere(
        "impact",
        { diameter: index !== undefined ? 0.22 : 0.11, segments: 4 },
        this.scene
      );
      spark.position.copyFrom(hit.pickedPoint);
      spark.material =
        this.world.materials[
          index !== undefined && this.level.kind !== "duck" ? "red" : "amber"
        ];
      spark.isPickable = false;
      this.effects.push({ mesh: spark, life: 0.15, maxLife: 0.15 });
    }
    this.camera.rotation.x = Math.max(-1.38, this.camera.rotation.x - 0.009);
    this.emitStatus();
  }
  private feedHippo() {
    this.shotTimer = 0.45;
    this.weapon.fire();
    const direction = this.camera.getDirection(Vector3.Forward());
    const hit = this.scene.pickWithRay(new Ray(this.camera.position.clone(), direction, 35), mesh => {
      const index=mesh.metadata?.enemy;
      return index !== undefined ? this.enemies[index]?.health>0 : mesh.isPickable && mesh.isEnabled();
    });
    const carrot=createCarrot(this.scene,this.world.materials);
    const destination=hit?.pickedPoint ?? this.camera.position.add(direction.scale(8));
    const origin=this.camera.position.add(direction.scale(.7));
    carrot.position.copyFrom(origin);
    carrot.rotation.x=Math.PI/2;
    this.effects.push({mesh:carrot,life:.35,maxLife:.35,velocity:destination.subtract(origin).scale(1/.35)});
    const index=hit?.pickedMesh?.metadata?.enemy;
    if(index!==undefined){
      const hippo=this.enemies[index];
      hippo.health--;
      hippo.root.getChildMeshes().find(mesh=>mesh.name===`hippo-carrot-${hippo.health}`)?.setEnabled(false);
      this.audio.pickup();this.hooks.hit();
      this.hooks.notify(`Baby-Hippo · ${3-hippo.health}/3 Karotten${hippo.health===0?" · Gute Nacht!":""}`);
      if(hippo.health===0){
        this.kills++;
        for(const mesh of hippo.root.getChildMeshes())mesh.isPickable=false;
        if(this.kills===this.enemies.length){
          this.hasCard=true;
          // Let the last hippo settle into its sleeping pose before the result.
          this.shotTimer=1;
        }
      }
    }
    this.emitStatus();
  }
  private shootInsulin() {
    this.ammo--;
    this.shotTimer = 0.85;
    this.weapon.fire();
    this.audio.shoot();
    this.audio.enemyShot();
    const forward = this.camera.getDirection(Vector3.Forward());
    const right = this.camera.getDirection(new Vector3(1, 0, 0));
    const up = this.camera.getDirection(new Vector3(0, 1, 0));
    // A centred syringe plus a six-syringe cone gives reliable close-range spread.
    for (let i = 0; i < 7; i++) {
      const angle = (i - 1) * Math.PI / 3;
      const spread = i === 0 ? Vector3.Zero() : right.scale(Math.cos(angle) * 0.065).add(up.scale(Math.sin(angle) * 0.065));
      const direction = forward.add(spread).normalize();
      const mesh = createSyringe(this.scene, this.world.materials);
      mesh.position.copyFrom(this.camera.position.add(forward.scale(0.65)).add(right.scale(0.16)).add(up.scale(-0.12)));
      mesh.rotation.set(Math.PI / 2 - Math.asin(direction.y), Math.atan2(direction.x, direction.z), 0);
      this.projectiles.push({ mesh, velocity: direction.scale(45), life: 0.85, player: true });
    }
    this.camera.rotation.x = Math.max(-1.38, this.camera.rotation.x - 0.035);
    this.emitStatus();
  }
  reload() {
    if(this.level.kind === "hippo") return;
    if (this.reloadTimer > 0 || this.ammo >= this.magazine) return;
    if (this.reserve <= 0) {
      this.hooks.notify("Keine Reservemunition");
      return;
    }
    this.reloadTimer = this.reloadTime;
    this.audio.reload();
    this.emitStatus();
  }
  private enemyShoot(origin: Vector3, direction: Vector3) {
    const bolt = MeshBuilder.CreateSphere(
      "security-bolt",
      { diameter: 0.15, segments: 5 },
      this.scene
    );
    bolt.position.copyFrom(origin);
    bolt.material = this.world.materials.red;
    bolt.isPickable = false;
    this.projectiles.push({
      mesh: bolt,
      velocity: direction.scale(12),
      life: 3.5,
    });
    if (Vector3.Distance(origin, this.camera.position) < 15)
      this.audio.enemyShot();
  }
  private takeDamage(amount: number) {
    if (this.phase !== "playing") return;
    this.health = Math.max(0, this.health - amount);
    this.audio.hurt();
    this.hooks.damage();
    if (this.health <= 0) {
      this.phase = "dead";
      this.keys.clear();
      document.exitPointerLock();
      this.emitStatus();
    }
  }
  private updateInteraction() {
    if(this.level.kind === "hippo") {
      this.interactionTarget=null;
      if(this.hasCard && this.enemies.every(e=>e.dying>=1)) {
        this.phase="won";this.audio.win();
        if(document.pointerLockElement===this.canvas)document.exitPointerLock();
        this.emitStatus();
      }
      return;
    }
    this.interactionTarget = null;
    let message = "";
    let closest = 3.4;
    const forward = this.camera.getDirection(Vector3.Forward());
    for (const door of this.world.doors) {
      const dx = door.definition.x - this.camera.position.x,
        dz = door.definition.z - this.camera.position.z,
        distance = Math.hypot(dx, dz);
      if (
        distance < closest &&
        (distance < 1.4 || (dx * forward.x + dz * forward.z) / distance > 0.35)
      ) {
        closest = distance;
        this.interactionTarget = door;
        message = door.target ? "Tür schließen" : "Tür öffnen";
      }
    }
    if (
      (this.level.kind !== "robot" || this.camera.position.y < 2.7) &&
      Math.hypot(
        this.camera.position.x - this.level.exit.x,
        this.camera.position.z - this.level.exit.z
      ) < 2.5
    ) {
      this.interactionTarget = "exit";
      message = this.hasCard
        ? this.level.kind === "duck"
          ? "Mit dem Boot ablegen"
          : this.level.kind === "cake"
          ? "Konditorei verlassen"
          : this.level.kind === "zombie"
          ? "Safehouse betreten"
          : "Anlage verlassen"
        : `${this.level.itemLabel} erforderlich`;
    }
    if (message !== this.interactionMessage) {
      this.interactionMessage = message;
      this.hooks.interaction(message);
    }
  }
  private interact() {
    if (this.interactionTarget === "exit") {
      if (!this.hasCard) {
        this.hooks.notify(this.level.objectiveBefore);
        return;
      }
      this.pendingLevel = nextLevel(this.level.id);
      this.keys.clear();
      this.velocity.setAll(0);
      this.audio.win();
      if (this.pendingLevel) {
        this.phase = "transition";
        this.transitionSeconds = 3;
        this.weapon.setVisible(false);
      } else {
        this.phase = "won";
        document.exitPointerLock();
      }
      this.emitStatus();
      return;
    }
    const door = this.interactionTarget;
    if (door) {
      const d = door.definition;
      if (door.target === 1) {
        const inDoor = (p: Vector3) =>
          d.axis === "x"
            ? Math.abs(p.x - d.x) < d.width / 2 + 0.5 &&
              Math.abs(p.z - d.z) < 0.65
            : Math.abs(p.z - d.z) < d.width / 2 + 0.5 &&
              Math.abs(p.x - d.x) < 0.65;
        if (
          inDoor(this.camera.position) ||
          this.enemies.some((e) => e.health > 0 && inDoor(e.root.position))
        ) {
          this.hooks.notify("Türbereich blockiert");
          return;
        }
      }
      door.target = door.target ? 0 : 1;
      this.audio.door();
    }
  }
  private advanceTransition(dt: number) {
    if (this.phase !== "transition" || !this.pendingLevel) return;
    this.transitionSeconds = Math.max(0, this.transitionSeconds - dt);
    if (this.transitionSeconds > 0) return;
    const id = this.pendingLevel;
    this.loadLevel(id);
    this.reset();
    this.phase = "playing";
    this.weapon.setVisible(true);
    // The same canvas keeps pointer lock; no second user gesture is required.
    this.emitStatus();
  }
  setQuality(quality: string) {
    this.engine.setHardwareScalingLevel(
      quality === "low" ? 2 : 1 / Math.min(window.devicePixelRatio || 1, 1.5)
    );
    this.engine.resize();
  }
  private emitStatus() {
    this.hooks.status({
      phase: this.phase,
      levelId: this.level.id,
      nextLevelId: this.pendingLevel,
      transitionSeconds: this.transitionSeconds,
      health: this.health,
      ammo: this.ammo,
      reserve: this.reserve,
      kills: this.kills,
      total: this.enemies.length,
      hasCard: this.hasCard,
      reloading: this.reloadTimer > 0,
      location: this.level.locationName(
        this.camera.position,
        this.camera.position.y - 1.65
      ),
      seconds: this.seconds,
      fps: Math.round(this.engine.getFps()),
    });
  }
  diagnostics() {
    return {
      phase: this.phase,
      levelId: this.level.id,
      nextLevelId: this.pendingLevel,
      transitionSeconds: this.transitionSeconds,
      position: this.camera.position.asArray(),
      health: this.health,
      ammo: this.ammo,
      reserve: this.reserve,
      kills: this.kills,
      hasCard: this.hasCard,
      seconds: this.seconds,
      fps: Math.round(this.engine.getFps()),
      drawCalls: this.engine._drawCalls.current,
      meshes: this.scene.meshes.length,
      activeEnemies: this.enemies.filter((e) => e.active && e.health > 0)
        .length,
      doors: this.world.doors.map((d) => ({
        id: d.definition.id,
        open: d.openness,
      })),
      projectiles: this.projectiles.length,
    };
  }
}
