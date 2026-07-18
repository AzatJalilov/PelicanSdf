import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const ids = process.argv.slice(2);
if (!ids.length) throw new Error("Usage: node scripts/merge-measurements.mjs run-id [run-id ...]");

function envKey(env) {
  return [env?.gpu, env?.browser, Array.isArray(env?.resolution) ? env.resolution.join("x") : ""].join("|");
}

for (const id of ids) {
  const resultPath = path.join(root, "data", "results", id + ".json");
  const measurePath = path.join(root, "artifacts", "evals", id, "measurement.json");
  const result = JSON.parse(await readFile(resultPath, "utf8"));
  const measure = JSON.parse(await readFile(measurePath, "utf8"));
  const r = measure.result || {};
  result.metrics = {
    sourceBytes: result.metrics?.sourceBytes ?? null,
    initMs: r.initMs ?? null,
    gpuMsMedian: r.gpuMsMedian ?? null,
    gpuMsP95: r.gpuMsP95 ?? null,
    throughputFps: r.throughputFps ?? null,
    timingMethod: r.timingMethod ?? null,
    environment: r.environment ?? null,
    environmentKey: r.environmentKey ?? envKey(r.environment) ?? null,
    profile: r.profile ?? "pelican-canvas-960x540-v1",
    sampleCount: r.sampleCount ?? null,
    trials: r.trials ?? null,
    measuredAt: r.measuredAt ?? null,
  };
  if (measure.browserErrors?.length) {
    result.validation = result.validation || { state: "untested", checks: [], unmetRequirements: [], warnings: [] };
    result.validation.warnings = Array.from(new Set([
      ...(result.validation.warnings || []),
      ...measure.browserErrors.map((e) => "Browser error during measurement: " + e),
    ]));
  }
  await writeFile(resultPath, JSON.stringify(result, null, 2) + "\n", "utf8");
  console.log(id + ": " + r.throughputFps?.toFixed(1) + " fps (" + r.gpuMsMedian + " ms median, " + r.timingMethod + ")");
}
