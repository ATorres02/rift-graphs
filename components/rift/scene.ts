/**
 * The Rift in low-poly 3D (three.js): arena with lanes, river, jungle walls,
 * towers, bases, Dragon and Baron, inside a dark stadium whose stands are blue
 * on one half and red on the other. Loaded lazily by `rift-3d.tsx`.
 *
 * Everything is built from primitives: no Riot assets.
 */
import * as THREE from "three";
import { MARKERS, type MarkerKind } from "./layout";

export interface RiftScene {
  resize(width: number, height: number): void;
  setPointer(nx: number, ny: number): void;
  /** Screen position (CSS px within the canvas) of a marker, or null when it is behind the camera. */
  project(kind: MarkerKind): { x: number; y: number } | null;
  setReducedMotion(on: boolean): void;
  dispose(): void;
}

const P = (x: number, y: number) => new THREE.Vector3(x - 50, 0, y - 50);
const M = (x: number, y: number): [number, number] => [100 - x, 100 - y];
const mat = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, flatShading: true, ...extra });
const hash = (x: number, z: number) => (((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1) + 1) % 1;

export function createRiftScene(canvas: HTMLCanvasElement, width: number, height: number): RiftScene {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x07080c, 150, 280);
  const camera = new THREE.PerspectiveCamera(38, width / height, 1, 600);
  const camAngle = 54;
  const camDist = 185;
  const baseCam = () =>
    new THREE.Vector3(
      0,
      Math.sin((camAngle * Math.PI) / 180) * camDist,
      Math.cos((camAngle * Math.PI) / 180) * camDist,
    );
  camera.position.copy(baseCam());
  camera.lookAt(0, 0, 4);

  scene.add(new THREE.HemisphereLight(0x8fb3ff, 0x1a2a1f, 0.8));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.1);
  sun.position.set(-60, 90, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80 });
  sun.shadow.bias = -0.0008;
  scene.add(sun);

  // ---------------------------------------------------------------- ground
  const groundGeo = new THREE.PlaneGeometry(112, 112, 96, 96);
  groundGeo.rotateX(-Math.PI / 2);
  const pos = groundGeo.attributes.position;
  const colors: number[] = [];
  const cGrass = new THREE.Color(0x2f6b45);
  const cJungle = new THREE.Color(0x1e4a33);
  const cEdge = new THREE.Color(0x18301f);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + 50;
    const z = pos.getZ(i) + 50;
    pos.setY(i, (Math.sin(x * 0.35) * Math.cos(z * 0.3) + Math.sin((x + z) * 0.12)) * 0.12 + (hash(x, z) - 0.5) * 0.14);
    const blueTop = x < z && x + z < 100 && x > 12 && x < 48;
    const blueBot = x > z && x + z > 100 && z > 52 && z < 88;
    const redTop = x < z && x + z > 100 && x > 52 && x < 88;
    const redBot = x > z && x + z < 100 && z > 12 && z < 48;
    const c =
      blueTop || blueBot || redTop || redBot
        ? cJungle.clone().lerp(cGrass, hash(x * 3, z * 3) * 0.5)
        : cGrass.clone().lerp(cEdge, 0.15);
    colors.push(c.r, c.g, c.b);
  }
  groundGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(
    groundGeo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }),
  );
  ground.receiveShadow = true;
  scene.add(ground);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshStandardMaterial({ color: 0x05070b, roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.2;
  floor.receiveShadow = true;
  scene.add(floor);

  // ---------------------------------------------------------------- ribbons (river, lanes)
  const laneMat = new THREE.MeshStandardMaterial({ color: 0xd8c59b, roughness: 0.95, side: THREE.DoubleSide });
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x1f6fc0,
    roughness: 0.15,
    metalness: 0.2,
    transparent: true,
    opacity: 0.92,
    emissive: 0x0b2d55,
    emissiveIntensity: 0.6,
    side: THREE.DoubleSide,
  });
  function ribbon(points: [number, number][], w: number, y: number, material: THREE.Material) {
    const curve = new THREE.CatmullRomCurve3(
      points.map(([x, z]) => P(x, z)),
      false,
      "catmullrom",
      0,
    );
    const n = 160;
    const verts: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = curve.getPoint(t);
      const tan = curve.getTangent(t);
      const nx = -tan.z;
      const nz = tan.x;
      verts.push(p.x + (nx * w) / 2, y, p.z + (nz * w) / 2, p.x - (nx * w) / 2, y, p.z - (nz * w) / 2);
      if (i < n) {
        const a = i * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, material);
    m.receiveShadow = true;
    scene.add(m);
  }
  const riverPts: [number, number][] = [
    [9, 9],
    [20, 22],
    [30, 33],
    [40, 41],
    [50, 50],
    [60, 59],
    [70, 67],
    [80, 78],
    [91, 91],
  ];
  ribbon(riverPts, 12, 0.5, mat(0x0f2e4a, { side: THREE.DoubleSide }));
  ribbon(riverPts, 9.5, 0.58, waterMat);
  ribbon(
    [
      [14, 86],
      [14, 60],
      [14, 20],
      [17, 15],
      [22, 14],
      [60, 14],
      [86, 14],
    ],
    5.6,
    0.62,
    laneMat,
  );
  ribbon(
    [
      [14, 86],
      [86, 14],
    ],
    5.6,
    0.62,
    laneMat,
  );
  ribbon(
    [
      [14, 86],
      [40, 86],
      [78, 86],
      [83, 85],
      [86, 80],
      [86, 40],
      [86, 14],
    ],
    5.6,
    0.62,
    laneMat,
  );

  // ---------------------------------------------------------------- jungle walls (approximate real pockets), pits, camps, bushes
  const wallMat = mat(0x2b5a3e, { roughness: 1 });
  const wallTop = mat(0x3f7a52);
  function wall(poly: [number, number][], h = 2) {
    for (const pts of [poly, poly.map(([x, y]) => M(x, y))]) {
      const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
      const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
      const shape = new THREE.Shape();
      pts.forEach(([x, y], i) => {
        const sx = cx + (x - cx) * 0.82 - 50;
        const sy = cy + (y - cy) * 0.82 - 50;
        if (i) shape.lineTo(sx, sy);
        else shape.moveTo(sx, sy);
      });
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: h,
        bevelEnabled: true,
        bevelThickness: 0.5,
        bevelSize: 0.5,
        bevelSegments: 1,
      });
      geo.rotateX(Math.PI / 2);
      geo.translate(0, h, 0);
      const m = new THREE.Mesh(geo, [wallTop, wallMat]);
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
    }
  }
  wall([
    [18, 26],
    [23, 25],
    [25, 31],
    [22, 36],
    [18, 35],
  ]);
  wall([
    [22, 40],
    [29, 39],
    [31, 45],
    [27, 50],
    [21, 48],
    [19, 43],
  ]);
  wall([
    [30, 52],
    [37, 54],
    [40, 60],
    [34, 63],
    [29, 58],
  ]);
  wall([
    [30, 28],
    [36, 26],
    [39, 31],
    [33, 34],
  ]);
  wall([
    [44, 64],
    [50, 62],
    [53, 67],
    [48, 71],
    [43, 69],
  ]);
  wall([
    [52, 72],
    [60, 71],
    [63, 76],
    [59, 82],
    [53, 81],
    [50, 76],
  ]);
  wall([
    [62, 84],
    [70, 83],
    [71, 88],
    [63, 89],
  ]);
  wall([
    [64, 60],
    [70, 58],
    [73, 63],
    [67, 66],
  ]);
  function pit(x: number, y: number, color: number) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 7.2, 0.6, 24), mat(0x0a1118));
    disc.position.copy(P(x, y)).setY(0.35);
    scene.add(disc);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(6.6, 0.5, 8, 32),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(P(x, y)).setY(0.7);
    scene.add(ring);
    const light = new THREE.PointLight(color, 40, 30, 1.6);
    light.position.copy(P(x, y)).setY(4);
    scene.add(light);
  }
  pit(36, 30, 0x8b5cf6);
  pit(64, 70, 0xf97316);
  for (const [x, y, c] of [
    [20, 31, 0x9ca3af],
    [25, 44, 0x60a5fa],
    [33, 56, 0x9ca3af],
    [47, 67, 0x9ca3af],
    [56, 77, 0xef4444],
    [66, 86, 0x9ca3af],
  ] as [number, number, number][]) {
    for (const [px, py] of [[x, y], M(x, y)] as [number, number][]) {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.1, 0.5, 12),
        new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.9 }),
      );
      m.position.copy(P(px, py)).setY(0.6);
      scene.add(m);
    }
  }
  const bushMat = mat(0x3f8a4f);
  let seed = 1;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const [x, y] of [
    [29, 31],
    [41, 34],
    [57, 62],
    [70, 76],
    [24, 60],
    [62, 48],
    [34, 44],
    [44, 74],
  ] as [number, number][]) {
    for (const [px, py] of [[x, y], M(x, y)] as [number, number][]) {
      for (let k = 0; k < 4; k++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(1.3 + rnd() * 0.8, 7, 5), bushMat);
        b.position.copy(P(px + (rnd() - 0.5) * 3, py + (rnd() - 0.5) * 2)).setY(0.9);
        b.scale.y = 0.7;
        b.castShadow = true;
        scene.add(b);
      }
    }
  }

  // ---------------------------------------------------------------- stands (blue half z >= x, red half x >= z)
  const keepBlue = [new THREE.Plane(new THREE.Vector3(-1, 0, 1).normalize(), 0)];
  const keepRed = [new THREE.Plane(new THREE.Vector3(1, 0, -1).normalize(), 0)];
  function frameShape(inner: number, outer: number) {
    const s = new THREE.Shape();
    s.moveTo(-outer, -outer);
    s.lineTo(outer, -outer);
    s.lineTo(outer, outer);
    s.lineTo(-outer, outer);
    s.closePath();
    const h = new THREE.Path();
    h.moveTo(-inner, -inner);
    h.lineTo(-inner, inner);
    h.lineTo(inner, inner);
    h.lineTo(inner, -inner);
    h.closePath();
    s.holes.push(h);
    return s;
  }
  function tier(inner: number, outer: number, h: number, y: number) {
    const geo = new THREE.ExtrudeGeometry(frameShape(inner, outer), { depth: h, bevelEnabled: false });
    geo.rotateX(Math.PI / 2);
    geo.translate(0, y + h, 0);
    const rimGeo = new THREE.ExtrudeGeometry(frameShape(inner, inner + 0.7), { depth: 0.35, bevelEnabled: false });
    rimGeo.rotateX(Math.PI / 2);
    rimGeo.translate(0, y + h + 0.35, 0);
    for (const [planes, color, rim] of [
      [keepBlue, 0x0b1630, 0x2563eb],
      [keepRed, 0x2a0b10, 0xdc2626],
    ] as [THREE.Plane[], number, number][]) {
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 1, clippingPlanes: planes }));
      m.receiveShadow = true;
      scene.add(m);
      scene.add(
        new THREE.Mesh(
          rimGeo,
          new THREE.MeshStandardMaterial({ color: rim, emissive: rim, emissiveIntensity: 1.1, clippingPlanes: planes }),
        ),
      );
    }
  }
  tier(58, 66, 3.2, 0);
  tier(66, 74, 3.2, 3.2);
  tier(74, 82, 3.2, 6.4);
  tier(82, 92, 3.2, 9.6);
  const seatGeo = new THREE.BoxGeometry(0.9, 0.5, 0.9);
  const seatBlue = new THREE.MeshStandardMaterial({ color: 0x16244a, roughness: 1, clippingPlanes: keepBlue });
  const seatRed = new THREE.MeshStandardMaterial({ color: 0x4a1620, roughness: 1, clippingPlanes: keepRed });
  const seats = new THREE.InstancedMesh(seatGeo, seatBlue, 2400);
  const seatsRed = new THREE.InstancedMesh(seatGeo, seatRed, 2400);
  const tmp = new THREE.Object3D();
  let nb = 0;
  let nr = 0;
  for (const [inner, y] of [
    [58, 3.2],
    [66, 6.4],
    [74, 9.6],
    [82, 12.8],
  ] as [number, number][]) {
    for (let row = 0; row < 2; row++) {
      const d = inner + 2 + row * 3;
      for (let k = -d; k <= d; k += 2.2) {
        for (const [x, z] of [
          [k, -d],
          [k, d],
          [-d, k],
          [d, k],
        ] as [number, number][]) {
          tmp.position.set(x, y + 0.25, z);
          tmp.updateMatrix();
          if (z >= x) seats.setMatrixAt(nb++, tmp.matrix);
          else seatsRed.setMatrixAt(nr++, tmp.matrix);
        }
      }
    }
  }
  seats.count = nb;
  seatsRed.count = nr;
  scene.add(seats, seatsRed);

  // ---------------------------------------------------------------- towers and bases
  function tower(x: number, y: number, color: number) {
    const g = new THREE.Group();
    const parts: THREE.Mesh[] = [
      new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2, 1.2, 10), mat(0x6b7280)),
      new THREE.Mesh(new THREE.CylinderGeometry(1, 1.3, 5.5, 10), mat(0xe5e7eb)),
      new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.6, 10), mat(0xd1d5db)),
      new THREE.Mesh(
        new THREE.OctahedronGeometry(0.7),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2 }),
      ),
    ];
    parts[0].position.y = 0.6;
    parts[1].position.y = 3.9;
    parts[2].position.y = 7.4;
    parts[3].position.y = 8.6;
    parts.forEach((m) => {
      m.castShadow = true;
      g.add(m);
    });
    g.position.copy(P(x, y));
    scene.add(g);
  }
  for (const [x, y] of [
    [14, 48],
    [14, 64],
    [15, 76],
    [33, 67],
    [26, 74],
    [21, 80],
    [53, 86],
    [38, 86],
    [25, 85],
    [19.5, 80.5],
    [20.5, 81.5],
  ] as [number, number][]) {
    tower(x, y, 0x60a5fa);
    const [mx, my] = M(x, y);
    tower(mx, my, 0xf87171);
  }
  function base(x: number, y: number, color: number) {
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(13, 14, 1.4, 32), mat(0x101a24));
    plat.position.copy(P(x, y)).setY(0.7);
    plat.receiveShadow = true;
    scene.add(plat);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(12.5, 0.35, 8, 48),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(P(x, y)).setY(1.45);
    scene.add(ring);
    const nexus = new THREE.Mesh(
      new THREE.OctahedronGeometry(3.2),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.8, roughness: 0.2 }),
    );
    nexus.position.copy(P(x, y)).setY(5);
    nexus.castShadow = true;
    scene.add(nexus);
    const light = new THREE.PointLight(color, 60, 40, 1.5);
    light.position.copy(P(x, y)).setY(8);
    scene.add(light);
    return nexus;
  }
  const nexB = base(14, 86, 0x3b82f6);
  const nexR = base(86, 14, 0xef4444);

  // ---------------------------------------------------------------- Dragon and Baron (stylised, from primitives)
  function dragon(x: number, y: number) {
    const g = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({
      color: 0xea580c,
      emissive: 0x7c2d12,
      emissiveIntensity: 0.8,
      flatShading: true,
      roughness: 0.8,
    });
    const wing = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0x9a3412,
      emissiveIntensity: 0.6,
      flatShading: true,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const body = new THREE.Mesh(new THREE.SphereGeometry(2.6, 8, 6), skin);
    body.scale.set(1.5, 1, 1);
    body.position.y = 2.8;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 4, 7), skin);
    neck.position.set(3.4, 4.4, 0);
    neck.rotation.z = -0.9;
    const head = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3, 7), skin);
    head.position.set(5.6, 6.2, 0);
    head.rotation.z = -1.9;
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.8, 6, 6), skin);
    tail.position.set(-5.2, 2.4, 0);
    tail.rotation.z = 1.5;
    g.add(body, neck, head, tail);
    for (const s of [1, -1]) {
      const w = new THREE.Mesh(new THREE.ConeGeometry(3.2, 6.5, 3), wing);
      w.position.set(0, 5.2, s * 3.4);
      w.rotation.x = s * 1.1;
      w.rotation.z = 0.2;
      g.add(w);
      const h = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.6, 5), skin);
      h.position.set(5.2, 7.4, s * 0.7);
      h.rotation.z = -0.6;
      g.add(h);
    }
    g.traverse((m) => {
      if ((m as THREE.Mesh).isMesh) m.castShadow = true;
    });
    g.position.copy(P(x, y));
    g.rotation.y = 0.6;
    g.scale.setScalar(1.5);
    scene.add(g);
    return g;
  }
  function baron(x: number, y: number) {
    const g = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({
      color: 0x6d28d9,
      emissive: 0x3b0764,
      emissiveIntensity: 0.9,
      flatShading: true,
      roughness: 0.7,
    });
    const horn = new THREE.MeshStandardMaterial({
      color: 0xc4b5fd,
      emissive: 0x7c3aed,
      emissiveIntensity: 0.8,
      flatShading: true,
    });
    for (let i = 0; i < 7; i++) {
      const tt = i / 6;
      const s = new THREE.Mesh(new THREE.SphereGeometry(1.2 + tt * 1.6, 8, 6), skin);
      s.position.set(-5 + tt * 7, 0.8 + Math.sin(tt * Math.PI) * 4.5 + tt * 2.5, Math.sin(tt * 3) * 0.6);
      g.add(s);
    }
    const head = new THREE.Mesh(new THREE.SphereGeometry(3.1, 8, 6), skin);
    head.scale.set(1.2, 1, 1);
    head.position.set(3.2, 9.6, 0);
    g.add(head);
    for (const [dx, dz, rz] of [
      [1.2, 1.6, -0.5],
      [1.2, -1.6, -0.5],
      [-1.4, 2.2, 0.3],
      [-1.4, -2.2, 0.3],
    ]) {
      const h = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.6, 5), horn);
      h.position.set(3.2 + dx, 12, dz);
      h.rotation.z = rz;
      g.add(h);
    }
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfde047, emissiveIntensity: 2 });
    for (const dz of [1.1, -1.1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.4, 6, 4), eyeMat);
      e.position.set(6, 10, dz);
      g.add(e);
    }
    g.traverse((m) => {
      if ((m as THREE.Mesh).isMesh) m.castShadow = true;
    });
    g.position.copy(P(x, y));
    g.rotation.y = -0.5;
    g.scale.setScalar(1.3);
    scene.add(g);
    return g;
  }
  const drake = dragon(64, 70);
  const nashor = baron(36, 30);

  // ---------------------------------------------------------------- loop
  let px = 0;
  let py = 0;
  let reduced = false;
  let t = 0;
  let raf = 0;
  let disposed = false;
  const target = new THREE.Vector3(0, 0, 4);
  function frame() {
    if (disposed) return;
    if (!reduced) {
      t += 0.016;
      nexB.rotation.y = t * 0.8;
      nexR.rotation.y = -t * 0.8;
      drake.position.y = Math.sin(t * 1.6) * 0.6;
      nashor.rotation.y = -0.5 + Math.sin(t * 0.7) * 0.15;
      waterMat.emissiveIntensity = 0.5 + Math.sin(t * 1.5) * 0.15;
      const want = baseCam();
      want.x += px * 10;
      want.y -= py * 6;
      camera.position.lerp(want, 0.05);
      camera.lookAt(target);
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  frame();

  const markerPos = new Map(MARKERS.map((m) => [m.kind, P(m.x, m.y).setY(m.height)]));
  let cssW = width;
  let cssH = height;
  return {
    resize(w, h) {
      cssW = w;
      cssH = h;
      camera.aspect = w / h;
      camera.fov = w / h < 1 ? 52 : 38;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    },
    setPointer(nx, ny) {
      px = nx;
      py = ny;
    },
    project(kind) {
      const p = markerPos.get(kind);
      if (!p) return null;
      const v = p.clone().project(camera);
      if (v.z > 1) return null;
      return { x: ((v.x + 1) / 2) * cssW, y: ((1 - v.y) / 2) * cssH };
    },
    setReducedMotion(on) {
      reduced = on;
      if (on) {
        camera.position.copy(baseCam());
        camera.lookAt(target);
      }
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        for (const mm of mats) mm.dispose();
      });
      renderer.dispose();
    },
  };
}
