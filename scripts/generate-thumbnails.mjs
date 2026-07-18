import { spawn } from "node:child_process";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const requestedIds = process.argv.slice(2);
if (requestedIds.some((id) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))) {
  throw new Error("Usage: npm run thumbnails -- [run-id ...]");
}

const manifest = JSON.parse(await readFile(path.join(root, "data", "manifest.json"), "utf8"));
const published = new Map();
for (const entry of manifest) {
  const result = JSON.parse(await readFile(path.join(root, "data", entry), "utf8"));
  published.set(result.id, result);
}
const ids = requestedIds.length ? requestedIds : [...published.keys()];
for (const id of ids) {
  if (!published.has(id)) throw new Error(`${id} is not in data/manifest.json`);
}

const portOffset = process.pid % 1000;
const sitePort = Number(process.env.THUMBNAIL_PORT || 47000 + portOffset);
const debugPort = Number(process.env.THUMBNAIL_DEBUG_PORT || 49000 + portOffset);
const siteUrl = `http://127.0.0.1:${sitePort}/`;
const profileDir = path.resolve(os.tmpdir(), `pelican-sdf-thumbnails-${process.pid}`);
const outputRoot = path.join(root, "assets", "thumbnails");

const browserCandidates = process.platform === "win32"
  ? [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    ]
  : process.platform === "darwin"
    ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
    : ["google-chrome", "chromium", "chromium-browser"];

async function canAccess(filePath) {
  if (!path.isAbsolute(filePath)) return true;
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

let browserPath = process.env.CHROME_PATH || null;
if (!browserPath) {
  for (const candidate of browserCandidates) {
    if (await canAccess(candidate)) {
      browserPath = candidate;
      break;
    }
  }
}
if (!browserPath) throw new Error("Chrome or Edge was not found. Set CHROME_PATH.");

class CdpClient {
  constructor(url) {
    this.url = url;
    this.socket = null;
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket?.close();
  }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForHttp(url, timeout = 12_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Poll while the local server starts.
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForTarget(timeout = 12_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
      const page = targets.find((target) => target.type === "page");
      if (page?.webSocketDebuggerUrl) return page;
    } catch {
      // Poll while the browser starts.
    }
    await delay(100);
  }
  throw new Error("Timed out waiting for the browser debug target.");
}

async function evaluate(client, expression) {
  const response = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text || "Browser evaluation failed");
  return response.result.value;
}

async function waitFor(client, expression, timeout = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(client, `Boolean(${expression})`)) return;
    await delay(100);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function captureCanvas(client, outputPath) {
  const rect = await evaluate(client, "document.querySelector('#measurement-canvas').getBoundingClientRect().toJSON()");
  const capture = await client.send("Page.captureScreenshot", {
    format: "jpeg",
    quality: 84,
    fromSurface: true,
    clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scale: 0.5 },
  });
  await writeFile(outputPath, Buffer.from(capture.data, "base64"));
}

await mkdir(outputRoot, { recursive: true });
await mkdir(profileDir, { recursive: true });

const server = spawn(process.execPath, ["scripts/serve.mjs"], {
  cwd: root,
  env: { ...process.env, PORT: String(sitePort) },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
const browser = spawn(browserPath, [
  "--headless=new",
  "--enable-gpu",
  "--ignore-gpu-blocklist",
  `--remote-debugging-port=${debugPort}`,
  "--remote-allow-origins=*",
  `--user-data-dir=${profileDir}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-background-networking",
  "--disable-component-update",
  "--window-size=1200,800",
  siteUrl,
], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });

let client;
const report = [];
let unexpectedFailures = 0;
try {
  await waitForHttp(siteUrl);
  const target = await waitForTarget();
  client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();
  await client.send("Runtime.enable");
  await client.send("Page.enable");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1200,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });

  for (const id of ids) {
    await client.send("Page.navigate", {
      url: `${siteUrl}benchmark/measure.html?id=${encodeURIComponent(id)}`,
    });
    await waitFor(client, "document.readyState === 'complete' && ['ready','error'].includes(globalThis.__pelicanMeasurement?.status)");
    const state = await evaluate(client, "({ status: globalThis.__pelicanMeasurement.status, error: globalThis.__pelicanMeasurement.error, initialView: globalThis.__pelicanMeasurement.initialView })");
    const outputPath = path.join(outputRoot, `${id}.jpg`);
    if (state.status === "error") {
      await rm(outputPath, { force: true });
      const expected = published.get(id).validation.state === "failed";
      if (!expected) unexpectedFailures += 1;
      report.push({ id, status: expected ? "expected-render-failure" : "error", error: state.error });
      continue;
    }

    await evaluate(client, `globalThis.__pelicanMeasurement.setView(${state.initialView.yaw},${state.initialView.pitch},${state.initialView.distance})`);
    await delay(80);
    await captureCanvas(client, outputPath);
    report.push({ id, status: "generated", path: path.relative(root, outputPath) });
  }
} finally {
  client?.close();
  browser.kill();
  server.kill();
  await delay(200);
  const safeTempRoot = path.resolve(os.tmpdir()) + path.sep;
  if (path.resolve(profileDir).startsWith(safeTempRoot)
    && path.basename(profileDir).startsWith("pelican-sdf-thumbnails-")) {
    await rm(profileDir, { recursive: true, force: true }).catch(() => {});
  }
}

console.log(JSON.stringify(report, null, 2));
if (unexpectedFailures) process.exitCode = 1;
