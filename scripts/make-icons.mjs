// Gera os ícones PNG do PWA a partir do logo, usando o Chromium já instalado. Uso: node scripts/make-icons.mjs
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("/node-tools/node_modules/");
const { chromium } = require("playwright");

const logo = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#0f1829"/>
  <g transform="translate(${pad} ${pad}) scale(${(512 - pad * 2) / 512})">
    <circle cx="256" cy="256" r="196" fill="#0d9488"/>
    <path d="M128 336c64-16 80-112 144-112s64 80 112 64" stroke="#fff" stroke-width="42" fill="none" stroke-linecap="round"/>
    <circle cx="384" cy="288" r="32" fill="#fff"/>
  </g>
</svg>`;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage();
const out = async (file, size, pad) => {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0;background:#0f1829">${logo(pad).replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body>`);
  await page.screenshot({ path: file, omitBackground: false });
};
await out("public/icons/icon-192.png", 192, 0);
await out("public/icons/icon-512.png", 512, 0);
await out("public/icons/maskable-512.png", 512, 64); // zona segura para ícone "maskable"
await out("public/icons/apple-touch-icon.png", 180, 0);
await browser.close();
console.log("ok", fs.readdirSync("public/icons"));
