// Generates Pakti's app icons from one SVG mark.
// Run: node scripts/generate-app-icons.mjs
// Uses sharp, which ships with Next.js as an optional dependency.
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const SAGE = "#2f5d50";
const PAPER = "#f7f5f0";
const WARM = "#e0a472";

// A three-quarter progress ring with a warm dot where it begins: progress,
// consistency, and the point you restart from.
const mark = (scale) => {
  const r = 120 * scale;
  const w = 44 * scale;
  const dot = 34 * scale;
  const top = 256 - r;
  return `
    <path d="M256 ${top} a${r} ${r} 0 1 1 ${-r} ${r}" fill="none" stroke="${PAPER}" stroke-width="${w}" stroke-linecap="round"/>
    <circle cx="256" cy="${top}" r="${dot}" fill="${WARM}"/>`;
};

// Rounded tile for favicons and iOS; full-bleed with a smaller mark for
// Android "maskable" icons, so nothing is clipped by the launcher's shape.
const tile = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${SAGE}"/>${mark(1)}</svg>`;
const fullBleed = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${SAGE}"/>${mark(1)}</svg>`;
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${SAGE}"/>${mark(0.78)}</svg>`;

await mkdir("public/icons", { recursive: true });
await writeFile("src/app/icon.svg", tile);

const outputs = [
  ["public/icons/icon-192.png", tile, 192],
  ["public/icons/icon-512.png", tile, 512],
  ["public/icons/icon-maskable-512.png", maskable, 512],
  ["src/app/apple-icon.png", fullBleed, 180], // iOS rounds the corners itself
];
for (const [file, svg, size] of outputs) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(file);
  console.log("wrote", file);
}
