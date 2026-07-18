import { createHash } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const id = process.argv[2];

if (!id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
  console.error("Usage: npm run new-result -- lowercase-kebab-id");
  process.exit(1);
}

const artifactRelative = `../artifacts/${id}.js`;
const artifactPath = path.join(root, "data", "artifacts", `${id}.js`);
const resultPath = path.join(root, "data", "results", `${id}.json`);
for (const filePath of [artifactPath, resultPath]) {
  try {
    await access(filePath);
    console.error(`Refusing to overwrite ${path.relative(root, filePath)}`);
    process.exit(1);
  } catch {
    // The path is available.
  }
}

const prompt = await readFile(path.join(root, "benchmark", "prompt.txt"));
const promptHash = createHash("sha256").update(prompt).digest("hex");
const artifact = `// Replace this file with the model's untouched first response.\n// It must export createPelicanSdf(canvas) exactly as benchmark/prompt.txt requests.\n`;
const artifactHash = createHash("sha256").update(artifact).digest("hex");
const result = {
  id,
  title: "TODO: specimen title",
  model: "TODO: exact model identifier",
  provider: "TODO: provider",
  status: "unverified",
  track: "one-shot",
  promptVersion: "1.0.0",
  promptSha256: promptHash,
  artifactSha256: artifactHash,
  createdAt: new Date().toISOString().slice(0, 10),
  artifact: artifactRelative,
  description: "TODO: factual description of the first response",
  accent: "#16877e",
  generationHarness: {
    name: "TODO: API, CLI, or chat surface",
    version: null,
    surface: "TODO: invocation surface",
    sandbox: null,
    notes: null,
  },
  generationUsage: {
    inputTokens: null,
    cachedInputTokens: null,
    reasoningTokens: null,
    outputTokens: null,
    totalTokens: null,
    apiCostUsd: null,
    billingMode: "unknown",
    source: null,
    notes: "TODO: attach provider receipt or explain why usage/cost is unavailable",
  },
  validation: { state: "untested", checks: [], unmetRequirements: [], warnings: ["Draft; not yet validated"] },
  metrics: {
    sourceBytes: Buffer.byteLength(artifact),
    initMs: null,
    gpuMsMedian: null,
    gpuMsP95: null,
    throughputFps: null,
    timingMethod: null,
    environment: null,
  },
  visual: {
    readability: null,
    completeness: null,
    coherence: null,
    craft: null,
    inspectability: null,
    reviewers: 0,
  },
  provenance: {
    generatorKind: "model-eval",
    method: "TODO: one-shot invocation details and any byte-preserving normalization",
    rawResponse: artifactRelative,
    decoding: null,
  },
};

await writeFile(artifactPath, artifact, { encoding: "utf8", flag: "wx" });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, { encoding: "utf8", flag: "wx" });

console.log(`Created draft:\n  ${path.relative(root, artifactPath)}\n  ${path.relative(root, resultPath)}`);
console.log("\nNext: replace the artifact, fill every TODO, update byte/hash fields, then add the result JSON path to data/manifest.json and run npm test.");
