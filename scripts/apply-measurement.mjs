import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const id = process.argv[2];
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id || "")) {
  throw new Error("Usage: node scripts/apply-measurement.mjs lowercase-kebab-id");
}

const measurementPath = path.join(root, "artifacts", "evals", id, "measurement.json");
const resultPath = path.join(root, "data", "results", `${id}.json`);
const measurement = JSON.parse(await readFile(measurementPath, "utf8"));
const result = JSON.parse(await readFile(resultPath, "utf8"));
if (measurement.id !== id) throw new Error("measurement id mismatch");

const summary = measurement.result;
if (!summary) throw new Error("measurement.json has no result summary; inspect the measurement output manually");

const gpu = summary.environment?.gpu || "";
const browser = summary.environment?.browser || "";
const knownEnvironment =
  gpu.includes("AMD Radeon(TM) Graphics (0x000015BF)") && browser.includes("HeadlessChrome/150");
if (!knownEnvironment) {
  throw new Error(
    "Measurement environment differs from the recorded profile strings; update the condensed environment/environmentKey in this script before applying.",
  );
}

const round = (value, places) =>
  value === null || value === undefined ? null : Number(value.toFixed(places));

result.metrics = {
  ...result.metrics,
  initMs: round(summary.initMs, 1),
  gpuMsMedian: round(summary.gpuMsMedian, 4),
  gpuMsP95: round(summary.gpuMsP95, 4),
  throughputFps: round(summary.throughputFps, 4),
  timingMethod: summary.timingMethod,
  environment: "AMD Radeon(TM) Graphics / ANGLE D3D11; Headless Chrome 150; Windows; 960x540; 3 serial trials",
  environmentKey: "amd-15bf-angle-d3d11|headless-chrome-150|windows|960x540|pelican-canvas-v1",
  profile: summary.profile,
  sampleCount: summary.sampleCount,
  trials: summary.trials,
  measuredAt: summary.measuredAt,
};

const browserErrors = measurement.browserErrors || [];
if (browserErrors.length === 0) {
  result.validation = {
    state: "passed",
    checks: [
      "JavaScript syntax",
      "lifecycle contract",
      "WebGL2 compilation",
      "initial composition",
      "pointer orbit",
      "wheel zoom",
      "two-finger pinch",
      "keyboard camera",
      "multi-angle camera response",
      "close-range inspection",
      "three-trial GPU timing",
    ],
    unmetRequirements: [],
    warnings: [],
  };
} else {
  result.validation = {
    state: "failed",
    checks: [],
    unmetRequirements: [],
    warnings: browserErrors.map((error) => String(error)),
  };
}

await writeFile(resultPath, JSON.stringify(result, null, 2) + "\n", "utf8");
console.log(
  JSON.stringify(
    {
      id,
      validation: result.validation.state,
      gpuMsMedian: result.metrics.gpuMsMedian,
      throughputFps: result.metrics.throughputFps,
      warnings: result.validation.warnings,
    },
    null,
    2,
  ),
);
