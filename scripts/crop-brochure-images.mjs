/**
 * Crop raw screenshots to brochure layout slots (manifest-driven).
 */
import sharp from "sharp";
import { readFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const manifest = JSON.parse(
  readFileSync(join(root, "brochure-assets", "crop-manifest.json"), "utf8")
);
const srcDir = join(root, manifest.sourceDir);
const outDir = join(root, manifest.outputDir);
mkdirSync(outDir, { recursive: true });

async function cropSlot(name, slot) {
  const src = join(srcDir, slot.source);
  if (!existsSync(src)) {
    console.warn(`  ⚠ skip ${name} — missing ${slot.source}`);
    return;
  }
  const meta = await sharp(src).metadata();
  const e = slot.extract;
  const safe = {
    left: Math.min(e.left, (meta.width || 2880) - 50),
    top: Math.min(e.top, (meta.height || 1800) - 50),
    width: Math.min(e.width, (meta.width || 2880) - e.left),
    height: Math.min(e.height, (meta.height || 1800) - e.top),
  };
  const out = join(outDir, `${name.replace("slot-", "")}.png`);
  await sharp(src)
    .extract(safe)
    .resize(slot.output.width, slot.output.height, {
      fit: slot.fit || "cover",
      position: slot.position || "top",
    })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`  ✓ ${name} → ${slot.output.width}×${slot.output.height}`);
}

console.log("\n✂️  Cropping to manifest slots…\n");
for (const [name, slot] of Object.entries(manifest.slots)) {
  await cropSlot(name, slot);
}
console.log(`\nDone → ${outDir}\n`);
