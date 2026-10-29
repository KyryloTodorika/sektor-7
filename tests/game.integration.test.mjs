import { test } from "node:test";
import assert from "node:assert/strict";
import { stripTypeScriptTypes } from "node:module";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine.js";

// NullEngine checks real scene geometry and gameplay without a browser/GPU.
// This canvas adapter deliberately does not claim to check rendered pixels.
class TestCanvas extends EventTarget {
  width = 1280;
  height = 720;
  clientWidth = 1280;
  clientHeight = 720;
  style = {};
  getContext() {
    return {
      fillRect() {},
      strokeRect() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      stroke() {},
      fillText() {},
      measureText(text) {
        return { width: text.length * 25 };
      },
    };
  }
  pointerRequests = 0;
  focus() {}
  requestPointerLock() {
    this.pointerRequests++;
    document.pointerLockElement = this;
    return Promise.resolve();
  }
}

test("gameplay lifecycle with a real Babylon scene", async (t) => {
  const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const output = await mkdtemp(resolve(tmpdir(), "sektor7-test-"));
  let engine;
  const originalWindow = globalThis.window,
    originalDocument = globalThis.document;
  t.after(async () => {
    engine?.dispose();
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
    await rm(output, { recursive: true, force: true });
  });
  // Production uses Vite's bundler resolution. Temporary ESM files let Node use
  // exactly the same source with explicit extensions, without another compiler.
  for (const name of await readdir(resolve(project, "src/game"))) {
    if (!name.endsWith(".ts")) continue;
    let source = await readFile(resolve(project, "src/game", name), "utf8");
    source = source
      .replace(
        /from ['"]\.\/([^'"]+)['"]/g,
        (_, name) => `from './${name}.mjs'`
      )
      .replace(
        /from ['"](@babylonjs\/core\/[^'"]+)['"]/g,
        (_, name) =>
          `from '${
            pathToFileURL(resolve(project, "node_modules", name + ".js")).href
          }'`
      );
    await writeFile(
      resolve(output, name.replace(".ts", ".mjs")),
      stripTypeScriptTypes(source)
    );
  }
  const doc = new EventTarget();
  doc.createElement = () => new TestCanvas();
  doc.pointerLockElement = null;
  doc.exitPointerLock = () => {
    doc.pointerLockElement = null;
  };
  doc.hidden = false;
  globalThis.document = doc;
  const win = new EventTarget();
  win.devicePixelRatio = 1;
  globalThis.window = win;
  const { Game } = await import(
    pathToFileURL(resolve(output, "game.mjs")).href
  );
  engine = new NullEngine({
    renderWidth: 1280,
    renderHeight: 720,
    textureSize: 512,
    deterministicLockstep: false,
    lockstepMaxSteps: 4,
  });
  const game = new Game(
    new TestCanvas(),
    { status() {}, notify() {}, interaction() {}, hit() {}, damage() {} },
    engine
  );
  engine.stopRenderLoop();
  const tick = (seconds) => {
    for (let i = 0; i < Math.ceil(seconds * 120); i++) game.update(1 / 120);
  };
  const restart = () => {
    game.start();
    engine.stopRenderLoop();
    game.scene.render();
  };
  const key = (type, code) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { code, repeat: false });
    doc.dispatchEvent(event);
  };
  restart();
  const materials = game.scene.materials.length;
  await t.test(
    "firing consumes ammunition and reloading transfers reserve rounds",
    () => {
      game.shoot();
      assert.equal(game.ammo, 11);
      game.reload();
      tick(1.5);
      assert.equal(game.ammo, 12);
      assert.equal(game.reserve, 71);
    }
  );
  await t.test(
    "pause freezes movement, mission time and the reload timer",
    () => {
      game.shoot();
      game.reload();
      const seconds = game.seconds;
      game.pause();
      tick(2);
      assert.equal(game.seconds, seconds);
      assert.equal(game.ammo, 11);
      game.resume();
      tick(1.5);
      assert.equal(game.ammo, 12);
    }
  );
  await t.test("keyboard movement stops at a closed door", () => {
    restart();
    key("keydown", "KeyW");
    tick(5);
    key("keyup", "KeyW");
    const door = game.world.doors[0].definition;
    assert.ok(game.camera.position.z > door.z + 0.32);
    assert.ok(game.camera.position.z < door.z + 1);
  });
  await t.test("jumping returns the player to the floor", () => {
    restart();
    key("keydown", "Space");
    tick(0.1);
    assert.ok(game.camera.position.y > 1.65);
    key("keyup", "Space");
    tick(1);
    assert.equal(game.camera.position.y, 1.65);
  });
  await t.test(
    "interacting opens a nearby door and prevents closing it onto the player",
    () => {
      const door = game.world.doors[0];
      game.camera.position.set(door.definition.x, 1.65, door.definition.z + 2);
      game.camera.rotation.set(0, Math.PI, 0);
      game.camera.computeWorldMatrix();
      game.updateInteraction();
      game.interact();
      assert.equal(door.target, 1);
      game.world.animate(0, 1);
      assert.equal(door.openness, 1);
      game.camera.position.z = door.definition.z;
      game.updateInteraction();
      game.interact();
      assert.equal(door.target, 1);
    }
  );
  await t.test("three aimed hits destroy an enemy", () => {
    restart();
    game.camera.position.set(15.4, 1.65, 33.4);
    game.camera.rotation.set(0, Math.PI, 0);
    game.scene.render();
    for (let i = 0; i < 3; i++) {
      game.shotTimer = 0;
      game.shoot();
    }
    assert.equal(game.kills, 1);
    assert.equal(game.ammo, 9);
  });
  await t.test(
    "extraction requires the card and completes the mission after collecting it",
    () => {
      game.camera.position.set(77, 1.65, 57.4);
      game.updateInteraction();
      game.interact();
      assert.equal(game.phase, "playing");
      game.camera.position.set(77, 1.65, 12.6);
      tick(0.02);
      assert.equal(game.hasCard, true);
      game.camera.position.set(77, 1.65, 57.4);
      game.updateInteraction();
      game.interact();
      assert.equal(game.phase, "transition");
    }
  );
  await t.test(
    "restarting restores actors, supplies and shared materials",
    () => {
      restart();
      assert.equal(game.health, 100);
      assert.equal(game.hasCard, false);
      assert.equal(game.kills, 0);
      assert.equal(game.ammo, 12);
      assert.equal(game.reserve, 72);
      assert.equal(game.scene.materials.length, materials);
    }
  );
  await t.test(
    "enemy projectiles damage the player and zero health ends the mission",
    () => {
      game.camera.position.set(15.4, 1.65, 33.4);
      tick(5);
      assert.ok(game.health < 100);
      game.takeDamage(100);
      assert.equal(game.health, 0);
      assert.equal(game.phase, "dead");
    }
  );
  const outdoor = await import(
    pathToFileURL(resolve(output, "outdoor-level.mjs")).href
  );
  await t.test(
    "level 2 is a separate outdoor scene with palms, burning cars and zombies",
    () => {
      const oldScene = game.scene;
      game.selectLevel("outbreak");
      assert.equal(oldScene.isDisposed, true);
      assert.equal(game.level.id, "outbreak");
      assert.equal(game.phase, "menu");
      assert.equal(game.world.doors.length, 0);
      assert.ok(game.scene.getLightByName("late-afternoon-sun"));
      assert.ok(game.scene.getMeshByName("outdoor-palm-leaf"));
      assert.equal(
        game.scene.meshes.filter((m) => m.name === "car-flame").length,
        28
      );
      assert.equal(
        game.scene.meshes.filter((m) => m.name === "car-smoke").length,
        20
      );
      assert.equal(game.enemies.length, 18);
      assert.ok(game.enemies.every((e) => e.root.name.startsWith("zombie-")));
      game.world.animate(3, 0.016);
      game.scene.render();
    }
  );
  await t.test(
    "the outdoor route, all zombies and supplies remain reachable around cars and palms",
    () => {
      const nav = outdoor.outdoorNavigation;
      for (const point of [
        outdoor.OUTDOOR_SPAWN,
        outdoor.OUTDOOR_EXIT,
        ...outdoor.OUTDOOR_ENEMIES,
        ...outdoor.OUTDOOR_PICKUPS,
      ]) {
        assert.ok(
          nav.canOccupy(point.x, point.z, 0.35),
          `blocked spawn: ${JSON.stringify(point)}`
        );
        if (point !== outdoor.OUTDOOR_SPAWN)
          assert.ok(
            nav.findPath(outdoor.OUTDOOR_SPAWN, point).length > 0,
            `unreachable: ${JSON.stringify(point)}`
          );
      }
      for (const point of [...outdoor.CARS, ...outdoor.PALMS])
        assert.equal(nav.canOccupy(point.x, point.z, 0.32), false);
      assert.equal(nav.canOccupy(-1, -1, 0.32), false);
    }
  );
  await t.test(
    "zombies chase and attack in melee without spawning projectiles",
    () => {
      restart();
      game.camera.position.set(21, 1.65, 75.4);
      tick(1.2);
      assert.ok(game.health < 100);
      assert.equal(game.projectiles.length, 0);
    }
  );
  await t.test(
    "zombies can be shot and the radio unlocks the safehouse",
    () => {
      restart();
      game.camera.position.set(21, 1.65, 78.2);
      game.camera.rotation.set(0, Math.PI, 0);
      game.scene.render();
      for (let i = 0; i < 2; i++) {
        game.shotTimer = 0;
        game.shoot();
      }
      assert.equal(game.kills, 1);
      const exit = outdoor.OUTDOOR_EXIT;
      game.camera.position.set(exit.x, 1.65, exit.z);
      game.updateInteraction();
      game.interact();
      assert.equal(game.phase, "playing");
      const radio = outdoor.OUTDOOR_PICKUPS.find((p) => p.kind === "card");
      game.camera.position.set(radio.x, 1.65, radio.z);
      tick(0.02);
      assert.equal(game.hasCard, true);
      game.camera.position.set(exit.x, 1.65, exit.z);
      game.updateInteraction();
      game.interact();
      assert.equal(game.phase, "transition");
      restart();
      assert.equal(game.level.id, "outbreak");
      assert.equal(game.reserve, 96);
      assert.equal(game.hasCard, false);
    }
  );
  await t.test(
    "switching back restores the original level 1 and its mission",
    () => {
      game.selectLevel("station");
      restart();
      assert.equal(game.enemies.length, 7);
      assert.ok(game.enemies.every((e) => e.root.name.startsWith("sentry-")));
      assert.equal(game.world.doors.length, 4);
      assert.equal(game.scene.materials.length, materials);
      assert.ok(Math.abs(game.camera.position.x - 15.4) < 1e-8);
      assert.ok(Math.abs(game.camera.position.z - 57.4) < 1e-8);
      assert.equal(game.reserve, 72);
      assert.equal(game.level.pickups.find((p) => p.kind === "card").x, 77);
    }
  );
  const lake = await import(
    pathToFileURL(resolve(output, "lake-level.mjs")).href
  );
  await t.test(
    "level 3 has a separate lakehouse, an upper floor, a pier and fourteen yellow rubber ducks",
    () => {
      game.selectLevel("lakehouse");
      restart();
      assert.equal(game.enemies.length, 14);
      assert.ok(
        game.enemies.every((e) => e.root.name.startsWith("rubber-duck-"))
      );
      assert.equal(
        game.world.materials.duckYellow.diffuseColor.toHexString(),
        "#FFCF22"
      );
      assert.ok(game.scene.getMeshByName("lake-red-roof"));
      assert.ok(game.scene.getMeshByName("lake-lake-water"));
      assert.ok(game.scene.getMeshByName("boat-key-ring"));
      game.scene.render();
      for (const point of [
        lake.LAKE_EXIT,
        ...lake.LAKE_PICKUPS,
        ...lake.LAKE_ENEMIES,
      ]) {
        assert.ok(
          lake.lakeNavigation.canOccupy(point.x, point.z, 0.36),
          `blocked lake spawn: ${JSON.stringify(point)}`
        );
        assert.ok(
          lake.lakeNavigation.findPath(lake.LAKE_SPAWN, point).length > 0,
          `unreachable lake spawn: ${JSON.stringify(point)}`
        );
      }
      assert.equal(
        lake.lakeNavigation.canOccupy(30, 83, 0.32),
        false,
        "open water is outside the walkable route"
      );
    }
  );
  await t.test("rubber ducks can be shot and attack at close range", () => {
    game.camera.position.set(46.2, 1.65, 23.8);
    game.camera.rotation.set(0.12, 0, 0);
    game.scene.render();
    for (let i = 0; i < 2; i++) {
      game.shotTimer = 0;
      game.shoot();
    }
    assert.equal(game.kills, 1);
    restart();
    game.camera.position.set(46.2, 1.65, 28.1);
    tick(1.3);
    assert.ok(game.health < 100);
    assert.equal(game.projectiles.length, 0);
  });
  await t.test(
    "the key requires going upstairs and the complete boat escape is walkable",
    () => {
      restart();
      for (const enemy of game.enemies) enemy.health = 0;
      const item = lake.LAKE_PICKUPS.find((p) => p.kind === "card");
      game.camera.position.set(item.x, 1.65, item.z);
      tick(0.03);
      assert.equal(game.hasCard, false);
      const walkTo = (point) => {
        game.camera.rotation.y = Math.atan2(
          point.x - game.camera.position.x,
          point.z - game.camera.position.z
        );
        key("keydown", "KeyW");
        let steps = 0;
        while (
          Math.hypot(
            point.x - game.camera.position.x,
            point.z - game.camera.position.z
          ) > 0.14 &&
          steps++ < 1400
        )
          tick(1 / 120);
        key("keyup", "KeyW");
        assert.ok(
          steps < 1400,
          `blocked walking to ${JSON.stringify(point)} at ${
            game.camera.position
          }`
        );
        tick(0.13);
      };
      game.camera.position.set(lake.STAIR_BOTTOM.x, 1.65, lake.STAIR_BOTTOM.z);
      walkTo(lake.STAIR_TOP);
      assert.ok(
        Math.abs(game.camera.position.y - 1.65 - lake.UPPER_FLOOR) < 0.02
      );
      walkTo({ x: 51.8, z: 60.2 });
      walkTo({ x: 51.8, z: 49 });
      walkTo({ x: 60.2, z: 49 });
      walkTo(item);
      assert.equal(game.hasCard, true);
      assert.equal(
        lake.lakeCanStand(56, 69.8, 3.4, 0.32),
        false,
        "upper balcony rail blocks movement"
      );
      assert.equal(
        lake.lakeCanStand(56, 69.8, 0, 0.32),
        true,
        "ground-level access below the balcony stays open"
      );
      walkTo({ x: 60.2, z: 49 });
      walkTo({ x: 51.8, z: 49 });
      walkTo(lake.STAIR_EXIT);
      walkTo(lake.STAIR_TOP);
      walkTo(lake.STAIR_BOTTOM);
      walkTo(lake.STAIR_APPROACH);
      assert.ok(Math.abs(game.camera.position.y - 1.65) < 0.1);
      walkTo({ x: 51.8, z: 40.6 });
      walkTo({ x: 51.8, z: 65.8 });
      walkTo({ x: 51.8, z: 77 });
      walkTo({ x: 51.8, z: 85.4 });
      walkTo(lake.LAKE_EXIT);
      game.updateInteraction();
      game.interact();
      assert.equal(game.phase, "transition");
    }
  );

  await t.test(
    "ducks use the staircase to pursue upstairs and cannot attack through the floor",
    () => {
      restart();
      for (const enemy of game.enemies) enemy.health = 0;
      const duck = game.enemies[0];
      duck.health = 68;
      duck.root.position.set(51.8, 0, 51.8);
      duck.active = true;
      game.camera.position.set(51.8, 5.05, 51.8);
      tick(0.5);
      assert.equal(game.health, 100);
      tick(32);
      assert.ok(
        duck.root.position.y > 3,
        `duck stuck at ${duck.root.position}`
      );
      assert.ok(
        game.health < 100,
        `duck cannot reach player from ${duck.root.position}`
      );
    }
  );
  const elapseTransition = (seconds) => {
    for (let i = 0; i < Math.ceil(seconds * 120); i++)
      game.advanceTransition(1 / 120);
  };
  const finishCurrent = () => {
    game.hasCard = true;
    game.camera.position.set(game.level.exit.x, 1.65, game.level.exit.z);
    game.updateInteraction();
    game.interact();
  };
  await t.test(
    "level 1 starts level 2 automatically, retaining mouse capture and replenishing supplies",
    () => {
      game.selectLevel("station");
      restart();
      const lock = document.pointerLockElement,
        requests = game.canvas.pointerRequests;
      finishCurrent();
      assert.equal(game.phase, "transition");
      assert.equal(game.diagnostics().nextLevelId, "outbreak");
      elapseTransition(1);
      assert.equal(game.level.id, "station");
      game.pause();
      const remaining = game.diagnostics().transitionSeconds;
      elapseTransition(10);
      assert.equal(game.diagnostics().transitionSeconds, remaining);
      game.resume();
      assert.equal(game.phase, "transition");
      const requestsAfterResume = game.canvas.pointerRequests;
      elapseTransition(2.1);
      assert.equal(game.level.id, "outbreak");
      assert.equal(game.phase, "playing");
      assert.equal(document.pointerLockElement, lock);
      assert.equal(game.canvas.pointerRequests, requestsAfterResume);
      assert.ok(requestsAfterResume >= requests);
      assert.equal(game.health, 100);
      assert.equal(game.ammo, 12);
      assert.equal(game.reserve, 96);
      assert.equal(game.hasCard, false);
    }
  );
  await t.test(
    "level 2 advances to Lakehouse, then bakery and office complete the campaign",
    () => {
      finishCurrent();
      assert.equal(game.phase, "transition");
      elapseTransition(3.1);
      assert.equal(game.level.id, "lakehouse");
      assert.equal(game.phase, "playing");
      assert.equal(game.enemies.length, 14);
      finishCurrent();
      assert.equal(game.phase, "transition");
      elapseTransition(3.1);
      assert.equal(game.level.id, "bakery");
      assert.equal(game.enemies.length, 12);
      assert.equal(game.ammo, 6);
      finishCurrent();
      assert.equal(game.phase, "transition");
      elapseTransition(3.1);
      assert.equal(game.level.id, "hippos");
      assert.equal(game.enemies.length, 6);
      game.selectLevel("office");restart();
      assert.equal(game.level.id, "office");
      assert.equal(game.ammo, 4);
      finishCurrent();
      assert.equal(game.phase, "won");
      assert.equal(document.pointerLockElement, null);
      elapseTransition(10);
      assert.equal(game.level.id, "office");
      assert.equal(game.diagnostics().nextLevelId, null);
    }
  );
  await t.test("level 4 cakes, syringe spread, reload and recipe escape work", async () => {
    const bakery = await import(pathToFileURL(resolve(output, "cake-level.mjs")).href);
    game.selectLevel("bakery");
    restart();
    assert.ok(game.enemies.every(e => e.root.name.startsWith("angry-cake-")));
    assert.ok(game.scene.getMeshByName("cake-angry-brow"));
    assert.ok(game.scene.getMeshByName("shotgun-barrel"));
    assert.equal(game.scene.getMeshByName("pistol-frame"), null);
    for (const point of [bakery.CAKE_EXIT, ...bakery.CAKE_PICKUPS, ...bakery.CAKE_ENEMIES]) {
      assert.ok(bakery.cakeNavigation.canOccupy(point.x, point.z, 0.35));
      assert.ok(bakery.cakeNavigation.findPath(bakery.CAKE_SPAWN, point).length > 0);
    }
    const cake = game.enemies[0];
    for (const enemy of game.enemies.slice(1)) enemy.health = 0;
    game.camera.position.set(cake.root.position.x, 1.25, cake.root.position.z + 4);
    game.camera.rotation.set(0, Math.PI, 0);
    game.scene.render();
    game.shoot();
    assert.equal(game.ammo, 5);
    assert.equal(game.projectiles.length, 7);
    assert.ok(game.projectiles.every(p => p.player && p.mesh.getChildMeshes().some(m => m.name === "syringe-needle")));
    game.shoot();
    assert.equal(game.ammo, 5, "pump cooldown prevents immediate repeated fire");
    tick(0.12);
    assert.equal(game.kills, 1, "close range syringe spread defeats a cake");
    assert.equal(game.health, 100, "player syringes cannot hit the player");
    game.reload();
    tick(2.2);
    assert.equal(game.ammo, 6);
    assert.equal(game.reserve, 35);
    restart();
    game.camera.position.set(bakery.CAKE_ENEMIES[0].x, 1.65, bakery.CAKE_ENEMIES[0].z + 0.9);
    tick(1.2);
    assert.ok(game.health < 100, "angry cakes attack at close range");
    assert.equal(game.projectiles.length, 0);
    game.camera.position.set(bakery.CAKE_EXIT.x, 1.65, bakery.CAKE_EXIT.z);
    game.updateInteraction();
    game.interact();
    assert.equal(game.phase, "playing", "recipe required for escape");
    const recipe = bakery.CAKE_PICKUPS.find(p => p.kind === "card");
    game.camera.position.set(recipe.x, 1.65, recipe.z);
    tick(0.02);
    assert.equal(game.hasCard, true);
    game.camera.position.set(bakery.CAKE_EXIT.x, 1.65, bakery.CAKE_EXIT.z);
    game.updateInteraction();
    game.interact();
    assert.equal(game.phase, "transition");
    game.selectLevel("station");
    restart();
    assert.equal(game.ammo, 12);
    assert.ok(game.scene.getMeshByName("pistol-frame"));
    assert.equal(game.scene.getMeshByName("shotgun-barrel"), null);
  });
  await t.test("baby hippos need exactly three carrots each and sleep peacefully", () => {
    game.selectLevel("hippos");restart();
    const carrotCount=game.ammo;
    assert.equal(game.enemies.length,6);
    assert.equal(game.scene.getMeshByName("pistol-frame"),null);
    for(const hippo of game.enemies){
      const p=hippo.root.position;
      game.camera.position.set(p.x,1.15,p.z+3);
      game.camera.rotation.set(0,Math.PI,0);
      for(let n=1;n<=3;n++){
        game.scene.render();game.shotTimer=0;game.shoot();
        assert.equal(hippo.health,3-n);
        assert.equal(game.kills,game.enemies.indexOf(hippo)+(n===3?1:0));
        assert.equal(game.phase,"playing");
      }
      assert.equal(hippo.health,0,"three carrots satisfy a hippo");
      tick(1.2);assert.equal(hippo.dying,1);
    }
    assert.ok(game.health>0);
    assert.equal(game.ammo,carrotCount,"unlimited carrots prevent running out");
    assert.equal(game.kills,6);assert.equal(game.phase,"won");
    restart();assert.equal(game.kills,0);assert.ok(game.enemies.every(e=>e.health===3&&e.dying===0));
    assert.ok(game.enemies.every(e=>e.root.getChildMeshes().filter(m=>m.name.startsWith("hippo-carrot-")&&m.isEnabled()).length===3));
  });
  await t.test("hungry hippos approach, hug on cooldown, and stop after three carrots", () => {
    game.selectLevel("hippos");restart();
    const hippo=game.enemies[0];
    for(const other of game.enemies.slice(1))other.health=0;
    const start=hippo.root.position.clone();
    game.camera.position.set(start.x,1.65,start.z+5);
    tick(1);
    assert.ok(hippo.root.position.z>start.z+1);
    assert.equal(game.health,100,"distant cuddles cannot cause damage");
    tick(1.3);assert.equal(game.health,92);
    tick(.5);assert.equal(game.health,92,"hug cooldown prevents damage every frame");
    tick(1.2);assert.equal(game.health,84);
    game.camera.rotation.set(.4,Math.PI,0);
    for(let i=0;i<3;i++){game.scene.render();game.shotTimer=0;game.shoot();}
    assert.equal(hippo.health,0);
    const health=game.health,position=hippo.root.position.clone();
    tick(4);assert.equal(game.health,health);
    assert.equal(hippo.root.position.x,position.x);assert.equal(hippo.root.position.z,position.z);
    restart();assert.equal(game.health,100);assert.ok(game.enemies.every(e=>e.health===3));
    for(let i=0;i<13;i++){
      const p=game.enemies[0].root.position;
      game.camera.position.set(p.x,1.65,p.z+1);
      game.enemies[0].cooldown=0;tick(1/120);
    }
    assert.equal(game.phase,"dead");
  });
  await t.test("office railgun kills robots, reloads, and robots attack on upper floors", () => {
    game.selectLevel("office");restart();
    const robot=game.enemies[0];
    game.camera.position.set(robot.root.position.x,1.65,robot.root.position.z+4);
    game.camera.rotation.set(0,Math.PI,0);game.scene.render();
    game.shoot();assert.equal(game.ammo,3);assert.equal(game.kills,1);
    assert.ok(game.scene.getMeshByName("railgun-beam"));
    game.reload();tick(1.9);assert.equal(game.ammo,4);
    restart();for(const enemy of game.enemies)enemy.health=0;
    const upper=game.enemies[6];upper.health=100;
    game.camera.position.set(upper.root.position.x,8.85,upper.root.position.z+.9);
    tick(1.3);assert.ok(game.health<100,"upper floor robots must attack");
    game.health=100;game.camera.position.y=5.25;tick(.5);
    assert.equal(game.health,100,"robots cannot attack through the floor");
  });
  await t.test("office stairs reach all three floors and return to the lobby exit", () => {
    game.selectLevel("office"); restart();
    assert.deepEqual(game.enemies.map(e=>e.root.position.y), [0,0,0,3.6,3.6,3.6,7.2,7.2,7.2]);
    for(const enemy of game.enemies)enemy.health=0;
    const walk=(x,z)=>{
      game.camera.rotation.y=Math.atan2(x-game.camera.position.x,z-game.camera.position.z);
      key("keydown","KeyW");
      let steps=0;
      while(Math.hypot(x-game.camera.position.x,z-game.camera.position.z)>.14&&steps++<2000)tick(1/120);
      key("keyup","KeyW");tick(.15);
      assert.ok(steps<2000, `blocked at ${game.camera.position} heading to ${x},${z}`);
    };
    walk(26.6,18.2);walk(21,18.2);walk(21,35);
    assert.ok(Math.abs(game.camera.position.y-5.25)<.05);
    walk(26.6,35);walk(26.6,18.2);walk(32.2,18.2);walk(32.2,35);
    assert.ok(Math.abs(game.camera.position.y-8.85)<.05);
    walk(40.6,35);walk(40.6,9.8);walk(26.6,9.8);
    assert.equal(game.hasCard,true);
    walk(40.6,9.8);walk(40.6,37.8);walk(32.2,37.8);walk(32.2,18.2);
    assert.ok(Math.abs(game.camera.position.y-5.25)<.05);
    walk(26.6,18.2);walk(26.6,37.8);walk(21,37.8);walk(21,18.2);
    assert.ok(Math.abs(game.camera.position.y-1.65)<.05);
    walk(26.6,18.2);walk(26.6,7);
    game.updateInteraction();game.interact();assert.equal(game.phase,"won");
  });
  await t.test(
    "returning to the menu cancels a pending automatic transition",
    () => {
      game.selectLevel("station");
      restart();
      finishCurrent();
      game.returnToMenu();
      elapseTransition(5);
      assert.equal(game.phase, "menu");
      assert.equal(game.level.id, "station");
      assert.equal(game.diagnostics().nextLevelId, null);
    }
  );
});
