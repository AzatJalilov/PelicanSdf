import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const PI_DIST = "C:/Users/azatj/AppData/Local/pi-node/current/node_modules/@earendil-works/pi-coding-agent/dist/index.js";
const allowedEfforts = new Set(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--") || !argv[index + 1]) {
      throw new Error("Usage: node scripts/run-model-eval-pi.mjs --id RUN_ID --model OPENROUTER_MODEL --effort EFFORT");
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
if (!model || !model.includes("/")) throw new Error("model must be an OpenRouter slug like z-ai/glm-5.2");
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

const pi = await import(pathToFileURL(PI_DIST).href);
const { ModelRuntime, createAgentSession, SessionManager, SettingsManager, createExtensionRuntime } = pi;

const piPkg = JSON.parse(await readFile(path.join(path.dirname(PI_DIST), "..", "package.json"), "utf8"));
const modelRuntime = await ModelRuntime.create();
const resolved = modelRuntime.getModel("openrouter", model);
if (!resolved) throw new Error("Model not found in pi runtime: " + model);

const resourceLoader = {
  getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
  getSkills: () => ({ skills: [], diagnostics: [] }),
  getPrompts: () => ({ prompts: [], diagnostics: [] }),
  getThemes: () => ({ themes: [], diagnostics: [] }),
  getAgentsFiles: () => ({ agentsFiles: [] }),
  getSystemPrompt: () =>
    "You are a helpful coding assistant. Follow the user's instructions exactly and return exactly what is requested.",
  getAppendSystemPrompt: () => [],
  extendResources: () => {},
  reload: async () => {},
};

const settingsManager = SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: true, maxRetries: 2 } });

const startedAt = new Date();
const events = [];
let responseText = "";

const { session } = await createAgentSession({
  cwd: root,
  model: resolved,
  thinkingLevel: effort,
  modelRuntime,
  resourceLoader,
  noTools: "all",
  sessionManager: SessionManager.inMemory(root),
  settingsManager,
});

session.subscribe((event) => {
  events.push(event);
  if (event.type === "message_update" && event.assistantMessageEvent?.type === "text_delta") {
    responseText += event.assistantMessageEvent.delta;
  }
});

let exitCode = 0;
let errorMessage = null;
try {
  await session.prompt(prompt.toString("utf8"));
} catch (error) {
  exitCode = 1;
  errorMessage = error?.stack || String(error);
} finally {
  session.dispose?.();
}
const completedAt = new Date();

const stats = session.getSessionStats ? session.getSessionStats() : null;
const response = Buffer.from(responseText, "utf8");

await writeFile(eventsPath, events.map((event) => JSON.stringify(event)).join("\n") + "\n", "utf8");
await writeFile(stderrPath, errorMessage ? errorMessage + "\n" : "", "utf8");
await writeFile(responsePath, response, "utf8");

const usage = {
  inputTokens: stats?.tokens?.input ?? null,
  cachedInputTokens: stats?.tokens?.cacheRead ?? null,
  reasoningTokens: null,
  outputTokens: stats?.tokens?.output ?? null,
  totalTokens: stats?.tokens?.total ?? null,
};

const receipt = {
  schemaVersion: 1,
  id,
  model,
  modelDisplayName: resolved.name,
  reasoningEffort: effort,
  harness: {
    name: "pi SDK",
    version: piPkg.version,
    surface: "pi-coding-agent createAgentSession (in-memory, no tools)",
    sandbox: "n/a",
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
    mode: "openrouter",
    apiCostUsd: stats?.cost ?? null,
    note: "OpenRouter invocation via pi SDK; cost computed by pi from provider pricing (per-million-token rates).",
  },
  startedAt: startedAt.toISOString(),
  completedAt: completedAt.toISOString(),
  durationMs: completedAt.getTime() - startedAt.getTime(),
  exitCode,
  error: errorMessage,
  eventCount: events.length,
  files: {
    events: "data/raw/" + id + "/events.jsonl",
    stderr: "data/raw/" + id + "/stderr.txt",
  },
};
await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + "\n", "utf8");

if (exitCode !== 0) {
  throw new Error("pi run failed; inspect " + path.relative(root, stderrPath));
}
if (!response.byteLength) {
  throw new Error("pi produced no response text; inspect " + path.relative(root, eventsPath));
}

console.log(JSON.stringify({
  id,
  model,
  modelDisplayName: resolved.name,
  effort,
  responseBytes: response.byteLength,
  usage,
  costUsd: receipt.billing.apiCostUsd,
  durationMs: receipt.durationMs,
  receipt: path.relative(root, receiptPath),
}, null, 2));
