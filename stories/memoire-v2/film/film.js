// « La mémoire de mon agent », v2 sur mesure : la mémoire est un objet (une page de 87 lignes),
// les 23 projets morts partent dans un tiroir d'archive, la pile se resserre à 65 lignes.
// Plan continu, pas de flou, pas de halo, pas de mot coloré : la voix (Noah) porte le récit.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const params = new URLSearchParams(location.search);
const CAPTURE = params.has("capture");
const storyUrl = new URL(params.get("story") || "../story.json", location.href);
const story = await (await fetch(storyUrl)).json();
const C = story.cues, TOTAL = story.timing.total;
const W = 1080, H = 1920;

/* ---------- temps ---------- */
const c01 = (x) => Math.min(1, Math.max(0, x));
const span = (t, a, b) => c01((t - a) / (b - a));
const ease = (x) => { x = c01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const out = (x) => 1 - Math.pow(1 - c01(x), 4);
const lerp = (a, b, k) => a + (b - a) * k;
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/* ---------- rendu ---------- */
await document.fonts.ready;
await Promise.all(["800 40px 'Public Sans'", "600 40px 'Public Sans'", "500 24px 'JetBrains Mono'"].map((f) => document.fonts.load(f)));
const stage = document.getElementById("stage");
if (CAPTURE) Object.assign(stage.style, { left: "0", top: "0" });
else {
  const fit = () => { const s = Math.min(innerWidth / W, innerHeight / H); Object.assign(stage.style, { marginLeft: `${-W / 2}px`, marginTop: `${-H / 2}px`, transform: `scale(${s})`, transformOrigin: "50% 50%" }); };
  fit(); addEventListener("resize", fit);
}
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.insertBefore(renderer.domElement, document.getElementById("vignette"));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 60);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;
scene.add(new THREE.HemisphereLight(0xfff1e6, 0x2a0d08, 0.9));
const key = new THREE.DirectionalLight(0xfff0e4, 2.1);
key.position.set(-2.2, 3.2, 4.5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -2.2; key.shadow.camera.right = 2.2; key.shadow.camera.top = 2.2; key.shadow.camera.bottom = -2.2;
key.shadow.camera.near = 0.5; key.shadow.camera.far = 14;
key.shadow.radius = 4; key.shadow.bias = -0.0004;
scene.add(key);

const COL = { cream: new THREE.Color(0xefe2d6), orange: new THREE.Color(0xff7a45), green: new THREE.Color(0x3ddc84), plate: new THREE.Color(0x2a110c) };

/* ---------- la page de mémoire : 87 lignes ---------- */
const N = 87, PAGE_H = 2.25, SP = PAGE_H / (N - 1), TOP = PAGE_H / 2, LEFT = -0.55;
const page = new THREE.Group();
page.position.set(-0.32, 0.05, 0);
page.rotation.set(-0.06, 0.24, 0.01);
scene.add(page);
const plate = new THREE.Mesh(new RoundedBoxGeometry(1.32, PAGE_H + 0.26, 0.03, 4, 0.03), new THREE.MeshStandardMaterial({ color: COL.plate, roughness: 0.92 }));
plate.position.z = -0.022;
plate.receiveShadow = true;
page.add(plate);
const barGeo = new RoundedBoxGeometry(1, 0.0125, 0.01, 2, 0.004);
const lengths = Array.from({ length: N }, (_, i) => (i === 0 ? 0.42 : 0.58 + rnd() * 0.5));
const deadSet = new Set();
while (deadSet.size < 23) { const i = 2 + Math.floor(rnd() * (N - 3)); deadSet.add(i); }
const dead = [...deadSet].sort((a, b) => a - b);
const keep = [...Array(N).keys()].filter((i) => !deadSet.has(i));
const bars = lengths.map((L, i) => {
  const m = new THREE.Mesh(barGeo, new THREE.MeshStandardMaterial({ color: COL.cream.clone(), roughness: 0.5 }));
  m.castShadow = true;
  scene.add(m);
  return { m, L, i, dead: deadSet.has(i), deadOrder: dead.indexOf(i), rank: keep.indexOf(i) };
});
// la ligne ajoutée à la fin : elle pointe vers l'archive
const newBar = { m: new THREE.Mesh(barGeo, new THREE.MeshStandardMaterial({ color: COL.cream.clone(), roughness: 0.5 })), L: 0.86 };
newBar.m.castShadow = true;
scene.add(newBar.m);

/* ---------- le tiroir d'archive ---------- */
const tray = new THREE.Group();
const trayMat = new THREE.MeshStandardMaterial({ color: 0x3b1a12, roughness: 0.85, transparent: true });
const wall = (w, h, d, x, y, z) => { const b = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.004), trayMat); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; tray.add(b); };
wall(0.7, 0.014, 0.36, 0, 0, 0);
wall(0.7, 0.17, 0.014, 0, 0.085, -0.173);
wall(0.014, 0.17, 0.36, -0.343, 0.085, 0);
wall(0.014, 0.17, 0.36, 0.343, 0.085, 0);
wall(0.7, 0.07, 0.014, 0, 0.035, 0.173);
const TRAY_POS = new THREE.Vector3(0.66, -0.86, 0.28);
tray.rotation.set(0.32, -0.42, 0);
scene.add(tray);

/* ---------- curseur de lecture (l'agent) ---------- */
const bandMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uCol: { value: COL.cream.clone() }, uA: { value: 0 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }",
  fragmentShader: "varying vec2 vUv; uniform vec3 uCol; uniform float uA; void main(){ float e = smoothstep(0.,.5,vUv.y)*smoothstep(1.,.5,vUv.y); gl_FragColor = vec4(uCol, e*uA); }",
});
const band = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.075), bandMat);
band.position.z = 0.016;
page.add(band);

/* ---------- lien de la nouvelle ligne vers l'archive ---------- */
let linkTube = null, linkCount = 0;
function buildLink() {
  const a = page.localToWorld(new THREE.Vector3(LEFT + newBar.L + 0.02, TOP - 64 * SP, 0.006));
  const b = tray.localToWorld(new THREE.Vector3(-0.1, 0.19, 0));
  const ctrl = a.clone().add(b).multiplyScalar(0.5).add(new THREE.Vector3(0.12, 0.18, 0.15));
  const geo = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, ctrl, b), 80, 0.0032, 6, false);
  linkTube = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffb066, roughness: 0.6 }));
  linkCount = geo.index.count;
  scene.add(linkTube);
}

/* ---------- interface ---------- */
const $ = (id) => document.getElementById(id);
const show = (e, o, dy = 0) => { e.style.opacity = o; e.style.transform = `translateY(${(1 - o) * dy}px)`; };
const v3 = new THREE.Vector3();
const placeAt = (e, world, dx = 0, dy = 0) => { v3.copy(world).project(camera); e.style.left = `${((v3.x + 1) / 2) * W + dx}px`; e.style.top = `${((1 - v3.y) / 2) * H + dy}px`; };
const caption = $("caption");
let capIdx = -1;

/* ---------- caméra : poses sur les temps forts, enchaînées en douceur ---------- */
const KEYS = [
  [0.0, [0.42, 1.0, 3.1], [-0.28, 0.78, 0]],
  [3.3, [0.3, 0.2, 3.7], [-0.32, -0.02, 0]],
  [4.5, [0.24, 0.2, 8.1], [-0.1, 0.2, 0]],
  [6.9, [0.3, 0.2, 8.3], [-0.06, 0.2, 0]],
  [8.6, [0.8, 0.12, 8.4], [0.16, 0.08, 0]],
  [13.0, [0.92, 0.1, 8.2], [0.2, 0.06, 0]],
  [14.3, [0.46, 0.2, 8.1], [0.06, 0.2, 0]],
  [16.9, [0.52, 0.18, 8.0], [0.1, 0.18, 0]],
  [18.3, [0.3, 0.1, 9.4], [0.06, 0.1, 0]],
  [TOTAL, [0.26, 0.08, 9.8], [0.06, 0.08, 0]],
];
const pa = new THREE.Vector3(), pb = new THREE.Vector3(), la = new THREE.Vector3(), lb = new THREE.Vector3();
function cameraAt(t) {
  let i = 0;
  while (i < KEYS.length - 2 && t >= KEYS[i + 1][0]) i++;
  const [t0, p0, l0] = KEYS[i], [t1, p1, l1] = KEYS[i + 1];
  const k = ease(span(t, t0, t1));
  camera.position.copy(pa.set(...p0).lerp(pb.set(...p1), k));
  camera.position.x += Math.sin(t * 0.42) * 0.035;
  camera.position.y += Math.sin(t * 0.31 + 1) * 0.025;
  camera.lookAt(la.set(...l0).lerp(lb.set(...l1), k));
  camera.updateMatrixWorld();
}

/* ---------- ligne de temps ---------- */
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
const sA = new THREE.Vector3(), sB = new THREE.Vector3(), sC = new THREE.Vector3(), tmp = new THREE.Vector3();
function update(t) {
  cameraAt(t);
  // tiroir : il monte en place pendant le ménage
  const tIn = out(span(t, C.trayIn[0], C.trayIn[1]));
  tray.position.copy(TRAY_POS).add(tmp.set(0, (1 - tIn) * -0.35, 0));
  trayMat.opacity = tIn;
  tray.visible = tIn > 0.001;
  tray.updateMatrixWorld(true);
  page.updateMatrixWorld(true);
  if (!linkTube && t >= C.newLine[0]) buildLink();

  const compK = ease(span(t, C.compact[0], C.compact[1]));
  const verA = span(t, C.verify[0], C.verify[1]);
  const bandY = (u) => TOP + 0.05 - u * (PAGE_H + 0.1);
  let bandOn = 0, bandU = 0, bandGreen = false;
  if (t >= C.read1[0] && t <= C.read1[1]) { bandU = ease(span(t, C.read1[0], C.read1[1])); bandOn = Math.min(span(t, C.read1[0], C.read1[0] + 0.2), 1 - span(t, C.read1[1] - 0.2, C.read1[1])); }
  if (t >= C.read2[0] && t <= C.read2[1]) { bandU = ease(span(t, C.read2[0], C.read2[1])); bandOn = Math.min(span(t, C.read2[0], C.read2[0] + 0.12), 1 - span(t, C.read2[1] - 0.12, C.read2[1])); }
  if (t >= C.verify[0] && t <= C.verify[1]) { bandU = ease(verA); bandOn = Math.min(span(t, C.verify[0], C.verify[0] + 0.12), 1 - span(t, C.verify[1] - 0.12, C.verify[1])); bandGreen = true; }
  const by = bandY(bandU);
  band.position.y = by;
  bandMat.uniforms.uA.value = bandOn * (bandGreen ? 0.32 : 0.2);
  bandMat.uniforms.uCol.value.copy(bandGreen ? COL.green : COL.cream);

  bars.forEach((b) => {
    const grow = out(span(t, C.buildIn[0] + b.i * 0.012, C.buildIn[0] + b.i * 0.012 + 0.38));
    const yOld = TOP - b.i * SP;
    const yNew = b.dead ? yOld : TOP - b.rank * SP;
    const y = lerp(yOld, yNew, compK);
    const s = Math.max(0.0001, grow);
    // position sur la page (bord gauche fixe, la ligne s'écrit vers la droite)
    sA.set(LEFT + (b.L * s) / 2, y, 0.006);
    page.localToWorld(sA);
    let scaleX = b.L * s;
    b.m.quaternion.copy(page.quaternion);
    if (b.dead) {
      const k = out(span(t, C.dead[0] + b.deadOrder * 0.03, C.dead[0] + b.deadOrder * 0.03 + 0.25));
      b.m.material.color.copy(COL.cream).lerp(COL.orange, k);
      const f0 = C.archive[0] + b.deadOrder * 0.055, fk = ease(span(t, f0, f0 + 0.72));
      if (fk > 0) {
        // vol vers le tiroir : arc vers la caméra, puis rangée à plat
        sC.set(0, 0.03 + b.deadOrder * 0.0095, 0);
        tray.localToWorld(sC);
        sB.copy(sA).lerp(sC, 0.5).add(tmp.set(0.08, 0.32, 0.45));
        const u = fk, iu = 1 - u;
        b.m.position.set(iu * iu * sA.x + 2 * iu * u * sB.x + u * u * sC.x, iu * iu * sA.y + 2 * iu * u * sB.y + u * u * sC.y, iu * iu * sA.z + 2 * iu * u * sB.z + u * u * sC.z);
        qa.copy(page.quaternion); qb.copy(tray.quaternion).multiply(flat);
        b.m.quaternion.slerpQuaternions(qa, qb, u);
        scaleX = lerp(b.L, 0.56, u);
        b.m.material.color.copy(COL.orange).lerp(new THREE.Color(0xd9673c), u);
      } else b.m.position.copy(sA);
    } else {
      b.m.position.copy(sA);
      const flash = bandGreen ? Math.exp(-Math.pow((yOld - by) / 0.05, 2)) * bandOn : 0;
      b.m.material.color.copy(COL.cream).lerp(COL.green, flash * 0.85);
    }
    b.m.scale.set(scaleX, 1, 1);
  });
  // nouvelle ligne de l'index : « archive/ »
  const nb = out(span(t, C.newLine[0], C.newLine[1]));
  newBar.m.visible = nb > 0.001;
  sA.set(LEFT + (newBar.L * nb) / 2, TOP - 64 * SP, 0.006);
  page.localToWorld(sA);
  newBar.m.position.copy(sA);
  newBar.m.quaternion.copy(page.quaternion);
  newBar.m.scale.set(Math.max(0.0001, newBar.L * nb), 1, 1);
  newBar.m.material.color.copy(COL.cream).lerp(new THREE.Color(0xffb066), 0.55);
  if (linkTube) linkTube.geometry.setDrawRange(0, Math.floor((linkCount * ease(span(t, C.connector[0], C.connector[1]))) / 3) * 3);

  /* --- interface --- */
  const cin = out(span(t, C.count87, C.count87 + 0.35));
  const cvis = Math.min(cin, 1 - span(t, C.toTray[0], C.toTray[0] + 0.4)) + Math.min(out(span(t, C.result, C.result + 0.35)), 1 - span(t, C.endTitle - 0.5, C.endTitle));
  show($("countBlock"), c01(cvis), 30);
  const n = t < C.result ? 87 : Math.round(lerp(87, 65, ease(span(t, C.count65[0], C.count65[1]))));
  $("countNum").textContent = n;
  $("deadLab").style.opacity = t < C.result ? out(span(t, C.dead[0], C.dead[0] + 0.3)) : 0;
  $("kbLab").style.opacity = t >= C.result ? out(span(t, C.count65[1], C.count65[1] + 0.35)) : 0;

  const bandWorld = page.localToWorld(tmp.set(0.7, by, 0.02));
  placeAt($("agentLab"), bandWorld, 14, -16);
  show($("agentLab"), bandOn > 0 && !bandGreen ? bandOn : 0);
  placeAt($("trayLab"), tray.localToWorld(tmp.set(-0.33, 0.24, -0.17)), 0, -30);
  show($("trayLab"), out(span(t, C.trayIn[1] - 0.2, C.trayIn[1] + 0.2)) * (1 - span(t, C.endTitle - 0.4, C.endTitle)));
  placeAt($("lostLab"), tray.localToWorld(tmp.set(0, -0.05, 0.2)), 0, 26);
  $("lostLab").style.left = "auto"; $("lostLab").style.right = "64px";
  show($("lostLab"), out(span(t, C.nothingLost, C.nothingLost + 0.3)) * (1 - span(t, C.endTitle - 0.4, C.endTitle)), 12);
  placeAt($("linksLab"), page.localToWorld(tmp.set(-0.6, TOP + 0.14, 0)), 0, -40);
  show($("linksLab"), Math.min(out(span(t, C.verify[0] + 0.25, C.verify[0] + 0.5)), 1 - span(t, C.result - 0.2, C.result + 0.1)), 12);

  show($("endTitle"), out(span(t, C.endTitle, C.endTitle + 0.45)), 34);
  show($("name"), out(span(t, C.name, C.name + 0.4)), 20);
  show($("credit"), out(span(t, C.credit, C.credit + 0.4)), 12);

  // sous-titres phrase par phrase (la dernière phrase est le titre de fin)
  const i = story.captions.findIndex((c) => t >= c.from && t < c.to);
  if (i !== capIdx) { capIdx = i; caption.innerHTML = i >= 0 ? `<span>${story.captions[i].text}</span>` : ""; }
  if (i >= 0) { const c = story.captions[i]; show(caption, Math.min(out(span(t, c.from, c.from + 0.18)), 1 - span(t, c.to - 0.15, c.to)), 14); } else caption.style.opacity = 0;

  const fade = span(t, C.fadeOut[0], C.fadeOut[1]);
  renderer.domElement.style.opacity = 1 - fade;
  $("ui").style.opacity = 1 - fade;
}

window.renderAt = async (t) => { update(t); renderer.render(scene, camera); await new Promise((r) => requestAnimationFrame(() => r())); };
window.FILM = { total: TOTAL, gpu: (() => { const gl = renderer.getContext(); const e = gl.getExtension("WEBGL_debug_renderer_info"); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : "?"; })() };
window.READY = true;

if (!CAPTURE) {
  const audio = new Audio(new URL("mix.wav", storyUrl).href);
  let t0 = performance.now();
  document.body.addEventListener("click", () => { audio.currentTime = 0; audio.play().catch(() => {}); t0 = performance.now(); });
  const loop = () => { const t = audio.paused ? ((performance.now() - t0) / 1000) % TOTAL : audio.currentTime; update(t); renderer.render(scene, camera); requestAnimationFrame(loop); };
  loop();
}
