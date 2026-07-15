import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clusters, projects, clusterById, type Project, type Cluster } from '../data/projects';

const canvas = document.getElementById('scene-canvas') as HTMLCanvasElement | null;
if (canvas) init(canvas);

function init(canvas: HTMLCanvasElement) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;

  const tooltip = document.getElementById('scene-tooltip')!;
  const tooltipCluster = tooltip.querySelector('.tip-cluster')!;
  const tooltipName = tooltip.querySelector('.tip-name')!;
  const panel = document.getElementById('project-panel')!;
  const panelCluster = panel.querySelector('.panel-cluster')!;
  const panelTitle = panel.querySelector('.panel-title')!;
  const panelBlurb = panel.querySelector('.panel-blurb')!;
  const panelTags = panel.querySelector('.panel-tags')!;
  const panelNote = panel.querySelector('.panel-note') as HTMLElement;
  const panelVisit = panel.querySelector('.panel-visit') as HTMLAnchorElement;
  const panelAppStore = panel.querySelector('.panel-appstore') as HTMLAnchorElement;
  const panelSceneAction = panel.querySelector('.panel-scene-action') as HTMLButtonElement;
  const panelClose = panel.querySelector('.panel-close')!;
  const hudPath = document.getElementById('hud-path')!;
  const hud = document.getElementById('scene-hud')!;

  // ── Renderer / scene / camera ─────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0a0e15');
  scene.fog = new THREE.FogExp2(0x0a0e15, 0.014);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 300);
  const HOME_POS = new THREE.Vector3(0, 7, 24);
  const ORIGIN = new THREE.Vector3(0, 0, 0);
  camera.position.copy(HOME_POS);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.autoRotate = !reduceMotion;
  controls.autoRotateSpeed = 0.45;
  controls.minPolarAngle = Math.PI * 0.12;
  controls.maxPolarAngle = Math.PI * 0.7;
  if (coarsePointer) controls.enableRotate = false;

  scene.add(new THREE.AmbientLight(0x2a3550, 1.4));
  const lamp = new THREE.PointLight(0xffb454, 260, 90, 1.9); // the workshop lamp
  scene.add(lamp);
  const rim = new THREE.DirectionalLight(0x6fd8e0, 0.7);
  rim.position.set(-14, 18, -10);
  scene.add(rim);

  // ── Sprite textures (glow + text labels) ──────────────────
  function makeGlowTexture(): THREE.Texture {
    const size = 128;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.28)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(c);
  }
  const glowTex = makeGlowTexture();

  function makeGlow(color: string, scale: number): THREE.Sprite {
    const mat = new THREE.SpriteMaterial({
      map: glowTex,
      color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.setScalar(scale);
    return sprite;
  }

  function makeLabelSprite(text: string, color: string, worldH = 0.9): THREE.Sprite {
    const pad = 28;
    const fontPx = 54;
    const c = document.createElement('canvas');
    const mctx = c.getContext('2d')!;
    mctx.font = `500 ${fontPx}px "IBM Plex Mono", monospace`;
    const spaced = text.toUpperCase().split('').join('  ');
    const w = Math.ceil(mctx.measureText(spaced).width) + pad * 2 + 40;
    const h = fontPx + pad * 2;
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.font = `500 ${fontPx}px "IBM Plex Mono", monospace`;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pad + 10, h / 2, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#ece7da';
    ctx.fillText(spaced, pad + 40, h / 2 + 2);
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set((w / h) * worldH, worldH, 1);
    return sprite;
  }

  // ── The lamp core (also the workshop's outer shell) ───────
  const core = new THREE.Group();
  const coreMesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.15, 1),
    new THREE.MeshStandardMaterial({
      color: 0xffb454,
      emissive: 0xff9a2e,
      emissiveIntensity: 1.6,
      roughness: 0.3,
      metalness: 0.1,
      flatShading: true,
      transparent: true,
    })
  );
  const coreShell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.1, 1),
    new THREE.MeshBasicMaterial({ color: 0xffb454, wireframe: true, transparent: true, opacity: 0.22 })
  );
  const coreGlow = makeGlow('#ffb454', 11);
  core.add(coreMesh, coreShell, coreGlow);
  scene.add(core);

  // hit target for "enter the workshop"
  const coreHit = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 12, 12),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  scene.add(coreHit);

  // ── Starfield ─────────────────────────────────────────────
  function makeStars(count: number, rMin: number, rMax: number, color: number, size: number) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = rMin + Math.random() * (rMax - rMin);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color,
      size,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    return new THREE.Points(geo, mat);
  }
  const starsFar = makeStars(1600, 45, 130, 0xbcd2e8, 0.32);
  const dustNear = makeStars(260, 14, 34, 0xffb454, 0.22);
  scene.add(starsFar, dustNear);

  // ── The workshop room (revealed when you enter the star) ──
  const room = new THREE.Group();
  room.visible = false;
  scene.add(room);
  const roomFades: { mat: THREE.Material & { opacity: number }; base: number }[] = [];
  function fadeMat(mat: THREE.Material & { opacity: number }, base = 1) {
    mat.transparent = true;
    roomFades.push({ mat, base });
    return mat;
  }

  // walls + floor (a cozy corner facing the camera)
  const wallMat = () =>
    fadeMat(new THREE.MeshStandardMaterial({ color: 0x141922, roughness: 0.95, metalness: 0 }));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), fadeMat(
    new THREE.MeshStandardMaterial({ color: 0x241a12, roughness: 0.9 })
  ));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.6;
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(12, 9), wallMat());
  backWall.position.set(0, 1.9, -5);
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(12, 9), wallMat());
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-5, 1.9, 0);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 4), fadeMat(
    new THREE.MeshStandardMaterial({ color: 0x3a2140, roughness: 1 }), 0.6
  ));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(-0.6, -2.58, -1.4);
  room.add(floor, backWall, leftWall, rug);

  // desk
  const woodMat = fadeMat(new THREE.MeshStandardMaterial({ color: 0x3c2a1b, roughness: 0.7 }));
  const desk = new THREE.Group();
  const deskTop = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.16, 1.4), woodMat);
  deskTop.position.set(0, -0.75, 0);
  const legGeo = new THREE.BoxGeometry(0.14, 1.7, 0.14);
  for (const [lx, lz] of [[-1.7, 0.55], [1.7, 0.55], [-1.7, -0.55], [1.7, -0.55]] as const) {
    const leg = new THREE.Mesh(legGeo, woodMat);
    leg.position.set(lx, -1.6, lz);
    desk.add(leg);
  }
  desk.add(deskTop);
  desk.position.set(-1.4, 0, -3.7);
  room.add(desk);

  // monitor with a live-ish terminal screen
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 640;
  screenCanvas.height = 400;
  const sctx = screenCanvas.getContext('2d')!;
  const screenTex = new THREE.CanvasTexture(screenCanvas);
  screenTex.anisotropy = 4;
  function drawScreen(cursorOn: boolean) {
    const W = screenCanvas.width;
    const H = screenCanvas.height;
    sctx.fillStyle = '#0b1a17';
    sctx.fillRect(0, 0, W, H);
    // faint scanlines
    sctx.fillStyle = 'rgba(120,220,180,0.04)';
    for (let y = 0; y < H; y += 4) sctx.fillRect(0, y, W, 1);
    sctx.font = '500 26px "IBM Plex Mono", monospace';
    sctx.textBaseline = 'top';
    const lines: [string, string][] = [
      ['#7fe0c0', 'ming@workshop ~ %'],
      ['#8b93a3', '> whoami'],
      ['#ece7da', '  ming · software engineer'],
      ['#8b93a3', '> now'],
      ['#ffb454', '  building small, kind software'],
      ['#8b93a3', '> status'],
      ['#7fe0c0', '  ● shipping quietly'],
    ];
    let y = 34;
    for (const [color, text] of lines) {
      sctx.fillStyle = color;
      sctx.fillText(text, 32, y);
      y += 44;
    }
    if (cursorOn) {
      sctx.fillStyle = '#7fe0c0';
      sctx.fillRect(32, y + 4, 16, 26);
    }
    screenTex.needsUpdate = true;
  }
  drawScreen(true);
  const monitor = new THREE.Group();
  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 1.35, 0.08),
    fadeMat(new THREE.MeshStandardMaterial({ color: 0x0c0f16, roughness: 0.6 }))
  );
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.94, 1.2),
    fadeMat(
      new THREE.MeshBasicMaterial({ map: screenTex, transparent: true }) as any
    ) as THREE.Material
  );
  screen.position.z = 0.05;
  const stand = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.5, 0.18),
    fadeMat(new THREE.MeshStandardMaterial({ color: 0x0c0f16, roughness: 0.6 }))
  );
  stand.position.y = -0.9;
  monitor.add(bezel, screen, stand);
  monitor.position.set(-1.4, 0.1, -3.9);
  monitor.rotation.y = 0.32;
  room.add(monitor);
  // warm desk glow
  const deskLampGlow = makeGlow('#ffcf8f', 3.2);
  deskLampGlow.position.set(0.4, 0.2, -3.4);
  fadeMat(deskLampGlow.material as any, 0.7);
  room.add(deskLampGlow);

  // poster on the back wall
  const posterCanvas = document.createElement('canvas');
  posterCanvas.width = 480;
  posterCanvas.height = 640;
  const pctx = posterCanvas.getContext('2d')!;
  pctx.fillStyle = '#12100c';
  pctx.fillRect(0, 0, 480, 640);
  pctx.strokeStyle = '#3a2f1e';
  pctx.lineWidth = 8;
  pctx.strokeRect(16, 16, 448, 608);
  pctx.textAlign = 'center';
  pctx.fillStyle = '#8b93a3';
  pctx.font = '500 22px "IBM Plex Mono", monospace';
  pctx.fillText('T H E   M A N I F E S T O', 240, 90);
  pctx.fillStyle = '#ece7da';
  pctx.font = '600 62px "Fraunces", Georgia, serif';
  pctx.fillText('quiet', 240, 250);
  pctx.fillStyle = '#ffb454';
  pctx.font = 'italic 600 62px "Fraunces", Georgia, serif';
  pctx.fillText('machines', 240, 330);
  pctx.fillStyle = '#a9adb8';
  pctx.font = '400 24px "Fraunces", Georgia, serif';
  pctx.fillText('small · kind · finished', 240, 470);
  pctx.fillStyle = '#6fd8e0';
  pctx.font = '500 18px "IBM Plex Mono", monospace';
  pctx.fillText('— ming', 240, 560);
  const posterTex = new THREE.CanvasTexture(posterCanvas);
  posterTex.anisotropy = 4;
  const poster = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 2.93),
    fadeMat(new THREE.MeshBasicMaterial({ map: posterTex, transparent: true }) as any) as THREE.Material
  );
  poster.position.set(2.3, 1.7, -4.9);
  room.add(poster);

  // shelf on the left wall, holding little project tokens
  const shelfMat = fadeMat(new THREE.MeshStandardMaterial({ color: 0x2a2016, roughness: 0.8 }));
  const tokenGeo: Record<string, THREE.BufferGeometry> = {
    arcade: new THREE.IcosahedronGeometry(0.22, 0),
    toolbench: new THREE.BoxGeometry(0.3, 0.3, 0.3),
    opensource: new THREE.OctahedronGeometry(0.24, 0),
    pocket: new THREE.CapsuleGeometry(0.12, 0.22, 4, 8),
  };
  [0.5, 1.7].forEach((sy, si) => {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 3.4), shelfMat);
    plank.position.set(-4.9, sy, -1.6);
    room.add(plank);
    clusters.forEach((cl, ci) => {
      const tok = new THREE.Mesh(
        tokenGeo[cl.id],
        fadeMat(
          new THREE.MeshStandardMaterial({
            color: cl.color,
            emissive: cl.color,
            emissiveIntensity: 0.5,
            roughness: 0.4,
            flatShading: true,
          })
        )
      );
      tok.position.set(-4.78, sy + 0.28, -2.7 + (ci + si * 0.5) * 0.75);
      tok.userData.spin = true;
      room.add(tok);
    });
  });

  // window on the back wall, looking out at the constellation
  const winFrame = new THREE.Mesh(
    new THREE.BoxGeometry(2.7, 1.9, 0.12),
    fadeMat(new THREE.MeshStandardMaterial({ color: 0x2a2016, roughness: 0.8 }))
  );
  winFrame.position.set(-2.1, 2.3, -4.95);
  const winPane = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 1.6),
    fadeMat(
      new THREE.MeshBasicMaterial({ color: 0x1a2740, transparent: true, blending: THREE.AdditiveBlending }) as any
    ) as THREE.Material,
    0.6
  );
  winPane.position.set(-2.1, 2.3, -4.88);
  const winStar1 = makeGlow('#6fd8e0', 0.7);
  winStar1.position.set(-2.6, 2.5, -4.85);
  fadeMat(winStar1.material as any, 0.9);
  const winStar2 = makeGlow('#f2889b', 0.5);
  winStar2.position.set(-1.6, 2.1, -4.85);
  fadeMat(winStar2.material as any, 0.9);
  room.add(winFrame, winPane, winStar1, winStar2);

  // ── Clusters: rings + labels + project nodes ──────────────
  const clusterGeometry: Record<string, THREE.BufferGeometry> = {
    arcade: new THREE.IcosahedronGeometry(0.62, 0),
    toolbench: new THREE.BoxGeometry(0.85, 0.85, 0.85),
    opensource: new THREE.OctahedronGeometry(0.68, 0),
    pocket: new THREE.CapsuleGeometry(0.34, 0.62, 4, 10),
  };

  const ringConfigs = [
    { radius: 6.5, tilt: new THREE.Euler(0.45, 0, 0.12), speed: 0.05 },
    { radius: 8.8, tilt: new THREE.Euler(-0.35, 0.6, -0.2), speed: -0.038 },
    { radius: 11.0, tilt: new THREE.Euler(0.2, -0.4, 0.5), speed: 0.03 },
    { radius: 13.2, tilt: new THREE.Euler(-0.55, 0.2, -0.35), speed: -0.024 },
  ];

  interface Node {
    project: Project;
    color: string;
    mesh: THREE.Mesh;
    holder: THREE.Group;
    baseScale: number;
    hoverT: number;
    bobPhase: number;
  }

  interface ClusterView {
    cluster: Cluster;
    cfg: (typeof ringConfigs)[number];
    pivot: THREE.Group;
    ring: THREE.Mesh;
    label: THREE.Sprite;
    labelHolder: THREE.Group;
    labelBaseW: number;
    nodes: Node[];
    focus: number;
    focusTarget: number;
    labelHoverT: number;
  }

  const clusterViews: ClusterView[] = [];
  const nodes: Node[] = [];
  const hitToNode = new Map<THREE.Object3D, Node>();
  const labelToCluster = new Map<THREE.Object3D, ClusterView>();

  clusters.forEach((cluster, ci) => {
    const cfg = ringConfigs[ci];
    const pivot = new THREE.Group();
    pivot.rotation.copy(cfg.tilt);
    scene.add(pivot);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(cfg.radius, 0.012, 8, 160),
      new THREE.MeshBasicMaterial({ color: cluster.color, transparent: true, opacity: 0.16 })
    );
    ring.rotation.x = Math.PI / 2;
    pivot.add(ring);

    const labelHolder = new THREE.Group();
    labelHolder.rotation.y = ci * 1.7 + 0.8;
    const label = makeLabelSprite(cluster.label, cluster.color);
    label.position.set(cfg.radius, 1.35, 0);
    labelHolder.add(label);
    pivot.add(labelHolder);

    const view: ClusterView = {
      cluster,
      cfg,
      pivot,
      ring,
      label,
      labelHolder,
      labelBaseW: label.scale.x / label.scale.y,
      nodes: [],
      focus: 1,
      focusTarget: 1,
      labelHoverT: 0,
    };
    labelToCluster.set(label, view);

    const members = projects.filter((p) => p.cluster === cluster.id);
    members.forEach((project, pi) => {
      const holder = new THREE.Group();
      holder.rotation.y = (pi / members.length) * Math.PI * 2 + ci * 0.9;
      pivot.add(holder);

      const mesh = new THREE.Mesh(
        clusterGeometry[cluster.id],
        new THREE.MeshStandardMaterial({
          color: cluster.color,
          emissive: cluster.color,
          emissiveIntensity: 0.55,
          roughness: 0.35,
          metalness: 0.15,
          flatShading: true,
          transparent: true,
        })
      );
      mesh.position.x = cfg.radius;
      mesh.add(makeGlow(cluster.color, 3.4));
      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(1.5, 8, 8),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      mesh.add(hit);
      holder.add(mesh);

      const node: Node = {
        project,
        color: cluster.color,
        mesh,
        holder,
        baseScale: 1,
        hoverT: 0,
        bobPhase: Math.random() * Math.PI * 2,
      };
      hitToNode.set(hit, node);
      nodes.push(node);
      view.nodes.push(node);
    });

    clusterViews.push(view);
  });

  const nodeHitTargets = [...hitToNode.keys()];
  const labelTargets = [...labelToCluster.keys()];
  const clusterViewById = Object.fromEntries(clusterViews.map((v) => [v.cluster.id, v]));

  // ── Room hotspots (interactive furniture) ─────────────────
  interface Spot {
    id: string;
    color: string;
    label: string;
    pos: THREE.Vector3;
    normal: THREE.Vector3; // direction the camera should sit, from pos
    viewDist: number;
    content: PanelContent;
    indicator: THREE.Sprite;
  }
  const spots: Spot[] = [];
  const spotHitTargets: THREE.Object3D[] = [];
  const hitToSpot = new Map<THREE.Object3D, Spot>();

  function addSpot(def: {
    id: string;
    color: string;
    label: string;
    pos: [number, number, number];
    normal: [number, number, number];
    viewDist: number;
    content: PanelContent;
  }) {
    const pos = new THREE.Vector3(...def.pos);
    const indicator = makeGlow(def.color, 0.85);
    indicator.position.copy(pos).add(new THREE.Vector3(...def.normal).normalize().multiplyScalar(0.35));
    fadeMat(indicator.material as any, 1);
    room.add(indicator);
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 10, 10),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    hit.position.copy(pos);
    room.add(hit);
    const spot: Spot = {
      id: def.id,
      color: def.color,
      label: def.label,
      pos,
      normal: new THREE.Vector3(...def.normal).normalize(),
      viewDist: def.viewDist,
      content: def.content,
      indicator,
    };
    hitToSpot.set(hit, spot);
    spotHitTargets.push(hit);
    spots.push(spot);
  }

  addSpot({
    id: 'screen',
    color: '#7fe0c0',
    label: 'the screen',
    pos: [-1.1, 0.2, -3.6],
    normal: [0.5, 0.25, 1],
    viewDist: 3.4,
    content: {
      color: '#7fe0c0',
      kicker: 'the screen · now',
      title: "What I'm building",
      body: "Right now: small browser games, developer tools, and a couple of iOS apps. The screen's always on and the coffee's usually cold. I work in the open — most of what's here lives on GitHub.",
      note: 'The numbers section below is pulled straight from my GitHub.',
      action: { label: 'See the numbers ↓', kind: 'scroll', target: '#github' },
    },
  });
  addSpot({
    id: 'poster',
    color: '#6fd8e0',
    label: 'the poster',
    pos: [2.3, 1.7, -4.7],
    normal: [0.1, 0.1, 1],
    viewDist: 3.6,
    content: {
      color: '#6fd8e0',
      kicker: 'the poster · manifesto',
      title: 'Quiet machines',
      body: 'Software can be small, kind, and finished. No ads, no dark patterns, no notifications begging for attention. Build the small thing well — then let it wait patiently until someone needs it.',
      action: { label: 'Read the house rules ↓', kind: 'scroll', target: '#principles' },
    },
  });
  addSpot({
    id: 'shelf',
    color: '#9ee493',
    label: 'the shelf',
    pos: [-4.6, 1.1, -1.9],
    normal: [1, 0.15, 0.4],
    viewDist: 3.4,
    content: {
      color: '#9ee493',
      kicker: 'the shelf · the work',
      title: 'Everything on the shelf',
      body: "Four shelves' worth: games for kids, developer tools, open-source pieces, and pocket-sized iOS apps. Every little token here is a real project — the same ones orbiting as planets outside.",
      action: { label: 'Explore the rings ↗', kind: 'overview' },
    },
  });
  addSpot({
    id: 'window',
    color: '#f2889b',
    label: 'the window',
    pos: [-2.1, 2.3, -4.7],
    normal: [0, 0.1, 1],
    viewDist: 3.4,
    content: {
      color: '#f2889b',
      kicker: 'the window · outside',
      title: 'Out to the constellation',
      body: 'Beyond the glass, the projects drift in their rings. Step back outside and wander — click any planet to see what it is, or a ring-label to visit a whole shelf.',
      action: { label: 'Step outside ↗', kind: 'overview' },
    },
  });

  // ══ Rocket + flight mode (the little exploration game) ═════
  const UP = new THREE.Vector3(0, 1, 0);

  // A low-poly rocket, built from primitives, nose pointing +Y.
  const rocket = new THREE.Group();
  const rocketBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.19, 0.58, 16),
    new THREE.MeshStandardMaterial({ color: 0xdfe4ec, roughness: 0.35, metalness: 0.5, flatShading: true })
  );
  const rocketNose = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.34, 16),
    new THREE.MeshStandardMaterial({
      color: 0xffb454,
      emissive: 0xff9a2e,
      emissiveIntensity: 0.7,
      roughness: 0.4,
      flatShading: true,
    })
  );
  rocketNose.position.y = 0.46;
  const rocketWindow = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 14, 14),
    new THREE.MeshStandardMaterial({ color: 0x6fd8e0, emissive: 0x6fd8e0, emissiveIntensity: 0.9 })
  );
  rocketWindow.position.set(0, 0.15, 0.15);
  const finMat = new THREE.MeshStandardMaterial({ color: 0xf2889b, roughness: 0.5, flatShading: true });
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 4), finMat);
    const a = (i / 3) * Math.PI * 2;
    fin.position.set(Math.cos(a) * 0.2, -0.28, Math.sin(a) * 0.2);
    fin.rotation.x = Math.PI;
    fin.rotation.y = -a;
    rocket.add(fin);
  }
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.5, 12),
    new THREE.MeshBasicMaterial({
      color: 0xffcf6b,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  flame.position.y = -0.55;
  flame.rotation.x = Math.PI;
  const thrustGlow = makeGlow('#ffb454', 1.3);
  thrustGlow.position.y = -0.55;
  const rocketHit = new THREE.Mesh(
    new THREE.SphereGeometry(1.2, 8, 8),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  rocket.add(rocketBody, rocketNose, rocketWindow, flame, thrustGlow, rocketHit);
  // Docked out among the near rings, clearly away from the star so it never
  // competes with the workshop click (verified on-screen from the home camera).
  const ROCKET_DOCK = new THREE.Vector3(6.5, 2.5, 4);
  rocket.position.copy(ROCKET_DOCK);
  rocket.scale.setScalar(1.25);
  scene.add(rocket);

  // Everything that only exists in flight mode lives here and fades with flightReveal.
  const flightGroup = new THREE.Group();
  flightGroup.visible = false;
  scene.add(flightGroup);
  const flightFades: { mat: THREE.Material & { opacity: number }; base: number }[] = [];
  const flightFade = (mat: THREE.Material & { opacity: number }, base = 1) => {
    mat.transparent = true;
    flightFades.push({ mat, base });
    return mat;
  };

  // Rocket exhaust trail (a comet-tail of recent positions, brightest at the head).
  const TRAIL_N = 26;
  const trailPos = new Float32Array(TRAIL_N * 3);
  const trailCol = new Float32Array(TRAIL_N * 3);
  for (let i = 0; i < TRAIL_N; i++) {
    const f = 1 - i / TRAIL_N;
    trailCol[i * 3] = 1 * f;
    trailCol[i * 3 + 1] = 0.7 * f;
    trailCol[i * 3 + 2] = 0.33 * f;
  }
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3));
  const trail = new THREE.Points(
    trailGeo,
    new THREE.PointsMaterial({
      size: 0.5,
      map: glowTex,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })
  );
  flightGroup.add(trail);
  let trailSeeded = false;
  function seedTrail() {
    for (let i = 0; i < TRAIL_N; i++) {
      trailPos[i * 3] = rocket.position.x;
      trailPos[i * 3 + 1] = rocket.position.y;
      trailPos[i * 3 + 2] = rocket.position.z;
    }
    trailGeo.attributes.position.needsUpdate = true;
    trailSeeded = true;
  }

  // Mystery stars — fly to each to discover its surprise.
  interface MysteryStar {
    id: string;
    name: string;
    color: string;
    pos: THREE.Vector3;
    content: PanelContent;
    effect?: 'constellation' | 'comet';
    discovered: boolean;
    mesh: THREE.Mesh;
    glow: THREE.Sprite;
    bob: number;
  }
  const STAR_DEFS: {
    id: string;
    name: string;
    color: string;
    pos: [number, number, number];
    title: string;
    body: string;
    note?: string;
    effect?: 'constellation' | 'comet';
  }[] = [
    {
      id: 'wish',
      name: 'the wishing star',
      color: '#ffcf6b',
      pos: [22, 7, -9],
      title: 'The Wishing Star',
      body: "This is where the 2 a.m. ideas go to shine. Everything I've shipped started as a wish about this bright. Go on — make one.",
      note: 'Fly back anytime; the sky keeps your discoveries.',
    },
    {
      id: 'maker',
      name: 'the maker',
      color: '#6fd8e0',
      pos: [-21, -3, -15],
      title: 'The Maker',
      body: "Look — the stars here line up. Sailors named their constellations; I named this one 'The Maker.' It points the way home when a build breaks at midnight.",
      effect: 'constellation',
    },
    {
      id: 'wander',
      name: 'wanderlust',
      color: '#9ee493',
      pos: [9, -9, 24],
      title: 'Wanderlust',
      body: "A comet just tore past. Comets, like good ideas, don't wait around — you chase them or you lose them. So I keep the engine warm.",
      effect: 'comet',
    },
    {
      id: 'arcade',
      name: 'the far arcade',
      color: '#f2889b',
      pos: [-17, 11, 11],
      title: 'The Far Arcade',
      body: "Somewhere out here the kids' games never end — no scores to beat, no coins to insert, just play. Tag. You're it.",
    },
    {
      id: 'home',
      name: 'home, far away',
      color: '#ece7da',
      pos: [27, 13, 19],
      title: 'Home, Far Away',
      body: 'Turn around. That small warm dot is the workshop — one desk, one lamp, one person. Funny how far a small thing travels when you let it go.',
    },
  ];
  const stars: MysteryStar[] = [];
  const starHitTargets: THREE.Object3D[] = [];
  const hitToStar = new Map<THREE.Object3D, MysteryStar>();
  const starGeo = new THREE.IcosahedronGeometry(0.7, 0);
  for (const def of STAR_DEFS) {
    const pos = new THREE.Vector3(...def.pos);
    const mesh = new THREE.Mesh(
      starGeo,
      flightFade(
        new THREE.MeshStandardMaterial({
          color: def.color,
          emissive: def.color,
          emissiveIntensity: 1.1,
          roughness: 0.4,
          flatShading: true,
        }) as any
      ) as THREE.Material
    );
    mesh.position.copy(pos);
    const glow = makeGlow(def.color, 4.2);
    flightFade(glow.material as any, 1);
    mesh.add(glow);
    flightGroup.add(mesh);
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(2.4, 8, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    hit.position.copy(pos);
    flightGroup.add(hit);
    const star: MysteryStar = {
      id: def.id,
      name: def.name,
      color: def.color,
      pos,
      effect: def.effect,
      discovered: false,
      mesh,
      glow,
      bob: Math.random() * Math.PI * 2,
      content: {
        color: def.color,
        kicker: `deep space · ${def.name}`,
        title: def.title,
        body: def.body,
        note: def.note,
      },
    };
    hitToStar.set(hit, star);
    starHitTargets.push(hit);
    stars.push(star);
  }

  // Particle burst (reused on each discovery).
  const BURST_N = 200;
  const burstPos = new Float32Array(BURST_N * 3);
  const burstVel = new Float32Array(BURST_N * 3);
  const burstGeo = new THREE.BufferGeometry();
  burstGeo.setAttribute('position', new THREE.BufferAttribute(burstPos, 3));
  const burstMat = flightFade(
    new THREE.PointsMaterial({
      size: 0.5,
      map: glowTex,
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    }) as any
  ) as THREE.PointsMaterial;
  const burstPts = new THREE.Points(burstGeo, burstMat);
  flightGroup.add(burstPts);
  let burstAge = 99;
  const BURST_LIFE = 1.4;
  function burst(at: THREE.Vector3, color: string) {
    burstMat.color.set(color);
    burstAge = 0;
    for (let i = 0; i < BURST_N; i++) {
      burstPos[i * 3] = at.x;
      burstPos[i * 3 + 1] = at.y;
      burstPos[i * 3 + 2] = at.z;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const sp = 2 + Math.random() * 6;
      burstVel[i * 3] = Math.sin(ph) * Math.cos(th) * sp;
      burstVel[i * 3 + 1] = Math.cos(ph) * sp;
      burstVel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * sp;
    }
    burstGeo.attributes.position.needsUpdate = true;
  }

  // Streaks — shooting stars / comets (a small reusable pool).
  const streaks = Array.from({ length: 4 }, () => {
    const g = makeGlow('#ffffff', 1.1);
    flightFade(g.material as any, 1);
    g.visible = false;
    flightGroup.add(g);
    return { glow: g, from: new THREE.Vector3(), to: new THREE.Vector3(), age: 0, dur: 1, active: false };
  });
  function streak(from: THREE.Vector3, to: THREE.Vector3, color: string, dur: number) {
    const s = streaks.find((x) => !x.active) ?? streaks[0];
    s.from.copy(from);
    s.to.copy(to);
    s.dur = dur;
    s.age = 0;
    s.active = true;
    (s.glow.material as THREE.SpriteMaterial).color.set(color);
    s.glow.visible = true;
  }

  // Hidden constellation revealed at "The Maker" — a little rocket drawn in lines.
  const makerPos = new THREE.Vector3(...STAR_DEFS[1].pos);
  const shape: [number, number][] = [
    [0, 2],
    [-0.8, 0.4],
    [-0.8, -1.2],
    [0, -0.6],
    [0.8, -1.2],
    [0.8, 0.4],
    [0, 2], // body outline
  ];
  const constPts: THREE.Vector3[] = [];
  for (let i = 0; i < shape.length - 1; i++) {
    constPts.push(new THREE.Vector3(shape[i][0] * 1.6, shape[i][1] * 1.6, 0).add(makerPos));
    constPts.push(new THREE.Vector3(shape[i + 1][0] * 1.6, shape[i + 1][1] * 1.6, 0).add(makerPos));
  }
  const constGeo = new THREE.BufferGeometry().setFromPoints(constPts);
  const constLines = new THREE.LineSegments(
    constGeo,
    flightFade(
      new THREE.LineBasicMaterial({ color: 0x6fd8e0, transparent: true, opacity: 0 }) as any
    ) as THREE.Material
  );
  constLines.userData.reveal = 0;
  flightGroup.add(constLines);

  // A soft halo the main star earns once the whole sky is charted.
  const coreHalo = new THREE.Mesh(
    new THREE.TorusGeometry(3.1, 0.05, 8, 80),
    new THREE.MeshBasicMaterial({ color: 0xffcf6b, transparent: true, opacity: 0 })
  );
  coreHalo.rotation.x = Math.PI / 2.3;
  core.add(coreHalo);

  // ── Panel content model ───────────────────────────────────
  interface PanelContent {
    color: string;
    kicker: string;
    title: string;
    body: string;
    tags?: string[];
    note?: string;
    visitHref?: string;
    appStoreHref?: string;
    action?: { label: string; kind: 'scroll' | 'overview' | 'flight'; target?: string };
  }

  let currentAction: (() => void) | null = null;

  function openInfoPanel(c: PanelContent) {
    panelCluster.textContent = c.kicker;
    panelTitle.textContent = c.title;
    panelBlurb.textContent = c.body;
    panelTags.innerHTML = (c.tags ?? []).map((t) => `<li class="qb-badge">${t}</li>`).join('');
    (panelTags as HTMLElement).style.display = c.tags && c.tags.length ? '' : 'none';
    if (c.note) {
      panelNote.textContent = c.note;
      panelNote.style.display = '';
    } else {
      panelNote.style.display = 'none';
    }
    panel.style.setProperty('--panel-color', c.color);

    if (c.visitHref) {
      panelVisit.href = c.visitHref;
      panelVisit.style.display = '';
    } else panelVisit.style.display = 'none';

    if (c.appStoreHref) {
      panelAppStore.href = c.appStoreHref;
      panelAppStore.style.display = '';
    } else panelAppStore.style.display = 'none';

    if (c.action) {
      panelSceneAction.textContent = c.action.label;
      panelSceneAction.style.display = '';
      const act = c.action;
      currentAction = () => {
        if (act.kind === 'overview') goOverview();
        else if (act.kind === 'flight') resumeFlight();
        else if (act.kind === 'scroll' && act.target) {
          document.querySelector(act.target)?.scrollIntoView({ behavior: 'smooth' });
        }
      };
    } else {
      panelSceneAction.style.display = 'none';
      currentAction = null;
    }

    panel.classList.add('open');
  }

  panelSceneAction.addEventListener('click', () => currentAction?.());

  // ── View state machine ────────────────────────────────────
  type View =
    | { level: 'overview' }
    | { level: 'cluster'; cluster: ClusterView }
    | { level: 'node'; node: Node }
    | { level: 'workshop' }
    | { level: 'spot'; spot: Spot }
    | { level: 'flight' }
    | { level: 'discovery'; star: MysteryStar };

  let view: View = { level: 'overview' };
  let roomRevealTarget = 0;
  let roomReveal = 0;
  const rootEl = document.documentElement;
  const setExploring = (on: boolean) => rootEl.classList.toggle('exploring', on);
  const camTarget = { pos: HOME_POS.clone(), look: ORIGIN.clone(), active: false };
  const worldPos = new THREE.Vector3();

  function flyTo(pos: THREE.Vector3, look: THREE.Vector3) {
    camTarget.pos.copy(pos);
    camTarget.look.copy(look);
    camTarget.active = true;
  }

  function setFocus(focused: ClusterView | null, dimTo: number) {
    for (const v of clusterViews) v.focusTarget = !focused || v === focused ? 1 : dimTo;
  }

  function setAllFocus(value: number) {
    for (const v of clusterViews) v.focusTarget = value;
  }

  function clusterCamPos(v: ClusterView): THREE.Vector3 {
    const normal = new THREE.Vector3(0, 1, 0).applyEuler(v.cfg.tilt);
    if (normal.z < 0) normal.negate();
    return normal
      .multiplyScalar(0.8)
      .add(new THREE.Vector3(0, 0.42, 0.85))
      .normalize()
      .multiplyScalar(v.cfg.radius * 2.05);
  }

  function goOverview() {
    view = { level: 'overview' };
    roomRevealTarget = 0;
    flightRevealTarget = 0;
    travel = null;
    rocket.position.copy(ROCKET_DOCK);
    rocket.quaternion.identity();
    trailSeeded = false;
    rootEl.classList.remove('flying');
    setExploring(false);
    if (!coarsePointer) controls.enableRotate = true;
    flyTo(HOME_POS, ORIGIN);
    setFocus(null, 1);
    controls.autoRotate = !reduceMotion;
    panel.classList.remove('open');
    hud.classList.remove('shifted');
    renderHud();
  }

  function goCluster(v: ClusterView) {
    view = { level: 'cluster', cluster: v };
    roomRevealTarget = 0;
    setExploring(true);
    flyTo(clusterCamPos(v), ORIGIN);
    setFocus(v, 0.16);
    controls.autoRotate = false;
    panel.classList.remove('open');
    hud.classList.remove('shifted');
    hideTooltip();
    renderHud();
  }

  function goNode(node: Node) {
    view = { level: 'node', node };
    roomRevealTarget = 0;
    setExploring(true);
    hideTooltip();
    node.mesh.getWorldPosition(worldPos);
    const dir = worldPos.clone().normalize();
    flyTo(
      worldPos.clone().add(dir.multiplyScalar(4.5)).add(new THREE.Vector3(0, 1.4, 0)),
      worldPos.clone()
    );
    setFocus(clusterViewById[node.project.cluster], 0.12);
    controls.autoRotate = false;
    openInfoPanel({
      color: node.color,
      kicker: clusterById[node.project.cluster].label,
      title: node.project.title,
      body: node.project.blurb,
      tags: node.project.tags,
      visitHref: node.project.url,
      appStoreHref: node.project.appStore,
    });
    hud.classList.add('shifted');
    renderHud();
  }

  const WORKSHOP_CAM = new THREE.Vector3(5.6, 2.7, 6.9);
  const WORKSHOP_LOOK = new THREE.Vector3(-0.4, 0.5, -1.4);

  function goWorkshop() {
    view = { level: 'workshop' };
    roomRevealTarget = 1;
    setExploring(true);
    room.visible = true;
    flyTo(WORKSHOP_CAM, WORKSHOP_LOOK);
    setAllFocus(0.3); // planets glow softly outside the window
    controls.autoRotate = false;
    panel.classList.remove('open');
    hud.classList.remove('shifted');
    hideTooltip();
    renderHud();
  }

  function goSpot(spot: Spot) {
    view = { level: 'spot', spot };
    roomRevealTarget = 1;
    setExploring(true);
    room.visible = true;
    hideTooltip();
    flyTo(spot.pos.clone().add(spot.normal.clone().multiplyScalar(spot.viewDist)), spot.pos.clone());
    openInfoPanel(spot.content);
    hud.classList.add('shifted');
    renderHud();
  }

  function stepBack() {
    if (view.level === 'node') goCluster(clusterViewById[view.node.project.cluster]);
    else if (view.level === 'cluster') goOverview();
    else if (view.level === 'spot') goWorkshop();
    else if (view.level === 'workshop') goOverview();
    else if (view.level === 'discovery') resumeFlight();
    else if (view.level === 'flight') goOverview();
  }

  // ── Flight mode ───────────────────────────────────────────
  let flightReveal = 0;
  let flightRevealTarget = 0;
  let charted = 0;
  const chartedEl = document.getElementById('charted-count');
  const chartedTotalEl = document.getElementById('charted-total');
  if (chartedTotalEl) chartedTotalEl.textContent = String(stars.length);
  type Travel = { curve: THREE.CatmullRomCurve3; t: number; dur: number; onArrive: () => void };
  let travel: Travel | null = null;

  function startTravel(from: THREE.Vector3, to: THREE.Vector3, dur: number, onArrive: () => void) {
    const mid = from.clone().lerp(to, 0.5);
    mid.y += from.distanceTo(to) * 0.18 + 2;
    travel = { curve: new THREE.CatmullRomCurve3([from.clone(), mid, to.clone()]), t: 0, dur, onArrive };
    if (!coarsePointer) controls.enableRotate = false;
  }

  function goFlight() {
    view = { level: 'flight' };
    roomRevealTarget = 0;
    flightRevealTarget = 1;
    flightGroup.visible = true;
    setExploring(true);
    rootEl.classList.add('flying');
    setAllFocus(0.28); // the home system recedes
    controls.autoRotate = false;
    panel.classList.remove('open');
    hud.classList.remove('shifted');
    hideTooltip();
    if (!trailSeeded) seedTrail();
    // launch: fly out from the star to a parking spot in open space
    startTravel(ROCKET_DOCK.clone(), new THREE.Vector3(10, 5, 9), 2.4, () => {});
    renderHud();
  }

  function resumeFlight() {
    view = { level: 'flight' };
    setExploring(true);
    rootEl.classList.add('flying');
    panel.classList.remove('open');
    hud.classList.remove('shifted');
    controls.target.copy(rocket.position);
    if (!coarsePointer) controls.enableRotate = true;
    renderHud();
  }

  function flyToStar(star: MysteryStar) {
    const from = rocket.position.clone();
    const to = star.pos.clone().add(from.clone().sub(star.pos).normalize().multiplyScalar(4.2));
    hideTooltip();
    panel.classList.remove('open');
    startTravel(from, to, 2.6, () => arriveStar(star));
  }

  function arriveStar(star: MysteryStar) {
    // frame the star for a nice look-around
    const from = camera.position.clone().sub(star.pos);
    if (from.lengthSq() < 1) from.set(0, 1.2, 6);
    camTarget.pos.copy(star.pos).add(from.normalize().multiplyScalar(6.5));
    camTarget.look.copy(star.pos);
    camTarget.active = true;
    if (!coarsePointer) controls.enableRotate = true;
    if (!star.discovered) discover(star);
    else openDiscoveryPanel(star);
    view = { level: 'discovery', star };
    hud.classList.add('shifted');
    renderHud();
  }

  function discover(star: MysteryStar) {
    star.discovered = true;
    charted++;
    if (chartedEl) chartedEl.textContent = String(charted);
    burst(star.pos, star.color);
    if (star.effect === 'constellation') constLines.userData.reveal = 1;
    if (star.effect === 'comet') {
      const off = new THREE.Vector3(18, 6, -4);
      streak(star.pos.clone().add(off), star.pos.clone().sub(off), star.color, 1.6);
    }
    openDiscoveryPanel(star);
    if (charted === stars.length) finale();
  }

  function openDiscoveryPanel(star: MysteryStar) {
    const all = charted === stars.length;
    openInfoPanel({
      ...star.content,
      note: all
        ? "You've charted the whole sky. Thanks for wandering — you know me a little now. — Ming"
        : star.content.note,
      action: all
        ? { label: 'Back to the workshop ↗', kind: 'overview' }
        : { label: 'Back to the sky ↗', kind: 'flight' },
    });
  }

  function finale() {
    // a shower of shooting stars + the star earns its halo
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const from = new THREE.Vector3(Math.cos(a) * 30, 12 + i * 4, Math.sin(a) * 30);
      const to = from.clone().multiplyScalar(-0.6);
      streak(from, to, '#ffcf6b', 1.8 + i * 0.3);
    }
    coreHalo.userData.earned = true;
  }

  function updateFlight(dt: number) {
    flightReveal += (flightRevealTarget - flightReveal) * Math.min(dt * 3, 1);
    if (Math.abs(flightReveal - flightRevealTarget) < 0.004) flightReveal = flightRevealTarget;
    flightGroup.visible = flightReveal > 0.02;
    for (const f of flightFades) f.mat.opacity = f.base * flightReveal;
    (trail.material as THREE.PointsMaterial).opacity = flightReveal;

    // constellation progressive reveal
    const cm = constLines.material as THREE.LineBasicMaterial;
    const cr = (constLines.userData.reveal ?? 0) as number;
    cm.opacity = Math.min(cm.opacity + (cr * 0.85 - cm.opacity) * Math.min(dt * 2, 1), 0.85) * flightReveal;

    // core halo
    const hm = coreHalo.material as THREE.MeshBasicMaterial;
    hm.opacity += ((coreHalo.userData.earned ? 0.5 : 0) - hm.opacity) * Math.min(dt * 2, 1);

    // travel along the flight path (drives rocket + chase camera)
    if (travel) {
      travel.t += dt / travel.dur;
      const tt = Math.min(travel.t, 1);
      const p = travel.curve.getPointAt(tt);
      const dir = travel.curve.getTangentAt(tt).normalize();
      rocket.position.copy(p);
      rocket.quaternion.setFromUnitVectors(UP, dir);
      camTarget.pos.copy(p).addScaledVector(dir, -4).add(new THREE.Vector3(0, 1.5, 0));
      camTarget.look.copy(p);
      camTarget.active = true;
      if (travel.t >= 1) {
        const cb = travel.onArrive;
        travel = null;
        cb();
      }
    }

    // trail follows the rocket (shift the buffer, head = current position)
    if (flightReveal > 0.05 && trailSeeded) {
      for (let i = TRAIL_N - 1; i > 0; i--) {
        trailPos[i * 3] = trailPos[(i - 1) * 3];
        trailPos[i * 3 + 1] = trailPos[(i - 1) * 3 + 1];
        trailPos[i * 3 + 2] = trailPos[(i - 1) * 3 + 2];
      }
      trailPos[0] = rocket.position.x - rocket.matrixWorld.elements[4] * 0.5;
      trailPos[1] = rocket.position.y - rocket.matrixWorld.elements[5] * 0.5;
      trailPos[2] = rocket.position.z - rocket.matrixWorld.elements[6] * 0.5;
      trailGeo.attributes.position.needsUpdate = true;
    }

    // burst
    if (burstAge < BURST_LIFE) {
      burstAge += dt;
      const k = burstAge / BURST_LIFE;
      for (let i = 0; i < BURST_N; i++) {
        burstPos[i * 3] += burstVel[i * 3] * dt;
        burstPos[i * 3 + 1] += burstVel[i * 3 + 1] * dt;
        burstPos[i * 3 + 2] += burstVel[i * 3 + 2] * dt;
      }
      burstGeo.attributes.position.needsUpdate = true;
      burstMat.opacity = (1 - k) * flightReveal;
      burstMat.size = 0.5 * (1 - k * 0.5);
    }

    // streaks
    for (const s of streaks) {
      if (!s.active) continue;
      s.age += dt;
      const k = Math.min(s.age / s.dur, 1);
      const e = 1 - Math.pow(1 - k, 2);
      s.glow.position.copy(s.from).lerp(s.to, e);
      (s.glow.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI) * flightReveal;
      if (k >= 1) {
        s.active = false;
        s.glow.visible = false;
      }
    }
  }

  // ── HUD (breadcrumb console) ──────────────────────────────
  function renderHud() {
    const parts: string[] = [];
    const crumb = (label: string, action: string | null, color?: string) =>
      action === null
        ? `<span class="hud-crumb current"${color ? ` style="--hud-color:${color}"` : ''}>${label}</span>`
        : `<button class="hud-crumb" data-goto="${action}">${label}</button>`;
    const sep = '<span class="hud-sep">▸</span>';

    if (view.level === 'overview') {
      parts.push(crumb('overview', null));
    } else if (view.level === 'cluster') {
      parts.push(crumb('overview', 'overview'), sep, crumb(view.cluster.cluster.label, null, view.cluster.cluster.color));
    } else if (view.level === 'node') {
      const c = clusterById[view.node.project.cluster];
      parts.push(
        crumb('overview', 'overview'),
        sep,
        crumb(c.label, `cluster:${c.id}`),
        sep,
        crumb(view.node.project.title, null, c.color)
      );
    } else if (view.level === 'workshop') {
      parts.push(crumb('overview', 'overview'), sep, crumb('workshop', null, '#ffb454'));
    } else if (view.level === 'flight') {
      parts.push(crumb('overview', 'overview'), sep, crumb('🚀 the sky', null, '#ffcf6b'));
    } else if (view.level === 'discovery') {
      parts.push(
        crumb('overview', 'overview'),
        sep,
        crumb('🚀 the sky', 'flight'),
        sep,
        crumb(view.star.name, null, view.star.color)
      );
    } else {
      parts.push(
        crumb('overview', 'overview'),
        sep,
        crumb('workshop', 'workshop'),
        sep,
        crumb(view.spot.label, null, view.spot.color)
      );
    }
    hudPath.innerHTML = parts.join('');
  }

  hud.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button');
    if (!btn) return;
    const goto = btn.dataset.goto;
    if (goto === 'overview') goOverview();
    else if (goto === 'workshop') goWorkshop();
    else if (goto === 'flight') resumeFlight();
    else if (goto?.startsWith('cluster:')) goCluster(clusterViewById[goto.slice(8)]);
    else if (btn.id === 'hud-zoom-in') zoomBy(0.78);
    else if (btn.id === 'hud-zoom-out') zoomBy(1.28);
  });

  function zoomBy(factor: number) {
    const look = camTarget.active ? camTarget.look.clone() : controls.target.clone();
    const from = camTarget.active ? camTarget.pos.clone() : camera.position.clone();
    const offset = from.sub(look);
    const dist = THREE.MathUtils.clamp(offset.length() * factor, 3, 46);
    flyTo(look.clone().add(offset.normalize().multiplyScalar(dist)), look);
  }

  renderHud();

  // ── Pointer interaction ───────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(-2, -2);
  let hoverKey: string | null = null; // what the tooltip currently shows
  let pointerDown: { x: number; y: number } | null = null;

  const inConstellation = () =>
    view.level === 'overview' || view.level === 'cluster' || view.level === 'node';
  const inFlight = () => view.level === 'flight' || view.level === 'discovery';

  // Pick the nearest interactive thing under the cursor in the constellation:
  // a ring-label, a planet, or (in overview) the central star. Nearest wins, so a
  // planet drifting in front of the star gets the click, and vice-versa.
  type Pick =
    | { kind: 'label'; cluster: ClusterView }
    | { kind: 'node'; node: Node }
    | { kind: 'core' }
    | { kind: 'rocket' };
  function pickConstellation(): Pick | null {
    const cands: { d: number; pick: Pick }[] = [];
    const l = raycaster.intersectObjects(labelTargets, false)[0];
    if (l) cands.push({ d: l.distance, pick: { kind: 'label', cluster: labelToCluster.get(l.object)! } });
    const nd = raycaster.intersectObjects(nodeHitTargets, false)[0];
    if (nd) cands.push({ d: nd.distance, pick: { kind: 'node', node: hitToNode.get(nd.object)! } });
    if (view.level === 'overview') {
      const c = raycaster.intersectObject(coreHit, false)[0];
      if (c) cands.push({ d: c.distance, pick: { kind: 'core' } });
      const r = raycaster.intersectObject(rocketHit, false)[0];
      if (r) cands.push({ d: r.distance, pick: { kind: 'rocket' } });
    }
    cands.sort((a, b) => a.d - b.d);
    return cands[0]?.pick ?? null;
  }

  function setPointer(e: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  canvas.addEventListener('pointermove', (e) => {
    setPointer(e);
    tooltip.style.left = `${e.clientX}px`;
    tooltip.style.top = `${e.clientY}px`;
  });
  canvas.addEventListener('pointerleave', () => {
    pointer.set(-2, -2);
    hideTooltip();
    hoverKey = null;
  });
  canvas.addEventListener('pointerdown', (e) => {
    pointerDown = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!pointerDown) return;
    const dx = e.clientX - pointerDown.x;
    const dy = e.clientY - pointerDown.y;
    pointerDown = null;
    if (Math.hypot(dx, dy) > 6) return; // a drag, not a click
    setPointer(e);
    raycaster.setFromCamera(pointer, camera);

    if (inConstellation()) {
      const pick = pickConstellation();
      if (pick?.kind === 'label') return goCluster(pick.cluster);
      if (pick?.kind === 'node') return goNode(pick.node);
      if (pick?.kind === 'core') return goWorkshop();
      if (pick?.kind === 'rocket') return goFlight();
      stepBack(); // node→cluster, cluster→overview
    } else if (inFlight()) {
      if (travel) return; // ignore clicks mid-flight
      const s = raycaster.intersectObjects(starHitTargets, false)[0];
      if (s) return flyToStar(hitToStar.get(s.object)!);
      if (view.level === 'discovery') resumeFlight(); // empty click dismisses the panel
      // flight empty click: stay and look around
    } else {
      const s = raycaster.intersectObjects(spotHitTargets, false)[0];
      if (s) return goSpot(hitToSpot.get(s.object)!);
      if (view.level === 'spot') goWorkshop(); // empty click returns to the room
      // workshop empty click: stay (let people look around)
    }
  });

  // Trackpad pinch-to-zoom. Browsers deliver a pinch gesture as a wheel event with
  // ctrlKey set; a plain two-finger scroll has ctrlKey unset. We only act on the pinch,
  // so ordinary scrolling still moves the page down to the sections below the hero.
  const heroEl = (canvas.closest('.hero') as HTMLElement) ?? canvas;
  heroEl.addEventListener(
    'wheel',
    (e) => {
      if (!e.ctrlKey) return; // plain scroll → let the page scroll
      e.preventDefault(); // this is a pinch → zoom the scene, not the browser page
      const factor = THREE.MathUtils.clamp(1 + e.deltaY * 0.01, 0.8, 1.2);
      zoomBy(factor);
    },
    { passive: false }
  );

  function showTooltip(key: string, kicker: string, name: string, color: string) {
    hoverKey = key;
    tooltipCluster.textContent = kicker;
    tooltipName.textContent = name;
    tooltip.style.setProperty('--tip-color', color);
    tooltip.classList.add('visible');
  }
  function hideTooltip() {
    tooltip.classList.remove('visible');
    hoverKey = null;
  }

  panelClose.addEventListener('click', stepBack);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && view.level !== 'overview') stepBack();
  });

  // ── Resize / visibility ───────────────────────────────────
  function resize() {
    const { clientWidth: w, clientHeight: h } = canvas;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  let onScreen = true;
  new IntersectionObserver(([entry]) => (onScreen = entry.isIntersecting), { threshold: 0 }).observe(
    canvas
  );

  // ── Animation loop ────────────────────────────────────────
  const clock = new THREE.Clock();
  let lastCursor = -1;
  let coreHoverT = 0;

  renderer.setAnimationLoop(() => {
    if (!onScreen) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    // room reveal / core fade — the star fades out fast and early so its
    // wireframe never overlaps the room; the room keeps fading in behind it.
    roomReveal += (roomRevealTarget - roomReveal) * Math.min(dt * 3.2, 1);
    if (Math.abs(roomReveal - roomRevealTarget) < 0.004) roomReveal = roomRevealTarget;
    room.visible = roomReveal > 0.02;
    const coreOpacity = Math.max(0, 1 - roomReveal / 0.4); // gone by 40% reveal
    core.visible = coreOpacity > 0.01;
    for (const f of roomFades) f.mat.opacity = f.base * roomReveal;
    (coreMesh.material as THREE.MeshStandardMaterial).opacity = coreOpacity;
    (coreShell.material as THREE.MeshBasicMaterial).opacity = 0.22 * coreOpacity;
    (coreGlow.material as THREE.SpriteMaterial).opacity = coreOpacity;

    if (roomReveal > 0.5) {
      const cursorOn = Math.floor(t * 1.5) % 2 === 0 ? 1 : 0;
      if (cursorOn !== lastCursor) {
        drawScreen(cursorOn === 1);
        lastCursor = cursorOn;
      }
      // gently spin the shelf tokens
      if (!reduceMotion)
        for (const obj of room.children)
          if ((obj as any).userData?.spin) obj.rotation.y += dt * 0.6;
    }

    if (!reduceMotion) {
      core.rotation.y = t * 0.12;
      coreShell.rotation.x = t * -0.07;
      starsFar.rotation.y = t * 0.004;
      dustNear.rotation.y = t * -0.01;
      for (const s of spots) {
        const p = 0.85 * (1 + Math.sin(t * 2.4 + s.pos.x) * 0.18);
        s.indicator.scale.setScalar(p);
      }
      // mystery stars bob + twinkle; discovered ones spin proudly
      for (const st of stars) {
        st.mesh.position.y = st.pos.y + Math.sin(t * 0.7 + st.bob) * 0.5;
        st.mesh.rotation.y += dt * (st.discovered ? 0.6 : 0.2);
        const tw = 1 + Math.sin(t * 3 + st.bob) * 0.12;
        (st.glow.material as THREE.SpriteMaterial).rotation = 0;
        st.glow.scale.setScalar(4.2 * tw * (st.discovered ? 1.15 : 1));
      }
      coreHalo.rotation.z = t * 0.15;
    }

    // docked-rocket idle bob + thruster flicker (overview); flame scales with travel
    if (!reduceMotion && !travel && view.level === 'overview') {
      rocket.position.y = ROCKET_DOCK.y + Math.sin(t * 1.3) * 0.12;
      rocket.rotation.z = Math.sin(t * 0.8) * 0.08;
    }
    const flick = 0.6 + Math.abs(Math.sin(t * 22)) * 0.5;
    flame.scale.set(1, travel ? 1.3 * flick : 0.7 * flick, 1);
    (flame.material as THREE.MeshBasicMaterial).opacity = (travel ? 0.9 : 0.5) * flick;
    rocket.visible = view.level === 'overview' || inFlight();

    updateFlight(dt);

    // ── hover detection ──
    raycaster.setFromCamera(pointer, camera);
    let hoverNode: Node | null = null;
    let hoverLabel: ClusterView | null = null;
    let hoverSpot: Spot | null = null;
    let hoverStar: MysteryStar | null = null;
    let hoverCore = false;
    let hoverRocket = false;

    if (inConstellation()) {
      const pick = pickConstellation();
      if (pick?.kind === 'label') hoverLabel = pick.cluster;
      else if (pick?.kind === 'node') hoverNode = pick.node;
      else if (pick?.kind === 'core') hoverCore = true;
      else if (pick?.kind === 'rocket') hoverRocket = true;
    } else if (inFlight() && !travel && flightReveal > 0.6) {
      const s = raycaster.intersectObjects(starHitTargets, false)[0];
      if (s) hoverStar = hitToStar.get(s.object)!;
    } else if (roomReveal > 0.6) {
      const s = raycaster.intersectObjects(spotHitTargets, false)[0];
      if (s) hoverSpot = hitToSpot.get(s.object)!;
    }

    const key = hoverLabel
      ? `L:${hoverLabel.cluster.id}`
      : hoverNode
        ? `N:${hoverNode.project.slug}`
        : hoverStar
          ? `T:${hoverStar.id}`
          : hoverSpot
            ? `S:${hoverSpot.id}`
            : hoverCore
              ? 'CORE'
              : hoverRocket
                ? 'ROCKET'
                : null;
    if (key !== hoverKey) {
      if (hoverLabel) showTooltip(key!, 'enter ▸', hoverLabel.cluster.label, hoverLabel.cluster.color);
      else if (hoverNode && view.level !== 'node')
        showTooltip(key!, clusterById[hoverNode.project.cluster].label, hoverNode.project.title, hoverNode.color);
      else if (hoverStar)
        showTooltip(key!, hoverStar.discovered ? 'revisit ▸' : 'fly ▸', hoverStar.name, hoverStar.color);
      else if (hoverSpot && view.level !== 'spot')
        showTooltip(key!, 'look ▸', hoverSpot.label, hoverSpot.color);
      else if (hoverCore) showTooltip(key!, 'enter ▸', 'the workshop', '#ffb454');
      else if (hoverRocket) showTooltip(key!, 'launch ▸', 'take the rocket', '#ffcf6b');
      else hideTooltip();
    }
    canvas.style.cursor = key ? 'pointer' : 'grab';

    // central star: light up on hover, mirroring how the planets respond
    coreHoverT += ((hoverCore ? 1 : 0) - coreHoverT) * Math.min(dt * 9, 1);
    const corePulse = reduceMotion ? 1 : 1 + Math.sin(t * 1.4) * 0.05;
    coreMesh.scale.setScalar(corePulse * (1 + coreHoverT * 0.15));
    coreShell.scale.setScalar(1 + coreHoverT * 0.12);
    coreGlow.scale.setScalar(11 * (1 + coreHoverT * 0.25));
    (coreMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.6 + coreHoverT * 1.8;
    (coreShell.material as THREE.MeshBasicMaterial).opacity = (0.22 + coreHoverT * 0.35) * coreOpacity;

    // ── per-cluster focus, orbits, node hover ──
    for (const v of clusterViews) {
      v.focus += (v.focusTarget - v.focus) * Math.min(dt * 5, 1);
      const f = v.focus;
      const isFocusedView = inConstellation() && view.level !== 'overview' && v.focusTarget === 1;
      (v.ring.material as THREE.MeshBasicMaterial).opacity = (isFocusedView ? 0.34 : 0.16) * f;

      v.labelHoverT += ((hoverLabel === v ? 1 : 0) - v.labelHoverT) * Math.min(dt * 8, 1);
      const labelMat = v.label.material as THREE.SpriteMaterial;
      labelMat.opacity = (0.55 + v.labelHoverT * 0.45) * Math.max(f, 0.25);
      const lh = 0.9 * (1 + v.labelHoverT * 0.22);
      v.label.scale.set(v.labelBaseW * lh, lh, 1);

      if (!reduceMotion) {
        const orbitScale = view.level === 'overview' ? 1 : isFocusedView ? 0.08 : 0.5;
        const spin = v.cfg.speed * dt * orbitScale;
        for (const n of v.nodes) n.holder.rotation.y += spin;
        v.labelHolder.rotation.y += spin;
      }

      for (const n of v.nodes) {
        const isCurrent = view.level === 'node' && view.node === n;
        const target = n === hoverNode || isCurrent ? 1 : 0;
        n.hoverT += (target - n.hoverT) * Math.min(dt * 9, 1);
        n.mesh.scale.setScalar(n.baseScale * (1 + n.hoverT * 0.55));
        const mat = n.mesh.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = (0.55 + n.hoverT * 1.3) * f;
        mat.opacity = 0.25 + 0.75 * f;
        const glow = n.mesh.children[0] as THREE.Sprite;
        (glow.material as THREE.SpriteMaterial).opacity = f;
        if (!reduceMotion) {
          n.mesh.position.y = Math.sin(t * 0.9 + n.bobPhase) * 0.35;
          n.mesh.rotation.y += dt * 0.4;
          n.mesh.rotation.x += dt * 0.15;
        }
      }
    }

    // camera flight
    if (camTarget.active) {
      camera.position.lerp(camTarget.pos, Math.min(dt * 3, 1));
      controls.target.lerp(camTarget.look, Math.min(dt * 3, 1));
      if (camera.position.distanceTo(camTarget.pos) < 0.04) camTarget.active = false;
    }

    controls.update();
    renderer.render(scene, camera);
  });
}
