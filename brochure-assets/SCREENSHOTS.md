# Brochure visuals

Hybrid layout: **AI concept art** for covers, problems, architecture + **cropped real screenshots** as proof.

## Regenerate

```bash
# 1. Capture (optional — requires puppeteer + local dev)
node scripts/capture-brochure-screenshots.mjs

# 2. Crop screenshots (removes sidebar, focuses content)
node scripts/crop-brochure-images.mjs

# 3. Export PDF + DOCX
node scripts/export-brochure.mjs
```

## Asset map

| Page | AI art | Cropped screenshot |
|------|--------|-------------------|
| 1 Cover | `cover-hub.png` (ChatGPT hub) | — |
| 2 Problem | `problem-chaos.png` | — |
| 3 Solution | `discovery-mesh.png` | — |
| 4 Dashboard | — | `cropped/dashboard.png` |
| 5 Discovery | `discovery-mesh.png` banner | `cropped/discovery.png` |
| 6 Lifecycle | — | `cropped/network-noc.png` |
| 7 Modules | — | 6× `cropped/thumb-*.png` |
| 8 Security | `security-arch.png` | inset `cropped/audit-logs.png` |
| 9 Banking | `banking-estate.png` | inset `cropped/assets.png` |
| 10 Deploy | `cover-hero.png` | inset `cropped/security-band.png` |
| 11 Why | — | `cropped/pricing-band.png` |
| 12 Rollout | — | `cropped/discovery.png` |
| 13 Contact | `backcover-bg.png` | — |

AI originals live in `brochure-assets/`. Raw captures in `screenshots/`. Print-ready crops in `cropped/`.
