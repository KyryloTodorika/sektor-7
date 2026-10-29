import {
  Color3,
  Color4,
  DirectionalLight,
  DynamicTexture,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
  VertexData,
} from "./babylon";
import { CELL, world } from "./level";
import {
  LAKE_CAR,
  LAKE_DEPTH,
  LAKE_EXIT,
  LAKE_RAILINGS,
  LAKE_ROCKS,
  LAKE_TREES,
  LAKE_WIDTH,
  UPPER_FLOOR,
  lakeGrid,
} from "./lake-level";
import type { World } from "./world";
const rgb = (hex: string) => Color3.FromHexString(hex);
/** Original low-poly geometry inspired by CS:GO Lake's boathouse, yard and dock. */
export function createLakeWorld(scene: Scene): World {
  scene.clearColor = new Color4(0.64, 0.77, 0.82, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.0048;
  scene.fogColor = rgb("#b1c5c4");
  const sky = new HemisphericLight(
    "lake-daylight",
    new Vector3(0.2, 1, -0.2),
    scene
  );
  sky.diffuse = rgb("#d4e6e5");
  sky.groundColor = rgb("#68705c");
  sky.intensity = 0.95;
  const sun = new DirectionalLight(
    "lake-sun",
    new Vector3(-0.5, -1, 0.4),
    scene
  );
  sun.diffuse = rgb("#ffe2ad");
  sun.intensity = 1.15;
  const materials: Record<string, StandardMaterial> = {};
  function mat(name: string, hex: string, emission = 0) {
    const m = new StandardMaterial(name, scene);
    m.diffuseColor = rgb(hex);
    m.specularColor = new Color3(0.08, 0.08, 0.08);
    if (emission) m.emissiveColor = rgb(hex).scale(emission);
    materials[name] = m;
    return m;
  }
  const grass = mat("grass", "#81926a"),
    sand = mat("shore", "#b9ad87"),
    wood = mat("deck-wood", "#98866c"),
    siding = mat("white-siding", "#ddd7bc"),
    roof = mat("red-roof", "#89534a");
  const trim = mat("trim", "#5b7068"),
    metal = mat("metal", "#768680"),
    dark = mat("dark", "#293c3c"),
    glass = mat("lake-glass", "#497982"),
    concrete = mat("concrete", "#a3a494"),
    brick = mat("brick", "#9c6d57");
  const amber = mat("amber", "#f4b449", 0.7),
    cyan = mat("cyan", "#74cfc2", 0.7),
    white = mat("white", "#eff0d0", 0.3);
  mat("red", "#da794c", 0.5);
  mat("enemy", "#85957a");
  mat("enemyDark", "#3f524d");
  mat("ammo", "#d0a34e", 0.3);
  mat("health", "#75c9ad", 0.45);
  mat("card", "#f6c35b", 0.8);
  const duck = mat("duckYellow", "#ffcf22", 0.12);
  duck.specularColor = new Color3(0.55, 0.5, 0.25);
  duck.specularPower = 48;
  mat("duckWing", "#edb816", 0.07);
  mat("duckOrange", "#ed7b24", 0.08);
  mat("duckDark", "#222c29");
  const trunk = mat("pine-trunk", "#79634c"),
    pine = mat("pine-green", "#456a50"),
    pineTip = mat("pine-light", "#668262"),
    stone = mat("rock", "#8c9387");
  const water = mat("lake-water", "#548e99", 0.12);
  water.specularColor = new Color3(0.55, 0.65, 0.65);
  water.specularPower = 96;
  const wake = mat("water-ripple", "#a6c9c6", 0.2);
  wake.alpha = 0.3;
  const boatRubber = mat("boat-rubber", "#354e4b");
  function plankTexture(
    name: string,
    background: string,
    seam: string,
    horizontal: boolean
  ) {
    const texture = new DynamicTexture(
        name,
        { width: 128, height: 128 },
        scene,
        false,
        Texture.NEAREST_SAMPLINGMODE
      ),
      c = texture.getContext();
    c.fillStyle = background;
    c.fillRect(0, 0, 128, 128);
    c.fillStyle = seam;
    for (let i = 0; i < 128; i += 16) {
      if (horizontal) c.fillRect(0, i, 128, 2);
      else c.fillRect(i, 0, 2, 128);
    }
    let seed = 19;
    for (let i = 0; i < 450; i++) {
      seed = (seed * 16807) % 2147483647;
      const x = seed % 128;
      seed = (seed * 16807) % 2147483647;
      const y = seed % 128;
      c.fillStyle = "#3c473312";
      c.fillRect(x, y, horizontal ? 4 : 1, horizontal ? 1 : 4);
    }
    texture.update();
    return texture;
  }
  siding.diffuseTexture = plankTexture(
    "house-clapboard",
    "#e7e2c7",
    "#b9b9a1",
    true
  );
  wood.diffuseTexture = plankTexture(
    "pier-planks",
    "#bbab8b",
    "#827960",
    false
  );
  const batches = new Map<StandardMaterial, Mesh[]>();
  const batch = (mesh: Mesh, m: StandardMaterial) => {
    mesh.material = m;
    const meshes = batches.get(m) ?? [];
    meshes.push(mesh);
    batches.set(m, meshes);
    return mesh;
  };
  const box = (
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    m: StandardMaterial
  ) => {
    const mesh = MeshBuilder.CreateBox(
      name,
      { width: w, height: h, depth: d },
      scene
    );
    mesh.position.set(x, y, z);
    return batch(mesh, m);
  };
  const cylinder = (
    name: string,
    x: number,
    y: number,
    z: number,
    h: number,
    bottom: number,
    top: number,
    m: StandardMaterial,
    tess = 8
  ) => {
    const mesh = MeshBuilder.CreateCylinder(
      name,
      {
        height: h,
        diameterBottom: bottom,
        diameterTop: top,
        tessellation: tess,
      },
      scene
    );
    mesh.position.set(x, y, z);
    return batch(mesh, m);
  };
  const sphere = (
    name: string,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    m: StandardMaterial
  ) => {
    const mesh = MeshBuilder.CreateSphere(
      name,
      { diameter: 1, segments: 8 },
      scene
    );
    mesh.position.set(x, y, z);
    mesh.scaling.set(sx, sy, sz);
    return batch(mesh, m);
  };
  box("estate-ground", 50, -0.22, 39, 87, 0.36, 62, grass);
  box("sandy-waterline", 50, -0.16, 70, 87, 0.13, 2.3, sand);
  box("lake", 52, -0.47, 124, 200, 0.08, 150, water);
  const floorAt = (x: number, z: number) => lakeGrid[z]?.[x] === true;
  for (let z = 0; z < LAKE_DEPTH; z++)
    for (let x = 0; x < LAKE_WIDTH; x++) {
      const p = world(x, z);
      if (floorAt(x, z)) {
        if (z >= 25 || (x >= 15 && x <= 22 && z >= 13 && z <= 24)) {
          box("timber-floor", p.x, -0.1, p.z, CELL, 0.2, CELL, wood);
        } else if (x >= 7 && x <= 9 && z >= 15 && z <= 19)
          box("garage-floor", p.x, -0.08, p.z, CELL, 0.16, CELL, concrete);
        else if ((x >= 17 && x <= 20 && z <= 11) || z === 10)
          box("gravel-drive", p.x, -0.02, p.z, CELL, 0.04, CELL, sand);
      } else if (x >= 14 && x <= 23 && z >= 12 && z <= 22) {
        box("house-wall", p.x, 3.4, p.z, CELL, 6.8, CELL, siding);
        for (const [dx, dz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ])
          if (floorAt(x + dx, z + dz)) {
            const fx = p.x + dx * (CELL / 2 + 0.025),
              fz = p.z + dz * (CELL / 2 + 0.025);
            box(
              "house-skirt",
              fx,
              0.23,
              fz,
              dx ? 0.12 : CELL,
              0.46,
              dz ? 0.12 : CELL,
              trim
            );
            if ((x + z) % 2 === 0)
              for (const y of [1.95, 5.35]) {
                box(
                  "window-frame",
                  fx,
                  y,
                  fz,
                  dx ? 0.08 : 1.85,
                  1.65,
                  dz ? 0.08 : 1.85,
                  white
                );
                box(
                  "window-glass",
                  fx + dx * 0.05,
                  y,
                  fz + dz * 0.05,
                  dx ? 0.04 : 1.6,
                  1.4,
                  dz ? 0.04 : 1.6,
                  glass
                );
                box(
                  "window-cross",
                  fx + dx * 0.08,
                  y,
                  fz + dz * 0.08,
                  dx ? 0.025 : 0.055,
                  1.4,
                  dz ? 0.025 : 0.055,
                  white
                );
              }
          }
      } else if (x >= 6 && x <= 10 && z >= 14 && z <= 19) {
        box("garage-wall", p.x, 1.8, p.z, CELL, 3.6, CELL, siding);
      } else if (x >= 27 && x <= 31 && z >= 15 && z <= 20) {
        box("unfinished-wall", p.x, 0.6, p.z, CELL, 1.2, CELL, concrete);
      }
    }
  // Upstairs floor, open stairwell and lakeside balcony.
  box(
    "upstairs-floor",
    20 * CELL,
    UPPER_FLOOR - 0.1,
    17.5 * CELL,
    6 * CELL,
    0.2,
    9 * CELL,
    wood
  );
  box(
    "stair-landing",
    16 * CELL,
    UPPER_FLOOR - 0.1,
    21.5 * CELL,
    2 * CELL,
    0.2,
    CELL,
    wood
  );
  box(
    "lake-balcony",
    20 * CELL,
    UPPER_FLOOR - 0.1,
    23.5 * CELL,
    6 * CELL,
    0.2,
    3 * CELL,
    wood
  );
  for (let i = 0; i < 20; i++) {
    const top = ((i + 1) * UPPER_FLOOR) / 20;
    box(
      "stair-tread",
      16 * CELL,
      top / 2,
      14 * CELL + ((i + 0.5) * 7 * CELL) / 20,
      2 * CELL,
      top,
      (7 * CELL) / 20,
      wood
    );
  }
  for (const rail of LAKE_RAILINGS) {
    box(
      "balcony-handrail",
      rail.x,
      UPPER_FLOOR + 1.1,
      rail.z,
      rail.width,
      0.12,
      rail.depth,
      white
    );
    box(
      "balcony-lowrail",
      rail.x,
      UPPER_FLOOR + 0.35,
      rail.z,
      rail.width,
      0.08,
      rail.depth,
      white
    );
    const length = Math.max(rail.width, rail.depth),
      alongX = rail.width > rail.depth;
    for (let i = 0; i <= Math.ceil(length / 1.4); i++) {
      const t = i / Math.ceil(length / 1.4) - 0.5;
      box(
        "balcony-baluster",
        rail.x + (alongX ? t * length : 0),
        UPPER_FLOOR + 0.55,
        rail.z + (alongX ? 0 : t * length),
        0.09,
        1.1,
        0.09,
        white
      );
    }
  }
  for (const x of [48.1, 55.8, 63.7])
    for (const z of [63, 69.5])
      box("house-stilt", x, 1.5, z, 0.27, 3, 0.27, trim);
  box(
    "upper-ceiling",
    19 * CELL,
    6.8,
    17.5 * CELL,
    10 * CELL,
    0.15,
    11 * CELL,
    siding
  );
  const roofAngle = Math.atan2(2.5, 14),
    slope = Math.hypot(14, 2.5);
  const left = box(
    "lakehouse-red-roof",
    46.2,
    8.05,
    49,
    slope + 0.8,
    0.25,
    32.4,
    roof
  );
  left.rotation.z = roofAngle;
  const right = box(
    "lakehouse-red-roof",
    60.2,
    8.05,
    49,
    slope + 0.8,
    0.25,
    32.4,
    roof
  );
  right.rotation.z = -roofAngle;
  for (const z of [33.55, 64.45]) {
    const data = new VertexData();
    data.positions = [39.2, 6.8, z, 53.2, 9.3, z, 67.2, 6.8, z];
    data.indices = z > 50 ? [2, 1, 0] : [0, 1, 2];
    data.uvs = [0, 0, 0.5, 1, 1, 0];
    data.normals = [];
    VertexData.ComputeNormals(data.positions, data.indices, data.normals);
    const gable = new Mesh("lakehouse-gable", scene);
    data.applyToMesh(gable);
    batch(gable, siding);
  }
  box("chimney", 60.5, 8.6, 44.5, 1.3, 3.1, 1.4, brick);
  box("chimney-cap", 60.5, 10.2, 44.5, 1.55, 0.18, 1.65, dark);
  box(
    "garage-red-roof",
    8.5 * CELL,
    3.7,
    17 * CELL,
    5.5 * CELL,
    0.23,
    6.5 * CELL,
    roof
  );
  for (const x of [27.2 * CELL, 30.8 * CELL])
    for (const z of [15.2 * CELL, 19.8 * CELL])
      box("construction-column", x, 3.1, z, 0.3, 6.2, 0.3, concrete);
  for (const y of [3.1, 6.2]) {
    box(
      "construction-beam",
      29 * CELL,
      y,
      15.2 * CELL,
      3.8 * CELL,
      0.3,
      0.3,
      concrete
    );
    box(
      "construction-beam",
      29 * CELL,
      y,
      19.8 * CELL,
      3.8 * CELL,
      0.3,
      0.3,
      concrete
    );
    box(
      "construction-beam",
      27.2 * CELL,
      y,
      17.5 * CELL,
      0.3,
      0.3,
      4.8 * CELL,
      concrete
    );
    box(
      "construction-beam",
      30.8 * CELL,
      y,
      17.5 * CELL,
      0.3,
      0.3,
      4.8 * CELL,
      concrete
    );
  }
  // Pine trees, shoreline rocks and distant wooded banks.
  function tree(x: number, z: number, height = 7) {
    cylinder(
      "pine-trunk",
      x,
      height * 0.36,
      z,
      height * 0.72,
      0.45,
      0.24,
      trunk
    );
    for (let i = 0; i < 3; i++)
      cylinder(
        "pine-canopy",
        x,
        height * (0.46 + i * 0.19),
        z,
        height * 0.43,
        4.2 - i * 1.1,
        0.08,
        i % 2 ? pine : pineTip,
        7
      );
  }
  LAKE_TREES.forEach((p, i) => tree(p.x, p.z, 6.5 + (i % 3) * 0.8));
  for (let i = 0; i < 25; i++) {
    const x = -10 + i * 5.1;
    tree(x, 145 + Math.sin(i) * 8, 10 + (i % 4));
  }
  LAKE_ROCKS.forEach((p, i) => {
    const rock = sphere(
      "shore-boulder",
      p.x,
      0.55,
      p.z,
      p.radius * 2,
      1.5 + (i % 2) * 0.3,
      p.radius * 1.8,
      stone
    );
    rock.rotation.y = i * 0.8;
  });
  sphere("wooded-hill", 7, 4, 153, 90, 27, 47, pine);
  sphere("wooded-hill", 95, 5, 166, 98, 35, 55, pineTip);
  // Fences border the yard without closing the three house approaches.
  for (let x = 9; x <= 89; x += 3.2) {
    box("yard-fence-post", x, 0.65, 8.45, 0.13, 1.3, 0.13, wood);
    box("yard-fence-rail", x, 1.02, 8.45, 3.2, 0.1, 0.1, wood);
  }
  // The garage contains a parked compact car.
  box("garage-car", LAKE_CAR.x, 0.6, LAKE_CAR.z, 1.8, 0.65, 3.5, trim);
  box(
    "garage-car-cabin",
    LAKE_CAR.x,
    1.12,
    LAKE_CAR.z - 0.1,
    1.55,
    0.55,
    1.7,
    glass
  );
  for (const side of [-1, 1])
    for (const dz of [-1.15, 1.15])
      sphere(
        "car-wheel",
        LAKE_CAR.x + side * 0.85,
        0.33,
        LAKE_CAR.z + dz,
        0.35,
        0.65,
        0.65,
        dark
      );
  // Pier supports, bumpers and the escape boat.
  for (let z = 72; z <= 89; z += 4)
    for (const x of [50.55, 55.85]) {
      cylinder("pier-pile", x, -0.42, z, 2.2, 0.26, 0.24, wood);
      cylinder("pier-cap", x, 0.42, z, 0.12, 0.37, 0.37, dark);
    }
  for (const x of [46.2, 65.8])
    cylinder("pier-pile", x, -0.42, 87.8, 2.2, 0.26, 0.24, wood);
  const boatX = LAKE_EXIT.x,
    boatZ = LAKE_EXIT.z + 3.4;
  sphere("escape-boat-hull", boatX, -0.08, boatZ, 5.6, 0.65, 2.6, boatRubber);
  box("escape-boat-deck", boatX, 0.14, boatZ, 4.2, 0.14, 1.75, wood);
  for (const side of [-1, 1])
    sphere(
      "inflatable-boat-tube",
      boatX,
      0.15,
      boatZ + side * 1.02,
      5.4,
      0.55,
      0.55,
      boatRubber
    );
  box("outboard-motor", boatX - 2.7, 0.35, boatZ, 0.55, 0.9, 0.5, dark);
  box("boarding-marker", LAKE_EXIT.x, 0.025, LAKE_EXIT.z, 2.3, 0.05, 2.2, cyan);
  function sign(
    text: string,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    rotation = 0
  ) {
    const texture = new DynamicTexture(
        `lake-sign-${text}`,
        { width: 512, height: 128 },
        scene,
        false,
        Texture.BILINEAR_SAMPLINGMODE
      ),
      c = texture.getContext();
    c.fillStyle = "#32473c";
    c.fillRect(0, 0, 512, 128);
    c.fillStyle = "#e8d9ad";
    c.font = "bold 43px monospace";
    c.fillText(text, 256 - c.measureText(text).width / 2, 82);
    texture.update();
    const m = new StandardMaterial("lake-sign", scene);
    m.diffuseTexture = texture;
    m.emissiveColor = new Color3(0.25, 0.25, 0.2);
    const mesh = MeshBuilder.CreatePlane(
      "lake-sign",
      { width, height, sideOrientation: Mesh.DOUBLESIDE },
      scene
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotation;
    mesh.material = m;
    mesh.isPickable = false;
  }
  sign("LAKEHOUSE", 53.2, 6.15, 33.54, 5, 0.9, Math.PI);
  sign("BOOT / STEG", 53.2, 2.3, 64.5, 3.5, 0.7);
  sign("ABFAHRT", LAKE_EXIT.x, 1.4, LAKE_EXIT.z + 1.3, 2.8, 0.65);
  sign("GARAGE", 23.8, 3.1, 55.95, 3, 0.65);
  sign("PRIVATE PROPERTY", 53.2, 1.8, 11, 4, 0.7, Math.PI);
  const ripples: Mesh[] = [];
  for (let i = 0; i < 14; i++) {
    const r = MeshBuilder.CreateBox(
      "lake-ripple",
      { width: 3 + (i % 4), height: 0.015, depth: 0.055 },
      scene
    );
    r.position.set(28 + ((i * 7.2) % 68), -0.4, 75 + ((i * 5.3) % 50));
    r.material = wake;
    r.isPickable = false;
    ripples.push(r);
  }
  for (const [material, meshes] of batches) {
    const merged = Mesh.MergeMeshes(meshes, true, true);
    if (merged) {
      merged.name = `lake-${material.name}`;
      merged.material = material;
      merged.freezeWorldMatrix();
      merged.metadata = { solid: true };
    }
  }
  const exit = new TransformNode("escape-boat-exit", scene);
  exit.position.set(LAKE_EXIT.x, 0, LAKE_EXIT.z);
  return {
    doors: [],
    exit,
    materials,
    animate: (time) => {
      ripples.forEach((r, i) => {
        r.position.y = -0.4 + Math.sin(time * 0.7 + i) * 0.02;
        r.scaling.x = 1 + Math.sin(time * 0.4 + i) * 0.13;
      });
    },
  };
}
