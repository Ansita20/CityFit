// The production server bundle (.output/server/_libs/pdf-parse+pdfjs-dist.mjs)
// imports its PDF.js worker via a relative "./pdf.worker.mjs" specifier that
// the bundler never actually emits alongside it — the real file only exists
// inside node_modules/pdfjs-dist. Without it, every resume upload fails with
// "We couldn't read text from that file", even for a perfectly normal PDF,
// because PDF.js's internal "fake worker" fallback does its own hardcoded
// relative-path lookup that bypasses GlobalWorkerOptions.workerSrc entirely.
// Copying the real worker file to the exact path the bundle expects fixes it.
import { copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const libsDir = path.join(projectRoot, ".output", "server", "_libs");
const source = path.join(projectRoot, "node_modules", "pdfjs-dist", "build", "pdf.worker.mjs");

if (!existsSync(libsDir)) {
  console.error(`[copy-pdf-worker] ${libsDir} does not exist — did the build run?`);
  process.exit(1);
}
if (!existsSync(source)) {
  console.error(`[copy-pdf-worker] ${source} not found — is pdfjs-dist installed?`);
  process.exit(1);
}

const dest = path.join(libsDir, "pdf.worker.mjs");
copyFileSync(source, dest);
console.log(`[copy-pdf-worker] copied pdf.worker.mjs -> ${dest}`);
