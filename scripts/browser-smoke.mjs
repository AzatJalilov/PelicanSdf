import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const artifactsDir = path.join(root, "artifacts", "qa");
const sitePort = Number(process.env.QA_PORT || 4174);
const debugPort = Number(process.env.QA_DEBUG_PORT || 9334);
const siteUrl = `http://127.0.0.1:${sitePort}/`;
const profileDir = path.resolve(os.tmpdir(), `pelican-sdf-chrome-${process.pid}`);
const publishedEntries = JSON.parse(await readFile(path.join(root, "data", "manifest.json"), "utf8"));
const publishedResults = await Promise.all(publishedEntries.map(async (entry) =>
  JSON.parse(await readFile(path.join(root, "data", entry), "utf8"))));
const publishedResultCount = publishedResults.length;
const publishedThumbnailCount = publishedResults.filter((result) => result.validation.state !== "failed").length;
const publishedFailureCount = publishedResultCount - publishedThumbnailCount;

const browserCandidates = process.platform === "win32"
  ? [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    ]
  : process.platform === "darwin"
    ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
    : ["google-chrome", "chromium", "chromium-browser"];

async function commandExists(candidate) {
  if (path.isAbsolute(candidate)) {
    try {
      const response = await import("node:fs/promises");
      await response.access(candidate);
      return true;
    } catch {
      return false;
    }
  }
  return true;
}

let browserPath = process.env.CHROME_PATH || null;
if (!browserPath) {
  for (const candidate of browserCandidates) {
    if (await commandExists(candidate)) {
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
      // Keep polling while the process starts.
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForTarget(timeout = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
      const page = targets.find((target) => target.type === "page");
      if (page?.webSocketDebuggerUrl) return page;
    } catch {
      // Keep polling while DevTools starts.
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

async function waitFor(client, expression, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(client, `Boolean(${expression})`)) return;
    await delay(100);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function centerOf(client, selector) {
  await evaluate(client, `document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'center', behavior:'instant'})`);
  await delay(80);
  const rect = await evaluate(client, `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return null;
    const box = element.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2, width: box.width, height: box.height };
  })()`);
  if (!rect) throw new Error(`Element not found: ${selector}`);
  return rect;
}

async function click(client, selector) {
  const point = await centerOf(client, selector);
  if (process.env.QA_DEBUG_HITS === "1") {
    const hit = await evaluate(client, `(() => {
      const element = document.elementFromPoint(${point.x}, ${point.y});
      return { tag: element?.tagName, className: element?.className, text: element?.textContent };
    })()`);
    console.error("click hit", selector, point, hit);
  }
  await client.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
  await client.send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", buttons: 1, clickCount: 1 });
  await client.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", buttons: 0, clickCount: 1 });
}

async function drag(client, selector, dx, dy) {
  const point = await centerOf(client, selector);
  await client.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
  await client.send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  for (let step = 1; step <= 6; step += 1) {
    await client.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x + dx * step / 6, y: point.y + dy * step / 6, button: "left", buttons: 1 });
  }
  await client.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x + dx, y: point.y + dy, button: "left", clickCount: 1 });
}

async function wheel(client, selector, deltaY) {
  const point = await centerOf(client, selector);
  await client.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: point.x, y: point.y, deltaX: 0, deltaY });
}

async function pinch(client, selector, startHalfSpan = 35, endHalfSpan = 110) {
  const point = await centerOf(client, selector);
  await client.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  try {
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [
      { x: point.x - startHalfSpan, y: point.y, radiusX: 4, radiusY: 4, force: 1, id: 0 },
      { x: point.x + startHalfSpan, y: point.y, radiusX: 4, radiusY: 4, force: 1, id: 1 },
    ] });
    await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [
      { x: point.x - endHalfSpan, y: point.y, radiusX: 4, radiusY: 4, force: 1, id: 0 },
      { x: point.x + endHalfSpan, y: point.y, radiusX: 4, radiusY: 4, force: 1, id: 1 },
    ] });
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } finally {
    await client.send("Emulation.setTouchEmulationEnabled", { enabled: false, maxTouchPoints: 1 });
  }
}

async function pressKey(client, key, code = key, modifiers = 0) {
  await client.send("Input.dispatchKeyEvent", { type: "keyDown", key, code, modifiers });
  await client.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, modifiers });
}

async function screenshot(client, filename) {
  const capture = await client.send("Page.captureScreenshot", { format: "jpeg", quality: 88, fromSurface: true, captureBeyondViewport: false });
  const filePath = path.join(artifactsDir, filename);
  await writeFile(filePath, Buffer.from(capture.data, "base64"));
  return filePath;
}

await mkdir(artifactsDir, { recursive: true });
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
  "--window-size=1600,1000",
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
  await client.send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  await client.send("Page.reload", { ignoreCache: true });
  await waitFor(client, `document.readyState === 'complete' && document.querySelector('#landing-title')`, 30000);

  const landing = await evaluate(client, `(() => {
    const resources = performance.getEntriesByType('resource').map((entry) => entry.name);
    return {
      title: document.title,
      canvases: document.querySelectorAll('canvas').length,
      runCards: document.querySelectorAll('.result-card').length,
      scripts: document.querySelectorAll('script').length,
      resourceCount: resources.length,
      heavyResources: resources.filter((url) => /\\/data\\/(?:manifest\\.json|results\\/|artifacts\\/)|\\/src\\/(?:app|data|viewer)\\.js/.test(url)),
      resultsHref: document.querySelector('.landing-copy a[href="./results.html"]')?.href,
      licenseHref: document.querySelector('.license-note a')?.href,
      viewport: { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth },
      heroBounds: document.querySelector('.landing-hero').getBoundingClientRect().toJSON(),
      contractBounds: document.querySelector('.contract-card').getBoundingClientRect().toJSON(),
    };
  })()`);
  if (landing.canvases || landing.runCards || landing.scripts || landing.heavyResources.length) {
    throw new Error(`Landing page loaded run machinery: ${JSON.stringify(landing)}`);
  }
  if (!landing.resultsHref?.endsWith('/results.html')
    || landing.licenseHref !== 'https://github.com/AzatJalilov/PelicanSdf/blob/main/LICENSE'
    || landing.viewport.scrollWidth > landing.viewport.width) {
    throw new Error(`Landing page navigation or layout failed: ${JSON.stringify(landing)}`);
  }
  const landingScreenshot = await screenshot(client, "desktop-landing.jpg");
  await evaluate(client, `document.querySelector('#method').scrollIntoView({block:'start', behavior:'instant'})`);
  const landingMethodScreenshot = await screenshot(client, "desktop-landing-method.jpg");
  await evaluate(client, `document.querySelector('.landing-results-cta').scrollIntoView({block:'start', behavior:'instant'})`);
  const landingCtaScreenshot = await screenshot(client, "desktop-landing-results-cta.jpg");
  await evaluate(client, `document.querySelector('#top').scrollIntoView({block:'start', behavior:'instant'})`);
  await click(client, '.landing-copy a[href="./results.html"]');
  await waitFor(client, `document.readyState === 'complete' && document.querySelector('#hero-loading')?.hidden`, 30000);

  const initial = await evaluate(client, `(() => {
    const gl = document.querySelector('#hero-canvas').getContext('webgl2');
    const debug = gl?.getExtension('WEBGL_debug_renderer_info');
    return {
      title: document.title,
      cards: document.querySelectorAll('.result-card').length,
      heroError: !document.querySelector('#hero-error').hidden,
      webgl2: Boolean(gl),
      renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'masked',
      viewport: { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth },
      heroBounds: document.querySelector('.hero').getBoundingClientRect().toJSON(),
      canvasDataLength: document.querySelector('#hero-canvas').toDataURL().length,
      view: document.querySelector('#hero-view').textContent,
      search: location.search,
      thumbnails: document.querySelectorAll('.poster-thumbnail').length,
      failedPlaceholders: document.querySelectorAll('.result-card .poster-placeholder').length,
      knownFailedPlaceholder: document.querySelectorAll('[data-result-id="claude-sonnet-5-max-run-01"] .poster-placeholder').length,
      licenseHref: document.querySelector('.license-note a')?.href,
    };
  })()`);
  if (!initial.webgl2
    || initial.heroError
    || initial.cards !== publishedResultCount
    || initial.search !== ''
    || initial.thumbnails !== publishedThumbnailCount
    || initial.failedPlaceholders !== publishedFailureCount
    || initial.knownFailedPlaceholder !== 1
    || initial.licenseHref !== 'https://github.com/AzatJalilov/PelicanSdf/blob/main/LICENSE') {
    throw new Error(`Initial state failed: ${JSON.stringify(initial)}`);
  }
  if (initial.viewport.scrollWidth > initial.viewport.width) throw new Error("Desktop page has horizontal overflow.");
  const catalogScreenshot = await screenshot(client, "desktop-catalog.jpg");

  await click(client, "#hero-pause");
  await waitFor(client, `document.querySelector('#hero-pause').getAttribute('aria-pressed') === 'true'`);
  await click(client, "#hero-pause");
  await waitFor(client, `document.querySelector('#hero-pause').getAttribute('aria-pressed') === 'false'`);

  const beforeDrag = await evaluate(client, `document.querySelector('#hero-view').textContent`);
  await drag(client, "#hero-canvas", 140, -45);
  await delay(350);
  const afterDrag = await evaluate(client, `document.querySelector('#hero-view').textContent`);
  await wheel(client, "#hero-canvas", -280);
  await delay(350);
  const afterZoom = await evaluate(client, `document.querySelector('#hero-view').textContent`);
  if (beforeDrag === afterDrag || afterDrag === afterZoom) throw new Error("Orbit or zoom did not update the visible camera readout.");
  await click(client, "#hero-canvas");
  await pressKey(client, "ArrowLeft", "ArrowLeft");
  await delay(200);
  const afterKeyboardOrbit = await evaluate(client, `document.querySelector('#hero-view').textContent`);
  await pressKey(client, "+", "Equal");
  await delay(200);
  const afterKeyboardZoom = await evaluate(client, `document.querySelector('#hero-view').textContent`);
  if (afterKeyboardOrbit === afterZoom || afterKeyboardZoom === afterKeyboardOrbit) throw new Error("Keyboard orbit or zoom did not update the camera readout.");
  await click(client, "#hero-reset");
  await delay(250);
  const afterReset = await evaluate(client, `document.querySelector('#hero-view').textContent`);
  if (afterReset !== beforeDrag) throw new Error(`Reset did not restore the default view (${afterReset}).`);
  await pinch(client, "#hero-canvas");
  await delay(300);
  const afterPinch = await evaluate(client, `document.querySelector('#hero-view').textContent`);
  if (afterPinch === afterReset) throw new Error("Two-finger pinch did not update the camera readout.");
  const closeupScreenshot = await screenshot(client, "desktop-closeup.jpg");
  await click(client, "#hero-reset");
  await delay(200);

  await evaluate(client, `document.querySelector('#results').scrollIntoView({block:'start', behavior:'instant'})`);
  await waitFor(client, `document.querySelectorAll('.result-card').length === ${publishedResultCount}`, 30000);
  await waitFor(client, `document.querySelector('.poster-thumbnail')?.naturalWidth === 480`, 30000);
  await click(client, "#result-search");
  await client.send("Input.insertText", { text: "Grand Tourer" });
  await waitFor(client, `document.querySelectorAll('.result-card').length === 1`);
  await client.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Control", code: "ControlLeft", modifiers: 2, windowsVirtualKeyCode: 17, nativeVirtualKeyCode: 17 });
  await client.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "a", code: "KeyA", modifiers: 2, windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65 });
  await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", modifiers: 2, windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65 });
  await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Control", code: "ControlLeft", modifiers: 0, windowsVirtualKeyCode: 17, nativeVirtualKeyCode: 17 });
  await client.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8, nativeVirtualKeyCode: 8 });
  await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8, nativeVirtualKeyCode: 8 });
  if (process.env.QA_DEBUG_HITS === "1") console.error("search after clear", await evaluate(client, `({ value: document.querySelector('#result-search').value, active: document.activeElement?.id, start: document.querySelector('#result-search').selectionStart, end: document.querySelector('#result-search').selectionEnd })`));
  await waitFor(client, `document.querySelectorAll('.result-card').length === ${publishedResultCount}`);
  await click(client, "#result-sort");
  await pressKey(client, "ArrowDown", "ArrowDown");
  await pressKey(client, "Enter", "Enter");
  await waitFor(client, `document.querySelector('#result-sort').value === 'fps'`);
  const requirementCard = await evaluate(client, `({
    status: document.querySelector('[data-result-id="gpt-5-5-run-01"] .poster-state').textContent,
    note: document.querySelector('[data-result-id="gpt-5-5-run-01"] .result-requirement-note').textContent,
    className: document.querySelector('[data-result-id="gpt-5-5-run-01"] .poster-state').className,
  })`);
  if (requirementCard.status.trim() !== '2 unmet'
    || !requirementCard.note.includes('Useful full-subject framing')
    || !requirementCard.note.includes('Two-finger pinch zoom')
    || requirementCard.className.includes('state-failed')) {
    throw new Error(`Catalog requirement disclosure failed: ${JSON.stringify(requirementCard)}`);
  }
  const resultsScreenshot = await screenshot(client, "desktop-results.jpg");
  await evaluate(client, `document.querySelector('[data-result-id="claude-sonnet-5-max-run-01"] .result-body').scrollIntoView({block:'center', behavior:'instant'})`);
  await delay(120);
  const renderFailureCardScreenshot = await screenshot(client, "desktop-render-failure-card.jpg");
  await evaluate(client, `document.querySelector('[data-result-id="gpt-5-5-run-01"] .result-body').scrollIntoView({block:'center', behavior:'instant'})`);
  await delay(120);
  const resultRequirementCardScreenshot = await screenshot(client, "desktop-result-requirement-card.jpg");

  await evaluate(client, `document.querySelector('#method').scrollIntoView({block:'start', behavior:'instant'})`);
  await click(client, "#copy-prompt");
  await waitFor(client, `document.querySelector('#toast').textContent.includes('Canonical prompt copied')`);
  const methodScreenshot = await screenshot(client, "desktop-method.jpg");
  await click(client, "[data-open-add]");
  await waitFor(client, `document.querySelector('#add-dialog').open`);
  await click(client, "#add-dialog .modal-close");
  await waitFor(client, `!document.querySelector('#add-dialog').open`);

  await click(client, '[data-result-id="gpt-5-6-sol-run-01"] .compare-check span');
  await waitFor(client, `document.querySelectorAll('[data-compare-id]:checked').length === 1`);
  await click(client, '[data-result-id="gpt-5-5-run-01"] .compare-check span');
  await waitFor(client, `document.querySelectorAll('[data-compare-id]:checked').length === 2`);
  await waitFor(client, `!document.querySelector('#open-compare').disabled`);
  await click(client, "#open-compare");
  await waitFor(client, `!document.querySelector('#compare').hidden && document.querySelector('#compare-left-canvas').width > 1`, 30000);
  await click(client, "#compare-swap");
  await waitFor(client, `document.querySelector('#compare-left-label').textContent === 'gpt-5.5'`, 30000);
  await click(client, "#compare-swap");
  await waitFor(client, `document.querySelector('#compare-left-label').textContent === 'gpt-5.6-sol'`, 30000);
  await click(client, ".toggle-field span");
  await waitFor(client, `!document.querySelector('#sync-view').checked`);
  await click(client, ".toggle-field span");
  await waitFor(client, `document.querySelector('#sync-view').checked`);
  await click(client, "#copy-compare-link");
  await waitFor(client, `document.querySelector('#toast').textContent.includes('Comparison link copied')`);
  await drag(client, "#compare-left-canvas", 95, 20);
  await delay(400);
  const compare = await evaluate(client, `({
    left: document.querySelector('#compare-left-label').textContent,
    right: document.querySelector('#compare-right-label').textContent,
    leftError: !document.querySelector('#compare-left-error').hidden,
    rightError: !document.querySelector('#compare-right-error').hidden,
    leftWidth: document.querySelector('#compare-left-canvas').width,
    rightWidth: document.querySelector('#compare-right-canvas').width,
    requirements: [...document.querySelectorAll('[data-metric="requirements"] strong')].map((cell) => cell.textContent),
  })`);
  if (compare.leftError || compare.rightError
    || compare.requirements[0] !== 'None recorded'
    || !compare.requirements[1].includes('Useful full-subject framing')) {
    throw new Error(`Comparison render or requirement disclosure failed: ${JSON.stringify(compare)}`);
  }
  const benchmarkRuns = [];
  const requestedBenchmarkRuns = Number(process.env.QA_BENCHMARK_RUNS || 0);
  for (let run = 0; run < requestedBenchmarkRuns; run += 1) {
    await click(client, "#benchmark-both");
    await waitFor(client, `document.querySelector('#benchmark-both').disabled`, 5000);
    await waitFor(client, `!document.querySelector('#benchmark-both').disabled && document.querySelector('#benchmark-overlay').hidden`, 120000);
    benchmarkRuns.push(await evaluate(client, `document.querySelector('#compare').benchmarkResults`));
  }
  await evaluate(client, `document.querySelector('#compare').scrollIntoView({block:'start', behavior:'instant'})`);
  await delay(150);
  const compareScreenshot = await screenshot(client, "desktop-compare.jpg");
  await evaluate(client, `document.querySelector('.comparison-report').scrollIntoView({block:'start', behavior:'instant'})`);
  await delay(120);
  const compareLedgerScreenshot = await screenshot(client, "desktop-compare-ledger.jpg");

  await click(client, '[data-result-id="gpt-5-6-sol-run-01"] [data-detail-id]');
  await waitFor(client, `location.pathname.endsWith('/result.html') && !document.querySelector('#run-page').hidden && document.querySelector('#run-viewer-loading').hidden && document.querySelector('#run-source').textContent.includes('createPelicanSdf')`, 30000);
  const runDetail = await evaluate(client, `(() => ({
    id: new URL(location.href).searchParams.get('id'),
    hash: location.hash,
    title: document.querySelector('#run-title').textContent,
    model: document.querySelector('#run-model').textContent,
    status: document.querySelector('#run-status').textContent,
    viewerError: !document.querySelector('#run-viewer-error').hidden,
    sourceLoaded: document.querySelector('#run-source').textContent.length,
    promptLoaded: document.querySelector('#run-prompt-text').textContent.length,
    invocationRows: document.querySelectorAll('#invocation-record > div').length,
    usageRows: document.querySelectorAll('#usage-record > div').length,
    integrityRows: document.querySelectorAll('#integrity-record > div').length,
    checks: document.querySelectorAll('#validation-checks li').length,
    requirements: document.querySelectorAll('#validation-requirements li').length,
    advisories: document.querySelectorAll('#validation-warnings li').length,
    compareHref: document.querySelector('#compare-run-link').href,
    viewport: { width: innerWidth, scrollWidth: document.documentElement.scrollWidth },
  }))()`);
  if (runDetail.id !== "gpt-5-6-sol-run-01" || runDetail.viewerError || runDetail.sourceLoaded < 1000 || runDetail.promptLoaded < 1000) {
    throw new Error(`Dedicated run record failed: ${JSON.stringify(runDetail)}`);
  }
  if (runDetail.invocationRows < 8 || runDetail.usageRows < 8 || runDetail.integrityRows < 6 || runDetail.checks < 1 || runDetail.requirements !== 0 || runDetail.advisories < 1) {
    throw new Error(`Dedicated run metadata is incomplete: ${JSON.stringify(runDetail)}`);
  }
  if (!runDetail.compareHref.includes("compare=gpt-5-6-sol-run-01%2Cgpt-5-5-run-01") || runDetail.viewport.scrollWidth > runDetail.viewport.width) {
    throw new Error(`Dedicated run navigation or layout failed: ${JSON.stringify(runDetail)}`);
  }
  const sourceLoaded = runDetail.sourceLoaded;

  await evaluate(client, `document.querySelector('.run-hero').scrollIntoView({block:'start', behavior:'instant'})`);
  await waitFor(client, `!document.querySelector('#run-view').textContent.includes('—')`);
  const beforeRunDrag = await evaluate(client, `document.querySelector('#run-view').textContent`);
  await drag(client, "#run-canvas", 110, -35);
  await delay(300);
  const afterRunDrag = await evaluate(client, `document.querySelector('#run-view').textContent`);
  await wheel(client, "#run-canvas", -220);
  await delay(300);
  const afterRunZoom = await evaluate(client, `document.querySelector('#run-view').textContent`);
  if (beforeRunDrag === afterRunDrag || afterRunDrag === afterRunZoom) throw new Error("Dedicated run orbit or zoom did not update its camera readout.");
  await click(client, "#run-reset");
  await delay(250);
  const afterRunReset = await evaluate(client, `document.querySelector('#run-view').textContent`);
  if (afterRunReset !== beforeRunDrag) throw new Error(`Dedicated run reset did not restore its view (${afterRunReset}).`);
  await click(client, "#run-pause");
  await waitFor(client, `document.querySelector('#run-pause').getAttribute('aria-pressed') === 'true'`);
  await click(client, "#run-pause");
  await waitFor(client, `document.querySelector('#run-pause').getAttribute('aria-pressed') === 'false'`);
  await click(client, "#share-run");
  await waitFor(client, `document.querySelector('#toast').textContent.includes('Run link copied')`);
  const runDetailScreenshot = await screenshot(client, "desktop-run-detail.jpg");

  await evaluate(client, `document.querySelector('#generation').scrollIntoView({block:'start', behavior:'instant'})`);
  await delay(120);
  const runGenerationScreenshot = await screenshot(client, "desktop-run-generation.jpg");
  await click(client, "#run-copy-prompt");
  await waitFor(client, `document.querySelector('#toast').textContent.includes('Canonical prompt copied')`);
  await click(client, "#copy-run-source");
  await waitFor(client, `document.querySelector('#toast').textContent.includes('Artifact source copied')`);
  await evaluate(client, `document.querySelector('#source').scrollIntoView({block:'start', behavior:'instant'})`);
  await delay(120);
  const runSourceScreenshot = await screenshot(client, "desktop-run-source.jpg");

  const evaluatedRuns = [];
  let solCostScreenshot = null;
  const generatedRuns = [
    { id: "gpt-5-6-terra-low-run-01", effort: "low", totalTokens: "17,290" },
    { id: "gpt-5-6-sol-low-run-01", effort: "low", totalTokens: "19,079", cost: "$0.2055 est." },
    { id: "gpt-5-6-sol-medium-run-01", effort: "medium", totalTokens: "20,913", cost: "$0.2712 est." },
    { id: "gpt-5-6-sol-high-run-01", effort: "high", totalTokens: "23,986", cost: "$0.3475 est." },
    { id: "gpt-5-6-sol-xhigh-run-01", effort: "xhigh", totalTokens: "32,183", cost: "$0.5933 est." },
    { id: "gpt-5-6-sol-max-run-01", effort: "max", totalTokens: "40,772", cost: "$0.8563 est." },
    { id: "gpt-5-6-luna-high-run-01", effort: "high", totalTokens: "22,619" },
  ];
  for (const generatedRun of generatedRuns) {
    await client.send("Page.navigate", { url: `${siteUrl}result.html?id=${generatedRun.id}` });
    await waitFor(client, `document.readyState === 'complete' && !document.querySelector('#run-page').hidden && document.querySelector('#run-viewer-loading').hidden`, 30000);
    const record = await evaluate(client, `({
      id: new URL(location.href).searchParams.get('id'),
      viewerError: !document.querySelector('#run-viewer-error').hidden,
      sourceLoaded: document.querySelector('#run-source').textContent.length,
      promptLoaded: document.querySelector('#run-prompt-text').textContent.length,
      invocation: document.querySelector('#invocation-record').textContent,
      usage: document.querySelector('#usage-record').textContent,
      checks: document.querySelectorAll('#validation-checks li').length,
      requirements: document.querySelectorAll('#validation-requirements li').length,
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    })`);
    if (record.id !== generatedRun.id
      || record.viewerError
      || record.sourceLoaded < 1000
      || record.promptLoaded < 1000
      || !record.invocation.includes(`reasoning effort: ${generatedRun.effort}`)
      || !record.usage.includes(generatedRun.totalTokens)
      || (generatedRun.cost && !record.usage.includes(generatedRun.cost))
      || record.checks < 10
      || record.requirements !== 0
      || record.scrollWidth > record.width) {
      throw new Error(`Generated run record failed: ${JSON.stringify({ generatedRun, record })}`);
    }

    if (generatedRun.id === "gpt-5-6-sol-medium-run-01") {
      await evaluate(client, `document.querySelector('#generation').scrollIntoView({block:'start', behavior:'instant'})`);
      await delay(120);
      solCostScreenshot = await screenshot(client, "desktop-sol-token-cost.jpg");
    }

    await evaluate(client, `document.querySelector('.run-hero').scrollIntoView({block:'start', behavior:'instant'})`);
    const before = await evaluate(client, `document.querySelector('#run-view').textContent`);
    await drag(client, "#run-canvas", 105, -30);
    await delay(220);
    const afterDrag = await evaluate(client, `document.querySelector('#run-view').textContent`);
    await wheel(client, "#run-canvas", -190);
    await delay(220);
    const afterWheel = await evaluate(client, `document.querySelector('#run-view').textContent`);
    await click(client, "#run-canvas");
    await pressKey(client, "ArrowLeft", "ArrowLeft");
    await delay(180);
    const afterKeyboard = await evaluate(client, `document.querySelector('#run-view').textContent`);
    await click(client, "#run-reset");
    await delay(180);
    const afterReset = await evaluate(client, `document.querySelector('#run-view').textContent`);
    await pinch(client, "#run-canvas");
    await delay(240);
    const afterPinch = await evaluate(client, `document.querySelector('#run-view').textContent`);
    if (before === afterDrag
      || afterDrag === afterWheel
      || afterWheel === afterKeyboard
      || afterReset !== before
      || afterPinch === afterReset) {
      throw new Error(`Generated run controls failed: ${JSON.stringify({ generatedRun, before, afterDrag, afterWheel, afterKeyboard, afterReset, afterPinch })}`);
    }
    evaluatedRuns.push({ ...generatedRun, record, before, afterDrag, afterWheel, afterKeyboard, afterReset, afterPinch });
  }

  await client.send("Page.navigate", { url: `${siteUrl}result.html?id=not-a-published-run` });
  await waitFor(client, `document.readyState === 'complete' && !document.querySelector('#run-error').hidden`, 30000);
  const missingRun = await evaluate(client, `({
    pageHidden: document.querySelector('#run-page').hidden,
    loadingHidden: document.querySelector('#run-loading').hidden,
    links: document.querySelectorAll('#run-error-links a').length,
    message: document.querySelector('#run-error-message').textContent,
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  })`);
  if (!missingRun.pageHidden || !missingRun.loadingHidden || missingRun.links !== publishedResultCount || missingRun.scrollWidth > missingRun.width) {
    throw new Error(`Missing-run state failed: ${JSON.stringify(missingRun)}`);
  }

  await client.send("Page.navigate", { url: `${siteUrl}result.html?id=gpt-5-5-run-01` });
  await waitFor(client, `document.readyState === 'complete' && !document.querySelector('#run-page').hidden && document.querySelector('#run-viewer-loading').hidden`, 30000);
  const requirementRunDetail = await evaluate(client, `({
    status: document.querySelector('#run-status').textContent,
    unmetClass: document.querySelector('#run-status').classList.contains('state-unmet'),
    failedClass: document.querySelector('#run-status').classList.contains('state-failed'),
    requirements: [...document.querySelectorAll('#validation-requirements li')].map((item) => ({
      requirement: item.querySelector('strong').textContent,
      evidence: item.querySelector('span').textContent,
    })),
    advisoriesHidden: document.querySelector('#validation-advisories-panel').hidden,
    summary: document.querySelector('#validation-summary').textContent,
    sourceLoaded: document.querySelector('#run-source').textContent.length,
    invocationRows: document.querySelectorAll('#invocation-record > div').length,
    usageRows: document.querySelectorAll('#usage-record > div').length,
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  })`);
  if (requirementRunDetail.status !== 'Rendered · 2 requirements unmet'
    || !requirementRunDetail.unmetClass
    || requirementRunDetail.failedClass
    || requirementRunDetail.requirements.length !== 2
    || !requirementRunDetail.requirements[0].evidence.includes('camera image outside the canvas')
    || !requirementRunDetail.advisoriesHidden
    || !requirementRunDetail.summary.includes('remains a benchmark result')
    || requirementRunDetail.sourceLoaded < 1000
    || requirementRunDetail.scrollWidth > requirementRunDetail.width) {
    throw new Error(`Requirement-level record disclosure failed: ${JSON.stringify(requirementRunDetail)}`);
  }
  await evaluate(client, `document.querySelector('.run-hero').scrollIntoView({block:'start', behavior:'instant'})`);
  const requirementRunScreenshot = await screenshot(client, "desktop-requirement-run.jpg");
  await evaluate(client, `document.querySelector('#validation').scrollIntoView({block:'start', behavior:'instant'})`);
  await delay(120);
  const requirementFindingsScreenshot = await screenshot(client, "desktop-unmet-requirements.jpg");

  await client.send("Page.navigate", { url: `${siteUrl}results.html?run=gpt-5-5-run-01` });
  await waitFor(client, `document.readyState === 'complete' && document.querySelector('#hero-loading')?.hidden`, 30000);
  const secondRun = await evaluate(client, `({
    error: !document.querySelector('#hero-error').hidden,
    view: document.querySelector('#hero-view').textContent,
    dataLength: document.querySelector('#hero-canvas').toDataURL().length,
  })`);
  const secondScreenshot = await screenshot(client, "desktop-second-run.jpg");

  await client.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true, screenWidth: 390, screenHeight: 844 });
  await client.send("Page.navigate", { url: siteUrl });
  await waitFor(client, `document.readyState === 'complete' && document.querySelector('#landing-title')`, 30000);
  const mobileLanding = await evaluate(client, `(() => {
    const resources = performance.getEntriesByType('resource').map((entry) => entry.name);
    return {
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      canvases: document.querySelectorAll('canvas').length,
      scripts: document.querySelectorAll('script').length,
      heavyResources: resources.filter((url) => /\\/data\\/(?:manifest\\.json|results\\/|artifacts\\/)|\\/src\\/(?:app|data|viewer)\\.js/.test(url)),
      heroWidth: document.querySelector('.landing-hero').getBoundingClientRect().width,
      ctaVisible: Boolean(document.querySelector('.landing-copy a[href="./results.html"]')),
    };
  })()`);
  if (mobileLanding.scrollWidth > mobileLanding.width || mobileLanding.canvases || mobileLanding.scripts || mobileLanding.heavyResources.length || !mobileLanding.ctaVisible) {
    throw new Error(`Mobile landing failed: ${JSON.stringify(mobileLanding)}`);
  }
  const mobileLandingScreenshot = await screenshot(client, "mobile-landing.jpg");
  await evaluate(client, `document.querySelector('.contract-card').scrollIntoView({block:'start', behavior:'instant'})`);
  const mobileLandingContractScreenshot = await screenshot(client, "mobile-landing-contract.jpg");
  await evaluate(client, `document.querySelector('#top').scrollIntoView({block:'start', behavior:'instant'})`);
  await click(client, '.landing-copy a[href="./results.html"]');
  await waitFor(client, `document.readyState === 'complete' && document.querySelector('#hero-loading')?.hidden`, 30000);
  const mobile = await evaluate(client, `({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    headerWidth: document.querySelector('.site-header').getBoundingClientRect().width,
    canvasWidth: document.querySelector('#hero-canvas').getBoundingClientRect().width,
    cards: document.querySelectorAll('.result-card').length,
    error: !document.querySelector('#hero-error').hidden,
  })`);
  if (mobile.scrollWidth > mobile.width || mobile.error || mobile.cards !== publishedResultCount) throw new Error(`Mobile state failed: ${JSON.stringify(mobile)}`);
  const mobileScreenshot = await screenshot(client, "mobile-catalog.jpg");
  await evaluate(client, `document.querySelector('#results').scrollIntoView({block:'start', behavior:'instant'})`);
  await waitFor(client, `document.querySelector('.poster-thumbnail')?.naturalWidth === 480`, 30000);
  await delay(120);
  const mobileResultsScreenshot = await screenshot(client, "mobile-results.jpg");

  await click(client, '[data-result-id="gpt-5-6-sol-run-01"] .compare-check span');
  await click(client, '[data-result-id="gpt-5-5-run-01"] .compare-check span');
  await waitFor(client, `!document.querySelector('#open-compare').disabled`);
  await click(client, "#open-compare");
  await waitFor(client, `!document.querySelector('#compare').hidden && document.querySelector('#compare-left-canvas').width > 1`, 30000);
  const mobileCompare = await evaluate(client, `({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    requirements: [...document.querySelectorAll('[data-metric="requirements"] strong')].map((cell) => cell.textContent),
    rowWidth: document.querySelector('[data-metric="requirements"]').getBoundingClientRect().width,
  })`);
  if (mobileCompare.scrollWidth > mobileCompare.width
    || mobileCompare.rowWidth > mobileCompare.width
    || !mobileCompare.requirements.some((value) => value.includes('Two-finger pinch zoom'))) {
    throw new Error(`Mobile comparison disclosure failed: ${JSON.stringify(mobileCompare)}`);
  }
  await evaluate(client, `document.querySelector('[data-metric="requirements"]').scrollIntoView({block:'center', behavior:'instant'})`);
  await delay(120);
  const mobileCompareScreenshot = await screenshot(client, "mobile-compare-requirements.jpg");

  await client.send("Page.navigate", { url: `${siteUrl}result.html?id=gpt-5-6-sol-run-01` });
  await waitFor(client, `document.readyState === 'complete' && !document.querySelector('#run-page').hidden && document.querySelector('#run-viewer-loading').hidden`, 30000);
  const mobileRun = await evaluate(client, `({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    canvasWidth: document.querySelector('#run-canvas').getBoundingClientRect().width,
    status: document.querySelector('#run-status').textContent,
    sourceLoaded: document.querySelector('#run-source').textContent.length,
    invocationRows: document.querySelectorAll('#invocation-record > div').length,
    usageRows: document.querySelectorAll('#usage-record > div').length,
    viewerError: !document.querySelector('#run-viewer-error').hidden,
  })`);
  if (mobileRun.scrollWidth > mobileRun.width || mobileRun.viewerError || mobileRun.canvasWidth < 300 || mobileRun.sourceLoaded < 1000 || mobileRun.usageRows < 8) {
    throw new Error(`Mobile run record failed: ${JSON.stringify(mobileRun)}`);
  }
  await evaluate(client, `document.querySelector('.run-hero').scrollIntoView({block:'start', behavior:'instant'})`);
  const mobileRunScreenshot = await screenshot(client, "mobile-run-detail.jpg");
  await evaluate(client, `document.querySelector('#generation').scrollIntoView({block:'start', behavior:'instant'})`);
  await delay(120);
  const mobileRunGenerationScreenshot = await screenshot(client, "mobile-run-generation.jpg");

  await client.send("Page.navigate", { url: `${siteUrl}result.html?id=gpt-5-5-run-01#validation` });
  await waitFor(client, `document.readyState === 'complete' && !document.querySelector('#run-page').hidden && document.querySelector('#run-viewer-loading').hidden`, 30000);
  const mobileRequirementRun = await evaluate(client, `({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    status: document.querySelector('#run-status').textContent,
    failedClass: document.querySelector('#run-status').classList.contains('state-failed'),
    requirements: document.querySelectorAll('#validation-requirements li').length,
    requirementsPanelHidden: document.querySelector('#validation-requirements-panel').hidden,
  })`);
  if (mobileRequirementRun.scrollWidth > mobileRequirementRun.width
    || mobileRequirementRun.status !== 'Rendered · 2 requirements unmet'
    || mobileRequirementRun.failedClass
    || mobileRequirementRun.requirements !== 2
    || mobileRequirementRun.requirementsPanelHidden) {
    throw new Error(`Mobile requirement disclosure failed: ${JSON.stringify(mobileRequirementRun)}`);
  }
  await evaluate(client, `document.querySelector('#validation').scrollIntoView({block:'start', behavior:'instant'})`);
  await delay(120);
  const mobileRequirementScreenshot = await screenshot(client, "mobile-unmet-requirements.jpg");
  await evaluate(client, `document.querySelector('#validation-requirements-panel').scrollIntoView({block:'start', behavior:'instant'})`);
  await delay(120);
  const mobileRequirementEvidenceScreenshot = await screenshot(client, "mobile-unmet-requirement-evidence.jpg");

  const report = {
    landing,
    initial,
    interaction: { beforeDrag, afterDrag, afterZoom, afterKeyboardOrbit, afterKeyboardZoom, afterReset, afterPinch },
    compare,
    benchmarkRuns,
    runDetail,
    runInteraction: { beforeRunDrag, afterRunDrag, afterRunZoom, afterRunReset },
    evaluatedRuns,
    sourceLoaded,
    missingRun,
    requirementRunDetail,
    secondRun,
    mobileLanding,
    mobile,
    mobileCompare,
    mobileRun,
    mobileRequirementRun,
    browserErrors,
    screenshots: [landingScreenshot, landingMethodScreenshot, landingCtaScreenshot, catalogScreenshot, closeupScreenshot, resultsScreenshot, renderFailureCardScreenshot, resultRequirementCardScreenshot, methodScreenshot, compareScreenshot, compareLedgerScreenshot, runDetailScreenshot, runGenerationScreenshot, solCostScreenshot, runSourceScreenshot, requirementRunScreenshot, requirementFindingsScreenshot, secondScreenshot, mobileLandingScreenshot, mobileLandingContractScreenshot, mobileScreenshot, mobileResultsScreenshot, mobileCompareScreenshot, mobileRunScreenshot, mobileRunGenerationScreenshot, mobileRequirementScreenshot, mobileRequirementEvidenceScreenshot],
  };
  console.log(JSON.stringify(report, null, 2));
  if (browserErrors.length) process.exitCode = 1;
} finally {
  client?.close();
  browser.kill();
  server.kill();
  await delay(150);
  const safeTempRoot = path.resolve(os.tmpdir()) + path.sep;
  if (profileDir.startsWith(safeTempRoot) && path.basename(profileDir).startsWith("pelican-sdf-chrome-")) {
    await rm(profileDir, { recursive: true, force: true }).catch(() => {});
  }
}
