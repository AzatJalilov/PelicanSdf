import { loadPrompt, loadResults } from "./data.js";
import { ArtifactViewer } from "./viewer.js";

const elements = {
  loading: document.querySelector("#run-loading"),
  error: document.querySelector("#run-error"),
  errorMessage: document.querySelector("#run-error-message"),
  errorLinks: document.querySelector("#run-error-links"),
  page: document.querySelector("#run-page"),
  canvas: document.querySelector("#run-canvas"),
  viewerLoading: document.querySelector("#run-viewer-loading"),
  viewerError: document.querySelector("#run-viewer-error"),
  reset: document.querySelector("#run-reset"),
  pause: document.querySelector("#run-pause"),
  benchmark: document.querySelector("#run-benchmark"),
  liveFps: document.querySelector("#run-live-fps"),
  view: document.querySelector("#run-view"),
  toast: document.querySelector("#toast"),
  benchmarkOverlay: document.querySelector("#benchmark-overlay"),
  benchmarkStatus: document.querySelector("#benchmark-status"),
  benchmarkDetail: document.querySelector("#benchmark-detail"),
  benchmarkProgress: document.querySelector("#benchmark-progress"),
};

let viewer;
let result;
let source = "";
let prompt = "";
let toastTimer = 0;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function runUrl(id) {
  const url = new URL("./result.html", window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("id", id);
  return url;
}

function compareUrl(left, right) {
  const url = new URL("./results.html", window.location.href);
  url.search = "";
  url.hash = "compare";
  url.searchParams.set("compare", `${left},${right}`);
  return url;
}

function formatFps(value) {
  return Number.isFinite(value) ? `${value.toFixed(value >= 100 ? 1 : 2)} fps` : "Not measured";
}

function formatMs(value) {
  return Number.isFinite(value) ? `${value.toFixed(3)} ms` : "Not measured";
}

function formatBytes(value) {
  if (!Number.isFinite(value)) return "Unknown";
  return value >= 1024 ? `${(value / 1024).toFixed(1)} KiB` : `${value} B`;
}

function formatTokens(value) {
  return Number.isInteger(value) ? value.toLocaleString("en-US") : "Not captured";
}

function formatCost(usage) {
  if (!Number.isFinite(usage.apiCostUsd)) return usage.billingMode === "subscription" ? "Not exposed" : "Not captured";
  return `$${usage.apiCostUsd.toFixed(usage.apiCostUsd < 0.01 ? 4 : 2)}`;
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "Not recorded";
  return String(value);
}

function statusLabel(item) {
  if (item.validation.state === "failed") return "Render error";
  const unmet = item.validation.unmetRequirements.length;
  if (unmet) return `Rendered · ${unmet} ${unmet === 1 ? "requirement" : "requirements"} unmet`;
  const advisories = item.validation.warnings.length;
  if (advisories) return `Rendered · ${advisories} ${advisories === 1 ? "advisory" : "advisories"}`;
  if (item.status === "verified") return "Verified";
  if (item.status === "reference") return "Reference";
  return "Rendered · unverified";
}

function validationStateClass(item) {
  if (item.validation.state === "failed") return "failed";
  if (item.validation.unmetRequirements.length) return "unmet";
  return item.validation.state;
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("visible"), 2400);
}

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
  showToast(message);
}

function row(label, value, options = {}) {
  const content = escapeHtml(formatValue(value));
  return `<div><dt>${escapeHtml(label)}</dt><dd>${options.code ? `<code>${content}</code>` : content}</dd></div>`;
}

function populateRecord(results, itemIndex) {
  const usage = result.generationUsage;
  const harness = result.generationHarness;
  const metrics = result.metrics;
  const lineCount = source ? source.split(/\r?\n/).length : 0;

  document.title = `${result.model} — ${result.id} · Pelican SDF`;
  const descriptionMeta = document.querySelector('meta[name="description"]');
  descriptionMeta.content = `${result.model}: ${result.description}`;

  document.querySelector("#run-breadcrumb").textContent = result.model;
  document.querySelector("#run-index").textContent = `SDF-${String(itemIndex + 1).padStart(3, "0")}`;
  document.querySelector("#run-date").textContent = result.createdAt;
  document.querySelector("#run-model-kicker").textContent = `${result.provider} · ${result.track}`;
  document.querySelector("#run-title").textContent = result.model;
  document.querySelector("#run-model").textContent = `${result.id} · ${result.title}`;
  document.querySelector("#run-description").textContent = result.description;
  document.querySelector("#run-viewer-label").textContent = `${result.model} / ${result.id}`;

  const status = document.querySelector("#run-status");
  status.textContent = statusLabel(result);
  status.className = `run-status state-${validationStateClass(result)}`;

  document.querySelector("#metric-fps").textContent = formatFps(metrics.throughputFps);
  document.querySelector("#metric-median").textContent = formatMs(metrics.gpuMsMedian);
  document.querySelector("#metric-p95").textContent = formatMs(metrics.gpuMsP95);
  document.querySelector("#metric-bytes").textContent = formatBytes(metrics.sourceBytes);
  document.querySelector("#metric-lines").textContent = `${lineCount.toLocaleString("en-US")} lines`;
  document.querySelector("#metric-profile").textContent = formatValue(metrics.profile);
  document.querySelector("#metric-method").textContent = formatValue(metrics.timingMethod);
  document.querySelector("#metric-environment").textContent = formatValue(metrics.environment);
  document.querySelector("#metric-samples").textContent = `${formatValue(metrics.trials)} trials · ${formatValue(metrics.sampleCount)} samples each`;
  document.querySelector("#metric-measured-at").textContent = metrics.measuredAt ? new Date(metrics.measuredAt).toLocaleString() : "Not measured";
  document.querySelector("#metric-environment-key").textContent = formatValue(metrics.environmentKey);

  document.querySelector("#invocation-record").innerHTML = [
    row("Exact model", result.model),
    row("Provider", result.provider),
    row("Track", result.track),
    row("Generated", result.createdAt),
    row("Harness", `${harness.name}${harness.version ? ` ${harness.version}` : ""}`),
    row("Surface", harness.surface),
    row("Sandbox", harness.sandbox),
    row("Method", result.provenance.method),
    row("Decoding", result.provenance.decoding),
  ].join("");

  document.querySelector("#usage-record").innerHTML = [
    row("Input tokens", formatTokens(usage.inputTokens)),
    row("Cached input", formatTokens(usage.cachedInputTokens)),
    row("Reasoning tokens", formatTokens(usage.reasoningTokens)),
    row("Output tokens", formatTokens(usage.outputTokens)),
    row("Total tokens", formatTokens(usage.totalTokens)),
    row("API cost", formatCost(usage)),
    row("Billing mode", usage.billingMode),
    row("Usage source", usage.source),
  ].join("");
  document.querySelector("#usage-note").textContent = usage.notes || "No usage note was supplied.";

  document.querySelector("#integrity-record").innerHTML = [
    row("Prompt version", result.promptVersion),
    row("Prompt SHA-256", result.promptSha256, { code: true }),
    row("Artifact SHA-256", result.artifactSha256, { code: true }),
    row("Artifact bytes", metrics.sourceBytes),
    row("Provenance kind", result.provenance.generatorKind),
    row("Raw response", result.provenance.rawResponse, { code: true }),
    row("Harness context", harness.notes),
  ].join("");

  document.querySelector("#validation-checks").innerHTML = result.validation.checks
    .map((check) => `<li>${escapeHtml(check)}</li>`).join("");
  const unmetRequirements = result.validation.unmetRequirements;
  const requirementsPanel = document.querySelector("#validation-requirements-panel");
  requirementsPanel.hidden = !unmetRequirements.length;
  document.querySelector("#validation-requirements").innerHTML = unmetRequirements
    .map((finding) => `<li><strong>${escapeHtml(finding.requirement)}</strong><span>${escapeHtml(finding.evidence)}</span></li>`).join("");
  const advisoriesPanel = document.querySelector("#validation-advisories-panel");
  advisoriesPanel.hidden = !result.validation.warnings.length;
  document.querySelector("#validation-warnings").innerHTML = result.validation.warnings
    .map((warning) => `<li>${escapeHtml(warning)}</li>`).join("");
  document.querySelector("#validation-summary").textContent = result.validation.state === "failed"
    ? "The artifact could not produce an inspectable render. Its source and generation record remain published."
    : unmetRequirements.length
      ? `This artifact renders and remains a benchmark result. ${unmetRequirements.length} required ${unmetRequirements.length === 1 ? "behavior was" : "behaviors were"} not met; each is named below with the observed evidence.`
      : result.validation.warnings.length
        ? "The artifact renders with the non-blocking advisory below preserved in its record."
      : "The submission passed the recorded validation checks.";

  const visualLabels = {
    readability: "Readability",
    completeness: "Completeness",
    coherence: "Coherence",
    craft: "Craft",
    inspectability: "Inspectability",
  };
  document.querySelector("#visual-scores").innerHTML = Object.entries(visualLabels).map(([key, label]) => {
    const value = result.visual[key];
    return `<div><span>${label}</span><strong>${Number.isFinite(value) ? `${value.toFixed(1)} / 5` : "Awaiting review"}</strong></div>`;
  }).join("") + `<p>${result.visual.reviewers} blind reviewer${result.visual.reviewers === 1 ? "" : "s"}</p>`;

  document.querySelector("#prompt-meta").textContent = `v${result.promptVersion} · ${result.promptSha256.slice(0, 12)}…`;
  document.querySelector("#run-prompt-text").textContent = prompt;
  document.querySelector("#run-source").textContent = source;
  document.querySelector("#source-filename").textContent = result.artifact.split("/").pop();
  document.querySelector("#source-size").textContent = `${formatBytes(metrics.sourceBytes)} · ${lineCount.toLocaleString("en-US")} lines`;

  const otherResults = results.filter((item) => item.id !== result.id);
  const compareSelect = document.querySelector("#compare-with");
  compareSelect.innerHTML = otherResults.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.model)} — ${escapeHtml(item.id)}</option>`).join("");
  const compareLink = document.querySelector("#compare-run-link");
  const updateCompareLink = () => {
    compareLink.href = otherResults.length ? compareUrl(result.id, compareSelect.value).href : "./results.html#compare";
    compareLink.setAttribute("aria-disabled", String(!otherResults.length));
  };
  compareSelect.disabled = !otherResults.length;
  updateCompareLink();
  compareSelect.addEventListener("change", updateCompareLink);

  const previous = results[(itemIndex - 1 + results.length) % results.length];
  const next = results[(itemIndex + 1) % results.length];
  const previousLink = document.querySelector("#previous-run");
  const nextLink = document.querySelector("#next-run");
  previousLink.href = runUrl(previous.id).href;
  previousLink.querySelector("strong").textContent = `${previous.model} · ${previous.id}`;
  nextLink.href = runUrl(next.id).href;
  nextLink.querySelector("strong").textContent = `${next.model} · ${next.id}`;
}

function showError(results, message) {
  elements.loading.hidden = true;
  elements.error.hidden = false;
  elements.errorMessage.textContent = message;
  elements.errorLinks.innerHTML = results.map((item) => `<a href="${runUrl(item.id).href}">${escapeHtml(item.model)} · ${escapeHtml(item.title)}</a>`).join("");
}

function setupInteractions() {
  elements.reset.addEventListener("click", () => viewer.resetView());
  elements.pause.addEventListener("click", () => {
    const paused = elements.pause.getAttribute("aria-pressed") !== "true";
    elements.pause.setAttribute("aria-pressed", String(paused));
    elements.pause.setAttribute("aria-label", paused ? "Resume preview" : "Pause preview");
    viewer.setPaused(paused);
  });
  document.querySelector("#share-run").addEventListener("click", () => copyText(window.location.href, "Run link copied"));
  document.querySelector("#run-copy-prompt").addEventListener("click", () => copyText(prompt, "Canonical prompt copied"));
  document.querySelector("#copy-run-source").addEventListener("click", () => copyText(source, "Artifact source copied"));
  document.querySelector("#download-run-source").addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = result.artifact.split("/").pop();
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Artifact download prepared");
  });
  elements.benchmark.addEventListener("click", runLocalBenchmark);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) viewer.setPaused(true);
    else if (elements.pause.getAttribute("aria-pressed") !== "true") viewer.setPaused(false);
  });
}

async function runLocalBenchmark() {
  if (!viewer?.controller) return;
  elements.benchmark.disabled = true;
  elements.benchmarkOverlay.hidden = false;
  elements.benchmarkProgress.style.width = "2%";
  elements.benchmarkStatus.textContent = `Measuring ${result.model}`;
  elements.benchmarkDetail.textContent = "Twelve canonical views run without preview contention.";
  try {
    const metrics = await viewer.benchmark((progress, detail) => {
      elements.benchmarkProgress.style.width = `${Math.round(progress * 100)}%`;
      elements.benchmarkStatus.textContent = detail;
    });
    document.querySelector("#local-result").hidden = false;
    document.querySelector("#local-result-value").textContent = formatFps(metrics.throughputFps);
    document.querySelector("#local-result-detail").textContent = `${formatMs(metrics.gpuMsMedian)} median · ${metrics.timingMethod} · ${metrics.environment.gpu}`;
    showToast("Local benchmark complete");
  } catch (error) {
    showToast(`Benchmark failed: ${error.message}`);
  } finally {
    elements.benchmark.disabled = false;
    elements.benchmarkOverlay.hidden = true;
  }
}

async function main() {
  const [results, loadedPrompt] = await Promise.all([loadResults(), loadPrompt()]);
  prompt = loadedPrompt.trimEnd();
  const requestedId = new URL(window.location.href).searchParams.get("id");
  const itemIndex = results.findIndex((item) => item.id === requestedId);
  if (itemIndex < 0) {
    showError(results, requestedId ? `No published result has the id “${requestedId}”.` : "This URL is missing a result id.");
    return;
  }

  result = results[itemIndex];
  const response = await fetch(result.artifactUrl);
  if (!response.ok) throw new Error(`Could not load artifact source: HTTP ${response.status}`);
  source = await response.text();
  populateRecord(results, itemIndex);

  elements.loading.hidden = true;
  elements.page.hidden = false;
  setupInteractions();
  if (window.location.hash) {
    window.requestAnimationFrame(() => document.querySelector(window.location.hash)?.scrollIntoView());
  }

  viewer = new ArtifactViewer(elements.canvas, {
    onFps: (fps) => { elements.liveFps.textContent = `${Math.round(fps)} fps`; },
    onView: (view) => {
      elements.view.textContent = `yaw ${(view.yaw * 180 / Math.PI).toFixed(1)}° · pitch ${(view.pitch * 180 / Math.PI).toFixed(1)}° · zoom ${view.distance.toFixed(2)}`;
    },
    onError: (error) => {
      elements.viewerError.hidden = false;
      elements.viewerError.querySelector("span").textContent = error.message;
    },
  });

  try {
    await viewer.load(result);
    elements.viewerLoading.hidden = true;
  } catch (error) {
    elements.viewerLoading.hidden = true;
    elements.viewerError.hidden = false;
    elements.viewerError.querySelector("span").textContent = error.message;
  }
}

main().catch((error) => {
  console.error(error);
  loadResults().then((results) => showError(results, error.message)).catch(() => showError([], error.message));
});
