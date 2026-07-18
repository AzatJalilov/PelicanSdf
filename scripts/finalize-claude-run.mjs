import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const allowedEfforts = new Set(["minimal", "low", "medium", "high", "xhigh", "max", "ultra"]);

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--") || !argv[index + 1]) {
      throw new Error(
        "Usage: node scripts/finalize-claude-run.mjs --id RUN_ID --model MODEL_ID --display DISPLAY_NAME --effort EFFORT [--accent HEX] [--harness-version VERSION] [--started ISO] [--completed ISO]",
      );
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

const args = parseArgs(process.argv.slice(2));
const { id, model, display, effort } = args;
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id || "")) throw new Error("id must be lowercase kebab-case");
if (!model || !model.startsWith("claude-")) throw new Error("model must be a claude-* identifier");
if (!display) throw new Error("--display is required");
if (!allowedEfforts.has(effort)) throw new Error("unsupported effort: " + effort);
if (args.accent && !/^#[0-9a-f]{6}$/i.test(args.accent)) throw new Error("accent must be a #rrggbb hex color");

const rawDir = path.join(root, "data", "raw", id);
const responsePath = path.join(rawDir, "response.txt");
const receiptPath = path.join(rawDir, "receipt.json");
const eventsPath = path.join(rawDir, "events.jsonl");
const stderrPath = path.join(rawDir, "stderr.txt");

if (!(await exists(responsePath))) throw new Error("Missing " + path.relative(root, responsePath) + "; write the untouched subagent response there first");
if (await exists(receiptPath)) throw new Error("Refusing to overwrite " + path.relative(root, receiptPath));

const prompt = await readFile(path.join(root, "benchmark", "prompt.txt"));
const response = await readFile(responsePath);
if (!response.byteLength) throw new Error("response.txt is empty");

await mkdir(rawDir, { recursive: true });
if (!(await exists(eventsPath))) {
  const event = {
    type: "note",
    message:
      "Streaming events are not captured by the Claude Code subagent harness; response.txt is the subagent's untouched final message.",
  };
  await writeFile(eventsPath, JSON.stringify(event) + "\n", "utf8");
}
if (!(await exists(stderrPath))) {
  await writeFile(stderrPath, "", "utf8");
}

const receipt = {
  schemaVersion: 1,
  id,
  model,
  modelDisplayName: display,
  provider: "Anthropic via Claude Code",
  reasoningEffort: effort,
  accent: args.accent || null,
  harness: {
    name: "Claude Code subagent",
    version: args["harness-version"] || null,
    surface:
      "Workflow agent() with custom agent type pelican-bench (minimal system prompt, no tools, no skills); prompt passed byte-exact via args",
    sandbox: "n/a (text-only; no tool access)",
    ephemeral: true,
    userConfigLoaded: false,
    projectRulesLoaded: false,
    notes:
      "Fresh subagent context; skills (including iquilez-sdf) and tools excluded via the agent definition; decoding settings not exposed.",
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
    inputTokens: null,
    cachedInputTokens: null,
    reasoningTokens: null,
    outputTokens: null,
    totalTokens: null,
  },
  billing: {
    mode: "subscription",
    apiCostUsd: null,
    note: "Claude Code subagent harness does not expose per-run token usage or cost.",
  },
  startedAt: args.started || null,
  completedAt: args.completed || null,
  durationMs: null,
  exitCode: 0,
  error: null,
  eventCount: null,
  files: {
    events: "data/raw/" + id + "/events.jsonl",
    stderr: "data/raw/" + id + "/stderr.txt",
  },
};

await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + "\n", { encoding: "utf8", flag: "wx" });

console.log(
  JSON.stringify(
    {
      id,
      model,
      effort,
      responseBytes: response.byteLength,
      responseSha256: receipt.response.sha256,
      receipt: path.relative(root, receiptPath),
    },
    null,
    2,
  ),
);
