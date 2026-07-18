import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const manifestPath = path.join(root, "data", "manifest.json");
const promptPath = path.join(root, "benchmark", "prompt.txt");
const expectedPromptHash = "cd21d5a8bb3956d82ab5650304e7e491063eacdb27dad85be6b4a845512f5e6b";
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const hashPattern = /^[0-9a-f]{64}$/;
const bannedArtifactPatterns = [
  [/\brequestAnimationFrame\s*\(/, "requestAnimationFrame"],
  [/\bset(?:Timeout|Interval)\s*\(/, "timer"],
  [/\b(?:fetch|XMLHttpRequest|WebSocket)\b/, "network API"],
  [/\b(?:localStorage|sessionStorage|indexedDB)\b/, "storage API"],
  [/\b(?:Worker|SharedWorker)\s*\(/, "worker"],
  [/\b(?:eval|Function)\s*\(/, "dynamic code evaluation"],
  [/^\s*import\s/m, "static import"],
  [/\bimport\s*\(/, "dynamic import"],
  [/\bdocument\s*\./, "document access"],
];

const errors = [];
const warnings = [];

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function fail(scope, message) {
  errors.push(`${scope}: ${message}`);
}

function warn(scope, message) {
  warnings.push(`${scope}: ${message}`);
}

async function readJson(filePath, scope) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    fail(scope, `invalid JSON (${error.message})`);
    return null;
  }
}

function requireString(result, key, scope) {
  if (typeof result[key] !== "string" || !result[key].trim()) fail(scope, `${key} must be a non-empty string`);
}

async function validateResult(entry, ids) {
  const resultPath = path.resolve(path.dirname(manifestPath), entry);
  const scope = entry;
  if (!resultPath.startsWith(`${path.join(root, "data", "results")}${path.sep}`)) {
    fail(scope, "manifest entry must stay inside data/results");
    return;
  }
  const result = await readJson(resultPath, scope);
  if (!result) return;

  for (const key of ["id", "title", "model", "provider", "status", "track", "promptVersion", "promptSha256", "artifactSha256", "createdAt", "artifact", "description"]) {
    requireString(result, key, scope);
  }
  if (!idPattern.test(result.id || "")) fail(scope, "id must be lowercase kebab-case");
  if (ids.has(result.id)) fail(scope, `duplicate id ${result.id}`);
  ids.add(result.id);
  if (path.basename(resultPath) !== `${result.id}.json`) fail(scope, "result filename must match id");
  if (result.promptVersion !== "1.0.0") fail(scope, "promptVersion must be 1.0.0 for this manifest");
  if (result.promptSha256 !== expectedPromptHash) fail(scope, "promptSha256 does not match benchmark/prompt.txt");
  if (!hashPattern.test(result.artifactSha256 || "")) fail(scope, "artifactSha256 must be lowercase SHA-256");
  if (!["reference", "unverified", "verified"].includes(result.status)) fail(scope, "invalid status");
  if (!["one-shot", "repair-2", "reference"].includes(result.track)) fail(scope, "invalid track");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result.createdAt || "")) fail(scope, "createdAt must use YYYY-MM-DD");

  if (!result.generationHarness || typeof result.generationHarness !== "object") {
    fail(scope, "generationHarness metadata is required");
  } else {
    for (const key of ["name", "surface"]) requireString(result.generationHarness, key, `${scope}.generationHarness`);
    if (!("version" in result.generationHarness)) fail(scope, "generationHarness.version must be present (null when unknown)");
    if (!("sandbox" in result.generationHarness)) fail(scope, "generationHarness.sandbox must be present (null when unknown)");
  }

  if (!result.generationUsage || typeof result.generationUsage !== "object") {
    fail(scope, "generationUsage metadata is required");
  } else {
    for (const key of ["inputTokens", "cachedInputTokens", "reasoningTokens", "outputTokens", "totalTokens", "apiCostUsd", "source", "notes"]) {
      if (!(key in result.generationUsage)) fail(scope, `generationUsage.${key} must be present (null when unknown)`);
    }
    if (!["api-metered", "subscription", "local", "unknown"].includes(result.generationUsage.billingMode)) fail(scope, "generationUsage.billingMode is invalid");
    const tokenFields = ["inputTokens", "cachedInputTokens", "reasoningTokens", "outputTokens", "totalTokens"];
    for (const key of tokenFields) {
      const value = result.generationUsage[key];
      if (value !== null && (!Number.isInteger(value) || value < 0)) fail(scope, `generationUsage.${key} must be a non-negative integer or null`);
    }
    if (result.generationUsage.apiCostUsd !== null && (!Number.isFinite(result.generationUsage.apiCostUsd) || result.generationUsage.apiCostUsd < 0)) fail(scope, "generationUsage.apiCostUsd must be a non-negative number or null");
  }

  if (!result.metrics || !Number.isInteger(result.metrics.sourceBytes)) fail(scope, "metrics.sourceBytes must be an integer");
  if (!result.visual || !Number.isInteger(result.visual.reviewers)) fail(scope, "visual.reviewers must be an integer");
  if (!result.validation
    || !Array.isArray(result.validation.checks)
    || !Array.isArray(result.validation.unmetRequirements)
    || !Array.isArray(result.validation.warnings)) {
    fail(scope, "validation record is incomplete");
  } else {
    for (const [index, finding] of result.validation.unmetRequirements.entries()) {
      if (!finding || typeof finding !== "object"
        || typeof finding.requirement !== "string" || !finding.requirement.trim()
        || typeof finding.evidence !== "string" || !finding.evidence.trim()) {
        fail(scope, `validation.unmetRequirements[${index}] must name a requirement and its evidence`);
      }
    }
  }
  if (!result.provenance || !["model-eval", "manual", "demo-fixture"].includes(result.provenance.generatorKind)) fail(scope, "provenance.generatorKind is invalid");

  const artifactPath = path.resolve(path.dirname(resultPath), result.artifact || "");
  const artifactsRoot = path.join(root, "data", "artifacts");
  if (!artifactPath.startsWith(`${artifactsRoot}${path.sep}`)) {
    fail(scope, "artifact must stay inside data/artifacts");
    return;
  }

  let source;
  try {
    source = await readFile(artifactPath);
  } catch (error) {
    fail(scope, `artifact cannot be read (${error.message})`);
    return;
  }
  const sourceText = source.toString("utf8");
  const sourceInfo = await stat(artifactPath);
  if (sourceInfo.size > 32768) fail(scope, `artifact is ${sourceInfo.size} bytes; limit is 32768`);
  if (sourceInfo.size !== result.metrics.sourceBytes) fail(scope, `sourceBytes says ${result.metrics.sourceBytes}, actual size is ${sourceInfo.size}`);
  if (sha256(source) !== result.artifactSha256) fail(scope, "artifactSha256 does not match artifact bytes");
  const exportMatches = sourceText.match(/export\s+function\s+createPelicanSdf\s*\(/g) || [];
  if (exportMatches.length !== 1) fail(scope, "artifact must export exactly one createPelicanSdf function declaration");
  for (const method of ["render", "setView", "getView", "dispose"]) {
    if (!new RegExp(`\\b${method}\\s*\\(`).test(sourceText)) fail(scope, `artifact does not appear to implement ${method}()`);
  }
  if (!/getContext\s*\(\s*["']webgl2["']/.test(sourceText)) fail(scope, "artifact does not request a WebGL2 context");
  for (const [pattern, name] of bannedArtifactPatterns) {
    if (pattern.test(sourceText)) fail(scope, `artifact uses banned ${name}`);
  }
  if (!/pointer(?:down|move)/.test(sourceText) || !/wheel/.test(sourceText) || !/keydown/.test(sourceText)) {
    warn(scope, "artifact may not implement the required pointer, wheel, and keyboard controls");
  }
  if (!/(touch|pointer)/.test(sourceText) || !/(pinch|touches|pointerId)/.test(sourceText)) {
    warn(scope, "static inspection could not confirm two-finger pinch support");
  }

  const syntax = spawnSync(process.execPath, ["--check", artifactPath], { encoding: "utf8" });
  if (syntax.status !== 0) fail(scope, `JavaScript syntax error: ${(syntax.stderr || syntax.stdout).trim()}`);
}

const prompt = await readFile(promptPath);
const promptHash = sha256(prompt);
if (promptHash !== expectedPromptHash) {
  fail("benchmark/prompt.txt", `prompt changed (${promptHash}); create a new prompt version and update result metadata`);
}

const manifest = await readJson(manifestPath, "data/manifest.json");
if (!Array.isArray(manifest) || !manifest.length) {
  fail("data/manifest.json", "manifest must contain at least one result path");
} else {
  const ids = new Set();
  for (const entry of manifest) {
    if (typeof entry !== "string") fail("data/manifest.json", "every manifest entry must be a string");
    else await validateResult(entry, ids);
  }
}

for (const message of warnings) console.warn(`WARN  ${message}`);
for (const message of errors) console.error(`ERROR ${message}`);

if (errors.length) {
  console.error(`\nValidation failed with ${errors.length} error${errors.length === 1 ? "" : "s"}.`);
  process.exit(1);
}

console.log(`Validated ${manifest.length} result${manifest.length === 1 ? "" : "s"} with ${warnings.length} warning${warnings.length === 1 ? "" : "s"}.`);
