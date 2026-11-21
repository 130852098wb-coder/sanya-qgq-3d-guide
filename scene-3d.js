// 三亚千古情景区 1:1 实景GLB三维导览场景引擎 (Hunyuan3D-2 + Blender 5.2 GLB)
import * as THREE from './lib/three.module.min.js';
import { OrbitControls } from './lib/OrbitControls.js';
import { GLTFLoader } from './lib/GLTFLoader.js';
import {
  MAP_CALIBRATION,
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

function createGroundTextures() {
  const stoneTex = makeCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#c9cdd2';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#a3aab2';
    ctx.lineWidth = 2;
    for (let y = 0; y < h; y += 32) {
      const sh = (y / 32) % 2 === 0 ? 0 : 32;
      for (let x = -32; x < w; x += 64) {
        ctx.fillStyle = (x + y) % 64 === 0 ? '#d2d6db' : '#c0c5cb';
        ctx.fillRect(x + sh + 1, y + 1, 62, 30);
        ctx.strokeRect(x + sh, y, 64, 32);
      }
    }
  }, 22, 22);

  const grassTex = makeCanvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#9bbd82');
    g.addColorStop(0.5, '#8eb275');
    g.addColorStop(1, '#a4c48b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 800; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(105,142,78,0.24)' : 'rgba(186,210,152,0.22)';
      ctx.fillRect((i * 73) % w, (i * 137) % h, 3, 3);
    }
  }, 16, 16);

  const poolTex = makeCanvasTexture(128, 128, (ctx, w, h) => {
    for (let y = 0; y < h; y += 32) {
      for (let x = 0; x < w; x += 32) {
        ctx.fillStyle = (x / 32 + y / 32) % 2 === 0 ? '#1ca6c6' : '#35cbe8';
        ctx.fillRect(x, y, 32, 32);
      }
    }
  }, 3, 3);

  return { stoneTex, grassTex, poolTex };
}

function buildTropicalTree(x, z, scale, isPalm, palmTrunkMat, palmLeafMat, banyanMat) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  if (isPalm) {
    const h = 8.2 * scale;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24 * scale, 0.44 * scale, h, 7), palmTrunkMat);
    trunk.position.y = h * 0.5;
    trunk.rotation.z = 0.06;
    trunk.castShadow = true;
    g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(1.05 * scale, 4.0 * scale, 5), palmLeafMat);
      const ang = (i * Math.PI * 2) / 6;
      frond.position.set(Math.cos(ang) * 1.45 * scale, h - 0.2, Math.sin(ang) * 1.45 * scale);
      frond.rotation.z = -Math.cos(ang) * 1.15;
      frond.rotation.x = Math.sin(ang) * 1.15;
      g.add(frond);
    }
  } else {
    const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(2.7 * scale, 1), banyanMat);
    crown.position.y = 4.2 * scale;
    crown.scale.y = 0.72;
    crown.castShadow = true;
    g.add(crown);
  }
  return g;
}

function buildParkGroundAndPools(venueMap, texs, animHooks, stateRef) {
  const root = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ map: texs.stoneTex, roughness: 0.86 });
  const grassMat = new THREE.MeshStandardMaterial({ map: texs.grassTex, roughness: 0.92 });
  const poolMat = new THREE.MeshStandardMaterial({ map: texs.poolTex, roughness: 0.22, metalness: 0.1 });
  const palmTrunkMat = new THREE.MeshStandardMaterial({ color: 0x765638, roughness: 0.85 });
  const palmLeafMat = new THREE.MeshStandardMaterial({ color: 0x49843e, roughness: 0.72 });
  const banyanMat = new THREE.MeshStandardMaterial({ color: 0x558946, roughness: 0.78 });

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(820, 820), grassMat);
  ground.rotation.x = -Math.PI * 0.5;
  ground.receiveShadow = true;
  root.add(ground);

  // 千古情广场圆形石坪、爱情广场、绣楼广场与图腾大道石阶
  const rp = venueMap.romance_plaza.pos;
  const mandala = new THREE.Mesh(new THREE.CylinderGeometry(38, 38, 0.25, 40), stoneMat);
  mandala.position.set(rp.x, 0.12, rp.z);
  mandala.receiveShadow = true;
  root.add(mandala);

  for (const [vid, w, d] of [['love_plaza', 52, 46], ['xiulou_plaza', 62, 54]]) {
    const p = venueMap[vid].pos;
    const pl = new THREE.Mesh(new THREE.BoxGeometry(w, 0.24, d), stoneMat);
    pl.position.set(p.x, 0.12, p.z);
    pl.receiveShadow = true;
    root.add(pl);
  }

  const ave = venueMap.totem_ave.box;
  const aveDeck = new THREE.Mesh(new THREE.BoxGeometry(ave.wx, 0.4, ave.dz), stoneMat);
  aveDeck.position.set(ave.cx, 0.2, ave.cz);
  aveDeck.rotation.y = -ave.yawRad;
  aveDeck.receiveShadow = true;
  root.add(aveDeck);

  for (const [a, b] of ROAD_EDGES) {
    const pa = ROAD_NODES[a].pos;
    const pb = ROAD_NODES[b].pos;
    const dx = pb.x - pa.x;
    const dz = pb.z - pa.z;
    const seg = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(dx, dz) + 7, 0.2, 10.5), stoneMat);
    seg.position.set((pa.x + pb.x) * 0.5, 0.1, (pa.z + pb.z) * 0.5);
    seg.rotation.y = -Math.atan2(dz, dx);
    seg.receiveShadow = true;
    root.add(seg);
  }

  // 喊泉喷泉池与动态水柱 + 戏水区蓝绿方格池
  for (const box of [venueMap.shouting_fountain.waterBox, venueMap.water_play.box]) {
    const pm = new THREE.Mesh(new THREE.BoxGeometry(box.wx, 0.9, box.dz), poolMat);
    pm.position.set(box.cx, 0.45, box.cz);
    pm.rotation.y = -box.yawRad;
    root.add(pm);
  }

  const fb = venueMap.shouting_fountain.waterBox;
  const jetGroup = new THREE.Group();
  jetGroup.position.set(fb.cx, 0, fb.cz);
  jetGroup.rotation.y = -fb.yawRad;
  const jets = [];
  for (let i = 0; i < 4; i++) {
    const jet = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.95, 9.5, 8),
      new THREE.MeshBasicMaterial({ color: 0xeafcff, transparent: true, opacity: 0.85 })
    );
    jet.position.set(0, 5.2, -fb.dz * 0.34 + (fb.dz * 0.68 * i) / 3);
    jetGroup.add(jet);
    jets.push(jet);
  }
  root.add(jetGroup);
  animHooks.push((t) => {
    const boost = stateRef.fountainBoost > 0 ? 1.8 : 1.0;
    if (stateRef.fountainBoost > 0) stateRef.fountainBoost -= 0.016;
    jets.forEach((j, idx) => {
      const s = (0.65 + 0.42 * Math.abs(Math.sin(t * 3.8 + idx * 0.9))) * boost;
      j.scale.y = s;
      j.position.y = 0.8 + 4.6 * s;
    });
  });

  // 迎宾路公路与周边椰林绿化带
  const r0 = uvToXZ(0, 442), r1 = uvToXZ(402, 598);
  const hwy = new THREE.Mesh(
    new THREE.BoxGeometry(Math.hypot(r1.x - r0.x, r1.z - r0.z) + 95, 0.28, 16),
    new THREE.MeshStandardMaterial({ color: 0x4d545e, roughness: 0.9 })
  );
  hwy.position.set((r0.x + r1.x) * 0.5 + 24, 0.14, (r0.z + r1.z) * 0.5 + 12);
  hwy.rotation.y = -Math.atan2(r1.z - r0.z, r1.x - r0.x);
  root.add(hwy);

  const treeUVs = [
    [95, 240], [112, 398], [168, 435], [248, 456], [358, 412], [412, 392], [435, 424],
    [548, 488], [648, 476], [706, 442], [755, 382], [728, 318], [685, 268], [625, 255],
    [322, 295], [285, 202], [548, 72], [652, 48], [742, 68], [828, 92], [892, 128],
    [972, 248], [912, 312], [852, 432], [58, 336], [198, 168],
  ];
  treeUVs.forEach(([u, v], i) => {
    const tp = uvToXZ(u, v);
    root.add(buildTropicalTree(tp.x, tp.z, 0.9 + (i % 3) * 0.15, i % 2 === 0, palmTrunkMat, palmLeafMat, banyanMat));
  });
  return root;
}

function buildParkGLBPlacements(venueMap) {
  const ave = venueMap.totem_ave.box;
  const gateCenter = uvToXZ(418, 517);
  const galleryCenter = uvToXZ(212, 392);
  const vol = EXTRA_STRUCTURES.find((e) => e.id === 'volcano_rockery');
  const woodArch = EXTRA_STRUCTURES.find((e) => e.id === 'yazhou_wood_arch');

  const items = [
    // 入口牌坊、南海女神门头+互动游乐馆综合体
    { model: '01_gate_paifang', cx: gateCenter.x, cz: gateCenter.z, wx: 56, dz: 14, h: 22, rotY: 0 },
    { model: '03_goddess_hall', cx: 71.5, cz: 27.5, wx: 106, dz: 88, h: 35, rotY: 0 },

    // 核心剧院群与商业前廊
    { model: '04_theater_1', cx: -156.0, cz: 98.0, wx: 64, dz: 104, h: 28, rotY: Math.PI * 0.5 },
    { model: '05_theater_2', cx: venueMap.theater_2.box.cx, cz: venueMap.theater_2.box.cz, wx: 54, dz: 65, h: 26, rotY: 0 },
    { model: '17_front_gallery', cx: galleryCenter.x, cz: galleryCenter.z, wx: 126, dz: 76, h: 12, rotY: 0 },
    { model: '15_virtual_sand_hall', cx: venueMap.phantom_space.box.cx, cz: venueMap.phantom_space.box.cz, wx: 26, dz: 20, h: 16, rotY: 0 },

    // 火焰山、喊泉古亭、丹霞柱廊、风情街城堡
    { model: '06_volcano_mountain', cx: vol.pos.x, cz: vol.pos.z, wx: 34, dz: 36, h: 25, rotY: -Math.PI * 0.5 },
    { model: '07_shouting_fountain', cx: venueMap.shouting_fountain.box.cx, cz: venueMap.shouting_fountain.box.cz, wx: 24, dz: 35, h: 16, rotY: 0 },
    { model: '08_danxia_colonnade', cx: -108.0, cz: -30.0, wx: 88, dz: 148, h: 28, rotY: 0 },
    { model: '09_exotic_castle', cx: venueMap.exotic_street.box.cx, cz: venueMap.exotic_street.box.cz, wx: 21, dz: 70, h: 18, rotY: Math.PI * 0.5 },

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
        cx: ave.cx + localX,
        cz: ave.cz + localZ,
        wx: 3.4,
        dz: 3.4,
        h: 15.0,
        rotY: 0,
      });
    }
  }
  return items;
}

async function loadAllParkGLBs(parentGroup, venueMap, maxAniso = 8) {
  const loader = new GLTFLoader();
  const placements = buildParkGLBPlacements(venueMap);
  const uniqueModels = [...new Set(placements.map((p) => p.model))];
  const cache = new Map();
  const loaderEl = document.getElementById('modelLoader');

  let done = 0;
  await Promise.all(
    uniqueModels.map(async (name) => {
      const gltf = await loader.loadAsync(`./models/${name}.glb`);
      const root = gltf.scene;
      root.traverse((ch) => {
        if (ch.isMesh) {
          ch.castShadow = true;
          ch.receiveShadow = true;
          if (ch.material && ch.material.map) {
            ch.material.map.anisotropy = maxAniso;
            ch.material.map.needsUpdate = true;
          }
        }
      });
      const box = new THREE.Box3().setFromObject(root);
      const size = new THREE.Vector3();
      box.getSize(size);
      cache.set(name, { root, size, minY: box.min.y });
      done += 1;
      if (loaderEl) loaderEl.textContent = `正在加载 1:1 实景3D模型 (${done}/${uniqueModels.length})...`;
    })
  );

  for (const p of placements) {
    const entry = cache.get(p.model);
    if (!entry) continue;
    const inst = entry.root.clone(true);
    const swapped = Math.abs(Math.sin(p.rotY)) > 0.7;
    const targetLocalX = swapped ? p.dz : p.wx;
    const targetLocalZ = swapped ? p.wx : p.dz;
    const sx = targetLocalX / Math.max(entry.size.x, 0.01);
    const sy = p.h / Math.max(entry.size.y, 0.01);
    const sz = targetLocalZ / Math.max(entry.size.z, 0.01);
    inst.scale.set(sx, sy, sz);
    inst.rotation.y = p.rotY;
    inst.position.set(p.cx, -entry.minY * sy + 0.15, p.cz);
    parentGroup.add(inst);
  }

  if (loaderEl) {
    loaderEl.textContent = '1:1 实景3D模型加载完成';
    setTimeout(() => loaderEl.classList.add('done'), 500);
  }
}

export function createParkScene3D(container, onFrameLabels) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdbe9dc);
  scene.fog = new THREE.FogExp2(0xdbe9dc, 0.00095);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  container.appendChild(renderer.domElement);

  const theta = (MAP_CALIBRATION.thetaDeg * Math.PI) / 180;
  const phi = (MAP_CALIBRATION.phiDeg * Math.PI) / 180;
  const isoDir = new THREE.Vector3(Math.sin(theta) * Math.cos(phi), Math.sin(phi), Math.cos(theta) * Math.cos(phi));

  const perspCam = new THREE.PerspectiveCamera(34, container.clientWidth / container.clientHeight, 2, 2400);
  perspCam.position.copy(isoDir.clone().multiplyScalar(510));

  const orthoCam = new THREE.OrthographicCamera(-267.5, 267.5, 150, -150, 1, 2400);
  orthoCam.position.copy(isoDir.clone().multiplyScalar(800));
  orthoCam.lookAt(0, 0, 0);

  let activeCam = perspCam;
  const controls = new OrbitControls(perspCam, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.maxPolarAngle = Math.PI * 0.455;
  controls.minPolarAngle = Math.PI * 0.12;
  controls.minDistance = 85;
  controls.maxDistance = 780;
  controls.target.set(-8, 0, -18);
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
  const stateRef = { fountainBoost: 0 };
  const texs = createGroundTextures();

  scene.add(buildParkGroundAndPools(venueMap, texs, animHooks, stateRef));

  const glbRootGroup = new THREE.Group();
  scene.add(glbRootGroup);
  loadAllParkGLBs(glbRootGroup, venueMap, renderer.capabilities.getMaxAnisotropy()).catch((err) => {
    console.error('GLB load error:', err);
  });

  const selectRing = new THREE.Mesh(
    new THREE.RingGeometry(11, 14.5, 32),
    new THREE.MeshBasicMaterial({ color: 0xff5722, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
  );
  selectRing.rotation.x = -Math.PI * 0.5;
  selectRing.position.y = 0.52;
  selectRing.visible = false;
  scene.add(selectRing);

  const routeGroup = new THREE.Group();
  scene.add(routeGroup);

  function clearRoute() {
    while (routeGroup.children.length) {
      const ch = routeGroup.children.pop();
      if (ch.geometry) ch.geometry.dispose();
    }
  }

  function showRoute(points3D, color = 0x00e5ff) {
    clearRoute();
    if (!points3D || points3D.length < 2) return;
    const vecs = points3D.map((p) => new THREE.Vector3(p.x, 1.05, p.z));
    const curve = new THREE.CatmullRomCurve3(vecs, false, 'catmullrom', 0.18);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, Math.max(24, vecs.length * 10), 1.45, 8, false),
      new THREE.MeshBasicMaterial({ color })
    );
    routeGroup.add(tube);

    for (const [pt, c] of [[vecs[0], 0x22c55e], [vecs[vecs.length - 1], 0xef4444]]) {
      const marker = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 1.5, 16), new THREE.MeshBasicMaterial({ color: c }));
      marker.position.copy(pt);
      routeGroup.add(marker);
    }
  }

  let flyAnim = null;
  function focusPoint(x, z, dist = 210) {
    activeCam = perspCam;
    controls.enabled = true;
    selectRing.visible = true;
    selectRing.position.set(x, 0.52, z);
    if (Math.hypot(x - venueMap.shouting_fountain.pos.x, z - venueMap.shouting_fountain.pos.z) < 8) {
      stateRef.fountainBoost = 4.0;
    }
    const isPortrait = container.clientHeight > container.clientWidth;
    const actualDist = isPortrait ? Math.max(dist * 1.62, 335) : dist;
    const endTarget = new THREE.Vector3(x, 0, z);
    const endPos = endTarget.clone().add(isoDir.clone().multiplyScalar(actualDist));
    flyAnim = { t: 0, startPos: perspCam.position.clone(), startTarget: controls.target.clone(), endPos, endTarget };
  }

  function resetOverview() {
    activeCam = perspCam;
    controls.enabled = true;
    selectRing.visible = false;
    const endTarget = new THREE.Vector3(-8, 0, -18);
    const dist = container.clientHeight > container.clientWidth ? 610 : 485;
    flyAnim = {
      t: 0,
      startPos: perspCam.position.clone(),
      startTarget: controls.target.clone(),
      endPos: endTarget.clone().add(isoDir.clone().multiplyScalar(dist)),
      endTarget,
    };
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
    handleResize();
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
  }

  function setNightMode(isNight) {
    scene.background.setHex(isNight ? 0x10192b : 0xdbe9dc);
    scene.fog.color.setHex(isNight ? 0x10192b : 0xdbe9dc);
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
    perspCam.updateProjectionMatrix();
    updateOrthoFrustum();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', handleResize);
  resetOverview();

  const projVec = new THREE.Vector3();
  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();
    if (flyAnim) {
      flyAnim.t = Math.min(1, flyAnim.t + 0.045);
      const k = 1 - Math.pow(1 - flyAnim.t, 3);
      perspCam.position.lerpVectors(flyAnim.startPos, flyAnim.endPos, k);
      controls.target.lerpVectors(flyAnim.startTarget, flyAnim.endTarget, k);
      if (flyAnim.t >= 1) flyAnim = null;
    }
    if (controls.enabled) controls.update();
    if (selectRing.visible) {
      const s = 1 + Math.sin(elapsed * 4.5) * 0.1;
      selectRing.scale.set(s, s, 1);
    }
    for (const fn of animHooks) fn(elapsed);
    renderer.render(scene, activeCam);

    if (onFrameLabels) {
      const w = container.clientWidth;
      const h = container.clientHeight;
      onFrameLabels((x, y, z) => {
        projVec.set(x, y, z).project(activeCam);
        return { x: (projVec.x * 0.5 + 0.5) * w, y: (-projVec.y * 0.5 + 0.5) * h, visible: projVec.z >= -1 && projVec.z <= 1 };
      });
    }
  }
  animate();

  return {
    focusPoint,
    resetOverview,
    showRoute,
    showParadeRoute: () => showRoute(PARADE_ROUTE_NODES.map((id) => ROAD_NODES[id].pos), 0xf59e0b),
    clearRoute,
    setOrthoCompare,
    setNightMode,
    resize: handleResize,
  };
}
