const BENCHMARK_WIDTH = 960;
const BENCHMARK_HEIGHT = 540;
const MAX_PREVIEW_DPR = 1.5;

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))];
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function describeEnvironment(gl) {
  let gpu = "WebGL2 renderer hidden by browser";
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  if (debug) {
    gpu = gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) || gpu;
  }
  return {
    gpu,
    browser: navigator.userAgent,
    platform: navigator.userAgentData?.platform || navigator.platform || "unknown platform",
    resolution: [BENCHMARK_WIDTH, BENCHMARK_HEIGHT],
  };
}

function verifyController(controller) {
  const methods = ["render", "setView", "getView", "dispose"];
  for (const method of methods) {
    if (typeof controller?.[method] !== "function") {
      throw new Error(`Artifact controller is missing ${method}().`);
    }
  }
  const view = controller.getView();
  if (![view?.yaw, view?.pitch, view?.distance].every(Number.isFinite)) {
    throw new Error("Artifact getView() did not return finite yaw, pitch, and distance.");
  }
}

export class ArtifactViewer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.onFps = options.onFps || (() => {});
    this.onView = options.onView || (() => {});
    this.onError = options.onError || (() => {});
    this.onInteraction = options.onInteraction || (() => {});
    this.controller = null;
    this.result = null;
    this.defaultView = null;
    this.initMs = null;
    this.running = false;
    this.paused = false;
    this.benchmarking = false;
    this.animationFrame = 0;
    this.lastFrameAt = 0;
    this.fpsWindowStarted = 0;
    this.fpsFrames = 0;
    this.loadToken = 0;
    this.contextLost = false;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);

    for (const event of ["pointerdown", "wheel", "keydown", "touchstart"]) {
      canvas.addEventListener(event, () => this.onInteraction(this), { passive: true });
    }
    canvas.addEventListener("webglcontextlost", () => {
      this.contextLost = true;
      this.stop();
      this.onError(new Error("The WebGL context was lost."));
    });
  }

  resize() {
    if (this.benchmarking) return;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_PREVIEW_DPR);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  async load(result) {
    const token = ++this.loadToken;
    this.stop();
    this.disposeController();
    this.result = result;
    this.contextLost = false;
    this.resize();

    try {
      const module = await import(result.artifactUrl);
      if (token !== this.loadToken) return;
      if (typeof module.createPelicanSdf !== "function") {
        throw new Error("Artifact does not export createPelicanSdf(canvas)." );
      }
      const started = performance.now();
      const controller = module.createPelicanSdf(this.canvas);
      this.initMs = performance.now() - started;
      verifyController(controller);
      if (token !== this.loadToken) {
        controller.dispose();
        return;
      }
      this.controller = controller;
      this.defaultView = { ...controller.getView() };
      controller.render(0);
      this.start();
    } catch (error) {
      this.stop();
      this.onError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  start() {
    if (!this.controller || this.contextLost) return;
    this.running = true;
    this.paused = false;
    this.lastFrameAt = performance.now();
    this.fpsWindowStarted = this.lastFrameAt;
    this.fpsFrames = 0;
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = requestAnimationFrame((time) => this.tick(time));
  }

  tick(time) {
    if (!this.running || this.paused || this.benchmarking || !this.controller) return;
    try {
      this.controller.render(time / 1000);
      this.fpsFrames += 1;
      const elapsed = time - this.fpsWindowStarted;
      if (elapsed >= 650) {
        this.onFps((this.fpsFrames * 1000) / elapsed);
        this.fpsFrames = 0;
        this.fpsWindowStarted = time;
      }
      const view = this.controller.getView();
      this.onView(view);
    } catch (error) {
      this.stop();
      this.onError(error instanceof Error ? error : new Error(String(error)));
      return;
    }
    this.animationFrame = requestAnimationFrame((nextTime) => this.tick(nextTime));
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.animationFrame);
  }

  setPaused(paused) {
    this.paused = paused;
    if (paused) {
      cancelAnimationFrame(this.animationFrame);
      return;
    }
    if (this.controller && !this.running) this.running = true;
    this.fpsWindowStarted = performance.now();
    this.fpsFrames = 0;
    this.animationFrame = requestAnimationFrame((time) => this.tick(time));
  }

  resetView() {
    if (!this.controller || !this.defaultView) return;
    const { yaw, pitch, distance } = this.defaultView;
    this.controller.setView(yaw, pitch, distance);
  }

  setView(view) {
    if (!this.controller) return;
    this.controller.setView(view.yaw, view.pitch, view.distance);
  }

  getView() {
    return this.controller?.getView() || null;
  }

  async benchmark(onProgress = () => {}, options = {}) {
    if (!this.controller) throw new Error("Artifact is not ready.");
    const resume = options.resume ?? true;
    const wasRunning = this.running && !this.paused;
    this.stop();
    this.benchmarking = true;

    const previousSize = [this.canvas.width, this.canvas.height];
    const previousView = { ...this.controller.getView() };
    const benchmarkDistance = clamp(this.defaultView?.distance || previousView.distance, 2.2, 10);
    const views = [
      ...Array.from({ length: 8 }, (_, index) => ({
        yaw: (index / 8) * Math.PI * 2,
        pitch: 0.08,
        distance: benchmarkDistance,
      })),
      ...Array.from({ length: 4 }, (_, index) => ({
        yaw: (index / 4) * Math.PI * 2 + Math.PI / 4,
        pitch: 0.42,
        distance: benchmarkDistance,
      })),
    ];

    this.canvas.width = BENCHMARK_WIDTH;
    this.canvas.height = BENCHMARK_HEIGHT;
    const gl = this.canvas.getContext("webgl2");
    if (!gl) throw new Error("Artifact did not retain a WebGL2 context.");

    let result;
    try {
      onProgress(0.05, "Warming twelve canonical views…");
      for (let pass = 0; pass < 2; pass += 1) {
        for (let index = 0; index < views.length; index += 1) {
          const view = views[index];
          this.controller.setView(view.yaw, view.pitch, view.distance);
          this.controller.render(index / views.length);
          if (this.canvas.width !== BENCHMARK_WIDTH || this.canvas.height !== BENCHMARK_HEIGHT) {
            throw new Error("Artifact resized the canonical benchmark canvas.");
          }
        }
      }
      gl.finish();

      const extension = gl.getExtension("EXT_disjoint_timer_query_webgl2");
      if (extension) {
        result = await this.benchmarkWithGpuQueries(gl, extension, views, onProgress);
      } else {
        result = await this.benchmarkWithFinish(gl, views, onProgress);
      }
      const environment = describeEnvironment(gl);
      result = {
        ...result,
        initMs: this.initMs,
        environment,
        environmentKey: `${environment.gpu}|${environment.browser}|${BENCHMARK_WIDTH}x${BENCHMARK_HEIGHT}`,
        measuredAt: new Date().toISOString(),
        profile: "pelican-canvas-960x540-v1",
      };
      onProgress(1, "Measurement complete.");
      return result;
    } finally {
      try {
        this.controller.setView(previousView.yaw, previousView.pitch, previousView.distance);
      } catch {
        // A failed artifact should not prevent the harness from restoring the canvas.
      }
      this.canvas.width = previousSize[0];
      this.canvas.height = previousSize[1];
      this.benchmarking = false;
      if (resume && wasRunning) this.start();
    }
  }

  async benchmarkWithGpuQueries(gl, extension, views, onProgress) {
    const queries = [];
    const samples = 36;
    for (let index = 0; index < samples; index += 1) {
      const view = views[index % views.length];
      this.controller.setView(view.yaw, view.pitch, view.distance);
      const query = gl.createQuery();
      gl.beginQuery(extension.TIME_ELAPSED_EXT, query);
      this.controller.render(index / samples);
      gl.endQuery(extension.TIME_ELAPSED_EXT);
      queries.push(query);
      if ((index + 1) % 6 === 0) {
        onProgress(0.2 + ((index + 1) / samples) * 0.45, `Timing GPU frame ${index + 1} of ${samples}…`);
        await nextFrame();
      }
    }
    gl.flush();

    const started = performance.now();
    const values = [];
    const pending = new Set(queries);
    while (pending.size) {
      if (performance.now() - started > 15000) {
        for (const query of queries) gl.deleteQuery(query);
        throw new Error("GPU timer queries did not complete within 15 seconds.");
      }
      if (gl.getParameter(extension.GPU_DISJOINT_EXT)) {
        for (const query of queries) gl.deleteQuery(query);
        throw new Error("GPU timing became disjoint; discard this run and try again.");
      }
      for (const query of [...pending]) {
        if (gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) {
          values.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6);
          pending.delete(query);
          gl.deleteQuery(query);
        }
      }
      onProgress(0.68 + (1 - pending.size / samples) * 0.27, "Collecting GPU timer queries…");
      if (pending.size) await nextFrame();
    }

    const sorted = values.sort((a, b) => a - b);
    const gpuMsMedian = median(sorted);
    return {
      timingMethod: "gpu-query",
      gpuMsMedian,
      gpuMsP95: percentile(sorted, 0.95),
      throughputFps: 1000 / gpuMsMedian,
      sampleCount: sorted.length,
    };
  }

  async benchmarkWithFinish(gl, views, onProgress) {
    const batchTimes = [];
    const batchCount = 7;
    const drawsPerBatch = 12;
    for (let batch = 0; batch < batchCount; batch += 1) {
      const started = performance.now();
      for (let index = 0; index < drawsPerBatch; index += 1) {
        const view = views[(batch * drawsPerBatch + index) % views.length];
        this.controller.setView(view.yaw, view.pitch, view.distance);
        this.controller.render((batch * drawsPerBatch + index) / (batchCount * drawsPerBatch));
      }
      gl.finish();
      batchTimes.push((performance.now() - started) / drawsPerBatch);
      onProgress(0.2 + ((batch + 1) / batchCount) * 0.75, `Timing synchronized batch ${batch + 1} of ${batchCount}…`);
      await nextFrame();
    }
    const sorted = batchTimes.sort((a, b) => a - b);
    const gpuMsMedian = median(sorted);
    return {
      timingMethod: "wall-clock-finish",
      gpuMsMedian,
      gpuMsP95: percentile(sorted, 0.95),
      throughputFps: 1000 / gpuMsMedian,
      sampleCount: batchCount * drawsPerBatch,
    };
  }

  disposeController() {
    if (!this.controller) return;
    try {
      this.controller.dispose();
    } catch {
      // Disposal is best effort when changing untrusted benchmark artifacts.
    }
    this.controller = null;
  }

  dispose() {
    this.stop();
    this.disposeController();
    this.resizeObserver.disconnect();
  }
}
