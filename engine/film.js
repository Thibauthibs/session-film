// Moteur de film de session : une histoire JSON → un film 3D vertical 1080×1920 (three.js).
// Tout est une fonction du temps : update(t). ?story=<url du story.json> ; ?capture = mode tournage (window.renderAt).
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { buildTimeline } from "./timeline.js";

const params = new URLSearchParams(location.search);
const CAPTURE = params.has("capture");
const storyUrl = new URL(params.get("story") || "/story/story.json", location.href);
const story = await (await fetch(storyUrl)).json();
const asset = (p) => new URL(p, storyUrl).href;
const TL = buildTimeline(story);
const S = TL.scenes, Q = TL.cues, TOTAL = TL.total;
const ORDER = Object.keys(S);
const sceneEnd = (n) => { const i = ORDER.indexOf(n); return i < ORDER.length - 1 ? S[ORDER[i + 1]] : TOTAL; };
const has = (n) => n in S;
const W = 1080, H = 1920, FOV = 35;
const B = story.before, A = story.agent, R = story.results, E = story.end || {};

/* ---------- outils ---------- */
const c01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, k) => a + (b - a) * k;
const span = (t, a, b) => c01((t - a) / (b - a));
const easeOut = (x) => 1 - Math.pow(1 - c01(x), 3);
const easeInOut = (x) => { x = c01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const backOut = (x) => { x = c01(x); const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const sceneVis = (t, n) => (has(n) ? Math.min(span(t, S[n], S[n] + 0.25), 1 - span(t, sceneEnd(n) - 0.35, sceneEnd(n))) : 0);
const LOCALE = story.locale || "fr-FR";
const fmt = (v, d = 0, unit = "") => v.toLocaleString(LOCALE, { minimumFractionDigits: d, maximumFractionDigits: d }) + unit;
const scoreColor = (v) => (v >= 90 ? "#0cce6b" : v >= 50 ? "#ffa400" : "#ff4e42");

/* ---------- polices et scène ---------- */
await document.fonts.ready;
await Promise.all(["600 200px Fraunces", "italic 600 200px Fraunces", "500 40px 'JetBrains Mono'", "800 40px 'Public Sans'"].map((f) => document.fonts.load(f)));

const stage = document.getElementById("stage");
if (CAPTURE) Object.assign(stage.style, { left: "0", top: "0" });
else {
  const fit = () => {
    const s = Math.min(innerWidth / W, innerHeight / H);
    Object.assign(stage.style, { marginLeft: `${-W / 2}px`, marginTop: `${-H / 2}px`, transform: `scale(${s})`, transformOrigin: "50% 50%" });
  };
  fit(); addEventListener("resize", fit);
}
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 120);
scene.add(camera);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;
const key = new THREE.DirectionalLight(0xffe2cf, 1.6); key.position.set(2.5, 3, 4); scene.add(key);
const rim = new THREE.DirectionalLight(0xff7a45, 2.2); rim.position.set(-3, 1.5, -2); scene.add(rim);

const composer = new EffectComposer(renderer);
composer.setPixelRatio(1); composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.85, 0.6, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const COL = { paper: new THREE.Color(0x1e0806), ink: new THREE.Color(0xfbeee6), accent: new THREE.Color(0xff7a45), accent2: new THREE.Color(0xffb066), green: new THREE.Color(0x0cce6b) };
const hdr = (c, k) => c.clone().multiplyScalar(k);
const hexHdr = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
const PIX = H / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));

/* ---------- fond ---------- */
const bgMat = new THREE.ShaderMaterial({
  depthWrite: false, depthTest: false,
  uniforms: { uPaper: { value: COL.paper }, uGlow: { value: hdr(COL.accent, 0.11) } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.); }",
  fragmentShader: `varying vec2 vUv; uniform vec3 uPaper, uGlow;
    void main(){ vec2 p = (vUv - vec2(0.92, 0.97)) * vec2(1.0, 1.7778); gl_FragColor = vec4(uPaper + uGlow * exp(-dot(p,p) * 4.5), 1.); }`,
});
const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
bg.frustumCulled = false; bg.renderOrder = -10; scene.add(bg);

const DUST = 900, dustGeo = new THREE.BufferGeometry();
{
  const p = new Float32Array(DUST * 3), ph = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) { p[3 * i] = (Math.random() - 0.5) * 9; p[3 * i + 1] = (Math.random() - 0.5) * 14; p[3 * i + 2] = -Math.random() * 10 + 2.5; ph[i] = Math.random() * 100; }
  dustGeo.setAttribute("position", new THREE.BufferAttribute(p, 3));
  dustGeo.setAttribute("aPh", new THREE.BufferAttribute(ph, 1));
}
const dustMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uTime: { value: 0 }, uPix: { value: PIX }, uCol: { value: hdr(COL.accent2, 0.5) } },
  vertexShader: `attribute float aPh; uniform float uTime, uPix; varying float vA;
    void main(){ vec3 p = position; p.x += sin(uTime*0.21 + aPh)*0.18; p.y += cos(uTime*0.17 + aPh*1.3)*0.22 + uTime*0.02;
      vec4 mv = modelViewMatrix * vec4(p,1.); gl_Position = projectionMatrix * mv;
      gl_PointSize = (0.006 + 0.008*fract(aPh)) * uPix / -mv.z; vA = 0.25 + 0.5*fract(aPh*7.3); }`,
  fragmentShader: `uniform vec3 uCol; varying float vA; void main(){ float d = length(gl_PointCoord-.5); gl_FragColor = vec4(uCol, smoothstep(.5,0.,d)*vA); }`,
});
scene.add(new THREE.Points(dustGeo, dustMat));

/* ---------- 1. accroche en particules (1 à 4 phrases, « | » = retour à la ligne, *mot* = accent) ---------- */
function sampleText(phrase) {
  const lines = phrase.split("|"), cw = 1600, lh = 230, ch = lh * lines.length + 60;
  const cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
  const g = cv.getContext("2d");
  g.textBaseline = "middle";
  const words = (line) => line.split(" ").map((w) => ({ acc: /^\*.*\*$/.test(w), txt: w.replace(/\*/g, "") }));
  let size = 200;
  const lineWidth = (line, s) => words(line).reduce((sum, w, i, arr) => { g.font = `${w.acc ? "italic " : ""}600 ${s}px Fraunces`; return sum + g.measureText(w.txt + (i < arr.length - 1 ? " " : "")).width; }, 0);
  while (Math.max(...lines.map((l) => lineWidth(l, size))) > 1500 && size > 80) size -= 6;
  lines.forEach((line, li) => {
    const y = 30 + lh * (li + 0.5);
    let x = cw / 2 - lineWidth(line, size) / 2;
    words(line).forEach((w, i, arr) => {
      g.font = `${w.acc ? "italic " : ""}600 ${size}px Fraunces`;
      g.fillStyle = w.acc ? "#ff0000" : "#ffffff";
      g.fillText(w.txt, x, y);
      x += g.measureText(w.txt + (i < arr.length - 1 ? " " : "")).width;
    });
  });
  const d = g.getImageData(0, 0, cw, ch).data, pts = [], step = 5, k = 2.45 / cw;
  for (let y = 0; y < ch; y += step) for (let x = 0; x < cw; x += step) {
    const i = (y * cw + x) * 4;
    if (d[i + 3] > 140) pts.push([(x - cw / 2) * k, (ch / 2 - y) * k, d[i] > 200 && d[i + 1] < 90 ? 1 : 0]);
  }
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return pts;
}
const phrases = (story.hook || ["Une session", "avec un *agent IA.*"]).slice(0, 4);
while (phrases.length < 4) phrases.push(phrases[phrases.length - 1]);
const PH = phrases.map(sampleText);
const NP = Math.max(...PH.map((p) => p.length));
const hookGeo = new THREE.BufferGeometry();
{
  const P = [0, 1, 2, 3].map(() => new Float32Array(NP * 3)), ACC = new Float32Array(NP * 4);
  const Rn = new Float32Array(NP * 3), D = new Float32Array(NP);
  for (let i = 0; i < NP; i++) {
    PH.forEach((ph, pi) => { const s = ph[Math.floor((i * ph.length) / NP)]; P[pi][3 * i] = s[0]; P[pi][3 * i + 1] = s[1]; P[pi][3 * i + 2] = (Math.random() - 0.5) * 0.04; ACC[4 * i + pi] = s[2]; });
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = 0.4 + Math.random() * 0.6, sq = Math.sqrt(1 - u * u);
    Rn[3 * i] = sq * Math.cos(th) * r; Rn[3 * i + 1] = sq * Math.sin(th) * r; Rn[3 * i + 2] = u * r;
    D[i] = c01((P[0][3 * i] + 1.2) / 2.4) * 0.75 + Math.random() * 0.25;
  }
  hookGeo.setAttribute("position", new THREE.BufferAttribute(P[0], 3));
  hookGeo.setAttribute("aB", new THREE.BufferAttribute(P[1], 3));
  hookGeo.setAttribute("aC", new THREE.BufferAttribute(P[2], 3));
  hookGeo.setAttribute("aD", new THREE.BufferAttribute(P[3], 3));
  hookGeo.setAttribute("aAcc", new THREE.BufferAttribute(ACC, 4));
  hookGeo.setAttribute("aRand", new THREE.BufferAttribute(Rn, 3));
  hookGeo.setAttribute("aDelay", new THREE.BufferAttribute(D, 1));
}
const hookMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uIntro: { value: 0 }, uM: { value: new THREE.Vector3() }, uScatter: { value: 0 }, uTime: { value: 0 }, uPix: { value: PIX },
    uInk: { value: hdr(COL.ink, 0.55) }, uAcc: { value: hdr(COL.accent, 1.15) } },
  vertexShader: `attribute vec3 aB, aC, aD, aRand; attribute vec4 aAcc; attribute float aDelay;
    uniform float uIntro, uScatter, uTime, uPix; uniform vec3 uM; varying float vAcc, vA;
    float e(float x){ x = clamp(x,0.,1.); return x<.5 ? 4.*x*x*x : 1.-pow(-2.*x+2.,3.)/2.; }
    float st(float u){ return e(u*1.35 - aDelay*0.35); }
    void main(){
      float i0 = st(uIntro), m1 = st(uM.x), m2 = st(uM.y), m3 = st(uM.z), sc = st(uScatter);
      vec3 p = mix(mix(mix(position, aB, m1), aC, m2), aD, m3);
      float acc = mix(mix(mix(aAcc.x, aAcc.y, m1), aAcc.z, m2), aAcc.w, m3);
      float tr = sin(3.14159*m1) + sin(3.14159*m2) + sin(3.14159*m3);
      p += aRand * tr * 0.55 + vec3(0., 0., tr * 0.35);
      p = mix(aRand * 3.2 + vec3(0., 0., -1.5), p, i0);
      p += aRand * sc * 7.0 + vec3(0., 0., sc * 2.5);
      p += 0.004 * vec3(sin(uTime*2.3 + aDelay*40.), cos(uTime*1.9 + aDelay*31.), 0.);
      vec4 mv = modelViewMatrix * vec4(p, 1.);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = 0.0105 * uPix * (1. + tr*0.9 + (1.-i0)*1.6) / -mv.z;
      vAcc = acc; vA = i0 * (1. - sc);
    }`,
  fragmentShader: `uniform vec3 uInk, uAcc; varying float vAcc, vA;
    void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, .0, d);
      gl_FragColor = vec4(mix(uInk, uAcc, vAcc) * (0.7 + 0.6*a), a * vA); }`,
});
const hookPts = new THREE.Points(hookGeo, hookMat);
hookPts.frustumCulled = false;
scene.add(hookPts);

/* ---------- téléphone (seulement si l'histoire fournit une capture) ---------- */
const loadImg = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
const imgHero = B?.screenshot ? await loadImg(asset(B.screenshot)) : null;
const imgScroll = E.scroll ? await loadImg(asset(E.scroll)) : null;
const HAS_PHONE = !!(imgHero || imgScroll);
const SW = 1.0, SH = (SW * 2532) / 1170, BEZ = 0.045, DEPTH = 0.09, STATUS = 92;
function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const geo = new THREE.ShapeGeometry(s, 24), pos = geo.attributes.position, uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) { uv[2 * i] = (pos.getX(i) - x) / w; uv[2 * i + 1] = (pos.getY(i) - y) / h; }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geo;
}
const scv = document.createElement("canvas"); scv.width = 780; scv.height = 1688;
const sg = scv.getContext("2d");
const screenTex = new THREE.CanvasTexture(scv);
screenTex.colorSpace = THREE.SRGBColorSpace;
screenTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
let lastScreen = "";
function drawScreen(mode, scrollPx) {
  const sig = `${mode}:${Math.round(scrollPx)}`;
  if (sig === lastScreen) return;
  lastScreen = sig;
  sg.fillStyle = "#fff"; sg.fillRect(0, 0, 780, 1688);
  const img = mode === "hero" ? imgHero || imgScroll : imgScroll || imgHero;
  if (img) {
    const k = 780 / img.naturalWidth;
    if (mode === "hero") sg.drawImage(img, 0, 0, img.naturalWidth, (1688 - STATUS) / k, 0, STATUS, 780, 1688 - STATUS);
    else sg.drawImage(img, 0, scrollPx / k, img.naturalWidth, (1688 - STATUS) / k, 0, STATUS, 780, 1688 - STATUS);
  }
  sg.fillStyle = "#0e0e10"; sg.fillRect(0, 0, 780, STATUS);
  sg.fillStyle = "#fff"; sg.font = "700 34px 'Public Sans'"; sg.textBaseline = "middle"; sg.fillText(story.phone?.time || "11:42", 58, STATUS / 2 + 4);
  sg.fillStyle = "#000"; sg.beginPath(); sg.roundRect(390 - 98, 20, 196, 54, 27); sg.fill();
  sg.fillStyle = "#fff"; [12, 17, 22, 27].forEach((h, i) => { sg.beginPath(); sg.roundRect(612 + i * 10, 62 - h, 6, h, 2); sg.fill(); });
  sg.strokeStyle = "rgba(255,255,255,.85)"; sg.lineWidth = 3; sg.beginPath(); sg.roundRect(664, 38, 52, 26, 7); sg.stroke();
  sg.fillRect(669, 43, 34, 16);
  screenTex.needsUpdate = true;
}
const phone = new THREE.Group();
phone.add(new THREE.Mesh(new RoundedBoxGeometry(SW + 2 * BEZ, SH + 2 * BEZ, DEPTH, 8, 0.11),
  new THREE.MeshPhysicalMaterial({ color: 0x1c1210, metalness: 0.75, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12 })));
const screen = new THREE.Mesh(roundedRect(SW, SH, 0.085), new THREE.MeshBasicMaterial({ map: screenTex, color: new THREE.Color(0.86, 0.86, 0.86) }));
screen.position.z = DEPTH / 2 + 0.002; phone.add(screen);
const glass = new THREE.Mesh(roundedRect(SW, SH, 0.085), new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.06, transparent: true, opacity: 0.1, envMapIntensity: 2 }));
glass.position.z = DEPTH / 2 + 0.004; phone.add(glass);
phone.visible = false;
if (HAS_PHONE) scene.add(phone);

/* ---------- jauges ---------- */
function makeRing(rIn, rOut) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uP: { value: 0 }, uCol: { value: new THREE.Color() }, uTrack: { value: new THREE.Color(0.05, 0.02, 0.015) }, uA: { value: 1 } },
    vertexShader: "varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: `varying vec2 vP; uniform float uP, uA; uniform vec3 uCol, uTrack;
      void main(){ float a = atan(vP.x, vP.y); a = (a < 0. ? a + 6.2831853 : a) / 6.2831853;
        gl_FragColor = vec4(mix(uTrack, uCol, step(a, uP)), uA); }`,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(rIn, rOut, 256, 1), mat);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(rIn, 128), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
  disc.position.z = -0.001;
  const grp = new THREE.Group(); grp.add(disc, ring); grp.visible = false;
  scene.add(grp);
  return { grp, mat, disc };
}
const small = makeRing(0.25, 0.31);
const big = makeRing(0.68, 0.8);
const BURST = 700, burstGeo = new THREE.BufferGeometry();
{
  const a = new Float32Array(BURST * 2);
  for (let i = 0; i < BURST; i++) { a[2 * i] = Math.random() * Math.PI * 2; a[2 * i + 1] = 0.3 + Math.random(); }
  burstGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(BURST * 3), 3));
  burstGeo.setAttribute("aAS", new THREE.BufferAttribute(a, 2));
}
const burstMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uT: { value: -1 }, uPix: { value: PIX }, uCol: { value: hdr(COL.green, 2.2) }, uR: { value: 0.74 } },
  vertexShader: `attribute vec2 aAS; uniform float uT, uPix, uR; varying float vA;
    void main(){ float t = max(uT, 0.); float r = uR + aAS.y * (1. - exp(-t*2.6)) * 1.3;
      vec3 p = vec3(sin(aAS.x)*r, cos(aAS.x)*r, (aAS.y-0.6)*t*1.2);
      vec4 mv = modelViewMatrix * vec4(p,1.); gl_Position = projectionMatrix * mv;
      gl_PointSize = (0.012 + 0.012*aAS.y) * uPix / -mv.z; vA = (uT < 0. ? 0. : 1.) * exp(-t*1.6); }`,
  fragmentShader: `uniform vec3 uCol; varying float vA; void main(){ float d = length(gl_PointCoord-.5); gl_FragColor = vec4(uCol, smoothstep(.5,0.,d)*vA); }`,
});
const burst = new THREE.Points(burstGeo, burstMat);
burst.frustumCulled = false;
big.grp.add(burst);

/* ---------- 3. l'agent et ses outils (2 à 6) ---------- */
const net = new THREE.Group(); net.visible = false; scene.add(net);
const AG = new THREE.Vector3(0, 0.23, 0);
const fresnel = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uCol: { value: hdr(COL.accent, 1.6) }, uA: { value: 1 } },
  vertexShader: "varying vec3 vN, vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }",
  fragmentShader: "uniform vec3 uCol; uniform float uA; varying vec3 vN, vV; void main(){ float f = pow(1. - abs(dot(vN, vV)), 2.2); gl_FragColor = vec4(uCol * (0.25 + 1.6*f), (0.25 + f) * uA); }",
});
const makeAgent = () => {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 5), fresnel));
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 3), new THREE.MeshBasicMaterial({ color: hdr(COL.accent2, 2.4) })));
  return g;
};
const agentNode = makeAgent(); agentNode.position.copy(AG); net.add(agentNode);
const TOOLS = A.tools.slice(0, 6).map((tl, i, arr) => {
  const n = arr.length, ang = THREE.MathUtils.degToRad(90 + 180 / n - (i * 360) / n);
  const pos = new THREE.Vector3(Math.cos(ang) * 0.78, AG.y + Math.sin(ang) * 0.58, (i % 2 ? -0.12 : 0.14));
  return { ...tl, pos };
});
TOOLS.forEach((tl) => {
  tl.mesh = new THREE.Mesh(new THREE.SphereGeometry(0.085, 48, 32), new THREE.MeshPhysicalMaterial({ color: 0x2a100c, metalness: 0.2, roughness: 0.25, clearcoat: 1 }));
  tl.mesh.position.copy(tl.pos);
  tl.halo = new THREE.Mesh(new THREE.RingGeometry(0.11, 0.125, 96), new THREE.MeshBasicMaterial({ color: hdr(COL.accent, 1.4), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  tl.halo.position.copy(tl.pos);
  const mid = AG.clone().add(tl.pos).multiplyScalar(0.5);
  const side = new THREE.Vector3(-(tl.pos.y - AG.y), tl.pos.x - AG.x, 0).normalize().multiplyScalar(0.16);
  tl.curve = new THREE.QuadraticBezierCurve3(AG.clone(), mid.add(side).add(new THREE.Vector3(0, 0, 0.25)), tl.pos.clone());
  const tg = new THREE.TubeGeometry(tl.curve, 90, 0.0055, 8, false);
  tl.tube = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: hdr(COL.accent, 0.75), transparent: true, opacity: 0.6, depthWrite: false }));
  tl.tubeCount = tg.index.count;
  net.add(tl.mesh, tl.halo, tl.tube);
});
const STEPS = A.steps.slice(0, 8);
const toolOf = (s) => TOOLS.find((x) => x.id === s.tool) || TOOLS[0];
const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.028, 24, 16), new THREE.MeshBasicMaterial({ color: hdr(COL.accent2, 3.2) }));
net.add(pulse);
const endAgent = makeAgent(); endAgent.visible = false; scene.add(endAgent);

/* ---------- interface HTML construite depuis l'histoire ---------- */
const ui = document.getElementById("ui");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const md = (s) => esc(s).replace(/\*([^*]+)\*/g, '<span class="acc">$1</span>');
function node(cls, style, html) { const e = document.createElement("div"); e.className = cls; e.style.cssText = style || ""; e.innerHTML = html ?? ""; ui.appendChild(e); return e; }
function fitTitle(e, size) { e.style.fontSize = `${size}px`; while (e.scrollWidth > e.clientWidth + 1 && size > 44) { size -= 2; e.style.fontSize = `${size}px`; } return size; }
const WORDS = new Map();
function titleBlock(lines, top, size) {
  const e = node("abs title serif", `top:${top}px`, lines.map((l) => `<div data-words>${md(l)}</div>`).join(""));
  e.querySelectorAll("[data-words]").forEach((line) => {
    const out = [];
    [...line.childNodes].forEach((n) => {
      if (n.nodeType === 3) n.textContent.split(/\s+/).filter(Boolean).forEach((w) => { const s = document.createElement("span"); s.className = "w"; s.textContent = w; out.push(s); });
      else { n.classList.add("w"); out.push(n); }
    });
    line.replaceChildren(...out);
  });
  WORDS.set(e, [...e.querySelectorAll(".w")]);
  fitTitle(e, size);
  return e;
}
function reveal(e, t0, t, gap = 0.055) {
  WORDS.get(e).forEach((w, i) => {
    const p = easeOut(span(t, t0 + i * gap, t0 + i * gap + 0.42));
    w.style.opacity = p; w.style.filter = `blur(${(1 - p) * 12}px)`; w.style.transform = `translateY(${(1 - p) * 28}px)`;
  });
}
function popEl(e, t0, t, vis = 1, dy = 40, extra = "") {
  const p = backOut(span(t, t0, t0 + 0.5));
  e.style.opacity = c01(span(t, t0, t0 + 0.22)) * vis;
  e.style.filter = `blur(${(1 - c01(p)) * 10 + (1 - vis) * 14}px)`;
  e.style.transform = `translateY(${(1 - p) * dy}px) scale(${0.92 + 0.08 * p}) ${extra}`;
}
const sceneBlur = (e, vis) => { e.style.opacity = vis; e.style.filter = `blur(${(1 - vis) * 14}px)`; };
const v3 = new THREE.Vector3();
function place(e, vec) { v3.copy(vec).project(camera); e.style.left = `${((v3.x + 1) / 2) * W}px`; e.style.top = `${((1 - v3.y) / 2) * H}px`; }

// scène 2
const UI = {};
if (B) {
  UI.bTitle = titleBlock(B.title || [], 230, 78);
  if (B.gauge) {
    UI.ringNum = node("abs num", "font-size:96px", "");
    UI.ringLabel = node("abs label", "", esc(B.gauge.label || ""));
  }
  if (B.card) {
    const alone = !imgHero && !B.gauge;
    const style = imgHero ? "left:612px;top:1340px;width:400px" : alone ? "left:120px;top:760px;width:840px;text-align:center;padding:48px 40px" : "left:290px;top:1330px;width:500px;text-align:center";
    const vsize = alone ? Math.min(170, Math.floor(760 / (0.56 * String(B.card.value).length))) : 104;
    UI.bCard = node("abs card", style, `<div class="num" style="font-size:${vsize}px;color:${B.card.tone === "good" ? "var(--green)" : "var(--orange)"}">${esc(B.card.value)}</div><div class="label" style="margin-top:16px;font-size:${alone ? 36 : 30}px">${esc(B.card.label || "")}</div>`);
  }
}
// scène 3
UI.aTitle = titleBlock(A.title || ["Je l'ai confié", "à un *agent IA.*"], 200, 80);
UI.agentLab = node("abs tool", "font-size:30px;color:var(--accent2)", esc(A.agentName || "claude code"));
TOOLS.forEach((tl) => (tl.lab = node("abs tool", "", esc(tl.name))));
const stepFont = Math.min(37, Math.floor(770 / (0.6 * Math.max(...STEPS.map((s) => s.text.length)))));
UI.term = node("abs card", "left:60px;top:1295px;width:960px;padding:26px 40px 30px", `
  <div class="mono" style="font-size:22px;color:var(--muted);margin-bottom:12px;display:flex;align-items:center;gap:10px">
    <span style="width:14px;height:14px;border-radius:7px;background:#ff5f57;opacity:.85"></span>
    <span style="width:14px;height:14px;border-radius:7px;background:#febc2e;opacity:.85"></span>
    <span style="width:14px;height:14px;border-radius:7px;background:#28c840;opacity:.85;margin-right:12px"></span>
    ${esc(A.context || "claude code")}
    <span data-count style="margin-left:auto;color:var(--accent2)"></span>
  </div>
  <div style="display:flex;align-items:center;gap:20px;height:66px">
    <span class="mono" style="font-weight:700;font-size:34px;color:var(--accent)">›</span>
    <span data-text class="mono" style="font-size:${stepFont}px;flex:1;white-space:nowrap"></span>
    <span data-check class="check"><svg width="24" height="24" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#0b2a17" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
  </div>
  <div data-segs style="display:flex;gap:10px;margin-top:18px">${STEPS.map(() => '<div style="flex:1;height:10px;border-radius:5px"></div>').join("")}</div>`);
const termText = UI.term.querySelector("[data-text]"), termCount = UI.term.querySelector("[data-count]"), termCheck = UI.term.querySelector("[data-check]"), segs = [...UI.term.querySelector("[data-segs]").children];
if (A.validated) UI.validated = node("abs", "left:90px;top:1535px;font-family:'Public Sans',sans-serif;font-weight:800;font-size:38px;color:var(--accent2);transform-origin:left center", esc(A.validated));
// scène 4
if (R) {
  UI.rTitle = titleBlock([R.title || "*Résultat.*"], 200, 128);
  if (R.subtitle) UI.rSub = node("abs label", "left:90px;top:360px;font-size:34px", esc(R.subtitle));
  if (R.gauge) {
    UI.bigNum = node("abs num", "font-size:190px", "");
    UI.bigLabel = node("abs label", "left:0;right:0;text-align:center;font-size:36px", esc(R.gauge.label || ""));
  }
  const cards = (R.cards || []).slice(0, 3), n = cards.length, gap = 30, stack = !R.gauge;
  const cw = stack ? 960 : (960 - gap * (n - 1)) / Math.max(1, n);
  UI.cards = cards.map((c, i) => {
    const longest = Math.max(fmt(c.from, c.decimals || 0, c.unit || "").length, fmt(c.to, c.decimals || 0, c.unit || "").length);
    const size = Math.min(stack ? 150 : 92, Math.floor((cw - 72) / (0.56 * longest)));
    const pos = stack ? `left:60px;top:${520 + i * 350}px;width:960px;padding:34px 44px` : `left:${60 + i * (cw + gap)}px;top:1310px;width:${cw}px`;
    const e = node("abs card", pos,
      `<div class="label">${esc(c.label)}</div><div class="strike" style="margin-top:12px">${esc(c.before ?? fmt(c.from, c.decimals || 0, c.unit || ""))}</div><div data-v class="num" style="font-size:${size}px;color:var(--green)"></div>`);
    e._v = e.querySelector("[data-v]"); e._c = c;
    return e;
  });
  if (R.footnote) UI.foot = node("abs label", `left:0;right:0;top:${R.gauge ? 1610 : 520 + n * 350 + 10}px;text-align:center;font-size:26px`, esc(R.footnote));
}
// scène 5
UI.eTitle = titleBlock(E.title || ["Fait avec", "un *agent IA.*"], 200, 92);
if (E.name) UI.name = node("abs", "left:90px;top:640px;display:flex;align-items:center;gap:22px;font-family:'Public Sans',sans-serif",
  `<span style="width:64px;height:4px;background:var(--accent)"></span><span style="font-weight:800;font-size:52px;letter-spacing:-0.02em">${esc(E.name)}</span>`);
{ // le nom se place sous la dernière ligne du titre
  const h = UI.eTitle.getBoundingClientRect().height / (CAPTURE ? 1 : stage.getBoundingClientRect().height / H);
  if (UI.name) UI.name.style.top = `${200 + h + 36}px`;
}

/* ---------- caméra ---------- */
const POSES = {
  hook: { p: [0, 0, 7.5], l: [0, 0.05, 0] },
  before: { p: [0.15, 0.1, 6.4], l: [0, -0.1, 0] },
  agent: { p: [0, 0.15, 7.0], l: [0, 0.05, 0] },
  results: { p: [0, 0.25, 6.5], l: [0, 0.2, 0] },
  end: { p: [0, 0.1, 6.2], l: [0, 0.1, 0] },
};
const cp = new THREE.Vector3(), cl = new THREE.Vector3(), pa = new THREE.Vector3(), la = new THREE.Vector3(), pb = new THREE.Vector3(), lb = new THREE.Vector3(), tmp = new THREE.Vector3();
function poseFor(name, t, p, l) {
  const P = POSES[name], local = t - S[name];
  p.set(...P.p); l.set(...P.l);
  if (name === "hook") p.z -= local * 0.12;
  if (name === "before") { p.x += Math.sin(local * 0.5) * 0.25; p.z -= local * 0.06; }
  if (name === "agent") { const a = Math.sin(local * 0.35) * 0.22; p.x = Math.sin(a) * P.p[2]; p.z = Math.cos(a) * P.p[2]; }
  if (name === "results") p.z -= local * 0.08;
  if (name === "end") p.z -= local * 0.05;
}
function cameraAt(t) {
  let i = ORDER.length - 1;
  while (i > 0 && t < S[ORDER[i]] - 0.45) i--;
  const k = i === 0 ? 1 : easeInOut(span(t, S[ORDER[i]] - 0.45, S[ORDER[i]] + 0.55));
  poseFor(ORDER[i], t, pb, lb);
  if (k < 1) { poseFor(ORDER[i - 1], t, pa, la); cp.copy(pa).lerp(pb, k); cl.copy(la).lerp(lb, k); } else { cp.copy(pb); cl.copy(lb); }
  camera.position.copy(cp); camera.lookAt(cl); camera.updateMatrixWorld();
}

/* ---------- ligne de temps ---------- */
function update(t) {
  dustMat.uniforms.uTime.value = t;
  cameraAt(t);

  // 1. accroche
  hookMat.uniforms.uTime.value = t;
  hookMat.uniforms.uIntro.value = span(t, Q.intro[0], Q.intro[1]);
  hookMat.uniforms.uM.value.set(...[0, 1, 2].map((i) => (Q.morphs[i] ? span(t, Q.morphs[i][0], Q.morphs[i][1]) : 0)));
  hookMat.uniforms.uScatter.value = span(t, Q.scatter[0], Q.scatter[1]);
  hookPts.visible = t < Q.scatter[1] + 0.5;

  // téléphone
  if (HAS_PHONE) {
    const outEnd = Q.phoneOut[1] + 0.1;
    if (imgHero && has("before") && t >= Q.phoneIn[0] - 0.05 && t < outEnd) {
      const fl = 1 - easeOut(span(t, Q.phoneIn[0], Q.phoneIn[1])), out = easeInOut(span(t, Q.phoneOut[0], Q.phoneOut[1]));
      phone.position.set(lerp(0.32, 1.4, fl) + out * 1.9, lerp(-0.55, -3.8, fl) - out * 2.8, lerp(0, -1.2, fl) - out * 2.5);
      phone.rotation.set(0.06 + fl * 0.5 + out * 0.4, -0.32 - fl * 1.3 - out * 0.9 + Math.sin(t * 0.6) * 0.04, fl * 0.25);
      phone.visible = true; drawScreen("hero", 0);
    } else if (imgScroll && t >= Q.phoneBack[0] - 0.05) {
      const fl = 1 - easeOut(span(t, Q.phoneBack[0], Q.phoneBack[1]));
      phone.position.set(lerp(0, -1.3, fl), lerp(-0.95, -3.6, fl), lerp(0, -1, fl));
      phone.rotation.set(fl * 0.45, 0.22 * fl + Math.sin(t * 0.7) * 0.05, -fl * 0.2);
      phone.visible = true;
      const maxScroll = Math.max(0, imgScroll.naturalHeight * (780 / imgScroll.naturalWidth) - 1688);
      drawScreen("scroll", easeInOut(span(t, Q.scroll[0], Q.scroll[1])) * Math.min(2600, maxScroll));
    } else phone.visible = false;
  }

  // 2. point de départ
  const visB = sceneVis(t, "before");
  if (B) {
    sceneBlur(UI.bTitle, visB); reveal(UI.bTitle, Q.beforeTitle, t);
    if (B.gauge) {
      const rIn = backOut(span(t, Q.ringIn, Q.ringIn + 0.5));
      small.grp.visible = t > Q.ringIn - 0.1 && t < sceneEnd("before");
      small.grp.position.set(imgHero ? -0.6 : 0, imgHero ? -0.02 : 0.05, imgHero ? 0.75 : 0.6);
      small.grp.scale.setScalar(Math.max(0.001, rIn * (imgHero ? 1 : 1.55)));
      small.grp.lookAt(camera.position);
      const val = easeOut(span(t, Q.ringFill[0], Q.ringFill[1])) * B.gauge.value;
      small.mat.uniforms.uP.value = val / (B.gauge.max || 100);
      small.mat.uniforms.uCol.value.copy(hexHdr(scoreColor(B.gauge.value), 1.5));
      small.mat.uniforms.uA.value = visB;
      small.disc.material.opacity = 0.75 * visB * c01(rIn);
      place(UI.ringNum, small.grp.position);
      UI.ringNum.textContent = Math.round(val);
      UI.ringNum.style.color = scoreColor(B.gauge.value);
      UI.ringNum.style.fontSize = imgHero ? "96px" : "150px";
      popEl(UI.ringNum, Q.ringIn + 0.1, t, visB, 10, "translate(-50%,-50%)");
      place(UI.ringLabel, tmp.copy(small.grp.position).add(new THREE.Vector3(0, imgHero ? -0.36 : -0.55, 0)));
      popEl(UI.ringLabel, Q.ringIn + 0.25, t, visB, 10, "translate(-50%,0)");
    }
    if (UI.bCard) popEl(UI.bCard, Q.beforeCard, t, visB, 60);
  }

  // 3. l'agent
  const visA = sceneVis(t, "agent");
  net.visible = t > Q.agentIn - 0.1 && t < sceneEnd("agent");
  agentNode.scale.setScalar(Math.max(0.001, backOut(span(t, Q.agentIn, Q.agentIn + 0.6)) * (1 + Math.sin(t * 3) * 0.03)));
  agentNode.children[0].rotation.set(t * 0.3, t * 0.45, 0);
  fresnel.uniforms.uA.value = Math.max(visA, sceneVis(t, "end"));
  const eK = span(t, Q.edges[0], Q.edges[1]);
  const done = STEPS.map((s, i) => t >= Q.steps[i] + Q.pulse);
  let pulseOn = false;
  STEPS.forEach((s, i) => { const t0 = Q.steps[i]; if (t >= t0 && t < t0 + Q.pulse) { pulse.position.copy(toolOf(s).curve.getPoint(easeInOut(span(t, t0, t0 + Q.pulse)))); pulseOn = true; } });
  pulse.visible = pulseOn;
  TOOLS.forEach((tl, i) => {
    const k = easeOut(c01(eK * 1.3 - i * 0.08));
    tl.tube.geometry.setDrawRange(0, Math.floor((tl.tubeCount * k) / 3) * 3);
    tl.tube.material.opacity = 0.6 * visA;
    tl.mesh.scale.setScalar(Math.max(0.001, backOut(c01(eK * 1.3 - i * 0.08 - 0.15) * 1.4)));
    let flash = 0, any = false;
    STEPS.forEach((s, j) => { if (toolOf(s) !== tl) return; const dt = t - (Q.steps[j] + Q.pulse); if (dt >= 0) { any = true; flash = Math.max(flash, Math.exp(-dt * 3.2)); } });
    tl.halo.lookAt(camera.position);
    tl.halo.material.color.copy(any ? hdr(COL.green, 1.2 + flash * 2.4) : hdr(COL.accent, 0.8));
    tl.halo.material.opacity = (0.35 + 0.65 * c01(eK * 1.3 - 0.4)) * visA * (any ? 1 : 0.6);
    tl.halo.scale.setScalar(1 + flash * 0.6);
    tl.mesh.material.emissive.copy(any ? hdr(COL.green, 0.25 + flash * 0.9) : new THREE.Color(0, 0, 0));
    const up = tl.pos.y > AG.y + 0.05;
    place(tl.lab, tmp.copy(tl.pos).add(new THREE.Vector3(0, up ? 0.2 : -0.22, 0)));
    popEl(tl.lab, Q.edges[0] + 0.25 + i * 0.1, t, visA, 12, "translate(-50%,-50%)");
    tl.lab.style.color = any ? "#7ef0b0" : "";
  });
  sceneBlur(UI.aTitle, visA); reveal(UI.aTitle, Q.agentTitle, t);
  place(UI.agentLab, tmp.copy(AG).add(new THREE.Vector3(0, -0.3, 0)));
  popEl(UI.agentLab, Q.agentIn + 0.3, t, visA, 10, "translate(-50%,-50%)");
  popEl(UI.term, Q.steps[0] - 0.35, t, visA, 50);
  let cur = 0;
  for (let i = 0; i < STEPS.length; i++) if (t >= Q.steps[i]) cur = i;
  const txt = STEPS[cur].text;
  termText.textContent = txt.slice(0, Math.round(c01((t - Q.steps[cur]) / 0.4) * txt.length));
  termCount.textContent = `${cur + 1}/${STEPS.length}`;
  const ck = c01((t - Q.steps[cur] - Q.pulse) / 0.2);
  termCheck.style.opacity = ck; termCheck.style.transform = `scale(${0.4 + 0.6 * backOut(ck)})`;
  segs.forEach((d, i) => (d.style.background = done[i] ? "#0cce6b" : i === cur && t >= Q.steps[0] ? "rgba(255,176,102,.55)" : "rgba(251,238,230,.12)"));
  if (UI.validated) popEl(UI.validated, Q.validated, t, visA, 24);

  // 4. résultats
  const visR = sceneVis(t, "results");
  if (R) {
    sceneBlur(UI.rTitle, visR); reveal(UI.rTitle, Q.resultTitle, t);
    if (UI.rSub) popEl(UI.rSub, Q.resultTitle + 0.3, t, visR, 14);
    if (R.gauge) {
      const bIn = backOut(span(t, Q.bigRing, Q.bigRing + 0.6));
      big.grp.visible = t > Q.bigRing - 0.1 && t < sceneEnd("results");
      big.grp.position.set(0, 0.45, 0);
      big.grp.scale.setScalar(Math.max(0.001, bIn * 0.9));
      big.grp.lookAt(camera.position);
      const v = lerp(R.gauge.from, R.gauge.to, easeInOut(span(t, Q.bigFill[0], Q.bigFill[1])));
      big.mat.uniforms.uP.value = (v / (R.gauge.max || 100)) * c01(span(t, Q.bigRing, Q.bigRing + 0.4));
      big.mat.uniforms.uCol.value.copy(hexHdr(scoreColor(v), v >= 90 ? 1.6 : 1.5));
      big.mat.uniforms.uA.value = visR;
      big.disc.material.opacity = 0.7 * visR * c01(bIn);
      const boomOn = R.gauge.to >= 90;
      burstMat.uniforms.uT.value = boomOn && t >= Q.bigFill[1] ? t - Q.bigFill[1] : -1;
      bloom.strength = 0.85 + (boomOn && t >= Q.bigFill[1] ? Math.exp(-(t - Q.bigFill[1]) * 2.5) * 0.9 : 0);
      place(UI.bigNum, big.grp.position);
      UI.bigNum.textContent = Math.round(v);
      UI.bigNum.style.color = scoreColor(v);
      popEl(UI.bigNum, Q.bigRing + 0.15, t, visR, 10, `translate(-50%,-50%) scale(${1 + (t >= Q.bigFill[1] ? Math.exp(-(t - Q.bigFill[1]) * 4) * 0.12 : 0)})`);
      place(UI.bigLabel, tmp.copy(big.grp.position).add(new THREE.Vector3(0, -0.8 * 0.9 - 0.07, 0)));
      UI.bigLabel.style.left = "0px";
      popEl(UI.bigLabel, Q.bigRing + 0.3, t, visR, 10);
    }
    UI.cards.forEach((e, i) => {
      popEl(e, Q.cards[i], t, visR, 60);
      const k = easeOut(span(t, Q.cards[i] + 0.15, Q.cards[i] + 0.9)), c = e._c;
      e._v.textContent = fmt(lerp(c.from, c.to, k), c.decimals || 0, c.unit || "");
    });
    if (UI.foot) popEl(UI.foot, Q.footnote, t, visR, 10);
  }

  // 5. signature
  const visE = sceneVis(t, "end");
  sceneBlur(UI.eTitle, visE); reveal(UI.eTitle, Q.endText, t);
  if (UI.name) popEl(UI.name, Q.name, t, visE, 20);
  endAgent.visible = !imgScroll && t > Q.phoneBack[0];
  if (endAgent.visible) {
    endAgent.position.set(0, -0.85, 0);
    endAgent.scale.setScalar(Math.max(0.001, backOut(span(t, Q.phoneBack[0], Q.phoneBack[1])) * 2.2));
    endAgent.children[0].rotation.set(t * 0.3, t * 0.45, 0);
  }
  renderer.domElement.style.opacity = 1 - span(t, Q.fadeOut[0], Q.fadeOut[1]) * 0.85;
}

/* ---------- lecture ---------- */
window.renderAt = async (t) => { update(t); composer.render(); await new Promise((r) => requestAnimationFrame(() => r())); };
window.FILM = { total: TOTAL, gpu: (() => { const gl = renderer.getContext(); const ext = gl.getExtension("WEBGL_debug_renderer_info"); return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "?"; })() };
window.READY = true;

if (!CAPTURE) {
  const audio = new Audio(params.get("audio") || new URL("mix.wav", storyUrl).href);
  let t0 = performance.now();
  const hint = document.createElement("div"); hint.id = "hint"; hint.textContent = LOCALE.startsWith("fr") ? "clic = lecture avec le son" : "click to play with sound"; document.body.appendChild(hint);
  document.body.addEventListener("click", () => { audio.currentTime = 0; audio.play().catch(() => {}); t0 = performance.now(); hint.remove(); });
  const loop = () => { const t = audio.paused ? ((performance.now() - t0) / 1000) % TOTAL : audio.currentTime; update(t); composer.render(); requestAnimationFrame(loop); };
  loop();
}
