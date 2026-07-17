# Brochure visuals — 12-page CIO edition

## Visual tiers

| Tier | Use | Count |
|------|-----|-------|
| A — AI concept | Cover, problem, banking, discovery banner, security, back cover | 6 |
| B — Product proof | Dashboard hero + banking assets inset | 2 |
| C — Text / SVG | Modules, compare, roadmap, deployment | 0 photos |

## Regenerate

```bash
# Optional: capture from local demo (requires API + web running)
node scripts/capture-brochure-screenshots.mjs

# Crop to layout slots (dashboard + assets)
node scripts/crop-brochure-images.mjs

# Export PDF + DOCX
node scripts/export-brochure.mjs
```

Outputs: `hero.png` and `inset.png` in `brochure-assets/cropped/` (682×360 and 300×170).

Slot definitions: `brochure-assets/crop-manifest.json`.

## Page map

| # | Title | Visual |
|---|-------|--------|
| 1 | Cover | `cover-hub.png` full bleed |
| 2 | CIO snapshot | `problem-chaos.png` accent |
| 3 | Four moves | SVG ring only |
| 4 | Command center | `cropped/hero.png` |
| 5 | Banking | `banking-estate.png` + `cropped/inset.png` |
| 6 | Modules | Text grid only |
| 7 | Discovery | `discovery-mesh.png` banner |
| 8 | Security | `security-arch.png` |
| 9 | Deployment | SVG topology |
| 10 | Why | Compare columns |
| 11 | Implementation | Roadmap |
| 12 | Contact | `backcover-bg.png` |

## Demo login (local capture)

`director@demobank.com` / `Demo@2026` on National Digital Bank tenant.

Production Railway auth may be unavailable; brochure proof shots use demo UI or AI mockups until production API is healthy.
