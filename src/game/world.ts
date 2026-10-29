import {
  Color3,
  Color4,
  DynamicTexture,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  PointLight,
  Scene,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
} from "./babylon";
import {
  CELL,
  CRATE_TILES,
  DEPTH,
  DOORS,
  EXIT,
  HEIGHT,
  WIDTH,
  floorAt,
  grid,
  world,
} from "./level";
import type { DoorDefinition } from "./level";
export interface Door {
  definition: DoorDefinition;
  mesh: Mesh;
  openness: number;
  target: number;
}
export interface World {
  doors: Door[];
  exit: TransformNode;
  materials: Record<string, StandardMaterial>;
  animate: (time: number, dt: number) => void;
}
const color = (hex: string) => Color3.FromHexString(hex);
export function createWorld(scene: Scene): World {
  scene.clearColor = new Color4(0.035, 0.065, 0.071, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.017;
  scene.fogColor = color("#152627");
  scene.ambientColor = color("#8aa2a0");
  const ambient = new HemisphericLight(
    "ambient",
    new Vector3(0.2, 1, 0.4),
    scene
  );
  ambient.intensity = 0.8;
  ambient.diffuse = color("#a4bbbc");
  ambient.groundColor = color("#39433b");
  const materials: Record<string, StandardMaterial> = {};
  const mat = (name: string, hex: string, emission = 0) => {
    const m = new StandardMaterial(name, scene);
    m.diffuseColor = color(hex);
    m.specularColor = new Color3(0.06, 0.07, 0.06);
    if (emission) m.emissiveColor = color(hex).scale(emission);
    materials[name] = m;
    return m;
  };
  const wall = mat("wall", "#89958b"),
    floor = mat("floor", "#65726a"),
    ceiling = mat("ceiling", "#354a48");
  const trim = mat("trim", "#243b3a"),
    metal = mat("metal", "#495b58"),
    dark = mat("dark", "#172a2b");
  const amber = mat("amber", "#edaa57", 0.9),
    cyan = mat("cyan", "#62c4b3", 1.2),
    red = mat("red", "#e06c47", 1.2),
    white = mat("white", "#b9dacd", 1);
  mat("enemy", "#87998a");
  mat("enemyDark", "#2a3938");
  mat("ammo", "#cfa34f", 0.2);
  mat("health", "#75c2ac", 0.5);
  mat("card", "#75c9d0", 1.3);
  function texture(name: string, isFloor = false) {
    const t = new DynamicTexture(
      name,
      { width: 128, height: 128 },
      scene,
      false,
      Texture.NEAREST_SAMPLINGMODE
    );
    const c = t.getContext();
    c.fillStyle = isFloor ? "#7e8c83" : "#a9afa0";
    c.fillRect(0, 0, 128, 128);
    let seed = 47;
    for (let i = 0; i < 1600; i++) {
      seed = (seed * 16807) % 2147483647;
      const x = seed % 128;
      seed = (seed * 16807) % 2147483647;
      const y = seed % 128;
      c.fillStyle = `rgba(0,17,15,${0.02 + (seed % 8) / 100})`;
      c.fillRect(x, y, 1 + (seed % 3), 1);
    }
    c.strokeStyle = isFloor ? "#4b5c56" : "#5c6e65";
    c.lineWidth = isFloor ? 3 : 2;
    c.strokeRect(0, 0, 128, 128);
    if (isFloor) {
      c.strokeStyle = "#697a6f";
      c.lineWidth = 1;
      for (let i = 12; i < 128; i += 13) {
        c.beginPath();
        c.moveTo(i, 4);
        c.lineTo(i, 124);
        c.stroke();
      }
    } else {
      c.fillStyle = "#788a7c";
      c.fillRect(5, 92, 118, 5);
      c.fillStyle = "#5b6f65";
      c.fillRect(5, 98, 118, 2);
      for (const x of [8, 120])
        for (const y of [8, 120]) {
          c.fillStyle = "#425a50";
          c.fillRect(x, y, 2, 2);
        }
    }
    t.update();
    return t;
  }
  wall.diffuseTexture = texture("wall-panels");
  floor.diffuseTexture = texture("floor-grate", true);
  const batches = new Map<StandardMaterial, Mesh[]>();
  const box = (
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    m: StandardMaterial,
    batch = true
  ) => {
    const mesh = MeshBuilder.CreateBox(
      name,
      { width: w, height: h, depth: d },
      scene
    );
    mesh.position.set(x, y, z);
    mesh.material = m;
    mesh.isPickable = true;
    if (batch) {
      const meshes = batches.get(m) ?? [];
      meshes.push(mesh);
      batches.set(m, meshes);
    }
    return mesh;
  };
  for (let z = 0; z < DEPTH; z++)
    for (let x = 0; x < WIDTH; x++) {
      const p = world(x, z);
      if (grid[z][x]) {
        box("floor", p.x, -0.12, p.z, CELL, 0.24, CELL, floor);
        box("ceiling", p.x, HEIGHT + 0.1, p.z, CELL, 0.2, CELL, ceiling);
        if ((x + z) % 4 === 0) {
          box("ceiling-channel", p.x, HEIGHT - 0.1, p.z, 0.13, 0.2, CELL, trim);
        }
      } else if (
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dz]) => floorAt(x + dx, z + dz))
      ) {
        box("wall", p.x, HEIGHT / 2, p.z, CELL, HEIGHT, CELL, wall);
        for (const [dx, dz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ])
          if (floorAt(x + dx, z + dz)) {
            const sx = p.x + dx * (CELL / 2 + 0.015),
              sz = p.z + dz * (CELL / 2 + 0.015);
            box(
              "wall-base",
              sx,
              0.2,
              sz,
              dx ? 0.07 : CELL,
              0.4,
              dz ? 0.07 : CELL,
              trim
            );
            box(
              "wall-stripe",
              sx,
              1.05,
              sz,
              dx ? 0.04 : CELL,
              0.16,
              dz ? 0.04 : CELL,
              metal
            );
            box(
              "wall-cap",
              sx,
              3.3,
              sz,
              dx ? 0.15 : CELL,
              0.22,
              dz ? 0.15 : CELL,
              trim
            );
          }
      }
    }
  function lamp(
    tx: number,
    tz: number,
    tint: StandardMaterial = white,
    light = false
  ) {
    const p = world(tx, tz);
    box("light-casing", p.x, 3.64, p.z, 1.65, 0.17, 0.46, dark);
    box("ceiling-light", p.x, 3.53, p.z, 1.45, 0.04, 0.23, tint);
    if (light) {
      const l = new PointLight("room-light", new Vector3(p.x, 2.8, p.z), scene);
      l.diffuse = tint.diffuseColor;
      l.intensity = 0.8;
      l.range = 13;
    }
  }
  [
    [4, 20],
    [8, 20],
    [5, 13],
    [4, 7],
    [9, 7],
    [9, 11],
    [14, 9],
    [21, 5],
    [26, 5],
    [21, 10],
    [26, 10],
    [24, 13],
    [21, 20],
    [26, 20],
    [12, 19],
    [16, 19],
  ].forEach(([x, z], i) =>
    lamp(x, z, i % 4 === 0 ? amber : white, i % 4 === 0)
  );
  const label = (
    name: string,
    text: string,
    w: number,
    h: number,
    background = "#1c3534",
    foreground = "#c7d5bd"
  ) => {
    const texture = new DynamicTexture(
      name,
      { width: 512, height: 128 },
      scene,
      false,
      Texture.BILINEAR_SAMPLINGMODE
    );
    const c = texture.getContext();
    c.fillStyle = background;
    c.fillRect(0, 0, 512, 128);
    c.fillStyle = foreground;
    c.font = "bold 54px monospace";
    c.fillText(text, 256 - c.measureText(text).width / 2, 83);
    texture.update();
    const m = new StandardMaterial(`${name}-material`, scene);
    m.diffuseTexture = texture;
    m.emissiveColor = new Color3(0.3, 0.4, 0.35);
    m.specularColor = Color3.Black();
    const mesh = MeshBuilder.CreatePlane(
      name,
      { width: w, height: h, sideOrientation: Mesh.DOUBLESIDE },
      scene
    );
    mesh.material = m;
    mesh.isPickable = false;
    return mesh;
  };
  // The arrival room's back wall and first corridor establish the station's visual language.
  let sign = label("sector-label", "SEKTOR 07", 4.4, 1.1);
  sign.position.set(22.4, 2.35, 50.45);
  sign.rotation.y = Math.PI;
  sign = label("arrival-label", "B-07 / WARTUNG", 3.8, 0.9);
  sign.position.set(17, 2.5, 64.35);
  sign = label("reactor-label", "A-01 / REAKTOR", 4.6, 1.1);
  sign.position.set(19.5, 2.5, 14.05);
  sign.rotation.y = Math.PI;
  sign = label("laboratory-label", "C-02 / SICHERHEIT", 5, 1);
  sign.position.set(65.8, 2.5, 8.45);
  sign.rotation.y = Math.PI;
  sign = label("exit-label", "AUSGANG  >", 4, 0.9, "#23463d", "#9fddb5");
  sign.position.set(EXIT.x + 0.2, 2.9, 64.35);
  // The positions of solid props are shared with collision and navigation in level.ts.
  function crate(tx: number, tz: number, scale = 1) {
    const p = world(tx, tz);
    const root = box(
      "crate",
      p.x,
      0.55 * scale,
      p.z,
      1.2 * scale,
      1.1 * scale,
      1.2 * scale,
      metal
    );
    root.rotation.y = 0.07;
    for (const side of [-1, 1]) {
      box(
        "crate-band",
        p.x + side * 0.45 * scale,
        0.56 * scale,
        p.z,
        0.08 * scale,
        1.15 * scale,
        1.22 * scale,
        trim
      );
    }
    box(
      "crate-mark",
      p.x,
      0.6 * scale,
      p.z - 0.61 * scale,
      0.4 * scale,
      0.18 * scale,
      0.015,
      amber
    );
  }
  CRATE_TILES.forEach(([x, z]) => crate(x, z));
  const consolePosition = world(26, 3);
  box(
    "console",
    consolePosition.x,
    0.63,
    consolePosition.z,
    3.5,
    1.25,
    1.2,
    dark
  );
  box(
    "console-top",
    consolePosition.x,
    1.28,
    consolePosition.z,
    3.65,
    0.12,
    1.35,
    metal
  );
  for (let i = 0; i < 3; i++) {
    const screen = box(
      "terminal-screen",
      consolePosition.x - 1.1 + i * 1.1,
      1.85,
      consolePosition.z,
      0.85,
      0.68,
      0.12,
      cyan
    );
    const display = label(
      `terminal-${i}`,
      i === 1 ? "LOCKDOWN" : "SYS_07",
      0.75,
      0.19,
      "#143e38",
      "#91d8c0"
    );
    display.position.set(screen.position.x, 1.87, screen.position.z - 0.066);
  }
  // Central reactor: deliberately simple geometry, strong silhouette and emissive rings.
  const reactor = world(7, 8);
  const core = MeshBuilder.CreateCylinder(
    "reactor",
    { height: 3.4, diameter: 2.3, tessellation: 12 },
    scene
  );
  core.position.set(reactor.x, 1.7, reactor.z);
  core.material = metal;
  core.isPickable = true;
  for (const y of [0.35, 1.2, 2.3, 3.3]) {
    const ring = MeshBuilder.CreateTorus(
      "reactor-ring",
      { diameter: 2.4, thickness: 0.09, tessellation: 24 },
      scene
    );
    ring.position.set(reactor.x, y, reactor.z);
    ring.material = cyan;
    ring.isPickable = false;
  }
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    box(
      "reactor-guard",
      reactor.x + Math.sin(angle) * 1.23,
      1.7,
      reactor.z + Math.cos(angle) * 1.23,
      0.14,
      3.5,
      0.14,
      dark
    );
  }
  const reactorLight = new PointLight(
    "reactor-light",
    new Vector3(reactor.x, 2, reactor.z),
    scene
  );
  reactorLight.diffuse = color("#70b6ab");
  reactorLight.intensity = 0.65;
  reactorLight.range = 12;
  // Doors rise into the ceiling and are also represented in collision/navigation data.
  const doors = DOORS.map((definition) => {
    const horizontal = definition.axis === "x";
    const mesh = box(
      `door-${definition.id}`,
      definition.x,
      1.65,
      definition.z,
      horizontal ? definition.width : 0.32,
      3.3,
      horizontal ? 0.32 : definition.width,
      metal,
      false
    );
    const stripe = MeshBuilder.CreateBox(
      "door-stripe",
      {
        width: horizontal ? definition.width : 0.34,
        height: 0.22,
        depth: horizontal ? 0.34 : definition.width,
      },
      scene
    );
    stripe.parent = mesh;
    stripe.position.y = -0.2;
    stripe.material = amber;
    const doorLabel = label(
      `label-${definition.id}`,
      definition.label,
      Math.min(3.5, definition.width - 0.4),
      0.5
    );
    doorLabel.parent = mesh;
    doorLabel.position.set(0, 0.7, -0.18);
    if (!horizontal) {
      doorLabel.rotation.y = -Math.PI / 2;
      doorLabel.position.set(-0.18, 0.7, 0);
    }
    box(
      "door-header",
      definition.x,
      3.55,
      definition.z,
      horizontal ? definition.width + 0.2 : 0.55,
      0.35,
      horizontal ? 0.55 : definition.width + 0.2,
      dark
    );
    for (const sign of [-1, 1])
      box(
        "door-jamb",
        definition.x + (horizontal ? (sign * definition.width) / 2 : 0),
        1.7,
        definition.z + (horizontal ? 0 : (sign * definition.width) / 2),
        0.18,
        3.4,
        0.18,
        dark
      );
    return { definition, mesh, openness: 0, target: 0 };
  });
  const exit = new TransformNode("extraction", scene);
  exit.position.set(EXIT.x, 0, EXIT.z);
  const exitPad = box(
    "extraction-pad",
    EXIT.x,
    0.025,
    EXIT.z,
    2.2,
    0.05,
    2.2,
    cyan
  );
  exitPad.isPickable = false;
  for (const side of [-1, 1])
    box(
      "extraction-marker",
      EXIT.x + side * 1.25,
      1.1,
      EXIT.z,
      0.08,
      2.2,
      0.08,
      cyan
    );
  for (const [material, meshes] of batches) {
    const merged = Mesh.MergeMeshes(meshes, true, true);
    if (merged) {
      merged.name = `static-${material.name}`;
      merged.material = material;
      merged.freezeWorldMatrix();
      merged.metadata = { solid: true };
    }
  }
  return {
    doors,
    exit,
    materials,
    animate: (time, dt) => {
      for (const door of doors) {
        door.openness += (door.target - door.openness) * Math.min(1, dt * 4.5);
        door.mesh.position.y = 1.65 + door.openness * 3.65;
      }
      reactorLight.intensity = 0.6 + Math.sin(time * 1.7) * 0.08;
    },
  };
}
