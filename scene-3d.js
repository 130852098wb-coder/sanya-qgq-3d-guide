// 三亚千古情景区 1:1 实景GLB三维导览场景引擎 (Hunyuan3D-2 + Blender 5.2 GLB)
import * as THREE from './lib/three.module.min.js';
import { OrbitControls } from './lib/OrbitControls.js';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { mergeGeometries } from './lib/BufferGeometryUtils.js';
import {
  MAP_CALIBRATION,
  PARK_GEO_ANCHOR,
  PARK_VENUES,
  EXTRA_STRUCTURES,
  ROAD_NODES,
  ROAD_EDGES,
  PARADE_ROUTE_NODES,
  uvToXZ,
} from './park-data.js';

function makeCanvasTexture(w, h, drawFn, rx = 1, ry = 1) {
  const cvs = document.createElement('canvas');
  cvs.width = w;
  cvs.height = h;
  drawFn(cvs.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  return tex;
}

const TAU = Math.PI * 2;
const PLAZA = { x: -106.47, z: 24.40, radius: 34 };
const HALL_CENTER = { x: 58, z: 38 };

function seededRandom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function createGroundTextures() {
  const random = seededRandom(7531);
  const grassRepeat = 35 * (6000 / 1900);
  const grass = makeCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#8ca77c';
    ctx.fillRect(0, 0, w, h);
    // Wrap each organic wash across tile edges, including the four corners.
    for (let i = 0; i < 720; i++) {
      const x = random() * w, y = random() * h, size = 8 + random() * 65;
      for (const dx of [-w, 0, w]) {
        for (const dy of [-h, 0, h]) {
          const px = x + dx, py = y + dy;
          if (px < -size || px > w + size || py < -size || py > h + size) continue;
          const wash = ctx.createRadialGradient(px, py, 0, px, py, size);
          wash.addColorStop(0, i % 3 ? '#809c7059' : '#8ca77cb3');
          wash.addColorStop(1, '#809c7000');
          ctx.fillStyle = wash;
          ctx.fillRect(px - size, py - size, size * 2, size * 2);
        }
      }
    }
    for (let i = 0; i < 24000; i++) {
      const x = random() * w, y = random() * h;
      ctx.strokeStyle = i % 3 ? 'rgba(61,86,53,0.09)' : 'rgba(224,220,170,0.22)';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 0.5 + random() * 2, y - random() * 2);
      ctx.stroke();
    }
  }, grassRepeat, grassRepeat);

  const stone = makeCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#d5d0c8';
    ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 8; row++) {
      for (let col = -1; col < 4; col++) {
        const x = col * 64 + (row % 2) * 32, y = row * 32;
        ctx.fillStyle = 'rgba(154,144,124,' + random() * 0.09 + ')';
        ctx.fillRect(x, y, 64, 32);
        ctx.strokeStyle = 'rgba(132,122,105,0.32)';
        ctx.lineWidth = 0.85;
        ctx.strokeRect(x, y, 64, 32);
      }
    }
    for (let i = 0; i < 9200; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(98,94,86,.11)' : 'rgba(255,251,243,.39)';
      ctx.fillRect(random() * w, random() * h, 0.8, 0.8);
    }
  });
  return { grass, stone };
}

// All paving shares a world-space grain, even where rounded path joints overlap.
function stoneUV(geometry) {
  const pos = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 8, pos.getZ(i) / 8);
  return geometry;
}

function floorPatch(width, depth, x, z, height, yaw = 0) {
  return stoneUV(new THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2).rotateY(yaw).translate(x, height, z));
}

function floorDisc(radius, x, z, height, segments = 28) {
  return stoneUV(new THREE.CircleGeometry(radius, segments).rotateX(-Math.PI / 2).translate(x, height, z));
}

function batchedFloor(root, pieces, material) {
  const mesh = new THREE.Mesh(mergeGeometries(pieces), material);
  mesh.receiveShadow = true;
  root.add(mesh);
  pieces.forEach(geometry => geometry.dispose());
}

function avenueHeading(ave) {
  return Math.atan2(ave.cx - HALL_CENTER.x, ave.cz - HALL_CENTER.z);
}

function buildPaving(root, stone) {
  const paving = new THREE.MeshStandardMaterial({ map: stone, roughness: 0.9 });
  const curb = new THREE.MeshStandardMaterial({ color: 0xe0d9cb, roughness: 0.85 });
  const beds = [], paths = [];
  for (const [a, b] of ROAD_EDGES) {
    const start = ROAD_NODES[a].pos, end = ROAD_NODES[b].pos;
    const dx = end.x - start.x, dz = end.z - start.z;
    const length = Math.hypot(dx, dz), yaw = -Math.atan2(dz, dx);
    const x = (start.x + end.x) / 2, z = (start.z + end.z) / 2;
    beds.push(floorPatch(length, 7.84, x, z, 0.12, yaw));
    paths.push(floorPatch(length, 7.2, x, z, 0.16, yaw));
  }
  for (const { pos } of Object.values(ROAD_NODES)) {
    beds.push(floorDisc(3.92, pos.x, pos.z, 0.12));
    paths.push(floorDisc(3.6, pos.x, pos.z, 0.16));
  }
  batchedFloor(root, beds, curb);
  batchedFloor(root, paths, paving);
  return paving;
}

function buildPlazaInlay() {
  const texture = makeCanvasTexture(1024, 1024, (ctx, w) => {
    ctx.translate(w / 2, w / 2);
    ctx.scale(w / (2 * PLAZA.radius), w / (2 * PLAZA.radius));
    ctx.strokeStyle = '#bda67c';
    ctx.fillStyle = '#d3bd94';
    for (const [radius, weight] of [[2.1, .38], [5.2, .22], [6.1, .42], [14, .13], [23.5, .16], [26.8, .6], [27.7, .14], [32, .4], [33.2, .15]]) {
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, TAU);
      ctx.lineWidth = weight;
      ctx.stroke();
    }
    for (let i = 0; i < 32; i++) {
      ctx.save();
      ctx.rotate(TAU * i / 32);
      ctx.lineWidth = .12;
      ctx.beginPath();
      ctx.moveTo(6.3, 0);
      ctx.lineTo(26.4, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(27.8, 0);
      ctx.lineTo(29.7, .78);
      ctx.lineTo(31.7, 0);
      ctx.lineTo(29.7, -.78);
      ctx.closePath();
      ctx.fill();
      if (i % 4 === 0) {
        ctx.beginPath();
        ctx.moveTo(2.35, -.45);
        ctx.lineTo(4.7, 0);
        ctx.lineTo(2.35, .45);
        ctx.fill();
      }
      ctx.restore();
    }
  });
  const inlay = new THREE.Mesh(new THREE.PlaneGeometry(68, 68).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
  inlay.position.set(PLAZA.x, .31, PLAZA.z);
  return inlay;
}

function buildParkGroundAndPools(venueMap, textures, animHooks, state) {
  const root = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.CircleGeometry(3000, 72).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: textures.grass, roughness: 1 }));
  ground.receiveShadow = true;
  root.add(ground);
  const paving = buildPaving(root, textures.stone);
  const ave = venueMap.totem_ave.box;
  const squares = [floorDisc(PLAZA.radius, PLAZA.x, PLAZA.z, .28, 112),
    floorPatch(ave.wx, ave.dz, ave.cx, ave.cz, .26, avenueHeading(ave))];
  for (const [id, width, depth] of [['love_plaza', 48, 44], ['xiulou_plaza', 62, 54]]) {
    const { x, z } = venueMap[id].pos;
    squares.push(floorPatch(width, depth, x, z, .24));
  }
  batchedFloor(root, squares, paving);
  root.add(buildPlazaInlay());

  const a = uvToXZ(0, 442), b = uvToXZ(402, 598);
  const dx = b.x - a.x, dz = b.z - a.z;
  const highway = new THREE.Mesh(floorPatch(Math.hypot(dx, dz) + 95, 16,
    (a.x + b.x) / 2 + 24, (a.z + b.z) / 2 + 12, .14, -Math.atan2(dz, dx)),
    new THREE.MeshStandardMaterial({ color: 0x67716e, roughness: 1 }));
  root.add(highway);
  buildWater(root, venueMap, textures.stone, animHooks, state);
  buildPlanting(root, venueMap);
  return root;
}

function buildWater(root, venues, stone, animHooks, state) {
  const depthMap = makeCanvasTexture(128, 256, (ctx, w, h) => {
    const depth = ctx.createLinearGradient(0, 0, w, h);
    depth.addColorStop(0, '#178fa8');
    depth.addColorStop(0.55, '#219fae');
    depth.addColorStop(1, '#2ec4d6');
    ctx.fillStyle = depth;
    ctx.fillRect(0, 0, w, h);
  });
  const ripple = makeCanvasTexture(256, 256, (ctx, w, h) => {
    for (let i = -1; i < 17; i++) {
      const base = h * i / 16;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const y = base + 4 * Math.sin(x / w * TAU + i * Math.PI / 4)
          + 1.5 * Math.sin(x / w * TAU * 3 - i * Math.PI / 2);
        if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.strokeStyle = i % 2 ? 'rgba(218,255,246,.65)' : 'rgba(255,255,244,.35)';
      ctx.lineWidth = i % 2 ? 1.45 : .8;
      ctx.stroke();
    }
  });
  const water = new THREE.MeshStandardMaterial({ map: depthMap, roughness: .26, metalness: .08 });
  const waves = new THREE.MeshBasicMaterial({ map: ripple, transparent: true, opacity: .32, depthWrite: false });
  const sill = new THREE.MeshStandardMaterial({ map: stone, color: 0xeee6d9, roughness: .77 });
  for (const box of [venues.shouting_fountain.waterBox, venues.water_play.box]) {
    const well = new THREE.Group();
    well.position.set(box.cx, 0, box.cz);
    well.rotation.y = -box.yawRad;
    const body = new THREE.Mesh(new THREE.BoxGeometry(box.wx, .72, box.dz), sill);
    body.position.y = .36;
    body.receiveShadow = true;
    well.add(body);
    const width = box.wx - 1.2, depth = box.dz - 1.2;
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2), water);
    surface.position.y = .75;
    well.add(surface);
    const veil = new THREE.Mesh(floorPatch(width, depth, 0, 0, .77), waves);
    well.add(veil);
    for (const sign of [-1, 1]) {
      const long = new THREE.Mesh(new THREE.BoxGeometry(.62, .24, box.dz), sill);
      long.position.set(sign * (box.wx - .62) / 2, .76, 0);
      const end = new THREE.Mesh(new THREE.BoxGeometry(width, .24, .62), sill);
      end.position.set(0, .76, sign * (box.dz - .62) / 2);
      well.add(long, end);
    }
    root.add(well);
  }
  const mist = makeCanvasTexture(8, 128, (ctx, w, h) => {
    const fade = ctx.createLinearGradient(0, 0, 0, h);
    fade.addColorStop(0, 'rgba(248,255,255,0)');
    fade.addColorStop(.27, 'rgba(249,255,255,.85)');
    fade.addColorStop(.82, 'rgba(201,239,239,.6)');
    fade.addColorStop(1, 'rgba(219,252,250,.08)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, w, h);
  });
  const dot = makeCanvasTexture(32, 32, (ctx, w) => {
    const fade = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    fade.addColorStop(0, 'white');
    fade.addColorStop(.38, 'rgba(239,255,255,.85)');
    fade.addColorStop(1, 'rgba(239,255,255,0)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, w, w);
  });
  const spray = new THREE.PointsMaterial({ map: dot, size: .54, transparent: true, opacity: .86, depthWrite: false });
  const cones = [[.12, .40, 8.4, .8], [.67, .27, 9.2, .47], [1.25, .16, 8.6, .23]].map(([top, bottom, h, opacity]) => ({
    geo: new THREE.CylinderGeometry(top, bottom, h, 14, 1, true).translate(0, h / 2, 0),
    mat: new THREE.MeshBasicMaterial({ map: mist, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }),
  }));
  const box = venues.shouting_fountain.waterBox, jets = [], random = seededRandom(829);
  const jetsGroup = new THREE.Group();
  jetsGroup.position.set(box.cx, .78, box.cz);
  jetsGroup.rotation.y = -box.yawRad;
  for (let i = 0; i < 4; i++) {
    const jet = new THREE.Group(), drops = [];
    for (const { geo, mat } of cones) jet.add(new THREE.Mesh(geo, mat));
    for (let n = 0; n < 42; n++) {
      const angle = random() * TAU, r = Math.sqrt(random()) * 1.55;
      drops.push(Math.cos(angle) * r, 8.5 + random() * 1.2 - r * r * .7, Math.sin(angle) * r);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(drops, 3));
    const foam = new THREE.Points(geometry, spray);
    jet.add(foam);
    jet.position.z = box.dz * (-.32 + .64 * i / 3);
    jetsGroup.add(jet);
    jets.push({ jet, foam });
  }
  root.add(jetsGroup);
  animHooks.push(time => {
    ripple.offset.set(time * .043, time * .024);
    jets.forEach(({ jet, foam }, i) => {
      jet.scale.y = (.83 + .2 * Math.sin(time * 2.7 + i * 1.5)) * (time < state.fountainBoostUntil ? 1.6 : 1);
      foam.rotation.y = time * .6 + i;
    });
  });
}

function palmGeometry() {
  const vertices = [], colors = [];
  function triangle(a, b, c, tint) {
    vertices.push(...a, ...b, ...c);
    const color = new THREE.Color(tint);
    for (let n = 0; n < 3; n++) colors.push(color.r, color.g, color.b);
  }
  const height = 9, bend = 1.15;
  function trunkPoint(t, a) {
    const r = .38 - .18 * t + .09 * Math.max(0, 1 - 5 * t);
    return [bend * t * t + Math.cos(a) * r, height * t, -.48 * Math.sin(t * Math.PI) + Math.sin(a) * r];
  }
  for (let y = 0; y < 12; y++) {
    for (let side = 0; side < 8; side++) {
      const a = TAU * side / 8, b = TAU * (side + 1) / 8;
      const p = trunkPoint(y / 12, a), q = trunkPoint(y / 12, b);
      const r = trunkPoint((y + 1) / 12, b), s = trunkPoint((y + 1) / 12, a);
      const tint = y % 3 === 0 ? 0x9d8963 : 0x847459;
      triangle(p, s, q, tint); triangle(q, s, r, tint);
    }
  }
  const greens = [0x426e49, 0x497d50, 0x58875a, 0x396b48, 0x6c945e];
  for (let frond = 0; frond < 10; frond++) {
    const a = TAU * frond / 10 + .09 * Math.sin(frond * 4);
    const length = 4.6 + .9 * Math.cos(frond * 3), lift = 1.35 + .45 * Math.sin(frond * 2);
    function leaf(t, side, down = 0) {
      const reach = t * length, fan = .28 * Math.sin(Math.PI * t) + side;
      return [bend + Math.cos(a) * reach - Math.sin(a) * fan,
        height + Math.sin(Math.PI * t) * lift - 1.85 * t * t + down,
        Math.sin(a) * reach + Math.cos(a) * fan];
    }
    for (let k = 0; k < 9; k++) {
      const t = k / 9, next = (k + 1) / 9;
      const half = .115 * (1 - t) + .02;
      triangle(leaf(t, -half), leaf(t, half), leaf(next, 0), 0x73935b);
      for (const sign of [-1, 1]) {
        const spread = .19 + .88 * Math.sin(Math.PI * (.12 + t * .84));
        const tip = leaf(Math.min(1.05, t + .19), sign * spread, -.26 - .31 * spread);
        triangle(leaf(t, 0), tip, leaf(next + .015, sign * .025), greens[(frond + k + (sign + 1)) % greens.length]);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function clusterGeometry(flowering) {
  const pieces = [], random = seededRandom(flowering ? 705 : 8421);
  function painted(geometry, color) {
    const tint = new THREE.Color(color), count = geometry.getAttribute('position').count;
    const rgb = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) rgb.set([tint.r, tint.g, tint.b], i * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
    pieces.push(geometry);
  }
  const height = flowering ? 1.7 : 5.9;
  const trunk = new THREE.CylinderGeometry(.17, flowering ? .25 : .46, height, 7).toNonIndexed();
  painted(trunk.translate(0, height / 2, 0), 0x726852);
  const shade = flowering ? [0x51754d, 0x627f4d, 0x3b6448] : [0x40694c, 0x517751, 0x66875b];
  const size = flowering ? 1.5 : 2.6;
  for (let i = 0; i < 10; i++) {
    const angle = i * 2.39996, offset = Math.sqrt(i / 9) * size;
    const x = Math.cos(angle) * offset, z = Math.sin(angle) * offset;
    const y = height + size * (.77 - i / 12) + random() * .45;
    painted(new THREE.IcosahedronGeometry(size * (.62 + random() * .44), 1)
      .scale(1.16, .85, 1).translate(x, y, z), shade[i % shade.length]);
    if (flowering) {
      for (let k = 0; k < 3; k++) {
        const blossom = new THREE.IcosahedronGeometry(.29 + random() * .26, 0);
        painted(blossom.translate(x + (random() - .5) * 1.5, y + .6 + random() * .56,
          z + (random() - .5) * 1.5), [0xc65369, 0xac435d, 0xdd7783][(i + k) % 3]);
      }
    }
  }
  const result = mergeGeometries(pieces);
  pieces.forEach(piece => piece.dispose());
  return result;
}

function plantingSites(venues) {
  const sites = [], random = seededRandom(18171);
  const buildings = buildParkGLBPlacements(venues);
  const pools = [venues.shouting_fountain.waterBox, venues.water_play.box];
  const roads = ROAD_EDGES.map(([a, b]) => [ROAD_NODES[a].pos, ROAD_NODES[b].pos]);
  function roomFor(x, z) {
    if (Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.radius + 3) return false;
    for (const [id, hw, hd] of [['love_plaza', 27, 25], ['xiulou_plaza', 34, 30]]) {
      const p = venues[id].pos;
      if (Math.abs(x - p.x) < hw && Math.abs(z - p.z) < hd) return false;
    }
    const ave = venues.totem_ave.box, turn = avenueHeading(ave);
    const ax = x - ave.cx, az = z - ave.cz;
    if (Math.abs(Math.cos(turn) * ax - Math.sin(turn) * az) < ave.wx / 2 + 3 &&
        Math.abs(Math.sin(turn) * ax + Math.cos(turn) * az) < ave.dz / 2 + 3) return false;
    if ([...buildings, ...pools].some(p => Math.abs(x - p.cx) < p.wx / 2 + 2.6 &&
      Math.abs(z - p.cz) < p.dz / 2 + 2.6)) return false;
    for (const [a, b] of roads) {
      const dx = b.x - a.x, dz = b.z - a.z;
      const k = THREE.MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
      if (Math.hypot(x - a.x - dx * k, z - a.z - dz * k) < 6.7) return false;
    }
    return sites.every(p => Math.hypot(x - p.x, z - p.z) >= 4.7);
  }
  function plant(kinds, candidate) {
    let placed = 0;
    for (let i = 0; placed < kinds.length && i < 6000; i++) {
      const { x, z } = candidate();
      if (!roomFor(x, z)) continue;
      sites.push({ kind: kinds[placed++], x, z, scale: .83 + random() * .48, yaw: random() * TAU });
    }
  }
  const mix = (palms, banyans, flowers) => [
    ...Array(palms).fill('palm'), ...Array(banyans).fill('banyan'), ...Array(flowers).fill('flowers')];
  plant(mix(12, 0, 8), () => {
    const a = random() * TAU, r = Math.sqrt(random());
    return { x: -66 + 32 * r * Math.cos(a), z: 68.5 + 9 * r * Math.sin(a) };
  });
  const perimeter = [[52,340],[72,271],[140,204],[226,159],[341,126],[480,80],[600,57],
    [706,62],[824,91],[937,132],[989,214],[958,283],[904,355],[823,429],[708,458],
    [623,478],[555,483],[507,500],[377,481],[291,449],[184,435],[90,395]].map(uv => uvToXZ(...uv));
  plant(mix(49, 5, 0), () => {
    const i = Math.floor(random() * perimeter.length), a = perimeter[i], b = perimeter[(i + 1) % perimeter.length];
    const t = random();
    return { x: a.x + (b.x - a.x) * t + (random() - .5) * 18,
      z: a.z + (b.z - a.z) * t + (random() - .5) * 18 };
  });
  plant(mix(25, 3, 2), () => {
    const [a, b] = roads[Math.floor(random() * roads.length)];
    const dx = b.x - a.x, dz = b.z - a.z, t = random();
    const edge = (random() < .5 ? -1 : 1) * (7 + random() * 9) / Math.hypot(dx, dz);
    return { x: a.x + dx * t - dz * edge, z: a.z + dz * t + dx * edge };
  });
  plant(mix(10, 3, 1), () => {
    const p = [venues.romance_plaza, venues.love_plaza, venues.xiulou_plaza][Math.floor(random() * 3)];
    const angle = random() * TAU, r = 37 + random() * 9;
    return { x: p.pos.x + r * Math.cos(angle), z: p.pos.z + r * Math.sin(angle) };
  });
  return sites;
}

function buildPlanting(root, venues) {
  const bed = new THREE.Shape();
  for (let i = 0; i <= 64; i++) {
    const a = i / 64 * TAU, r = 1 + .055 * Math.cos(3 * a);
    const x = -66 + 34 * Math.cos(a) * r, y = -(68.5 + 11 * Math.sin(a) * r);
    if (i) bed.lineTo(x, y); else bed.moveTo(x, y);
  }
  const garden = new THREE.Mesh(new THREE.ShapeGeometry(bed).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x77936a, roughness: 1 }));
  garden.position.y = .055;
  garden.receiveShadow = true;
  root.add(garden);
  const sites = plantingSites(venues);
  const leaves = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .91, side: THREE.DoubleSide });
  const transform = new THREE.Object3D();
  for (const [kind, geometry] of [['palm', palmGeometry()], ['banyan', clusterGeometry(false)], ['flowers', clusterGeometry(true)]]) {
    const plants = sites.filter(s => s.kind === kind);
    const batch = new THREE.InstancedMesh(geometry, leaves, plants.length);
    batch.name = kind;
    for (const [i, p] of plants.entries()) {
      transform.position.set(p.x, .04, p.z);
      transform.rotation.y = p.yaw;
      transform.scale.setScalar(p.scale);
      transform.updateMatrix();
      batch.setMatrixAt(i, transform.matrix);
      batch.setColorAt(i, new THREE.Color().setScalar(.87 + .13 * Math.sin(i * 2.23) ** 2));
    }
    batch.castShadow = batch.receiveShadow = true;
    root.add(batch);
  }
}

function buildParkGLBPlacements(venueMap) {
  const ave = venueMap.totem_ave.box;
  const gateCenter = uvToXZ(418, 517);
  const galleryCenter = uvToXZ(212, 392);
  const woodArch = EXTRA_STRUCTURES.find((e) => e.id === 'yazhou_wood_arch');
  const avenueYaw = avenueHeading(ave);

  const items = [
    // 入口牌坊、南海女神门头+互动游乐馆综合体
    { model: '01_gate_paifang', cx: gateCenter.x, cz: gateCenter.z, wx: 56, dz: 14, h: 22, rotY: 0 },
    { model: '03_goddess_hall', cx: 58, cz: 38, wx: 106, dz: 88, h: 35, rotY: avenueYaw },

    // 核心剧院群与商业前廊
    { model: '04_theater_1', cx: -156.0, cz: 98.0, wx: 64, dz: 104, h: 28, rotY: Math.PI * 0.5 },
    { model: '05_theater_2', cx: venueMap.theater_2.box.cx, cz: venueMap.theater_2.box.cz, wx: 54, dz: 65, h: 26, rotY: 0 },
    { model: '17_front_gallery', cx: galleryCenter.x, cz: galleryCenter.z, wx: 126, dz: 76, h: 12, rotY: 0 },
    { model: '15_virtual_sand_hall', cx: -152, cz: 26, wx: 23, dz: 18, h: 16, rotY: 0 },

    // 火焰山、喊泉古亭、丹霞柱廊、风情街城堡
    // These three neighbors leave the entire 34 m ceremonial stone disc clear.
    { model: '06_volcano_mountain', cx: -66, cz: 1.5, wx: 16.8, dz: 19, h: 20, rotY: -Math.PI * 0.5 },
    { model: '07_shouting_fountain', cx: venueMap.shouting_fountain.box.cx + 1.1, cz: venueMap.shouting_fountain.box.cz, wx: 20.9, dz: 35, h: 16, rotY: 0 },
    { model: '08_danxia_colonnade', cx: -144.0, cz: -62.0, wx: 34.0, dz: 110.0, h: 25.0, rotY: 0.18 },
    { model: '09_exotic_castle', cx: -80.0, cz: -38.0, wx: 28.0, dz: 52.0, h: 17.5, rotY: 0 },

    // 美食广场、绣楼、黎村、苗寨、虚拟空间、精灵谷、鹦歌燕舞、天涯鬼域
    { model: '10_food_courtyard', cx: venueMap.food_plaza.box.cx, cz: venueMap.food_plaza.box.cz, wx: 56, dz: 64, h: 15, rotY: 0 },
    { model: '11_xiulou_tower', cx: venueMap.xiulou_plaza.box.cx, cz: venueMap.xiulou_plaza.box.cz, wx: 24, dz: 24, h: 24, rotY: 0 },
    { model: '13_miao_stilted', cx: venueMap.miao_village.box.cx, cz: venueMap.miao_village.box.cz, wx: 50, dz: 48, h: 19, rotY: 0 },
    { model: '12_li_boat_house', cx: venueMap.li_village.box.cx - 18, cz: venueMap.li_village.box.cz - 4, wx: 42, dz: 38, h: 13, rotY: 0 },
    { model: '12_li_boat_house', cx: venueMap.li_village.box.cx + 22, cz: venueMap.li_village.box.cz + 6, wx: 38, dz: 34, h: 12, rotY: Math.PI * 0.5 },
    { model: '15_virtual_sand_hall', cx: venueMap.virtual_space.box.cx, cz: venueMap.virtual_space.box.cz, wx: 38, dz: 36, h: 16, rotY: 0 },
    { model: '16_elf_mushroom_cottage', cx: venueMap.elf_valley.box.cx, cz: venueMap.elf_valley.box.cz, wx: 42, dz: 32, h: 14, rotY: 0 },
    { model: '18_parrot_play_fort', cx: venueMap.parrot_dance.box.cx, cz: venueMap.parrot_dance.box.cz, wx: 48, dz: 30, h: 12, rotY: 0 },
    { model: '19_ghost_corridor', cx: 167.0, cz: -66.0, wx: 36, dz: 148, h: 18, rotY: 0 },

    // 青瓦红木古街院落群（黎锦馆、爱情街、礼品店、恐怖研究院、千古情客栈南北翼、扎染馆、崖州古街）
    { model: '14_ancient_street_hall', cx: venueMap.lijin_hall.box.cx, cz: venueMap.lijin_hall.box.cz, wx: 23, dz: 52, h: 12.5, rotY: Math.PI * 0.5 },
    { model: '14_ancient_street_hall', cx: venueMap.love_street.box.cx, cz: venueMap.love_street.box.cz, wx: 23, dz: 62, h: 12.5, rotY: Math.PI * 0.5 },
    { model: '14_ancient_street_hall', cx: venueMap.gift_shop.box.cx, cz: venueMap.gift_shop.box.cz, wx: 22, dz: 19, h: 10.5, rotY: 0 },
    { model: '14_ancient_street_hall', cx: venueMap.horror_inst.box.cx, cz: venueMap.horror_inst.box.cz, wx: 33, dz: 34, h: 14.5, rotY: 0 },
    { model: '14_ancient_street_hall', cx: venueMap.romance_inn.northWingBox.cx, cz: venueMap.romance_inn.northWingBox.cz, wx: 56, dz: 24, h: 13.5, rotY: 0 },
    { model: '14_ancient_street_hall', cx: venueMap.romance_inn.box.cx, cz: venueMap.romance_inn.box.cz, wx: 53, dz: 25, h: 13.0, rotY: 0 },
    { model: '14_ancient_street_hall', cx: venueMap.tie_dye_hall.box.cx, cz: venueMap.tie_dye_hall.box.cz, wx: 27, dz: 21, h: 11.0, rotY: 0 },
    { model: '14_ancient_street_hall', cx: venueMap.yazhou_street.box.cx, cz: venueMap.yazhou_street.box.cz, wx: 58, dz: 26, h: 13.5, rotY: 0 },
  ];

  if (woodArch) {
    items.push({ model: '01_gate_paifang', cx: woodArch.box.cx, cz: woodArch.box.cz, wx: 20, dz: 8, h: 13, rotY: Math.PI * 0.5 });
  }

  // 图腾大道两侧8根黎苗彩绘神柱
  for (let row = 0; row < 4; row++) {
    const localZ = -ave.dz * 0.36 + (ave.dz * 0.72 * row) / 3;
    for (const side of [-1, 1]) {
      const localX = side * (ave.wx * 0.5 + 2.4);
      items.push({
        model: '02_totem_pillar',
        cx: ave.cx + Math.cos(avenueYaw) * localX + Math.sin(avenueYaw) * localZ,
        cz: ave.cz - Math.sin(avenueYaw) * localX + Math.cos(avenueYaw) * localZ,
        wx: 3.4,
        dz: 3.4,
        h: 15.0,
        rotY: 0,
      });
    }
  }
  return items;
}

function placeModel(entry, plan) {
  const centered = entry.root.clone(true);
  centered.position.sub(new THREE.Vector3(entry.center.x, entry.minY, entry.center.z));
  const placed = new THREE.Group();
  placed.name = plan.model;
  placed.add(centered);
  const swapped = Math.abs(Math.sin(plan.rotY)) > .7;
  placed.scale.set((swapped ? plan.dz : plan.wx) / entry.size.x, plan.h / entry.size.y,
    (swapped ? plan.wx : plan.dz) / entry.size.z);
  placed.rotation.y = plan.rotY;
  if (plan.model === '08_danxia_colonnade') {
    // The cliff is L-shaped. Fit its rotated vertices, not empty corners of its local box.
    const bounds = new THREE.Box3(), size = new THREE.Vector3();
    for (let pass = 0; pass < 12; pass++) {
      bounds.setFromObject(placed, true).getSize(size);
      if (Math.abs(size.x - plan.wx) + Math.abs(size.z - plan.dz) < .001) break;
      placed.scale.x *= plan.wx / size.x;
      placed.scale.z *= plan.dz / size.z;
    }
    const center = bounds.setFromObject(placed, true).getCenter(new THREE.Vector3());
    placed.position.set(plan.cx - center.x, -bounds.min.y, plan.cz - center.z);
  } else {
    placed.position.set(plan.cx, 0, plan.cz);
  }
  return placed;
}

async function loadAllParkGLBs(parentGroup, placements, maxAniso) {
  const loader = new GLTFLoader();
  const names = [...new Set(placements.map(p => p.model))];
  const loaderEl = document.getElementById('modelLoader');
  let done = 0;
  await Promise.all(names.map(async name => {
    const { scene: root } = await loader.loadAsync('./models/' + name + '.glb');
    root.traverse(ch => {
      if (!ch.isMesh) return;
      ch.castShadow = ch.receiveShadow = true;
      if (ch.material.map) ch.material.map.anisotropy = maxAniso;
    });
    const box = new THREE.Box3().setFromObject(root, true);
    const entry = { root, size: box.getSize(new THREE.Vector3()), center: box.getCenter(new THREE.Vector3()), minY: box.min.y };
    for (const plan of placements.filter(p => p.model === name)) parentGroup.add(placeModel(entry, plan));
    done++;
    if (loaderEl) loaderEl.textContent = '实景模型加载中 ' + done + ' / ' + names.length;
  }));
  if (loaderEl) {
    loaderEl.textContent = '实景模型已就绪';
    setTimeout(() => loaderEl.classList.add('done'), 300);
  }
}

function createGroundArtwork() {
  const { imageWidth, imageHeight } = MAP_CALIBRATION;
  const geometry = new THREE.PlaneGeometry(1, 1);
  const uv = geometry.getAttribute('uv'), positions = geometry.getAttribute('position');
  for (let i = 0; i < uv.count; i++) {
    const { x, z } = uvToXZ(uv.getX(i) * imageWidth, (1 - uv.getY(i)) * imageHeight);
    positions.setXYZ(i, x, .08, z);
  }
  geometry.computeVertexNormals();
  const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: .55, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = '手绘导览底图';
  mesh.visible = false;
  mesh.renderOrder = -1;
  return mesh;
}

function createLocationMarker() {
  const group = new THREE.Group();
  group.name = '我的位置';
  group.visible = false;
  // GPS 点可能位于门楼或树冠下，保持标记可读，地理位置仍落在原始坐标。
  function layer(geometry, options, order) {
    const material = new THREE.MeshBasicMaterial({ ...options, transparent: true, depthTest: false,
      depthWrite: false, toneMapped: false, fog: false });
    const mesh = new THREE.Mesh(geometry.rotateX(-Math.PI / 2), material);
    mesh.renderOrder = order;
    group.add(mesh);
    return mesh;
  }
  const fanTexture = makeCanvasTexture(128, 128, (ctx, w, h) => {
    ctx.translate(w / 2, h / 2);
    const radius = w * .49, gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    gradient.addColorStop(0, 'rgba(30,136,229,.80)');
    gradient.addColorStop(.55, 'rgba(55,165,255,.48)');
    gradient.addColorStop(1, 'rgba(55,165,255,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, -Math.PI / 2 - .58, -Math.PI / 2 + .58);
    ctx.fill();
  });
  const fan = layer(new THREE.PlaneGeometry(34, 34), { map: fanTexture }, 10);
  const pulse = layer(new THREE.RingGeometry(3.5, 4.2, 48), { color: 0x59b7ff }, 11);
  layer(new THREE.CircleGeometry(3.7, 48), { color: 0x91d2ff, opacity: .38 }, 12);
  layer(new THREE.CircleGeometry(3, 48), { color: 0xffffff }, 13);
  layer(new THREE.CircleGeometry(2.15, 48), { color: 0x1e88e5 }, 14);
  return { group, fan, pulse };
}

export function createParkScene3D(container, onFrameLabels, onHeadingChange) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdceaf0);
  scene.fog = new THREE.FogExp2(0xdceaf0, 0.00088);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 820 ? 1.5 : 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.03;
  container.appendChild(renderer.domElement);

  const theta = (MAP_CALIBRATION.thetaDeg * Math.PI) / 180;
  const phi = (MAP_CALIBRATION.phiDeg * Math.PI) / 180;
  const LOCKED_POLAR = Math.PI / 2 - phi;
  const isoDir = new THREE.Vector3().setFromSphericalCoords(1, LOCKED_POLAR, theta);

  const perspCam = new THREE.PerspectiveCamera(34, container.clientWidth / container.clientHeight, 2, 2400);
  perspCam.position.copy(isoDir).multiplyScalar(510);

  const orthoCam = new THREE.OrthographicCamera(-267.5, 267.5, 150, -150, 1, 2400);
  orthoCam.position.copy(isoDir.clone().multiplyScalar(800));
  orthoCam.lookAt(0, 0, 0);

  let activeCam = perspCam;
  const controls = new OrbitControls(perspCam, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enableRotate = true;
  controls.screenSpacePanning = false;
  controls.minPolarAngle = LOCKED_POLAR;
  controls.maxPolarAngle = LOCKED_POLAR;
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  controls.minDistance = 115;
  controls.maxDistance = 640;
  controls.target.set(-8, 0, -18);
  perspCam.position.copy(controls.target).addScaledVector(isoDir, 510);
  controls.update();

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
  scene.add(ambientLight);

  const hemiLight = new THREE.HemisphereLight(0xfffaf0, 0x708b60, 1.05);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff3dc, 1.65);
  sunLight.position.set(190, 310, 185);
  sunLight.castShadow = true;
  const sm = window.innerWidth < 820 ? 1024 : 2048;
  sunLight.shadow.mapSize.set(sm, sm);
  sunLight.shadow.bias = -0.0006;
  sunLight.shadow.normalBias = 0.05;
  sunLight.shadow.camera.left = -290;
  sunLight.shadow.camera.right = 290;
  sunLight.shadow.camera.top = 270;
  sunLight.shadow.camera.bottom = -270;
  scene.add(sunLight);

  const nightSpotGroup = new THREE.Group();
  nightSpotGroup.visible = false;
  for (const [lx, lz, col] of [[-150, 102, 0xff6b42], [-73, 114, 0xffc244], [-105, 26, 0xff7722], [7, -109, 0xff4d4d], [68, 63, 0xffd275], [31, -198, 0xffaa44]]) {
    const pl = new THREE.PointLight(col, 3.6, 145, 1.4);
    pl.position.set(lx, 28, lz);
    nightSpotGroup.add(pl);
  }
  scene.add(nightSpotGroup);

  const venueMap = Object.fromEntries(PARK_VENUES.map((v) => [v.id, v]));
  const animHooks = [];
  const stateRef = { fountainBoostUntil: 0 };
  const texs = createGroundTextures();

  scene.add(buildParkGroundAndPools(venueMap, texs, animHooks, stateRef));
  const artwork = createGroundArtwork();
  const locationMarker = createLocationMarker();
  scene.add(artwork, locationMarker.group);
  let artworkEnabled = false, artworkReady = false;

  function setGroundOverlay(enabled, opacity = .55) {
    const material = artwork.material;
    artworkEnabled = enabled;
    material.opacity = THREE.MathUtils.clamp(opacity, 0, 1);
    if (enabled && !material.map) {
      // 保留原图像素标定，仅在贴地层淡出纸边、印刷标题与图例框。
      material.alphaMap = makeCanvasTexture(MAP_CALIBRATION.imageWidth, MAP_CALIBRATION.imageHeight, (ctx, w, h) => {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        for (const [x, y, dx, dy] of [[0,0,20,0],[w,0,-20,0],[0,0,0,18],[0,h,0,-18]]) {
          const fade = ctx.createLinearGradient(x, y, x + dx, y + dy);
          fade.addColorStop(0, '#000');
          fade.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = fade;
          ctx.fillRect(0, 0, w, h);
        }
        ctx.shadowBlur = 9;
        ctx.shadowColor = ctx.fillStyle = '#000';
        ctx.fillRect(38, 42, 360, 44);
        ctx.fillRect(95, 96, 130, 38);
        ctx.fillRect(915, 338, 99, 235);
      });
      material.alphaMap.colorSpace = THREE.NoColorSpace;
      const texture = new THREE.TextureLoader().load(MAP_CALIBRATION.referenceImage, () => {
        artworkReady = true;
        artwork.visible = artworkEnabled && material.opacity > 0;
      });
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      material.map = texture;
      material.needsUpdate = true;
    }
    artwork.visible = enabled && artworkReady && material.opacity > 0;
  }

  const glbRootGroup = new THREE.Group();
  scene.add(glbRootGroup);
  const placements = buildParkGLBPlacements(venueMap);
  loadAllParkGLBs(glbRootGroup, placements, Math.min(8, renderer.capabilities.getMaxAnisotropy())).catch((err) => {
    const loaderEl = document.getElementById('modelLoader');
    if (loaderEl) loaderEl.textContent = '部分实景模型加载失败，请刷新重试';
    console.error('GLB load error:', err);
  }).finally(() => { renderer.shadowMap.needsUpdate = true; });

  const selectRing = new THREE.Mesh(
    new THREE.RingGeometry(10.5, 11.3, 64),
    new THREE.MeshBasicMaterial({ color: 0xc6954b, side: THREE.DoubleSide, transparent: true, opacity: .86 })
  );
  selectRing.rotation.x = -Math.PI * 0.5;
  selectRing.position.y = 0.52;
  selectRing.visible = false;
  scene.add(selectRing);

  const routeGroup = new THREE.Group();
  scene.add(routeGroup);

  function clearRoute() {
    for (const mesh of [...routeGroup.children]) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    routeGroup.clear();
  }

  function showRoute(points, color = 0xb8292f) {
    clearRoute();
    if (!points?.length) return;
    const bands = [], gilding = [];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
      const yaw = -Math.atan2(dz, dx), x = (a.x + b.x) / 2, z = (a.z + b.z) / 2;
      gilding.push(floorPatch(length, 2.05, x, z, .55, yaw));
      bands.push(floorPatch(length, 1.38, x, z, .58, yaw));
    }
    for (const { x, z } of points) {
      gilding.push(floorDisc(1.025, x, z, .55, 16));
      bands.push(floorDisc(.69, x, z, .58, 16));
    }
    batchedFloor(routeGroup, gilding, new THREE.MeshBasicMaterial({ color: 0xe0c998 }));
    batchedFloor(routeGroup, bands, new THREE.MeshBasicMaterial({ color }));
    for (const [point, tint] of [[points[0], 0x397459], [points[points.length - 1], color]]) {
      const stop = new THREE.Mesh(floorDisc(1.75, point.x, point.z, .62),
        new THREE.MeshBasicMaterial({ color: tint }));
      routeGroup.add(stop);
    }
  }

  const clock = new THREE.Clock();
  let flyAnim = null, framedPoints = null;
  let hasUserLocation = false;
  const offset = new THREE.Vector3();
  const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
  function currentYaw() {
    return Math.atan2(perspCam.position.x - controls.target.x, perspCam.position.z - controls.target.z);
  }
  function getHeadingDeg() {
    return activeCam === orthoCam ? 0 : THREE.MathUtils.radToDeg(wrapAngle(currentYaw() - theta));
  }
  function clampGroundTarget(target) {
    // 保留 V2 拖动边界，仅在定位点位于图外、650 m 园内时延伸至该点。
    const x = hasUserLocation ? locationMarker.group.position.x : 0;
    const z = hasUserLocation ? locationMarker.group.position.z : 0;
    target.x = THREE.MathUtils.clamp(target.x, Math.min(-230, x), Math.max(230, x));
    target.z = THREE.MathUtils.clamp(target.z, Math.min(-230, z), Math.max(210, z));
    target.y = 0;
  }
  function discardInertia() {
    const eye = perspCam.position.clone(), target = controls.target.clone();
    controls.enableDamping = false;
    controls.update();
    controls.target.copy(target);
    perspCam.position.copy(eye);
    controls.update();
    controls.enableDamping = true;
  }
  function placeCamera(target, range, yaw) {
    offset.setFromSphericalCoords(range, LOCKED_POLAR, yaw);
    perspCam.position.copy(target).add(offset);
    perspCam.lookAt(target);
  }
  function flyTo(target, distance, instant = false, yaw = currentYaw(), duration = 540) {
    activeCam = perspCam;
    controls.enabled = true;
    discardInertia();
    clampGroundTarget(target);
    const range = THREE.MathUtils.clamp(distance, controls.minDistance, controls.maxDistance);
    if (instant) {
      controls.target.copy(target);
      placeCamera(target, range, yaw);
      controls.update();
      flyAnim = null;
      return;
    }
    const fromYaw = currentYaw();
    flyAnim = { start: performance.now(), duration, fromYaw, turn: wrapAngle(yaw - fromYaw), from: controls.target.clone(), to: target,
      fromRange: perspCam.position.distanceTo(controls.target), toRange: range };
  }
  controls.addEventListener('start', () => {
    flyAnim = null;
    framedPoints = null;
    discardInertia();
  });

  function resetHeading() {
    framedPoints = null;
    flyTo(controls.target.clone(), perspCam.position.distanceTo(controls.target), false, theta, 350);
  }

  // OrbitControls 处理两指间距和中点。这里只消费有方向的夹角差，跨 ±π 时仍是小步旋转。
  const canvas = renderer.domElement;
  const twistThreshold = THREE.MathUtils.degToRad(3);
  let lastAngle = null, accumulated = 0, twisting = false, remainingFinger = null;
  function pairAngle(touches) {
    const [a, b] = touches[0].identifier <= touches[1].identifier
      ? [touches[0], touches[1]] : [touches[1], touches[0]];
    return Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX);
  }
  function beginTouches(event) {
    const touches = event.targetTouches;
    lastAngle = touches.length === 2 ? pairAngle(touches) : null;
    accumulated = 0;
    twisting = false;
    remainingFinger = null;
  }
  canvas.addEventListener('touchstart', beginTouches, { passive: true });
  canvas.addEventListener('touchmove', (event) => {
    if (!controls.enabled) return;
    const touches = event.targetTouches;
    if (touches.length === 2 && lastAngle !== null) {
      const angle = pairAngle(touches);
      accumulated += wrapAngle(angle - lastAngle);
      lastAngle = angle;
      if (!twisting && Math.abs(accumulated) <= twistThreshold) return;
      twisting = true;
      placeCamera(controls.target, perspCam.position.distanceTo(controls.target), currentYaw() + accumulated);
      accumulated = 0;
    } else if (touches.length === 1 && remainingFinger) {
      // 本地版本的 OrbitControls 抬起任一指即退出拖动；另一指可继续在地面上拉动地图。
      const { clientX, clientY } = touches[0];
      const dx = clientX - remainingFinger.x, dy = clientY - remainingFinger.y, yaw = currentYaw();
      const scale = 2 * perspCam.position.distanceTo(controls.target) * Math.tan(THREE.MathUtils.degToRad(perspCam.fov / 2)) / canvas.clientHeight;
      offset.set(-dx * Math.cos(yaw) - dy * Math.sin(yaw), 0, dx * Math.sin(yaw) - dy * Math.cos(yaw)).multiplyScalar(scale);
      controls.target.add(offset);
      perspCam.position.add(offset);
      remainingFinger.set(clientX, clientY);
    }
  }, { passive: true });
  function endTouches(event) {
    beginTouches(event);
    if (event.targetTouches.length === 1) {
      const touch = event.targetTouches[0];
      remainingFinger = new THREE.Vector2(touch.clientX, touch.clientY);
    }
  }
  canvas.addEventListener('touchend', endTouches, { passive: true });
  canvas.addEventListener('touchcancel', endTouches, { passive: true });

  function setUserLocation(x, z, headingDeg = null, visible = true, focus = false) {
    hasUserLocation = visible;
    locationMarker.group.visible = visible && activeCam === perspCam;
    if (!visible) return;
    locationMarker.group.position.set(x, .72, z);
    locationMarker.fan.visible = Number.isFinite(headingDeg);
    if (locationMarker.fan.visible) {
      locationMarker.fan.rotation.y = THREE.MathUtils.degToRad(PARK_GEO_ANCHOR.headingDeg - headingDeg);
    }
    if (focus && activeCam === perspCam) {
      selectRing.visible = false;
      framedPoints = null;
      flyTo(new THREE.Vector3(x, 0, z), 190);
    }
  }

  function focusPoint(x, z, dist = 210) {
    framedPoints = null;
    selectRing.visible = true;
    selectRing.position.set(x, .52, z);
    if (Math.hypot(x - venueMap.shouting_fountain.pos.x, z - venueMap.shouting_fountain.pos.z) < 8)
      stateRef.fountainBoostUntil = clock.getElapsedTime() + 4;
    flyTo(new THREE.Vector3(x, 0, z), dist);
  }

  function fitView(points, instant = false, yaw = currentYaw()) {
    if (!points.length) return;
    const dir = new THREE.Vector3().setFromSphericalCoords(1, LOCKED_POLAR, yaw);
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const up = new THREE.Vector3().crossVectors(dir, right);
    const corners = points.map(p => new THREE.Vector3(p.x, p.y ?? 0, p.z));
    const frame = new THREE.Box2();
    for (const p of corners) frame.expandByPoint(new THREE.Vector2(p.dot(right), p.dot(up)));
    const center = frame.getCenter(new THREE.Vector2());
    const target = right.clone().multiplyScalar(center.x);
    target.x -= Math.sin(yaw) * center.y / Math.sin(phi);
    target.z -= Math.cos(yaw) * center.y / Math.sin(phi);
    clampGroundTarget(target);
    const tanV = Math.tan(THREE.MathUtils.degToRad(perspCam.fov / 2)), tanH = tanV * perspCam.aspect;
    const usableX = Math.max(.6, 1 - 70 / container.clientWidth);
    const usableY = Math.max(.56, 1 - 145 / container.clientHeight);
    let distance = controls.minDistance;
    for (const p of corners) {
      const delta = p.sub(target), near = delta.dot(dir);
      distance = Math.max(distance, near + Math.abs(delta.dot(right)) / (tanH * usableX),
        near + Math.abs(delta.dot(up)) / (tanV * usableY));
    }
    flyTo(target, distance, instant, yaw);
  }

  const overviewPoints = placements.flatMap(p => [-1, 1].flatMap(sx => [-1, 1].map(sz =>
    ({ x: p.cx + sx * p.wx / 2, y: 0, z: p.cz + sz * p.dz / 2 }))).concat({ x: p.cx, y: p.h, z: p.cz }));
  function resetOverview(restoreHeading = false) {
    selectRing.visible = false;
    framedPoints = overviewPoints;
    fitView(overviewPoints, false, restoreHeading ? theta : currentYaw());
  }
  function focusPoints(points) {
    selectRing.visible = false;
    framedPoints = points;
    fitView(points);
  }

  function updateOrthoFrustum() {
    const aspect = container.clientWidth / container.clientHeight;
    const mapAspect = MAP_CALIBRATION.imageWidth / MAP_CALIBRATION.imageHeight;
    const halfW = MAP_CALIBRATION.imageWidth / (2 * MAP_CALIBRATION.pixelsPerMeter);
    const halfH = MAP_CALIBRATION.imageHeight / (2 * MAP_CALIBRATION.pixelsPerMeter);
    if (aspect >= mapAspect) {
      orthoCam.top = halfH;
      orthoCam.bottom = -halfH;
      orthoCam.right = halfH * aspect;
      orthoCam.left = -halfH * aspect;
    } else {
      orthoCam.right = halfW;
      orthoCam.left = -halfW;
      orthoCam.top = halfW / aspect;
      orthoCam.bottom = -halfW / aspect;
    }
    orthoCam.updateProjectionMatrix();
  }

  function setOrthoCompare(enabled) {
    if (enabled) {
      flyAnim = null;
      orthoCam.position.copy(isoDir.clone().multiplyScalar(800));
      orthoCam.lookAt(0, 0, 0);
      activeCam = orthoCam;
      controls.enabled = false;
    } else {
      activeCam = perspCam;
      controls.enabled = true;
    }
    locationMarker.group.visible = hasUserLocation && !enabled;
  }

  function setNightMode(isNight) {
    scene.background.setHex(isNight ? 0x0d1524 : 0xdceaf0);
    scene.fog.color.setHex(isNight ? 0x0d1524 : 0xdceaf0);
    ambientLight.intensity = isNight ? 0.35 : 0.85;
    hemiLight.intensity = isNight ? 0.32 : 1.05;
    sunLight.intensity = isNight ? 0.28 : 1.65;
    sunLight.color.setHex(isNight ? 0x7ba4ff : 0xfff3dc);
    nightSpotGroup.visible = isNight;
  }

  function handleResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    perspCam.aspect = w / h;
    // Limit wide-angle distortion when framing the park in portrait.
    const tanV = Math.max(Math.tan(THREE.MathUtils.degToRad(17)), .53 / perspCam.aspect);
    perspCam.fov = Math.min(58, THREE.MathUtils.radToDeg(2 * Math.atan(tanV)));
    perspCam.updateProjectionMatrix();
    updateOrthoFrustum();
    renderer.setSize(w, h);
    if (activeCam === perspCam && framedPoints) fitView(framedPoints, true);
  }
  window.addEventListener('resize', handleResize);
  framedPoints = overviewPoints;
  handleResize();

  const projVec = new THREE.Vector3();
  function animate() {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();
    if (flyAnim) {
      const t = Math.min(1, (performance.now() - flyAnim.start) / flyAnim.duration);
      const eased = 1 - Math.pow(1 - t, 3);
      controls.target.lerpVectors(flyAnim.from, flyAnim.to, eased);
      placeCamera(controls.target, THREE.MathUtils.lerp(flyAnim.fromRange, flyAnim.toRange, eased), flyAnim.fromYaw + flyAnim.turn * eased);
      if (t === 1) flyAnim = null;
    }
    if (controls.enabled) {
      controls.update();
      offset.subVectors(perspCam.position, controls.target);
      clampGroundTarget(controls.target);
      perspCam.position.copy(controls.target).add(offset);
    }
    if (locationMarker.group.visible) {
      const phase = (elapsed % 2) / 2;
      locationMarker.pulse.scale.setScalar(1 + phase * 1.75);
      locationMarker.pulse.material.opacity = .58 * (1 - phase);
      locationMarker.group.scale.setScalar(perspCam.position.distanceTo(controls.target) / 250);
    }
    if (selectRing.visible) {
      const s = 1 + Math.sin(elapsed * 4.5) * 0.1;
      selectRing.scale.set(s, s, 1);
    }
    for (const fn of animHooks) fn(elapsed);
    renderer.render(scene, activeCam);
    onHeadingChange?.(getHeadingDeg());

    if (onFrameLabels) {
      const w = container.clientWidth;
      const h = container.clientHeight;
      onFrameLabels((x, y, z) => {
        projVec.set(x, y, z).project(activeCam);
        return { x: (projVec.x * .5 + .5) * w, y: (-projVec.y * .5 + .5) * h,
          visible: Math.abs(projVec.x) <= 1 && Math.abs(projVec.y) <= 1 && Math.abs(projVec.z) <= 1 };
      });
    }
  }
  animate();

  return {
    focusPoint,
    focusPoints,
    clearSelection: () => { selectRing.visible = false; },
    resetOverview,
    resetHeading,
    getHeadingDeg,
    setUserLocation,
    setGroundOverlay,
    showRoute,
    showParadeRoute: () => showRoute(PARADE_ROUTE_NODES.map((id) => ROAD_NODES[id].pos), 0xc6954b),
    clearRoute,
    setOrthoCompare,
    setNightMode,
    resize: handleResize,
  };
}
