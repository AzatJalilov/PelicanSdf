import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const CLAUDE_BIN = process.env.CLAUDE_BIN || (process.platform === "win32" ? "claude.exe" : "claude");
const allowedEfforts = new Set(["low", "medium", "high", "xhigh", "max"]);
const SYSTEM_PROMPT =
  "You are a helpful coding assistant. Follow the user's instructions exactly and return exactly what is requested.";

const KNOWN_MODELS = {
  "claude-fable-5": { display: "Claude Fable 5", accent: "#7b4fa6" },
  "claude-opus-4-8": { display: "Claude Opus 4.8", accent: "#b0762f" },
  "claude-sonnet-5": { display: "Claude Sonnet 5", accent: "#3f7f5f" },
  "claude-haiku-4-5-20251001": { display: "Claude Haiku 4.5", accent: "#4f8fb0" },
};

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--") || !argv[index + 1]) {
      throw new Error("Usage: node scripts/run-model-eval-claude.mjs --id RUN_ID --model CLAUDE_MODEL --effort EFFORT");
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

function runClaude(cliArgs, stdinBuffer) {
  return new Promise((resolve, reject) => {
    const child = spawn(CLAUDE_BIN, cliArgs, { stdio: ["pipe", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        code,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
    if (stdinBuffer) child.stdin.write(stdinBuffer);
    child.stdin.end();
  });
}

const { id, model, effort } = parseArgs(process.argv.slice(2));
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id || "")) throw new Error("id must be lowercase kebab-case");
if (!model || !/^claude-[a-z0-9.-]+$/.test(model)) throw new Error("model must be a claude-* identifier");
if (!allowedEfforts.has(effort)) throw new Error("unsupported effort: " + effort);
const known = KNOWN_MODELS[model] || { display: model, accent: "#0b6e75" };

const rawDir = path.join(root, "data", "raw", id);
if (await exists(rawDir)) throw new Error("Refusing to overwrite " + path.relative(root, rawDir));
await mkdir(rawDir, { recursive: true });

const promptPath = path.join(root, "benchmark", "prompt.txt");
const responsePath = path.join(rawDir, "response.txt");
const eventsPath = path.join(rawDir, "events.jsonl");
const stderrPath = path.join(rawDir, "stderr.txt");
const receiptPath = path.join(rawDir, "receipt.json");
const prompt = await readFile(promptPath);

const versionRun = await runClaude(["--version"], null);
const harnessVersion = versionRun.stdout.trim() || null;

const cliArgs = [
  "-p",
  "--model",
  model,
  "--effort",
  effort,
  "--tools",
  "",
  "--setting-sources",
  "",
  "--strict-mcp-config",
  "--system-prompt",
  SYSTEM_PROMPT,
  "--output-format",
  "json",
];

const startedAt = new Date();
const run = await runClaude(cliArgs, prompt);
const completedAt = new Date();

let output = null;
let errorMessage = null;
try {
  output = JSON.parse(run.stdout);
} catch {
  errorMessage = "Failed to parse claude --output-format json stdout";
}
if (output && output.is_error) {
  errorMessage = "claude reported is_error: " + String(output.result).slice(0, 500);
}
if (run.code !== 0 && !errorMessage) {
  errorMessage = "claude exited with code " + run.code;
}

const responseText = output && typeof output.result === "string" && !output.is_error ? output.result : "";
const response = Buffer.from(responseText, "utf8");

await writeFile(eventsPath, run.stdout.trim() ? run.stdout.trim() + "\n" : "", "utf8");
await writeFile(stderrPath, run.stderr || (errorMessage ? errorMessage + "\n" : ""), "utf8");
await writeFile(responsePath, response, "utf8");

const usageRaw = output?.usage || {};
const inputTokens = usageRaw.input_tokens ?? null;
const cachedInputTokens = usageRaw.cache_read_input_tokens ?? null;
const cacheCreationTokens = usageRaw.cache_creation_input_tokens ?? 0;
const outputTokens = usageRaw.output_tokens ?? null;
const totalTokens =
  inputTokens === null || outputTokens === null
    ? null
    : inputTokens + (cachedInputTokens ?? 0) + cacheCreationTokens + outputTokens;

const receipt = {
  schemaVersion: 1,
  id,
  model,
  modelDisplayName: known.display,
  provider: "Anthropic via Claude Code CLI",
  reasoningEffort: effort,
  accent: known.accent,
  harness: {
    name: "Claude Code CLI",
    version: harnessVersion,
    surface:
      'claude -p --tools "" --setting-sources "" --strict-mcp-config --system-prompt <minimal> --output-format json (prompt piped byte-exact via stdin)' +
      (process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS
        ? "; CLAUDE_CODE_MAX_OUTPUT_TOKENS=" + process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS
        : ""),
    sandbox: "n/a (no tools available)",
    ephemeral: true,
    userConfigLoaded: false,
    projectRulesLoaded: false,
    notes:
      "Fresh non-interactive invocation with a minimal replacement system prompt; no tools, skills, hooks, MCP servers, CLAUDE.md, or memory in context (verified 253-token bare context probe).",
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
  usage: {
    inputTokens,
    cachedInputTokens,
    reasoningTokens: null,
    outputTokens,
    totalTokens,
  },
  billing: {
    mode: "subscription",
    apiCostUsd: output?.total_cost_usd ?? null,
    note: "Claude subscription invocation; total_cost_usd is the CLI's pricing estimate, not a separate API charge.",
  },
  startedAt: startedAt.toISOString(),
  completedAt: completedAt.toISOString(),
  durationMs: completedAt.getTime() - startedAt.getTime(),
  exitCode: run.code,
  error: errorMessage,
  sessionId: output?.session_id ?? null,
  files: {
    events: "data/raw/" + id + "/events.jsonl",
    stderr: "data/raw/" + id + "/stderr.txt",
  },
};
await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + "\n", "utf8");

if (errorMessage) {
  throw new Error(errorMessage + "; inspect " + path.relative(root, rawDir));
}
if (!response.byteLength) {
  throw new Error("claude produced an empty response; inspect " + path.relative(root, eventsPath));
}

console.log(
  JSON.stringify(
    {
      id,
      model,
      effort,
      responseBytes: response.byteLength,
      usage: receipt.usage,
      costUsd: receipt.billing.apiCostUsd,
      durationMs: receipt.durationMs,
      receipt: path.relative(root, receiptPath),
    },
    null,
    2,
  ),
);
