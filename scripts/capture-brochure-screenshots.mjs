/**
 * Capture real QS Assets screenshots for the product brochure.
 * Public pages: production (www.qsasset.com)
 * App pages: local dev (localhost:3100) with seeded demo data
 */
import puppeteer from "puppeteer";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "brochure-assets", "screenshots");
mkdirSync(outDir, { recursive: true });

const PROD = "https://www.qsasset.com";
const LOCAL = "http://localhost:3100";
const API = "http://localhost:4100/api/v1";
const LOGIN = { email: "director@demobank.com", password: "Demo@2026" };

const VIEWPORT = { width: 1440, height: 900, deviceScaleFactor: 2 };

async function getTokens() {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(LOGIN),
  });
  if (!res.ok) throw new Error(`Login failed: ${await res.text()}`);
  return res.json();
}

async function injectAuth(page, tokens) {
  await page.goto(`${LOCAL}/login`, { waitUntil: "networkidle2", timeout: 60000 });
  await page.evaluate(
    ({ accessToken, refreshToken, email }) => {
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      localStorage.setItem("userEmail", email);
      try {
        const payload = JSON.parse(atob(accessToken.split(".")[1]));
        localStorage.setItem("userRole", payload.role || "");
      } catch {}
    },
    { ...tokens, email: LOGIN.email }
  );
}

async function shot(page, name, url, opts = {}) {
  const { clip, waitMs = 2500, fullPage = false, dark = false } = opts;
  await page.goto(url, { waitUntil: "networkidle2", timeout: 90000 });
  if (dark) {
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("theme", "dark");
    });
    await new Promise((r) => setTimeout(r, 500));
  }
  await new Promise((r) => setTimeout(r, waitMs));
  const file = join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage, clip, type: "png" });
  console.log(`  ✓ ${name}.png`);
  return file;
}

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1440,900"],
    defaultViewport: VIEWPORT,
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);

  console.log("\n📸 Public pages (production)…");
  await shot(page, "prod-landing-hero", `${PROD}/`, {
    clip: { x: 0, y: 0, width: 1440, height: 900 },
    waitMs: 3000,
  });
  await shot(page, "prod-pricing", `${PROD}/pricing`, { waitMs: 2000 });
  await shot(page, "prod-security", `${PROD}/security`, { waitMs: 2000 });
  await shot(page, "prod-customers", `${PROD}/customers`, { waitMs: 2000 });
  await shot(page, "prod-contact", `${PROD}/contact`, { waitMs: 2000 });
  await shot(page, "prod-about", `${PROD}/about`, { waitMs: 2000 });
  await page.goto(`${PROD}/#platform`, { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 2500));
  await page.screenshot({ path: join(outDir, "prod-platform-section.png"), type: "png" });
  console.log("  ✓ prod-platform-section.png");
  await page.evaluate(() => window.scrollTo(0, 1100));
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({
    path: join(outDir, "prod-modules-section.png"),
    type: "png",
    clip: { x: 0, y: 0, width: 1440, height: 900 },
  });
  console.log("  ✓ prod-modules-section.png");

  console.log("\n📸 App pages (local demo tenant)…");
  const tokens = await getTokens();
  await injectAuth(page, tokens);

  const appRoutes = [
    ["dashboard", "/dashboard", 4000],
    ["assets", "/dashboard/it-assets", 3500],
    ["discovery", "/dashboard/discovery", 3500],
    ["tickets", "/dashboard/tickets", 3500],
    ["vulnerabilities", "/dashboard/vulnerabilities", 3500],
    ["network-noc", "/dashboard/network/noc", 3500],
    ["reports", "/dashboard/reports", 3500],
    ["fleet", "/dashboard/fleet", 3500],
    ["audit-logs", "/dashboard/audit-logs", 3500],
    ["cmdb", "/dashboard/cmdb", 3500],
    ["patches", "/dashboard/patches", 3500],
    ["procurement", "/dashboard/procurement", 3500],
    ["cctv", "/dashboard/cctv", 3500],
    ["software", "/dashboard/software", 3500],
    ["compliance", "/dashboard/compliance", 3500],
    ["non-it-assets", "/dashboard/non-it-assets", 3500],
    ["facility", "/dashboard/facility", 3500],
    ["intelligence", "/dashboard/intelligence", 3500],
    ["scanning", "/dashboard/scanning", 3500],
    ["alerts", "/dashboard/alerts", 3500],
    ["automation", "/dashboard/automation", 3500],
  ];

  for (const [name, path, waitMs] of appRoutes) {
    await shot(page, name, `${LOCAL}${path}`, { dark: true, waitMs });
  }

  await browser.close();
  console.log(`\nDone → ${outDir}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
