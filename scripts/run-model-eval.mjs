import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { extractCodexUsage, parseJsonLines } from "./eval-usage.mjs";
import { apiPricingNote, calculateApiCostUsd, getModelPricing } from "./model-pricing.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const allowedEfforts = new Set(["minimal", "low", "medium", "high", "xhigh", "max", "ultra"]);

function parseArgs(argv) {
  if (argv.length === 3 && argv.every((value) => !value.startsWith("--"))) {
    return { id: argv[0], model: argv[1], effort: argv[2] };
  }
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--") || !argv[index + 1]) {
      throw new Error("Usage: npm run eval:run -- --id RUN_ID --model MODEL --effort EFFORT");
    }
    values[key.slice(2)] = argv[index + 1];
    index += 1;
  }
  return values;
}

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

const { id, model, effort } = parseArgs(process.argv.slice(2));
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id || "")) throw new Error("id must be lowercase kebab-case");
if (!/^gpt-[a-z0-9.-]+$/.test(model || "")) throw new Error("model must be an explicit GPT model slug");
if (!allowedEfforts.has(effort)) throw new Error("unsupported effort: " + effort);

const rawDir = path.join(root, "data", "raw", id);
if (await exists(rawDir)) throw new Error("Refusing to overwrite " + path.relative(root, rawDir));
await mkdir(rawDir, { recursive: true });

const promptPath = path.join(root, "benchmark", "prompt.txt");
const responsePath = path.join(rawDir, "response.txt");
const eventsPath = path.join(rawDir, "events.jsonl");
const stderrPath = path.join(rawDir, "stderr.txt");
const receiptPath = path.join(rawDir, "receipt.json");
const prompt = await readFile(promptPath);
const workDir = await mkdtemp(path.join(os.tmpdir(), "pelican-sdf-eval-"));
const codexCommand = process.env.CODEX_BIN || (process.platform === "win32" ? "codex.cmd" : "codex");
const versionRun = spawnSync(codexCommand, ["--version"], {
  encoding: "utf8",
  shell: process.platform === "win32",
  windowsHide: true,
});
const codexVersion = /(?:codex-cli\s+)?([^\s]+)\s*$/.exec(versionRun.stdout || "")?.[1] || null;
const args = [
  "exec",
  "--model", model,
  "--config", 'model_reasoning_effort="' + effort + '"',
  "--config", 'approval_policy="never"',
  "--sandbox", "read-only",
  "--ephemeral",
  "--ignore-user-config",
  "--ignore-rules",
  "--skip-git-repo-check",
  "--color", "never",
  "--json",
  "--output-last-message", responsePath,
  "--cd", workDir,
  "-",
];

const startedAt = new Date();
const child = spawn(codexCommand, args, {
  cwd: root,
  env: process.env,
  shell: process.platform === "win32",
  windowsHide: true,
  stdio: ["pipe", "pipe", "pipe"],
});

const stdoutChunks = [];
const stderrChunks = [];
child.stdout.on("data", (chunk) => stdoutChunks.push(chunk));
child.stderr.on("data", (chunk) => stderrChunks.push(chunk));
child.stdin.end(prompt);

let exitCode;
try {
  exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
} finally {
  await rm(workDir, { recursive: true, force: true }).catch(() => {});
}

const completedAt = new Date();
const stdout = Buffer.concat(stdoutChunks).toString("utf8");
const stderr = Buffer.concat(stderrChunks).toString("utf8");
await writeFile(eventsPath, stdout, "utf8");
await writeFile(stderrPath, stderr, "utf8");

const events = parseJsonLines(stdout);
const response = await readFile(responsePath).catch(() => Buffer.alloc(0));
const usage = extractCodexUsage(events);
const pricing = getModelPricing(model);
const apiCostUsd = calculateApiCostUsd(model, usage);
const receipt = {
  schemaVersion: 1,
  id,
  model,
  reasoningEffort: effort,
  harness: {
    name: "Codex CLI",
    version: codexVersion,
    surface: "codex exec --json",
    sandbox: "read-only",
    ephemeral: true,
    userConfigLoaded: false,
    projectRulesLoaded: false,
  },
  prompt: {
    path: "benchmark/prompt.txt",
    bytes: prompt.byteLength,
    sha256: sha256(prompt),
  },
  response: {
    path: "data/raw/" + id + "/response.txt",
    bytes: response.byteLength,
    sha256: sha256(response),
  },
  usage,
  billing: {
    mode: "subscription",
    apiCostUsd,
    note: apiPricingNote(model),
    pricing: pricing ? {
      inputUsdPerMillion: pricing.inputUsdPerMillion,
      cachedInputUsdPerMillion: pricing.cachedInputUsdPerMillion,
      outputUsdPerMillion: pricing.outputUsdPerMillion,
      source: pricing.source,
      publishedAt: pricing.publishedAt,
    } : null,
  },
  startedAt: startedAt.toISOString(),
  completedAt: completedAt.toISOString(),
  durationMs: completedAt.getTime() - startedAt.getTime(),
  exitCode,
  eventCount: events.length,
  files: {
    events: "data/raw/" + id + "/events.jsonl",
    stderr: "data/raw/" + id + "/stderr.txt",
  },
};
await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + "\n", "utf8");

if (exitCode !== 0) {
  throw new Error("Codex exited with " + exitCode + "; inspect " + path.relative(root, stderrPath));
}
if (!response.byteLength) {
  throw new Error("Codex produced no final response; inspect " + path.relative(root, eventsPath));
}

console.log(JSON.stringify({
  id,
  model,
  effort,
  responseBytes: response.byteLength,
  usage: receipt.usage,
  apiCostUsd: receipt.billing.apiCostUsd,
  durationMs: receipt.durationMs,
  receipt: path.relative(root, receiptPath),
}, null, 2));
