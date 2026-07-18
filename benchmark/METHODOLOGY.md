# Benchmark methodology

Pelican SDF is an end-to-end generation benchmark. A model receives a blank
canvas—not a geometry kit. It owns the SDFs, ray marcher, camera, lighting,
materials, and close-inspection controls. The host owns only sizing, calls to the
small lifecycle API in [`PROMPT.md`](./PROMPT.md), and measurement.

That choice makes the benchmark broad and creatively useful. It also means FPS
can be gamed by drawing less. Pelican SDF therefore reports performance beside
resolution, validity, visual evidence, and coverage; it never treats FPS alone
as a quality score.

## Generation protocol

1. Start a fresh text-only conversation.
2. Send the byte-exact [`prompt.txt`](./prompt.txt) verbatim in one turn.
3. Do not repair, re-prompt, or hand-edit the response. Removing Markdown fences
   is permitted only as a recorded normalization.
4. Save the raw response, normalized module, exact model identifier, provider,
   date, decoding settings, and prompt version.
5. Compile and run the module in a disposable browser profile before review.

The primary track is one-shot. Repaired or best-of-N outputs belong to separately
named tracks and must not be mixed into the primary table.

## Generation usage and cost

Each generation trial records provider-reported input, cached-input, reasoning,
output, and total tokens when those fields exist, plus the billing mode and
per-invocation API cost in USD. A usage receipt or harness log is the preferred
source. Do not estimate model tokens from characters or infer cost from a public
price table after the fact without preserving all billing inputs. Subscription or
local access with no per-call price uses `apiCostUsd: null`, never zero. Missing
token splits are also `null` with a note explaining why they were unavailable.

## Artifact contract

An artifact is a reviewed, self-contained JavaScript module. The evaluator gives
it one canvas and calls `createPelicanSdf(canvas)`. The artifact must implement
rendering and controls, then expose `render`, `setView`, `getView`, and `dispose`.
No benchmark SDF primitives, shader template, camera, lighting, or controls are
injected into it.

Repository artifacts are executable code. Pull requests are reviewed before
merge; the public site does not execute arbitrary pasted submissions.

## Canonical performance protocol

Profile `pelican-canvas-960x540-v1` uses a 960 × 540 drawing buffer, DPR 1, and
the canvas context created by the artifact. Compilation and setup are timed but
excluded from frame throughput.

The host uses twelve fixed views: eight yaw angles at a level pitch and four at
a raised pitch. It warms every view twice, then times 36 synchronous `render()`
calls per trial. Published fixture metrics use three serial trials and store the
median of each reported trial statistic.
When `EXT_disjoint_timer_query_webgl2` is available, GPU timer queries provide
median and p95 GPU frame time. Equivalent throughput is `1000 / median GPU ms`.
If timer queries are unavailable, batches are synchronized with `gl.finish()`
and labeled **wall-clock estimate**; these results do not share a leaderboard
with GPU-query results.

Before and after every frame, the host verifies that the drawing buffer remains
960 × 540. Trials are rejected after WebGL errors, context loss, disjoint timer
queries, canvas resizing, or non-finite timing.

Published runs include browser, OS, GPU renderer, backend, canvas dimensions,
profile version, timing method, warm-up/sample counts, and date. Performance
deltas are shown only for matching environment fingerprints. Side-by-side live
FPS is diagnostic because two canvases contend for the GPU.

## Validity and anti-shortcut checks

Automated checks cannot prove artistic success, but they make empty or degraded
renderers visible:

- module contract, byte limit, and banned-API checks
- clean initialization, deterministic frames, and no canvas resizing
- screenshots from all canonical views and three close zoom levels
- non-empty pixel coverage and variance
- full-resolution edge-energy diagnostic to expose internal upscaling
- frame-difference check after camera changes
- WebGL error and context-loss monitoring
- manual confirmation that orbit, wheel/pinch zoom, and keyboard controls work

Runtime failures remain in the dataset. They are benchmark results, not records
to hide.

Validation reporting separates the artifact's overall runtime outcome from
benchmark compliance:

- `passed` means the artifact rendered and no findings were recorded.
- `warnings` means the artifact rendered, with advisories and/or explicitly
  listed `unmetRequirements`.
- `failed` is reserved for a contract, compilation, or runtime error that
  prevents an inspectable render.

Every unmet requirement names the requirement and records concrete evidence. It
does not erase the source, performance measurements, or the result itself.

## Visual rubric

Three reviewers, blind to model identity and performance, score 0–5 for:

- **Readability** — unmistakably a pelican riding a bicycle
- **Completeness** — requested anatomy and bicycle parts are present
- **Coherence** — contacts, pose, depth, and proportions work from many angles
- **Craft** — appealing silhouette, materials, lighting, and details
- **Inspectability** — close zoom remains legible and controls are useful

The site stores medians per dimension. These are subjective judgments and remain
separate from objective performance and validity metrics. There is no composite
“best model” score.

## Result states

- `reference`: a sample artifact for the harness, not a model claim
- `unverified`: provenance exists but has not been independently reproduced
- `verified`: generation artifact and measurements were independently checked

The published seed artifacts are one-shot model-eval entries. They retain their
requested model, generation harness, and available receipts, but remain
`unverified` until independently reproduced.
