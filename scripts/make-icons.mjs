// scripts/make-icons.mjs
// Draws the SnapFind app icon (a camera viewfinder with a magnifying glass) and saves it in
// every size phones ask for. Run with: node scripts/make-icons.mjs
import sharp from "sharp";

// "pad" shrinks the drawing for "maskable" icons: Android may crop icons into circles,
// so the important part has to stay inside the middle 80%.
const svg = (pad = 0) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${pad ? 0 : 112}" fill="#7c5cff"/>
  <g transform="translate(${pad} ${pad}) scale(${(512 - 2 * pad) / 512})" fill="none" stroke="#fff" stroke-width="34" stroke-linecap="round">
    <path d="M120 190 V140 a20 20 0 0 1 20 -20 H190"/>
    <path d="M322 120 H372 a20 20 0 0 1 20 20 V190"/>
    <path d="M120 322 V372 a20 20 0 0 0 20 20 H190"/>
    <circle cx="246" cy="246" r="72"/>
    <path d="M300 300 L380 380"/>
  </g>
</svg>`;

const out = [
  ["public/icon-192.png", 192, 0],
  ["public/icon-512.png", 512, 0],
  ["public/icon-maskable-512.png", 512, 60],
  ["app/apple-icon.png", 180, 40], // iPhone home screen (iOS rounds the corners itself)
  ["app/icon.png", 64, 0], // the little icon in the browser tab
];
for (const [file, size, pad] of out) {
  await sharp(Buffer.from(svg(pad))).resize(size, size).png().toFile(file);
  console.log("made", file);
}
