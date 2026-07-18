import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const allowedEfforts = new Set(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);

async function resolvePiDist() {
  const relative = path.join("pi-node", "current", "node_modules", "@earendil-works", "pi-coding-agent", "dist", "index.js");
  const candidates = [
    process.env.PI_CODING_AGENT_DIST,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, relative) : null,
    process.env.HOME ? path.join(process.env.HOME, ".local", "share", relative) : null,
  ].filter(Boolean).map((candidate) => path.resolve(candidate));
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next supported install location.
    }
  }
  throw new Error("pi-coding-agent was not found; set PI_CODING_AGENT_DIST to its dist/index.js path");
}

const PI_DIST = await resolvePiDist();

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

const { id, model, effort, "max-tokens": maxTokensArg } = parseArgs(process.argv.slice(2));
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id || "")) throw new Error("id must be lowercase kebab-case");
if (!model || !model.includes("/")) throw new Error("model must be an OpenRouter slug like z-ai/glm-5.2");
if (!allowedEfforts.has(effort)) throw new Error("unsupported effort: " + effort);
const maxOutputTokens = Number(maxTokensArg || 32768);
if (!Number.isInteger(maxOutputTokens) || maxOutputTokens <= 0) throw new Error("maxTokens must be a positive integer");

const rawDir = path.join(root, "data", "raw", id);
if (await exists(rawDir)) throw new Error("Refusing to overwrite " + path.relative(root, rawDir));
await mkdir(rawDir, { recursive: true });

const promptPath = path.join(root, "benchmark", "prompt.txt");
const responsePath = path.join(rawDir, "response.txt");
const eventsPath = path.join(rawDir, "events.jsonl");
const stderrPath = path.join(rawDir, "stderr.txt");
const receiptPath = path.join(rawDir, "receipt.json");
const thinkingPath = path.join(rawDir, "thinking.txt");
const prompt = await readFile(promptPath);

const pi = await import(pathToFileURL(PI_DIST).href);
const { ModelRuntime, createAgentSession, SessionManager, SettingsManager, createExtensionRuntime } = pi;

const piPkg = JSON.parse(await readFile(path.join(path.dirname(PI_DIST), "..", "package.json"), "utf8"));
const modelRuntime = await ModelRuntime.create();
const resolved = modelRuntime.getModel("openrouter", model);
if (!resolved) throw new Error("Model not found in pi runtime: " + model);
// The local models-store may cap output at 4096 for some models; raise it so a full
// SDF module (plus reasoning for thinking models) is not truncated mid-stream.
const runModel = { ...resolved, maxTokens: maxOutputTokens };
if ((resolved.maxTokens ?? 0) < maxOutputTokens) {
  process.stderr.write("[" + id + "] raising maxTokens " + resolved.maxTokens + " -> " + runModel.maxTokens + "\n");
}
// pi's default streamFn does not forward model.maxTokens into the request params, so
// OpenRouter applies its own default (e.g. 32768 for Kimi K3) and truncates long
// reasoning + code outputs. Wrap streamSimple to inject maxTokens on every call.
const originalStreamSimple = modelRuntime.streamSimple.bind(modelRuntime);
modelRuntime.streamSimple = (modelArg, context, options) => {
  return originalStreamSimple(modelArg, context, { ...options, maxTokens: runModel.maxTokens });
};

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
let responseText = "";
let thinkingText = "";
let eventCount = 0;
const eventsStream = createWriteStream(eventsPath);

const { session } = await createAgentSession({
  cwd: root,
  model: runModel,
  thinkingLevel: effort,
  modelRuntime,
  resourceLoader,
  noTools: "all",
  sessionManager: SessionManager.inMemory(root),
  settingsManager,
});

// Per-token message_update events embed the full cumulative message, so only log
// lifecycle events (plus any event carrying usage) to keep events.jsonl tiny.
const LIFECYCLE = new Set(["agent_start", "agent_end", "turn_start", "turn_end", "message_start", "message_end"]);
let lastUsage = null;
let lastProgress = Date.now();
session.subscribe((event) => {
  eventCount += 1;
  if (event.type === "message_update" && event.assistantMessageEvent?.type === "text_delta") {
    responseText += event.assistantMessageEvent.delta;
  } else if (event.type === "message_update" && event.assistantMessageEvent?.type === "thinking_delta") {
    thinkingText += event.assistantMessageEvent.delta;
  } else if (LIFECYCLE.has(event.type) || event.usage) {
    if (event.usage) lastUsage = event.usage;
    try { eventsStream.write(JSON.stringify(stripHeavy(event)) + "\n"); } catch {}
  }
  if (eventCount % 2000 === 0 && Date.now() - lastProgress > 20000) {
    process.stderr.write("[" + id + "] updates=" + eventCount + " respBytes=" + Buffer.byteLength(responseText) + "\n");
    lastProgress = Date.now();
  }
});

function stripHeavy(event) {
  // Drop large cumulative payloads before serializing provenance events.
  const { message, messages, ...rest } = event;
  return rest;
}

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
const thinking = Buffer.from(thinkingText, "utf8");
let responseSource = "text";
if (!response.byteLength && thinking.byteLength) {
  // Some OpenRouter reasoning models (e.g. Kimi K3) stream the entire answer as
  // thinking content; preserve it as the artifact when no visible text arrived.
  responseSource = "thinking";
}
const artifactBytes = responseSource === "text" ? response : thinking;

await new Promise((resolve) => eventsStream.end(resolve));
await writeFile(stderrPath, errorMessage ? errorMessage + "\n" : "", "utf8");
await writeFile(thinkingPath, thinkingText, "utf8");
await writeFile(responsePath, response, "utf8");

const usage = {
  inputTokens: stats?.tokens?.input ?? lastUsage?.input ?? null,
  cachedInputTokens: stats?.tokens?.cacheRead ?? lastUsage?.cacheRead ?? null,
  reasoningTokens: null,
  outputTokens: stats?.tokens?.output ?? lastUsage?.output ?? null,
  totalTokens: stats?.tokens?.total ?? lastUsage?.total ?? null,
};
const costUsd = stats?.cost ?? lastUsage?.cost?.total ?? null;

const providerPrefix = model.split("/")[0];
const accentByProvider = {
  "z-ai": "#2e7d4f",
  moonshotai: "#5b3fa8",
  deepseek: "#1f6feb",
};
const accent = accentByProvider[providerPrefix] || "#0b6e75";

const receipt = {
  schemaVersion: 1,
  id,
  model,
  provider: "OpenRouter via pi SDK",
  accent,
  modelDisplayName: runModel.name,
  reasoningEffort: effort,
  maxOutputTokens: runModel.maxTokens,
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
    bytes: artifactBytes.byteLength,
    sha256: sha256(artifactBytes),
    source: responseSource,
  },
  thinking: {
    path: "data/raw/" + id + "/thinking.txt",
    bytes: thinking.byteLength,
    sha256: sha256(thinking),
  },
  usage,
  billing: {
    mode: "openrouter",
    apiCostUsd: costUsd,
    note: "OpenRouter invocation via pi SDK; cost computed by pi from provider pricing (per-million-token rates).",
  },
  startedAt: startedAt.toISOString(),
  completedAt: completedAt.toISOString(),
  durationMs: completedAt.getTime() - startedAt.getTime(),
  exitCode,
  error: errorMessage,
  eventCount: eventCount,
  files: {
    events: "data/raw/" + id + "/events.jsonl",
    stderr: "data/raw/" + id + "/stderr.txt",
    thinking: "data/raw/" + id + "/thinking.txt",
  },
};
await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + "\n", "utf8");

if (exitCode !== 0) {
  throw new Error("pi run failed; inspect " + path.relative(root, stderrPath));
}
if (!artifactBytes.byteLength) {
  throw new Error("pi produced no response or thinking text; inspect " + path.relative(root, eventsPath));
}

console.log(JSON.stringify({
  id,
  model,
  modelDisplayName: runModel.name,
  responseBytes: artifactBytes.byteLength,
  responseSource,
  thinkingBytes: thinking.byteLength,
  usage,
  costUsd: receipt.billing.apiCostUsd,
  durationMs: receipt.durationMs,
  receipt: path.relative(root, receiptPath),
}, null, 2));
