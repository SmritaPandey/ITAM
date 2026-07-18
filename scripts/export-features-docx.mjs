import { readFileSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const htmlFile = resolve(root, "qs_assets_features_list.html");
const docxFile = resolve(root, "QS_Assets_Features.docx");

const html = readFileSync(htmlFile, "utf8");
const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
if (!bodyMatch) throw new Error("Could not find <body> in features HTML");

const HTMLtoDOCX = (await import("html-to-docx")).default;
const docxBuffer = await HTMLtoDOCX(
  `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${bodyMatch[1]}</body></html>`,
  null,
  {
    table: { row: { cantSplit: false } },
    footer: false,
    header: false,
    pageNumber: false,
    margins: { top: 1080, right: 1080, bottom: 1080, left: 1080, header: 0, footer: 0, gutter: 0 },
  },
  null
);

writeFileSync(docxFile, docxBuffer);
console.log(`DOCX written: ${docxFile}`);
