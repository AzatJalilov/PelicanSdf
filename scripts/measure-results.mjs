import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const ids = process.argv.slice(2);
if (!ids.length || ids.some((id) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))) {
  throw new Error("Usage: npm run eval:measure -- run-id [run-id ...]");
}

const portOffset = process.pid % 1000;
const sitePort = Number(process.env.MEASURE_PORT || 43000 + portOffset);
const debugPort = Number(process.env.MEASURE_DEBUG_PORT || 45000 + portOffset);
const siteUrl = "http://127.0.0.1:" + sitePort + "/";
const profileDir = path.join(os.tmpdir(), "pelican-sdf-measure-" + process.pid);
const outputRoot = path.join(root, "artifacts", "evals");

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
  try {
    const fs = await import("node:fs/promises");
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

let browserPath = process.env.CHROME_PATH || null;
if (!browserPath) {
  for (const candidate of browserCandidates) {
    if (!path.isAbsolute(candidate) || await canAccess(candidate)) {
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
    this.listeners = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const request = this.pending.get(message.id);
        if (!request) return;
        this.pending.delete(message.id);
        if (message.error) request.reject(new Error(message.error.message));
        else request.resolve(message.result);
        return;
      }
      for (const listener of this.listeners.get(message.method) || []) listener(message.params);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, listener) {
    const list = this.listeners.get(method) || [];
    list.push(listener);
    this.listeners.set(method, list);
  }

  close() {
    this.socket?.close();
  }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForHttp(url, timeout = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Poll while the local server starts.
    }
    await delay(100);
  }
  throw new Error("Timed out waiting for " + url);
}

async function waitForTarget(timeout = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const targets = await (await fetch("http://127.0.0.1:" + debugPort + "/json/list")).json();
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

async function waitFor(client, expression, timeout = 180000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(client, "Boolean(" + expression + ")")) return;
    await delay(100);
  }
  throw new Error("Timed out waiting for: " + expression);
}

async function captureCanvas(client, outputPath) {
  const rect = await evaluate(client, "document.querySelector('#measurement-canvas').getBoundingClientRect().toJSON()");
  const capture = await client.send("Page.captureScreenshot", {
    format: "jpeg",
    quality: 90,
    fromSurface: true,
    clip: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      scale: 1,
    },
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
  "--remote-debugging-port=" + debugPort,
  "--remote-allow-origins=*",
  "--user-data-dir=" + profileDir,
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-background-networking",
  "--disable-component-update",
  "--window-size=1200,800",
  siteUrl,
], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });

let client;
try {
  await waitForHttp(siteUrl);
  const target = await waitForTarget();
  client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();
  const browserErrors = [];
  client.on("Runtime.exceptionThrown", ({ exceptionDetails }) => browserErrors.push(exceptionDetails.text || "Uncaught exception"));
  client.on("Log.entryAdded", ({ entry }) => {
    if (entry.level === "error") browserErrors.push(entry.text);
  });
  await client.send("Runtime.enable");
  await client.send("Page.enable");
  await client.send("Log.enable");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1200,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });

  const report = [];
  for (const id of ids) {
    const errorStart = browserErrors.length;
    const outputDir = path.join(outputRoot, id);
    await mkdir(outputDir, { recursive: true });
    const url = siteUrl + "benchmark/measure.html?id=" + encodeURIComponent(id) + "&trials=3&autostart=1";
    await client.send("Page.navigate", { url });
    await waitFor(client,
      "document.readyState === 'complete' && ['complete','error'].includes(globalThis.__pelicanMeasurement?.status)",
      240000,
    );
    const record = await evaluate(client, "(() => { const state = globalThis.__pelicanMeasurement; return { status: state.status, id: state.id, error: state.error, initialView: state.initialView, trials: state.trials, result: state.result }; })()");
    if (record.status !== "complete") throw new Error(id + ": " + record.error);

    const distance = Math.max(2.2, Math.min(10, record.initialView.distance));
    const views = [
      ...Array.from({ length: 8 }, (_, index) => ({
        name: "level-" + String(index).padStart(2, "0"),
        yaw: (index / 8) * Math.PI * 2,
        pitch: 0.08,
        distance,
      })),
      ...Array.from({ length: 4 }, (_, index) => ({
        name: "raised-" + String(index).padStart(2, "0"),
        yaw: (index / 4) * Math.PI * 2 + Math.PI / 4,
        pitch: 0.42,
        distance,
      })),
      ...[0.7, 0.48, 0.32].map((scale, index) => ({
        name: "close-" + String(index).padStart(2, "0"),
        yaw: record.initialView.yaw,
        pitch: record.initialView.pitch,
        distance: Math.max(0.7, distance * scale),
      })),
    ];

    const screenshots = [];
    for (const view of views) {
      await evaluate(client, "globalThis.__pelicanMeasurement.setView("
        + view.yaw + "," + view.pitch + "," + view.distance + ")");
      await delay(60);
      const outputPath = path.join(outputDir, view.name + ".jpg");
      await captureCanvas(client, outputPath);
      screenshots.push(path.relative(root, outputPath));
    }
    await evaluate(client, "globalThis.__pelicanMeasurement.setView("
      + record.initialView.yaw + "," + record.initialView.pitch + "," + record.initialView.distance + ")");
    const initialPath = path.join(outputDir, "initial.jpg");
    await captureCanvas(client, initialPath);
    screenshots.unshift(path.relative(root, initialPath));

    const measurement = {
      id,
      initialView: record.initialView,
      result: record.result,
      trials: record.trials,
      browserErrors: browserErrors.slice(errorStart),
      screenshots,
    };
    const measurementPath = path.join(outputDir, "measurement.json");
    await writeFile(measurementPath, JSON.stringify(measurement, null, 2) + "\n", "utf8");
    report.push({
      id,
      throughputFps: record.result.throughputFps,
      gpuMsMedian: record.result.gpuMsMedian,
      gpuMsP95: record.result.gpuMsP95,
      timingMethod: record.result.timingMethod,
      browserErrors: measurement.browserErrors,
      measurement: path.relative(root, measurementPath),
    });
  }
  console.log(JSON.stringify(report, null, 2));
  if (report.some((item) => item.browserErrors.length)) process.exitCode = 1;
} finally {
  client?.close();
  browser.kill();
  server.kill();
  await delay(200);
  const safeTempRoot = path.resolve(os.tmpdir()) + path.sep;
  if (path.resolve(profileDir).startsWith(safeTempRoot)
    && path.basename(profileDir).startsWith("pelican-sdf-measure-")) {
    await rm(profileDir, { recursive: true, force: true }).catch(() => {});
  }
}
