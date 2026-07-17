/**
 * Crop raw screenshots for brochure use — removes sidebar/chrome, focuses content.
 * Output: brochure-assets/cropped/
 */
import sharp from "sharp";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, "..", "brochure-assets", "screenshots");
const outDir = join(__dirname, "..", "brochure-assets", "cropped");
mkdirSync(outDir, { recursive: true });

/** left, top, width, height on 2880×1800 captures; then resize to target width */
const CROPS = [
  // App — skip ~17% left sidebar + top nav
  { name: "dashboard", file: "dashboard.png", left: 500, top: 110, width: 2320, height: 1050, outW: 1400 },
  { name: "discovery", file: "discovery.png", left: 500, top: 100, width: 2320, height: 980, outW: 1400 },
  { name: "tickets", file: "tickets.png", left: 500, top: 90, width: 2320, height: 1100, outW: 1400 },
  { name: "assets", file: "assets.png", left: 500, top: 90, width: 2320, height: 1000, outW: 1400 },
  { name: "audit-logs", file: "audit-logs.png", left: 500, top: 90, width: 2320, height: 1000, outW: 1400 },
  { name: "vulnerabilities", file: "vulnerabilities.png", left: 500, top: 90, width: 2320, height: 1000, outW: 1400 },
  { name: "cmdb", file: "cmdb.png", left: 500, top: 90, width: 2320, height: 1000, outW: 1400 },
  { name: "fleet", file: "fleet.png", left: 500, top: 90, width: 2320, height: 1000, outW: 1400 },
  { name: "reports", file: "reports.png", left: 500, top: 90, width: 2320, height: 1000, outW: 1400 },
  { name: "network-noc", file: "network-noc.png", left: 500, top: 90, width: 2320, height: 1000, outW: 1400 },
  // Marketing — hero bands
  { name: "pricing-band", file: "prod-pricing.png", left: 0, top: 0, width: 2880, height: 1100, outW: 1600 },
  { name: "security-band", file: "prod-security.png", left: 0, top: 0, width: 2880, height: 1100, outW: 1600 },
  { name: "customers-band", file: "prod-customers.png", left: 0, top: 200, width: 2880, height: 1200, outW: 1600 },
  { name: "platform-band", file: "prod-platform-section.png", left: 0, top: 0, width: 2880, height: 1300, outW: 1600 },
  // Module thumbs (tighter, smaller)
  { name: "thumb-cmdb", file: "cmdb.png", left: 500, top: 90, width: 2320, height: 700, outW: 800 },
  { name: "thumb-tickets", file: "tickets.png", left: 500, top: 90, width: 2320, height: 700, outW: 800 },
  { name: "thumb-fleet", file: "fleet.png", left: 500, top: 90, width: 2320, height: 700, outW: 800 },
  { name: "thumb-vuln", file: "vulnerabilities.png", left: 500, top: 90, width: 2320, height: 700, outW: 800 },
  { name: "thumb-reports", file: "reports.png", left: 500, top: 90, width: 2320, height: 700, outW: 800 },
  { name: "thumb-noc", file: "network-noc.png", left: 500, top: 90, width: 2320, height: 700, outW: 800 },
];

async function cropOne({ name, file, left, top, width, height, outW }) {
  const src = join(srcDir, file);
  const out = join(outDir, `${name}.png`);
  const meta = await sharp(src).metadata();
  const safe = {
    left: Math.min(left, (meta.width || 2880) - 100),
    top: Math.min(top, (meta.height || 1800) - 100),
    width: Math.min(width, (meta.width || 2880) - left),
    height: Math.min(height, (meta.height || 1800) - top),
  };
  const outH = Math.round(safe.height * (outW / safe.width));
  await sharp(src)
    .extract(safe)
    .resize(outW, outH, { fit: "fill" })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`  ✓ ${name}.png (${outW}×${outH})`);
}

console.log("\n✂️  Cropping brochure images…\n");
for (const c of CROPS) await cropOne(c);
console.log(`\nDone → ${outDir}\n`);
