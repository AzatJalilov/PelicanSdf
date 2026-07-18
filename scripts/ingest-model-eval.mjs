import { createHash } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const id = process.argv[2];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeResponse(raw) {
  let source = raw.toString("utf8");
  const actions = [];
  if (source.charCodeAt(0) === 0xfeff) {
    source = source.slice(1);
    actions.push("removed UTF-8 BOM");
  }
  const fence = String.fromCharCode(96).repeat(3);
  const fencedPattern = new RegExp(
    "^\\s*" + fence + "(?:javascript|js)?[ \\t]*\\r?\\n([\\s\\S]*?)\\r?\\n" + fence + "[ \\t]*\\s*$",
    "i",
  );
  const fenced = fencedPattern.exec(source);
  if (fenced) {
    source = fenced[1];
    actions.push("removed one surrounding Markdown fence");
  }
  if (source.includes("\r\n")) {
    source = source.replace(/\r\n/g, "\n");
    actions.push("normalized CRLF to LF");
  }
  if (!source.endsWith("\n")) {
    source += "\n";
    actions.push("added trailing LF");
  }
  return { source, actions };
}

if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id || "")) {
  throw new Error("Usage: npm run eval:ingest -- lowercase-kebab-id");
}

const rawDir = path.join(root, "data", "raw", id);
const responsePath = path.join(rawDir, "response.txt");
const thinkingPath = path.join(rawDir, "thinking.txt");
const receiptPath = path.join(rawDir, "receipt.json");
const artifactPath = path.join(root, "data", "artifacts", id + ".js");
const resultPath = path.join(root, "data", "results", id + ".json");
if (await exists(artifactPath) || await exists(resultPath)) {
  throw new Error("Refusing to overwrite an existing artifact or result for " + id);
}

const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
if (receipt.id !== id) throw new Error("Receipt id does not match the requested run");
// Use the channel the run actually produced: reasoning-only models (e.g. Kimi
// K3 via OpenRouter) may stream the entire answer as thinking content.
const artifactSourcePath = receipt.response?.source === "thinking" ? thinkingPath : responsePath;
const raw = await readFile(artifactSourcePath);
if (receipt.response?.sha256 !== sha256(raw)) throw new Error("Raw response hash does not match its receipt (source=" + (receipt.response?.source || "text") + ")");

const prompt = await readFile(path.join(root, "benchmark", "prompt.txt"));
if (receipt.prompt?.sha256 !== sha256(prompt)) throw new Error("Receipt prompt hash does not match benchmark/prompt.txt");

const { source, actions } = normalizeResponse(raw);
const sourceBuffer = Buffer.from(source, "utf8");
const variant = receipt.model.split("-").at(-1);
const displayName = receipt.modelDisplayName || variant.charAt(0).toUpperCase() + variant.slice(1);
const title = displayName + " / " + receipt.reasoningEffort + " effort";
const accents = { terra: "#8a5a2b", sol: "#c94f2d", luna: "#446aa8" };
const normalization = actions.length ? actions.join("; ") : "byte-identical response";
const usage = receipt.usage || {};
const harnessName = receipt.harness?.name || "Codex CLI";
const harnessNotes =
  receipt.harness?.notes ||
  "Fresh ephemeral invocation with user config and project rules disabled; orchestrated by Codex.";
const provider = receipt.provider || "OpenAI via Codex CLI";
const methodPrefix =
  harnessName === "Codex CLI"
    ? "Fresh one-shot Codex CLI invocation; read-only ephemeral sandbox; "
    : "Fresh one-shot " + harnessName + " invocation; text-only with tools and skills disabled; ";

const result = {
  id,
  title,
  model: receipt.model,
  provider,
  status: "unverified",
  track: "one-shot",
  promptVersion: "1.0.0",
  promptSha256: receipt.prompt.sha256,
  artifactSha256: sha256(sourceBuffer),
  createdAt: receipt.completedAt.slice(0, 10),
  artifact: "../artifacts/" + id + ".js",
  description: "Unreviewed one-shot SDF artifact generated at " + receipt.reasoningEffort + " reasoning effort.",
  accent: receipt.accent || accents[variant] || "#0b6e75",
  generationHarness: {
    name: harnessName,
    version: receipt.harness.version,
    surface: receipt.harness.surface,
    sandbox: receipt.harness.sandbox,
    notes: harnessNotes,
  },
  generationUsage: {
    inputTokens: usage.inputTokens ?? null,
    cachedInputTokens: usage.cachedInputTokens ?? null,
    reasoningTokens: usage.reasoningTokens ?? null,
    outputTokens: usage.outputTokens ?? null,
    totalTokens: usage.totalTokens ?? null,
    apiCostUsd: receipt.billing.apiCostUsd,
    billingMode: receipt.billing.mode === "openrouter" ? "api-metered" : (receipt.billing.mode || "unknown"),
    source: "data/raw/" + id + "/events.jsonl",
    notes: receipt.billing.note,
  },
  validation: {
    state: "untested",
    checks: [],
    unmetRequirements: [],
    warnings: ["Draft; runtime and visual validation have not run."],
  },
  metrics: {
    sourceBytes: sourceBuffer.byteLength,
    initMs: null,
    gpuMsMedian: null,
    gpuMsP95: null,
    throughputFps: null,
    timingMethod: null,
    environment: null,
    environmentKey: null,
    profile: "pelican-canvas-960x540-v1",
    sampleCount: null,
    trials: null,
    measuredAt: null,
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
    method: methodPrefix + normalization,
    rawResponse: "../raw/" + id + "/response.txt",
    decoding: "reasoning effort: " + receipt.reasoningEffort + "; other decoding settings not exposed",
  },
};

await writeFile(artifactPath, sourceBuffer, { flag: "wx" });
await writeFile(resultPath, JSON.stringify(result, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
console.log(JSON.stringify({
  id,
  artifact: path.relative(root, artifactPath),
  result: path.relative(root, resultPath),
  bytes: sourceBuffer.byteLength,
  normalization: actions,
}, null, 2));
