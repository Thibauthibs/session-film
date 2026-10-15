// Fabrique un film de session à partir d'une histoire.
//   node make.mjs stories/<nom>/story.json            → <dossier de l'histoire>/<nom>.mp4
//   node make.mjs stories/<nom>/story.json --stills    → 6 images clés dans <dossier>/stills/ pour vérifier
//   node make.mjs stories/<nom>/story.json --stills 2.5,9.1
//   node make.mjs stories/<nom>/story.json --preview   → serveur local, film en boucle dans le navigateur
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { buildTimeline } from "./engine/timeline.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
if (!args[0]) { console.log("usage : node make.mjs <story.json> [--stills [t1,t2]] [--preview]"); process.exit(1); }
const storyPath = path.resolve(args[0]);
const storyDir = path.dirname(storyPath);
const story = JSON.parse(fs.readFileSync(storyPath, "utf8"));
const name = story.name || path.basename(storyDir);
const flag = (f) => args.indexOf(f);

// 1. minutage + bande son (musique + bruitages, sans voix)
// une histoire peut fournir son propre minutage (film sur mesure) ; sinon il est calculé
const tl = story.timing || buildTimeline(story);
fs.writeFileSync(path.join(storyDir, "timing.json"), JSON.stringify(tl, null, 1));
let hasAudio = true;
try {
  execFileSync("python3", [path.join(ROOT, "engine/audio/pub_audio.py"), path.join(storyDir, "timing.json"), story.voice ? path.join(storyDir, story.voice) : "-", path.join(storyDir, "mix.wav")], { stdio: "inherit" });
} catch {
  hasAudio = false;
  console.log("Bande son impossible (python3 + numpy + scipy + ffmpeg requis) : le film sera muet.");
}
const CHROME = process.env.CHROME_PATH || { darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", win32: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", linux: "/usr/bin/google-chrome" }[process.platform];

// 2. petit serveur : /engine, /node_modules et /story (le dossier de l'histoire)
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".wav": "audio/wav", ".css": "text/css" };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = u.startsWith("/story/") ? path.join(storyDir, u.slice(7))
    : u.startsWith("/node_modules/") ? path.join(ROOT, u)
    : path.join(ROOT, "engine", u.replace(/^\/engine\//, "/"));
  if (!file.startsWith(ROOT) && !file.startsWith(storyDir)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
});
await new Promise((r) => server.listen(args.includes("--preview") ? 8899 : 0, "127.0.0.1", r));
// une histoire peut aussi fournir sa propre page (film sur mesure), servie depuis son dossier
const pagePath = story.page ? `/story/${story.page}` : "/engine/index.html";
const base = `http://127.0.0.1:${server.address().port}${pagePath}?story=/story/${path.basename(storyPath)}`;

if (args.includes("--preview")) {
  console.log(`Film en boucle : ${base}  (clic = son ; ctrl+C pour arrêter)`);
} else {
  // 3. tournage image par image
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    protocolTimeout: 180000,
    args: ["--ignore-gpu-blocklist", "--enable-gpu-rasterization", ...(process.platform === "darwin" ? ["--use-angle=metal"] : [])],
  });
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.log("erreur page :", e.message));
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  await page.goto(`${base}&capture`, { waitUntil: "networkidle0", timeout: 120000 });
  await page.waitForFunction("window.READY === true", { timeout: 120000 });
  const info = await page.evaluate("window.FILM");
  console.log(`${name} : ${info.total} s | GPU ${info.gpu}`);
  const clip = { x: 0, y: 0, width: 1080, height: 1920 };

  if (flag("--stills") >= 0) {
    const S = tl.scenes, C = tl.cues || {}, given = args[flag("--stills") + 1] && !args[flag("--stills") + 1].startsWith("--");
    const list = given ? args[flag("--stills") + 1].split(",").map(Number)
      : story.timing ? [0.12, 0.27, 0.45, 0.6, 0.72, 0.9].map((k) => +(k * tl.total).toFixed(1))
      : [C.intro[1] + 0.4, S.before != null ? S.before + 2.6 : null, C.steps[Math.min(2, C.steps.length - 1)] + 0.6, C.validated + 0.3, S.results != null ? (C.cards?.[0] ?? S.results + 2) + 1.2 : null, S.end + 2.4].filter((x) => x != null);
    fs.mkdirSync(path.join(storyDir, "stills"), { recursive: true });
    for (const t of list) {
      await page.evaluate((x) => window.renderAt(x), t);
      const out = path.join(storyDir, "stills", `still_${t.toFixed(1)}.jpg`);
      await page.screenshot({ path: out, type: "jpeg", quality: 90, clip });
      console.log("image", out);
    }
  } else {
    const fps = 30, n = Math.round(info.total * fps), out = path.join(storyDir, `${name}.mp4`);
    const audioArgs = hasAudio ? ["-i", path.join(storyDir, "mix.wav")] : [];
    const audioCodec = hasAudio ? ["-c:a", "aac", "-b:a", "192k", "-shortest"] : [];
    const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(fps), "-i", "-", ...audioArgs,
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "17", "-preset", "slow", "-movflags", "+faststart", ...audioCodec, out],
      { stdio: ["pipe", "inherit", "inherit"] });
    const t0 = Date.now();
    // une image ratée est refaite (rare : délai du protocole de Chrome)
    const frame = async (t) => {
      for (let essai = 0; ; essai++) {
        try { await page.evaluate((x) => window.renderAt(x), t); return await page.screenshot({ type: "jpeg", quality: 93, clip }); }
        catch (e) { if (essai >= 2) throw e; console.log(`image à ${t.toFixed(2)} s refaite (${e.message.slice(0, 60)})`); await new Promise((r) => setTimeout(r, 500)); }
      }
    };
    for (let i = 0; i < n; i++) {
      const buf = await frame(i / fps);
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
      if (i % 150 === 0) console.log(`image ${i}/${n}`);
    }
    ff.stdin.end();
    await new Promise((r) => ff.on("close", r));
    console.log(`film : ${out} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  await browser.close();
  server.close();
}
