/**
 * Capture the two product-proof screenshots for the brochure.
 * Requires local API (:4100) + web (:3100) with seeded demo tenant.
 */
import puppeteer from "puppeteer";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "brochure-assets", "screenshots");
mkdirSync(outDir, { recursive: true });

const LOCAL = process.env.BROCHURE_WEB_URL || "http://localhost:3100";
const API = process.env.BROCHURE_API_URL || "http://localhost:4100/api/v1";
const LOGIN = {
  email: process.env.BROCHURE_DEMO_EMAIL || "director@demobank.com",
  password: process.env.BROCHURE_DEMO_PASSWORD || "Demo@2026",
};

const VIEWPORT = { width: 1440, height: 900, deviceScaleFactor: 2 };

const ROUTES = [
  { name: "dashboard", path: "/dashboard", waitMs: 4000 },
  { name: "assets", path: "/dashboard/it-assets", waitMs: 3500 },
];

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
      localStorage.setItem("theme", "dark");
      document.documentElement.setAttribute("data-theme", "dark");
      try {
        const payload = JSON.parse(atob(accessToken.split(".")[1]));
        localStorage.setItem("userRole", payload.role || "");
      } catch {}
    },
    { ...tokens, email: LOGIN.email }
  );
}

async function shot(page, name, path, waitMs) {
  await page.goto(`${LOCAL}${path}`, { waitUntil: "networkidle2", timeout: 90000 });
  await new Promise((r) => setTimeout(r, waitMs));
  await page.screenshot({ path: join(outDir, `${name}.png`), type: "png" });
  console.log(`  ✓ ${name}.png`);
}

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1440,900"],
    defaultViewport: VIEWPORT,
  });
  const page = await browser.newPage();
  console.log("\n📸 Product proof captures…");
  const tokens = await getTokens();
  await injectAuth(page, tokens);
  for (const r of ROUTES) await shot(page, r.name, r.path, r.waitMs);
  await browser.close();
  console.log(`\nDone → ${outDir}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
