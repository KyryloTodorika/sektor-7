import {
  Color3,
  Color4,
  DirectionalLight,
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
  VertexData,
} from "./babylon";
import { CELL, world } from "./level";
import {
  BARRICADES,
  LAMPS,
  CARS,
  OUTDOOR_DEPTH,
  OUTDOOR_EXIT,
  OUTDOOR_WIDTH,
  PALMS,
  outdoorGrid,
} from "./outdoor-level";
import type { World } from "./world";
const rgb = (hex: string) => Color3.FromHexString(hex);
export function createOutdoorWorld(scene: Scene): World {
  scene.clearColor = new Color4(0.43, 0.55, 0.58, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.008;
  scene.fogColor = rgb("#7a9292");
  const ambient = new HemisphericLight(
    "coastal-daylight",
    new Vector3(0, 1, 0),
    scene
  );
  ambient.intensity = 1.05;
  ambient.diffuse = rgb("#c0d3d5");
  ambient.groundColor = rgb("#4b4544");
  const sunLight = new DirectionalLight(
    "late-afternoon-sun",
    new Vector3(-0.55, -1, 0.35),
    scene
  );
  sunLight.intensity = 1.2;
  sunLight.diffuse = rgb("#f2cda0");
  const materials: Record<string, StandardMaterial> = {};
  function mat(name: string, hex: string, emission = 0, alpha = 1) {
    const m = new StandardMaterial(name, scene);
    m.diffuseColor = rgb(hex);
    m.specularColor = new Color3(0.04, 0.04, 0.04);
    m.maxSimultaneousLights = 6;
    m.alpha = alpha;
    if (emission) m.emissiveColor = rgb(hex).scale(emission);
    materials[name] = m;
    return m;
  }
  const asphalt = mat("asphalt", "#454d4d"),
    pavement = mat("pavement", "#9c9b88"),
    sand = mat("sand", "#a7a68c");
  const plaster = mat("plaster", "#a8afa0"),
    brick = mat("brick", "#a78a73"),
    paint = mat("paint", "#819d98"),
    roof = mat("roof", "#505958");
  const metal = mat("metal", "#6a7772"),
    trim = mat("trim", "#354a48"),
    dark = mat("dark", "#253637");
  const amber = mat("amber", "#f4b351", 1),
    white = mat("white", "#d6e2bd", 0.6),
    cyan = mat("cyan", "#7cdec5", 1),
    red = mat("red", "#d46241", 0.8);
  mat("enemy", "#8b9c7b");
  mat("enemyDark", "#3f4d45");
  mat("ammo", "#d3a346", 0.4);
  mat("health", "#76c5ac", 0.5);
  mat("card", "#80dbca", 1.1);
  mat("zombieSkin", "#8b9a73");
  mat("zombiePale", "#b4b292");
  mat("zombieShirt", "#83554b");
  mat("zombieBlue", "#637f7c");
  mat("zombiePants", "#39494d");
  mat("zombieBlood", "#6f302a");
  const wood = mat("palm-trunk", "#88775c"),
    leafGreen = mat("palm-leaf", "#506f47"),
    leafLight = mat("palm-leaf-light", "#6f8651");
  leafGreen.backFaceCulling = false;
  leafLight.backFaceCulling = false;
  const glass = mat("car-glass", "#2b454b"),
    tire = mat("tire", "#272c2c"),
    charcoal = mat("charcoal", "#393d39");
  const flameOrange = mat("flame-orange", "#ee6221", 1.7, 0.86),
    flameYellow = mat("flame-yellow", "#ffc05a", 1.5, 0.95),
    smokeMaterial = mat("smoke", "#424a49", 0.06, 0.2);
  flameOrange.disableLighting = true;
  flameYellow.disableLighting = true;
  smokeMaterial.disableLighting = true;
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
    m: StandardMaterial,
    parent?: TransformNode
  ) => {
    const mesh = MeshBuilder.CreateBox(
      name,
      { width: w, height: h, depth: d },
      scene
    );
    mesh.position.set(x, y, z);
    if (parent) mesh.parent = parent;
    return batch(mesh, m);
  };
  const cylinder = (
    name: string,
    x: number,
    y: number,
    z: number,
    height: number,
    bottom: number,
    top: number,
    m: StandardMaterial,
    tessellation = 8
  ) => {
    const mesh = MeshBuilder.CreateCylinder(
      name,
      { height, diameterBottom: bottom, diameterTop: top, tessellation },
      scene
    );
    mesh.position.set(x, y, z);
    return batch(mesh, m);
  };
  const grain = new DynamicTexture(
      "road-grain",
      { width: 128, height: 128 },
      scene,
      false,
      Texture.NEAREST_SAMPLINGMODE
    ),
    ctx = grain.getContext();
  ctx.fillStyle = "#9fa6a0";
  ctx.fillRect(0, 0, 128, 128);
  let seed = 71;
  for (let i = 0; i < 2200; i++) {
    seed = (seed * 16807) % 2147483647;
    const x = seed % 128;
    seed = (seed * 16807) % 2147483647;
    const z = seed % 128;
    ctx.fillStyle = `rgba(20,28,22,${0.1 + (seed % 12) / 100})`;
    ctx.fillRect(x, z, 1, 1);
  }
  grain.update();
  asphalt.diffuseTexture = grain;
  const floorAt = (x: number, z: number) => outdoorGrid[z]?.[x] === true;
  box("sand-foundation", 55, -0.21, 50, 145, 0.25, 135, sand);
  for (let z = 0; z < OUTDOOR_DEPTH; z++)
    for (let x = 0; x < OUTDOOR_WIDTH; x++) {
      const p = world(x, z),
        neighbors = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ];
      if (floorAt(x, z)) {
        const edge = neighbors.some(([dx, dz]) => !floorAt(x + dx, z + dz));
        box(
          edge ? "sidewalk" : "road",
          p.x,
          -0.045,
          p.z,
          CELL,
          0.09,
          CELL,
          edge ? pavement : asphalt
        );
      } else if (neighbors.some(([dx, dz]) => floorAt(x + dx, z + dz))) {
        if (x >= 36) {
          const fenceX = 36 * CELL + 0.02;
          box("seafront-post", fenceX, 1, p.z, 0.12, 2, 0.12, metal);
          box("seafront-rail", fenceX, 1.5, p.z, 0.08, 0.08, CELL, metal);
          box("seafront-rail", fenceX, 0.6, p.z, 0.08, 0.08, CELL, metal);
          continue;
        }
        const height =
            6.5 + ((Math.floor(x / 4) * 3 + Math.floor(z / 5) * 5) % 4) * 2.3,
          m = [plaster, brick, paint][
            (Math.floor(x / 5) + Math.floor(z / 6)) % 3
          ];
        box("coastal-building", p.x, height / 2, p.z, CELL, height, CELL, m);
        box(
          "flat-roof",
          p.x,
          height + 0.1,
          p.z,
          CELL + 0.14,
          0.23,
          CELL + 0.14,
          roof
        );
        for (const [dx, dz] of neighbors)
          if (floorAt(x + dx, z + dz)) {
            const fx = p.x + dx * (CELL / 2 + 0.025),
              fz = p.z + dz * (CELL / 2 + 0.025);
            box(
              "building-plinth",
              fx,
              0.35,
              fz,
              dx ? 0.12 : CELL,
              0.7,
              dz ? 0.12 : CELL,
              dark
            );
            for (let y = 3.1; y < height - 0.7; y += 2.4) {
              box(
                "window",
                fx,
                y,
                fz,
                dx ? 0.045 : 1.35,
                1.3,
                dz ? 0.045 : 1.35,
                glass
              );
              box(
                "window-sill",
                fx,
                y - 0.68,
                fz,
                dx ? 0.18 : 1.6,
                0.11,
                dz ? 0.18 : 1.6,
                white
              );
            }
            if ((x + z) % 3 === 0)
              box(
                "shuttered-shop",
                fx,
                1.3,
                fz,
                dx ? 0.06 : 1.8,
                1.8,
                dz ? 0.06 : 1.8,
                trim
              );
          }
      }
    }
  // Painted road lines remain legible between abandoned cars.
  for (let z = 54; z < 91; z += 4.5)
    box("boulevard-lane", 24, 0.012, z, 0.13, 0.024, 1.8, amber);
  for (let x = 20; x < 57; x += 4.5)
    box("square-lane", x, 0.012, 49, 1.8, 0.024, 0.13, white);
  for (let z = 21; z < 46; z += 4.5)
    box("avenue-lane", 57, 0.012, z, 0.13, 0.024, 1.8, amber);
  for (let x = 66; x < 99; x += 4.5)
    box("promenade-lane", x, 0.012, 21, 1.8, 0.024, 0.13, white);
  for (let i = 0; i < 8; i++)
    box("crosswalk", 19 + i * 0.7, 0.018, 59, 0.38, 0.025, 2.3, white);
  function sign(
    text: string,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    rotation = 0,
    bg = "#293b38",
    fg = "#f0deb3"
  ) {
    const texture = new DynamicTexture(
        `sign-${text}`,
        { width: 512, height: 128 },
        scene,
        false,
        Texture.BILINEAR_SAMPLINGMODE
      ),
      c = texture.getContext();
    c.fillStyle = bg;
    c.fillRect(0, 0, 512, 128);
    c.fillStyle = fg;
    c.font = "bold 45px monospace";
    c.fillText(text, 256 - c.measureText(text).width / 2, 80);
    texture.update();
    const m = new StandardMaterial(`sign-${text}`, scene);
    m.diffuseTexture = texture;
    m.emissiveColor = new Color3(0.35, 0.35, 0.3);
    m.specularColor = Color3.Black();
    const mesh = MeshBuilder.CreatePlane(
      `sign-${text}`,
      { width, height, sideOrientation: Mesh.DOUBLESIDE },
      scene
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotation;
    mesh.material = m;
    mesh.isPickable = false;
  }
  sign("PALM BOULEVARD", 30, 3.4, 75, 4.5, 0.9, -Math.PI / 2);
  sign("QUARANTINE", 17, 2.6, 85, 4, 0.9, Math.PI / 2, "#683c2e");
  sign("CHECKPOINT NORD", 54, 3.8, 20, 5, 1, Math.PI);
  sign("SAFEHOUSE  >", 76, 3.1, 14.04, 4.6, 0.9, Math.PI, "#304e43", "#b7e2b8");
  sign("HOTEL MIRAMAR", 93, 4.7, 44.7, 6, 1.3, 0, "#385c5c", "#f4dec2");
  // Palm fronds are curved low-poly ribbons, batched into two materials.
  PALMS.forEach((p, index) => {
    const lean = Math.sin(index * 2.3) * 0.3;
    for (let i = 0; i < 4; i++) {
      const trunk = cylinder(
        "palm-trunk",
        p.x + lean * i,
        0.7 + i * 1.35,
        p.z,
        1.5,
        0.48 - i * 0.07,
        0.42 - i * 0.07,
        wood,
        7
      );
      trunk.rotation.z = -lean * 0.3;
    }
    const crown = new Vector3(p.x + lean * 3, 5.6, p.z);
    for (let i = 0; i < 9; i++) {
      const a = (i * Math.PI * 2) / 9 + index * 0.7,
        dx = Math.cos(a),
        dz = Math.sin(a),
        ox = -dz * 0.4,
        oz = dx * 0.4;
      const positions = [
        crown.x,
        crown.y,
        crown.z,
        crown.x + dx * 1.5 + ox,
        crown.y + 0.15,
        crown.z + dz * 1.5 + oz,
        crown.x + dx * 3.7,
        crown.y - 1.1,
        crown.z + dz * 3.7,
        crown.x + dx * 1.5 - ox,
        crown.y + 0.15,
        crown.z + dz * 1.5 - oz,
      ];
      const data = new VertexData();
      data.positions = positions;
      data.indices = [0, 1, 3, 1, 2, 3];
      data.normals = [];
      VertexData.ComputeNormals(positions, data.indices, data.normals);
      const frond = new Mesh("palm-frond", scene);
      data.applyToMesh(frond);
      batch(frond, i % 2 ? leafGreen : leafLight);
    }
    for (let i = 0; i < 3; i++) {
      const nut = MeshBuilder.CreateSphere(
        "coconut",
        { diameter: 0.26, segments: 5 },
        scene
      );
      nut.position.set(
        crown.x + Math.cos(i * 2) * 0.23,
        crown.y - 0.3,
        crown.z + Math.sin(i * 2) * 0.23
      );
      batch(nut, wood);
    }
  });
  const flames: { mesh: Mesh; offset: number; base: number }[] = [],
    smoke: { mesh: Mesh; x: number; z: number; offset: number }[] = [],
    fireLights: PointLight[] = [];
  CARS.forEach((car, index) => {
    const root = new TransformNode("abandoned-car", scene);
    root.position.set(car.x, 0, car.z);
    root.rotation.y = car.yaw;
    const paintMaterial = mat(
      `car-paint-${index}`,
      car.burning ? "#494940" : car.color
    );
    box("car-body", 0, 0.65, 0, 1.9, 0.65, 4.3, paintMaterial, root);
    box("car-cabin", 0, 1.22, -0.15, 1.65, 0.65, 2.05, paintMaterial, root);
    box("windscreen", 0, 1.28, 0.9, 1.48, 0.47, 0.045, glass, root);
    box("rear-window", 0, 1.28, -1.2, 1.48, 0.4, 0.045, glass, root);
    for (const side of [-1, 1]) {
      box(
        "side-window",
        side * 0.84,
        1.28,
        -0.1,
        0.04,
        0.42,
        1.65,
        glass,
        root
      );
      box(
        "window-pillar",
        side * 0.87,
        1.28,
        -0.12,
        0.06,
        0.57,
        0.08,
        metal,
        root
      );
      box(
        "headlight",
        side * 0.62,
        0.76,
        2.17,
        0.42,
        0.24,
        0.04,
        car.burning ? charcoal : white,
        root
      );
      box("tail-light", side * 0.68, 0.75, -2.17, 0.3, 0.17, 0.04, red, root);
      for (const z of [-1.42, 1.42]) {
        const wheel = cylinder(
          "car-wheel",
          side * 0.95,
          0.4,
          z,
          0.2,
          0.72,
          0.72,
          tire,
          10
        );
        wheel.parent = root;
        wheel.rotation.z = Math.PI / 2;
      }
    }
    box("front-bumper", 0, 0.4, 2.18, 1.95, 0.16, 0.12, metal, root);
    box("rear-bumper", 0, 0.4, -2.18, 1.95, 0.16, 0.12, metal, root);
    if (car.burning) {
      box("burnt-hood", 0, 1.02, 1.45, 1.8, 0.045, 1.15, charcoal, root);
      const fx = car.x + Math.sin(car.yaw) * 1.25,
        fz = car.z + Math.cos(car.yaw) * 1.25;
      for (let i = 0; i < 7; i++) {
        const h = 0.8 + (i % 3) * 0.4,
          flame = MeshBuilder.CreateCylinder(
            "car-flame",
            { height: h, diameterBottom: 0.6, diameterTop: 0, tessellation: 4 },
            scene
          );
        flame.position.set(
          fx + Math.sin(i * 2.4) * 0.6,
          1 + h / 2,
          fz + Math.cos(i * 2.4) * 0.4
        );
        flame.material = i % 2 ? flameOrange : flameYellow;
        flame.isPickable = false;
        flames.push({
          mesh: flame,
          offset: index * 5 + i * 1.3,
          base: flame.position.y,
        });
      }
      for (let i = 0; i < 5; i++) {
        const puff = MeshBuilder.CreateSphere(
          "car-smoke",
          { diameter: 1.2, segments: 6 },
          scene
        );
        puff.material = smokeMaterial;
        puff.isPickable = false;
        smoke.push({ mesh: puff, x: fx, z: fz, offset: i * 1.1 + index });
      }
      const light = new PointLight(
        "fire-light",
        new Vector3(fx, 1.8, fz),
        scene
      );
      light.diffuse = rgb("#ff9c42");
      light.range = 10;
      light.intensity = 1.2;
      fireLights.push(light);
    }
  });
  // Barricades and supply cases make the street feel evacuated.
  BARRICADES.forEach((p, index) => {
    for (const side of [-1, 1]) {
      box("barrier-leg", p.x + side * 0.8, 0.5, p.z, 0.12, 1, 0.18, dark);
    }
    box("barrier-board", p.x, 1, p.z, 2, 0.5, 0.12, index % 2 ? amber : white);
  });
  for (const p of LAMPS) {
    cylinder("streetlamp", p.x, 2.7, p.z, 5.4, 0.12, 0.09, metal);
    box("streetlamp-arm", p.x + 0.6, 5.3, p.z, 1.3, 0.12, 0.12, metal);
    box("streetlamp-head", p.x + 1.1, 5.25, p.z, 0.7, 0.12, 0.35, white);
  }
  box(
    "ocean",
    153,
    -0.25,
    37,
    100,
    0.1,
    200,
    mat("ocean-material", "#507a80", 0.1)
  );
  const sun = MeshBuilder.CreateSphere(
    "hazy-sun",
    { diameter: 17, segments: 12 },
    scene
  );
  sun.position.set(110, 39, -100);
  sun.material = mat("sun-material", "#f1c59c", 1);
  sun.isPickable = false;
  const exit = new TransformNode("safehouse", scene);
  exit.position.set(OUTDOOR_EXIT.x, 0, OUTDOOR_EXIT.z);
  box("safehouse-pad", OUTDOOR_EXIT.x, 0.025, OUTDOOR_EXIT.z, 3, 0.05, 3, cyan);
  box("safehouse-door", OUTDOOR_EXIT.x, 1.55, 44.65, 2.8, 3.1, 0.13, trim);
  for (const side of [-1, 1])
    box(
      "safehouse-light",
      OUTDOOR_EXIT.x + side * 1.6,
      1.65,
      44.5,
      0.12,
      3.3,
      0.12,
      cyan
    );
  sign(
    "SAFEHOUSE",
    OUTDOOR_EXIT.x,
    3.7,
    44.48,
    3.5,
    0.7,
    0,
    "#2c5d4c",
    "#bcf2c3"
  );
  for (const [material, meshes] of batches) {
    const merged = Mesh.MergeMeshes(meshes, true, true);
    if (merged) {
      merged.name = `outdoor-${material.name}`;
      merged.material = material;
      merged.freezeWorldMatrix();
      merged.metadata = { solid: true };
    }
  }
  return {
    doors: [],
    exit,
    materials,
    animate: (time) => {
      for (const f of flames) {
        const flicker = Math.sin(time * 11 + f.offset);
        f.mesh.scaling.set(
          0.85 + flicker * 0.15,
          0.85 + Math.sin(time * 15 + f.offset) * 0.26,
          0.8 + flicker * 0.14
        );
        f.mesh.position.y = f.base + Math.sin(time * 7 + f.offset) * 0.1;
        f.mesh.rotation.y = time * 0.4 + f.offset;
      }
      for (const p of smoke) {
        const age = (time * 0.65 + p.offset) % 6;
        p.mesh.position.set(
          p.x + age * 0.38 + Math.sin(time + p.offset) * 0.17,
          2 + age,
          p.z + age * 0.12
        );
        p.mesh.scaling.setAll(0.65 + age * 0.22);
      }
      fireLights.forEach(
        (light, i) =>
          (light.intensity =
            1.1 + Math.sin(time * 13 + i) * 0.13 + Math.sin(time * 7 + i) * 0.1)
      );
    },
  };
}
