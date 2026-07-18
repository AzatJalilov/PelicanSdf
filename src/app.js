import { loadPrompt, loadResults } from "./data.js";
import { ArtifactViewer } from "./viewer.js";

const state = {
  results: [],
  prompt: "",
  activeId: null,
  selectedIds: [],
  localBenchmarks: new Map(),
  compareLeftId: null,
  compareRightId: null,
  compareMaster: "left",
};

const elements = {
  resultCount: document.querySelector("#result-count"),
  resultGrid: document.querySelector("#result-grid"),
  resultSearch: document.querySelector("#result-search"),
  resultSort: document.querySelector("#result-sort"),
  emptyState: document.querySelector("#empty-state"),
  heroModel: document.querySelector("#hero-model"),
  heroCanvas: document.querySelector("#hero-canvas"),
  heroLoading: document.querySelector("#hero-loading"),
  heroError: document.querySelector("#hero-error"),
  heroFps: document.querySelector("#hero-fps"),
  heroView: document.querySelector("#hero-view"),
  heroPause: document.querySelector("#hero-pause"),
  heroReset: document.querySelector("#hero-reset"),
  heroDetails: document.querySelector("#hero-details"),
  heroBenchmark: document.querySelector("#hero-benchmark"),
  compareSection: document.querySelector("#compare"),
  compareTray: document.querySelector("#compare-tray"),
  traySelection: document.querySelector("#tray-selection"),
  openCompare: document.querySelector("#open-compare"),
  clearCompare: document.querySelector("#clear-compare"),
  leftSelect: document.querySelector("#compare-left-select"),
  rightSelect: document.querySelector("#compare-right-select"),
  swapCompare: document.querySelector("#compare-swap"),
  syncView: document.querySelector("#sync-view"),
  copyCompareLink: document.querySelector("#copy-compare-link"),
  leftLabel: document.querySelector("#compare-left-label"),
  rightLabel: document.querySelector("#compare-right-label"),
  leftLive: document.querySelector("#compare-left-live"),
  rightLive: document.querySelector("#compare-right-live"),
  leftError: document.querySelector("#compare-left-error"),
  rightError: document.querySelector("#compare-right-error"),
  benchmarkBoth: document.querySelector("#benchmark-both"),
  compareNote: document.querySelector("#compare-note"),
  promptText: document.querySelector("#prompt-text"),
  copyPrompt: document.querySelector("#copy-prompt"),
  modalCopyPrompt: document.querySelector("#modal-copy-prompt"),
  addDialog: document.querySelector("#add-dialog"),
  benchmarkOverlay: document.querySelector("#benchmark-overlay"),
  benchmarkStatus: document.querySelector("#benchmark-status"),
  benchmarkDetail: document.querySelector("#benchmark-detail"),
  benchmarkProgress: document.querySelector("#benchmark-progress"),
  toast: document.querySelector("#toast"),
};

let toastTimeout = 0;
let heroViewer;
let leftViewer;
let rightViewer;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function findResult(id) {
  return state.results.find((result) => result.id === id);
}

function getMetrics(result) {
  return state.localBenchmarks.get(result.id) || result.metrics;
}

function formatNumber(value, digits = 1) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : "—";
}

function formatFps(value) {
  return Number.isFinite(value) ? `${formatNumber(value, value >= 100 ? 0 : 1)} fps` : "Not measured";
}

function formatMs(value) {
  return Number.isFinite(value) ? `${formatNumber(value, 2)} ms` : "—";
}

function formatBytes(value) {
  if (!Number.isFinite(value)) return "—";
  return value >= 1024 ? `${(value / 1024).toFixed(1)} KiB` : `${value} B`;
}

function formatTokens(value) {
  return Number.isInteger(value) ? value.toLocaleString("en-US") : "Not captured";
}

function formatCost(usage) {
  if (!Number.isFinite(usage.apiCostUsd)) return usage.billingMode === "subscription" ? "Not exposed" : "Not captured";
  return `$${usage.apiCostUsd.toFixed(usage.apiCostUsd < 0.01 ? 4 : 2)}`;
}

function showToast(message) {
  clearTimeout(toastTimeout);
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  toastTimeout = window.setTimeout(() => elements.toast.classList.remove("visible"), 2400);
}

async function copyText(text, successMessage = "Copied") {
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
  showToast(successMessage);
}

function updateUrl(values = {}) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(values)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  history.replaceState(null, "", url);
}

function statusLabel(result) {
  if (result.validation.state === "failed") return "Render error";
  const unmet = result.validation.unmetRequirements.length;
  if (unmet) return `${unmet} unmet`;
  const advisories = result.validation.warnings.length;
  if (advisories) return `${advisories} ${advisories === 1 ? "advisory" : "advisories"}`;
  if (result.status === "verified") return "Verified";
  if (result.status === "reference") return "Reference";
  return "Unverified";
}

function validationStateClass(result) {
  if (result.validation.state === "failed") return "failed";
  if (result.validation.unmetRequirements.length) return "unmet";
  return result.validation.state;
}

function requirementCell(result) {
  const findings = result.validation.unmetRequirements;
  if (!findings.length) return "None recorded";
  return `${findings.length}: ${findings.map((finding) => finding.requirement).join("; ")}`;
}

function posterPlaceholder() {
  return `
    <div class="poster-placeholder" aria-hidden="true">
      <svg viewBox="0 0 240 130">
        <circle cx="48" cy="92" r="31"></circle>
        <circle cx="192" cy="92" r="31"></circle>
        <path d="M48 92 96 48l32 44H48Zm48-44 96 44m-96-44-20 44m20-44 39 0 57 44M109 42c-7-26 24-38 38-20 8 10 1 22-9 25m-29-5c-29-23-42 19-18 26m47-21 38-12 27 8-31 7"></path>
      </svg>
    </div>`;
}

function renderCards() {
  const query = elements.resultSearch.value.trim().toLowerCase();
  const sort = elements.resultSort.value;
  const results = state.results.filter((result) => {
    const haystack = `${result.model} ${result.provider} ${result.title} ${result.description}`.toLowerCase();
    return haystack.includes(query);
  });

  results.sort((a, b) => {
    if (sort === "fps") return (getMetrics(b).throughputFps ?? -1) - (getMetrics(a).throughputFps ?? -1);
    if (sort === "size") return a.metrics.sourceBytes - b.metrics.sourceBytes;
    if (sort === "model") return a.model.localeCompare(b.model);
    return b.createdAt.localeCompare(a.createdAt);
  });

  elements.emptyState.hidden = results.length > 0;
  elements.resultGrid.innerHTML = results.map((result, index) => {
    const metrics = getMetrics(result);
    const checked = state.selectedIds.includes(result.id);
    const unmetRequirements = result.validation.unmetRequirements;
    const advisories = result.validation.warnings;
    return `
      <article class="result-card" style="--card-accent:${escapeHtml(result.accent || "#16877e")}" data-result-id="${escapeHtml(result.id)}">
        <div class="result-poster">
          ${posterPlaceholder()}
          <span class="poster-index">SDF-${String(index + 1).padStart(3, "0")}</span>
          <span class="poster-state state-${escapeHtml(validationStateClass(result))}">${escapeHtml(statusLabel(result))}</span>
        </div>
        <div class="result-body">
          <div class="result-kicker"><span>${escapeHtml(result.provider)}</span><span>${escapeHtml(result.createdAt)}</span></div>
          <div class="result-title-row">
            <h3>${escapeHtml(result.model)}</h3>
            <label class="compare-check" title="Select ${escapeHtml(result.model)} for comparison">
              <input type="checkbox" data-compare-id="${escapeHtml(result.id)}" ${checked ? "checked" : ""}>
              <span aria-hidden="true"></span> Compare
            </label>
          </div>
          <p class="result-description"><strong>${escapeHtml(result.id)}</strong> · ${escapeHtml(result.title)}. ${escapeHtml(result.description)}</p>
          ${unmetRequirements.length
            ? `<a class="result-requirement-note" href="./result.html?id=${encodeURIComponent(result.id)}#validation"><strong>${unmetRequirements.length} requirements unmet</strong><span>${unmetRequirements.map((finding) => escapeHtml(finding.requirement)).join(" · ")}</span></a>`
            : advisories.length
              ? `<a class="result-requirement-note is-advisory" href="./result.html?id=${encodeURIComponent(result.id)}#validation"><strong>${advisories.length} ${advisories.length === 1 ? "advisory" : "advisories"}</strong><span>${advisories.map((warning) => escapeHtml(warning)).join(" · ")}</span></a>`
              : ""}
          <div class="result-metrics">
            <div><span>Throughput</span><strong>${formatFps(metrics.throughputFps)}</strong></div>
            <div><span>Source</span><strong>${formatBytes(result.metrics.sourceBytes)}</strong></div>
            <div><span>Harness</span><strong>${escapeHtml(result.generationHarness.name)} ${escapeHtml(result.generationHarness.version || "")}</strong></div>
          </div>
          <div class="result-actions">
            <a class="view-result" href="./result.html?id=${encodeURIComponent(result.id)}">Open full run →</a>
            <a href="./result.html?id=${encodeURIComponent(result.id)}#source" data-detail-id="${escapeHtml(result.id)}">Source & record</a>
          </div>
        </div>
      </article>`;
  }).join("");

  elements.resultGrid.querySelectorAll("[data-compare-id]").forEach((input) => {
    input.addEventListener("change", () => toggleCompareSelection(input.dataset.compareId, input.checked));
  });
}

function toggleCompareSelection(id, checked) {
  if (checked) {
    state.selectedIds = [...state.selectedIds.filter((value) => value !== id), id];
    if (state.selectedIds.length > 2) {
      state.selectedIds.shift();
      showToast("Comparison keeps the two most recent selections");
    }
  } else {
    state.selectedIds = state.selectedIds.filter((value) => value !== id);
  }
  renderCards();
  renderCompareTray();
}

function renderCompareTray() {
  elements.compareTray.hidden = state.selectedIds.length === 0;
  elements.openCompare.disabled = state.selectedIds.length !== 2;
  elements.traySelection.innerHTML = state.selectedIds.map((id, index) => {
    const result = findResult(id);
    return `<span class="tray-chip"><span>${index ? "B" : "A"}</span>${escapeHtml(result?.model || id)}</span>`;
  }).join("");
}

async function activateResult(id, scroll = false) {
  const result = findResult(id);
  if (!result) return;
  state.activeId = id;
  updateUrl({ run: id });
  elements.heroDetails.href = `./result.html?id=${encodeURIComponent(id)}`;
  const requirementNote = result.validation.unmetRequirements.length
    ? ` / ${result.validation.unmetRequirements.length} requirements unmet`
    : "";
  elements.heroModel.textContent = `${result.model} / ${result.id}${requirementNote}`;
  elements.heroModel.title = elements.heroModel.textContent;
  elements.heroLoading.hidden = false;
  elements.heroError.hidden = true;
  elements.heroFps.textContent = "— fps";
  try {
    await heroViewer.load(result);
    elements.heroLoading.hidden = true;
  } catch (error) {
    elements.heroLoading.hidden = true;
    elements.heroError.hidden = false;
    elements.heroError.querySelector("span").textContent = error.message;
  }
  if (scroll) {
    document.querySelector("#top").scrollIntoView({ behavior: "smooth" });
    window.setTimeout(() => elements.heroCanvas.focus({ preventScroll: true }), 500);
  }
}

function populateCompareSelects() {
  const options = state.results.map((result) => `<option value="${escapeHtml(result.id)}">${escapeHtml(result.model)} — ${escapeHtml(result.id)}</option>`).join("");
  elements.leftSelect.innerHTML = options;
  elements.rightSelect.innerHTML = options;
}

async function loadComparison(leftId, rightId, shouldScroll = false) {
  const left = findResult(leftId);
  const right = findResult(rightId);
  if (!left || !right || left.id === right.id) {
    showToast("Choose two different results");
    return;
  }
  state.compareLeftId = left.id;
  state.compareRightId = right.id;
  state.selectedIds = [left.id, right.id];
  elements.compareSection.hidden = false;
  elements.leftSelect.value = left.id;
  elements.rightSelect.value = right.id;
  elements.leftLabel.textContent = left.model;
  elements.rightLabel.textContent = right.model;
  elements.leftError.hidden = true;
  elements.rightError.hidden = true;
  updateUrl({ compare: `${left.id},${right.id}` });
  renderCards();
  renderCompareTray();
  updateComparisonTable();

  const loads = [
    leftViewer.load(left).catch((error) => {
      elements.leftError.hidden = false;
      elements.leftError.textContent = error.message;
    }),
    rightViewer.load(right).catch((error) => {
      elements.rightError.hidden = false;
      elements.rightError.textContent = error.message;
    }),
  ];
  await Promise.allSettled(loads);
  if (shouldScroll) elements.compareSection.scrollIntoView({ behavior: "smooth" });
}

function viewsDiffer(a, b) {
  if (!a || !b) return true;
  return Math.abs(a.yaw - b.yaw) > 0.0001
    || Math.abs(a.pitch - b.pitch) > 0.0001
    || Math.abs(a.distance - b.distance) > 0.0001;
}

function synchronizedView(sourceViewer, targetViewer, sourceView) {
  const sourceDefault = sourceViewer.defaultView;
  const targetDefault = targetViewer.defaultView;
  if (!sourceView || !sourceDefault || !targetDefault) return null;
  return {
    yaw: targetDefault.yaw + (sourceView.yaw - sourceDefault.yaw),
    pitch: targetDefault.pitch + (sourceView.pitch - sourceDefault.pitch),
    distance: targetDefault.distance * (sourceView.distance / sourceDefault.distance),
  };
}

function updateComparisonTable() {
  const left = findResult(state.compareLeftId);
  const right = findResult(state.compareRightId);
  if (!left || !right) return;
  const a = getMetrics(left);
  const b = getMetrics(right);
  elements.compareSection.benchmarkResults = { left: a, right: b };
  const comparable = a.environmentKey && b.environmentKey && a.environmentKey === b.environmentKey;

  setMetric("throughput", formatFps(a.throughputFps), formatFps(b.throughputFps), comparable && Number.isFinite(a.throughputFps) && Number.isFinite(b.throughputFps)
    ? `${a.throughputFps >= b.throughputFps ? "A" : "B"} +${Math.abs((a.throughputFps / b.throughputFps - 1) * 100).toFixed(1)}%`
    : "not comparable");
  setMetric("median", formatMs(a.gpuMsMedian), formatMs(b.gpuMsMedian), comparable && Number.isFinite(a.gpuMsMedian) && Number.isFinite(b.gpuMsMedian)
    ? `${a.gpuMsMedian <= b.gpuMsMedian ? "A" : "B"} lower`
    : "not comparable");
  setMetric("p95", formatMs(a.gpuMsP95), formatMs(b.gpuMsP95), comparable && Number.isFinite(a.gpuMsP95) && Number.isFinite(b.gpuMsP95)
    ? `${a.gpuMsP95 <= b.gpuMsP95 ? "A" : "B"} lower`
    : "not comparable");
  setMetric("source", formatBytes(left.metrics.sourceBytes), formatBytes(right.metrics.sourceBytes), `${formatBytes(Math.abs(left.metrics.sourceBytes - right.metrics.sourceBytes))} apart`);
  setMetric("harness", `${left.generationHarness.name} ${left.generationHarness.version || ""}`, `${right.generationHarness.name} ${right.generationHarness.version || ""}`, "metadata");
  setMetric("tokens", formatTokens(left.generationUsage.totalTokens), formatTokens(right.generationUsage.totalTokens), "metadata");
  setMetric("cost", formatCost(left.generationUsage), formatCost(right.generationUsage), "metadata");
  setMetric("requirements", requirementCell(left), requirementCell(right), "reported separately");

  elements.compareNote.textContent = comparable
    ? `Comparable results: ${a.timingMethod}, ${typeof a.environment === "string" ? a.environment : a.environment.gpu}, 960 × 540. Measurements ran serially.`
    : "Run the serial local test to produce a fair same-device comparison. The previews pause while each artifact is measured alone.";
}

function setMetric(name, left, right, delta) {
  const row = document.querySelector(`[data-metric="${name}"]`);
  if (!row) return;
  const cells = row.querySelectorAll(":scope > strong, :scope > em");
  cells[0].textContent = left;
  cells[1].textContent = right;
  cells[2].textContent = delta;
}

function showBenchmark(status, detail, progress) {
  elements.benchmarkOverlay.hidden = false;
  elements.benchmarkStatus.textContent = status;
  elements.benchmarkDetail.textContent = detail;
  elements.benchmarkProgress.style.width = `${Math.round(progress * 100)}%`;
}

function updateBenchmarkProgress(progress, detail) {
  elements.benchmarkStatus.textContent = detail;
  elements.benchmarkDetail.textContent = "Do not switch tabs; timing pauses the live preview.";
  elements.benchmarkProgress.style.width = `${Math.round(progress * 100)}%`;
}

function hideBenchmark() {
  elements.benchmarkOverlay.hidden = true;
}

async function benchmarkHero() {
  const result = findResult(state.activeId);
  if (!result || !heroViewer.controller) return;
  showBenchmark(`Measuring ${result.model}`, "Warming twelve canonical views…", 0.02);
  elements.heroBenchmark.disabled = true;
  try {
    const metrics = await heroViewer.benchmark(updateBenchmarkProgress);
    state.localBenchmarks.set(result.id, metrics);
    renderCards();
    updateComparisonTable();
    showToast(`${result.model}: ${formatFps(metrics.throughputFps)} (${metrics.timingMethod})`);
  } catch (error) {
    showToast(`Benchmark failed: ${error.message}`);
  } finally {
    elements.heroBenchmark.disabled = false;
    hideBenchmark();
  }
}

async function benchmarkComparison() {
  const left = findResult(state.compareLeftId);
  const right = findResult(state.compareRightId);
  if (!left || !right || !leftViewer.controller || !rightViewer.controller) return;
  elements.benchmarkBoth.disabled = true;
  leftViewer.setPaused(true);
  rightViewer.setPaused(true);
  showBenchmark(`Measuring A · ${left.model}`, "The B preview is paused to avoid GPU contention.", 0.01);
  try {
    const a = await leftViewer.benchmark((progress, detail) => updateBenchmarkProgress(progress * 0.48, `A · ${detail}`), { resume: false });
    state.localBenchmarks.set(left.id, a);
    showBenchmark(`Measuring B · ${right.model}`, "A is complete. B now runs alone on the same device.", 0.51);
    const b = await rightViewer.benchmark((progress, detail) => updateBenchmarkProgress(0.5 + progress * 0.48, `B · ${detail}`), { resume: false });
    state.localBenchmarks.set(right.id, b);
    renderCards();
    updateComparisonTable();
    showToast("Serial local comparison complete");
  } catch (error) {
    showToast(`Comparison failed: ${error.message}`);
  } finally {
    leftViewer.setPaused(false);
    rightViewer.setPaused(false);
    elements.benchmarkBoth.disabled = false;
    hideBenchmark();
  }
}

function setupViewers() {
  heroViewer = new ArtifactViewer(elements.heroCanvas, {
    onFps: (fps) => { elements.heroFps.textContent = `${Math.round(fps)} fps`; },
    onView: (view) => {
      elements.heroView.textContent = `yaw ${(view.yaw * 180 / Math.PI).toFixed(1)}° · pitch ${(view.pitch * 180 / Math.PI).toFixed(1)}° · zoom ${view.distance.toFixed(2)}`;
    },
    onError: (error) => {
      elements.heroError.hidden = false;
      elements.heroError.querySelector("span").textContent = error.message;
    },
  });

  leftViewer = new ArtifactViewer(document.querySelector("#compare-left-canvas"), {
    onFps: (fps) => { elements.leftLive.textContent = `${Math.round(fps)} fps live`; },
    onInteraction: () => { state.compareMaster = "left"; },
    onView: (view) => {
      const targetView = synchronizedView(leftViewer, rightViewer, view);
      if (elements.syncView.checked && state.compareMaster === "left" && targetView && viewsDiffer(targetView, rightViewer.getView())) rightViewer.setView(targetView);
    },
    onError: (error) => { elements.leftError.hidden = false; elements.leftError.textContent = error.message; },
  });

  rightViewer = new ArtifactViewer(document.querySelector("#compare-right-canvas"), {
    onFps: (fps) => { elements.rightLive.textContent = `${Math.round(fps)} fps live`; },
    onInteraction: () => { state.compareMaster = "right"; },
    onView: (view) => {
      const targetView = synchronizedView(rightViewer, leftViewer, view);
      if (elements.syncView.checked && state.compareMaster === "right" && targetView && viewsDiffer(targetView, leftViewer.getView())) leftViewer.setView(targetView);
    },
    onError: (error) => { elements.rightError.hidden = false; elements.rightError.textContent = error.message; },
  });
}

function setupEvents() {
  elements.resultSearch.addEventListener("input", renderCards);
  elements.resultSort.addEventListener("change", renderCards);
  elements.heroReset.addEventListener("click", () => heroViewer.resetView());
  elements.heroPause.addEventListener("click", () => {
    const paused = elements.heroPause.getAttribute("aria-pressed") !== "true";
    elements.heroPause.setAttribute("aria-pressed", String(paused));
    elements.heroPause.setAttribute("aria-label", paused ? "Resume preview" : "Pause preview");
    heroViewer.setPaused(paused);
  });
  elements.heroBenchmark.addEventListener("click", benchmarkHero);
  elements.clearCompare.addEventListener("click", () => {
    state.selectedIds = [];
    renderCards();
    renderCompareTray();
  });
  elements.openCompare.addEventListener("click", () => loadComparison(state.selectedIds[0], state.selectedIds[1], true));
  elements.leftSelect.addEventListener("change", () => loadComparison(elements.leftSelect.value, elements.rightSelect.value));
  elements.rightSelect.addEventListener("change", () => loadComparison(elements.leftSelect.value, elements.rightSelect.value));
  elements.swapCompare.addEventListener("click", () => loadComparison(state.compareRightId, state.compareLeftId));
  elements.syncView.addEventListener("change", () => {
    if (elements.syncView.checked) {
      const source = state.compareMaster === "left" ? leftViewer : rightViewer;
      const target = state.compareMaster === "left" ? rightViewer : leftViewer;
      const view = synchronizedView(source, target, source.getView());
      if (view) target.setView(view);
    }
  });
  elements.copyCompareLink.addEventListener("click", () => copyText(window.location.href, "Comparison link copied"));
  elements.benchmarkBoth.addEventListener("click", benchmarkComparison);
  elements.copyPrompt.addEventListener("click", () => copyText(state.prompt, "Canonical prompt copied"));
  elements.modalCopyPrompt.addEventListener("click", () => copyText(state.prompt, "Canonical prompt copied"));
  document.querySelectorAll("[data-open-add]").forEach((button) => button.addEventListener("click", () => {
    elements.addDialog.showModal();
    document.body.classList.add("modal-open");
  }));
  document.querySelector("[data-copy-command]").addEventListener("click", () => copyText("npm run new-result -- my-model-run-01", "Scaffold command copied"));
  for (const dialog of [elements.addDialog]) {
    dialog.addEventListener("close", () => document.body.classList.remove("modal-open"));
    dialog.addEventListener("click", (event) => {
      const rect = dialog.getBoundingClientRect();
      const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (!inside) dialog.close();
    });
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      heroViewer.setPaused(true);
      leftViewer.setPaused(true);
      rightViewer.setPaused(true);
    } else {
      const heroPausedByButton = elements.heroPause.getAttribute("aria-pressed") === "true";
      if (!heroPausedByButton) heroViewer.setPaused(false);
      if (!elements.compareSection.hidden) {
        leftViewer.setPaused(false);
        rightViewer.setPaused(false);
      }
    }
  });
}

async function main() {
  setupViewers();
  setupEvents();
  try {
    const [results, prompt] = await Promise.all([loadResults(), loadPrompt()]);
    state.results = results;
    state.prompt = prompt.trimEnd();
    elements.resultCount.textContent = String(results.length).padStart(2, "0");
    elements.promptText.textContent = state.prompt;
    populateCompareSelects();
    renderCards();

    const url = new URL(window.location.href);
    const requestedActive = url.searchParams.get("run");
    const initial = findResult(requestedActive) || results[0];
    await activateResult(initial.id);

    const requestedCompare = url.searchParams.get("compare")?.split(",");
    if (requestedCompare?.length === 2 && requestedCompare[0] !== requestedCompare[1]) {
      await loadComparison(requestedCompare[0], requestedCompare[1]);
    }
  } catch (error) {
    elements.heroLoading.hidden = true;
    elements.heroError.hidden = false;
    elements.heroError.querySelector("span").textContent = error.message;
    elements.resultGrid.innerHTML = `<p class="empty-state">Could not load benchmark data: ${escapeHtml(error.message)}</p>`;
    console.error(error);
  }
}

main();
