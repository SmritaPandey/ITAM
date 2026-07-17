import { readFileSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const htmlFile = resolve(root, "qs_assets_enterprise_proposal.html");
const pdfFile = resolve(root, "QS_Assets_Enterprise_Proposal.pdf");
const docxFile = resolve(root, "QS_Assets_Enterprise_Proposal.docx");
const chromePath =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function exportPdf() {
  execFileSync(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--run-all-compositor-stages-before-draw",
      "--virtual-time-budget=15000",
      `--print-to-pdf=${pdfFile}`,
      "--no-pdf-header-footer",
      `file://${htmlFile}`,
    ],
    { stdio: "inherit" }
  );
  console.log(`PDF written: ${pdfFile}`);
}

async function exportDocx() {
  const HTMLtoDOCX = (await import("html-to-docx")).default;
  const html = readFileSync(htmlFile, "utf8");
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!bodyMatch) throw new Error("Could not find <body> in proposal HTML");

  const docxBuffer = await HTMLtoDOCX(
    `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${bodyMatch[1]}</body></html>`,
    null,
    {
      table: { row: { cantSplit: true } },
      footer: false,
      header: false,
      pageNumber: false,
      margins: {
        top: 720,
        right: 800,
        bottom: 720,
        left: 800,
        header: 0,
        footer: 0,
        gutter: 0,
      },
    },
    null
  );

  writeFileSync(docxFile, docxBuffer);
  console.log(`DOCX written: ${docxFile}`);
}

exportPdf();
await exportDocx();
