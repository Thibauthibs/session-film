// Captures mobiles d'un site pour un film : node shoot.mjs <url> <dossier>
// → <dossier>/site-hero.jpg (écran d'accueil, 390×844 à ×3) et <dossier>/site-scroll.jpg (4 000 premiers px CSS à ×2,
//   soit 8 000 px : au-delà, certaines cartes graphiques refusent la texture)
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const [url, dir] = process.argv.slice(2);
if (!url || !dir) { console.log("usage : node shoot.mjs <url> <dossier>"); process.exit(1); }
const CHROME = process.env.CHROME_PATH || { darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", win32: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", linux: "/usr/bin/google-chrome" }[process.platform];
fs.mkdirSync(dir, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
await page.evaluate(async () => { await document.fonts.ready; });
await page.screenshot({ path: path.join(dir, "site-hero.jpg"), type: "jpeg", quality: 90 });
const height = await page.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
  window.scrollTo(0, 0);
  document.querySelectorAll("img").forEach((i) => (i.loading = "eager"));
  const st = document.createElement("style");
  st.textContent = "[class*=float],[class*=sticky],[class*=cookie],[id*=cookie]{display:none!important} header{position:relative!important}";
  document.head.appendChild(st);
  return document.documentElement.scrollHeight;
});
await new Promise((r) => setTimeout(r, 1500));
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.screenshot({ path: path.join(dir, "site-scroll.jpg"), type: "jpeg", quality: 85, captureBeyondViewport: true, clip: { x: 0, y: 0, width: 390, height: Math.min(4000, height) } });
await browser.close();
console.log("captures :", path.join(dir, "site-hero.jpg"), path.join(dir, "site-scroll.jpg"));
