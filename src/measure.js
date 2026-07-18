import { ArtifactViewer } from "./viewer.js";

const canvas = document.querySelector("#measurement-canvas");
const statusNode = document.querySelector("#measurement-status");
const params = new URL(window.location.href).searchParams;
const id = params.get("id") || "";
const trialCount = Math.max(1, Math.min(10, Number(params.get("trials")) || 3));
const autostart = params.get("autostart") === "1";

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function aggregate(trials) {
  const first = trials[0];
  const gpuMsMedian = median(trials.map((trial) => trial.gpuMsMedian));
  return {
    initMs: first.initMs,
    gpuMsMedian,
    gpuMsP95: median(trials.map((trial) => trial.gpuMsP95)),
    throughputFps: 1000 / gpuMsMedian,
    timingMethod: first.timingMethod,
    environment: first.environment,
    environmentKey: first.environmentKey,
    profile: first.profile,
    sampleCount: first.sampleCount,
    trials: trials.length,
    measuredAt: new Date().toISOString(),
  };
}

const state = {
  status: "initializing",
  id,
  trialCount,
  initialView: null,
  trials: [],
  result: null,
  error: null,
  setView: null,
};
globalThis.__pelicanMeasurement = state;

if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
  state.status = "error";
  state.error = "A valid run id is required.";
  statusNode.textContent = state.error;
  throw new Error(state.error);
}

let viewer;
try {
  const artifactUrl = new URL("../data/artifacts/" + id + ".js", import.meta.url).href;
  viewer = new ArtifactViewer(canvas, {
    onError: (error) => {
      state.error = error.message;
      statusNode.textContent = error.message;
    },
  });
  await viewer.load({ id, artifactUrl });
  viewer.stop();
  state.initialView = { ...viewer.getView() };
  state.setView = (yaw, pitch, distance) => {
    viewer.setView({ yaw, pitch, distance });
    viewer.controller.render(0);
    return { ...viewer.getView() };
  };
  state.status = "ready";
  statusNode.textContent = "Artifact ready: " + id;

  if (autostart) {
    state.status = "measuring";
    for (let index = 0; index < trialCount; index += 1) {
      const metrics = await viewer.benchmark((progress, detail) => {
        statusNode.textContent = "Trial " + (index + 1) + "/" + trialCount
          + " - " + Math.round(progress * 100) + "% - " + detail;
      }, { resume: false });
      state.trials.push(metrics);
    }
    state.result = aggregate(state.trials);
    state.setView(state.initialView.yaw, state.initialView.pitch, state.initialView.distance);
    state.status = "complete";
    statusNode.textContent = JSON.stringify(state.result, null, 2);
  }
} catch (error) {
  state.status = "error";
  state.error = error instanceof Error ? error.message : String(error);
  statusNode.textContent = state.error;
}
