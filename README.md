<p align="center">
  <img src="assets/favicon.svg" width="88" height="88" alt="Pelican SDF logo">
</p>

# Pelican SDF

**One bird. Two wheels. Infinite signed distances.**

Pelican SDF is an open, end-to-end benchmark for model-generated interactive 3D
art. Every model gets the same byte-exact prompt and one blank canvas. It must
build its own SDF primitives, ray marcher, camera, lighting, materials, orbit
controls, and close-up zoom. The website preserves first responses, renders them
live, compares any two, and measures same-device throughput without pretending
that speed and artistry are one score.

The idea extends [Simon Willison's pelican-on-a-bicycle SVG
benchmark](https://simonwillison.net/2024/Oct/25/pelicans-on-a-bicycle/) into a
harder, inspectable 3D task.

## What is here

- A lightweight, artifact-free landing page and a separate results catalog
- A polished dependency-free results site with live WebGL2 artifacts
- A permanent page for every run with its viewer, metrics, provenance, prompt, and complete source
- A versioned, byte-exact one-shot prompt in [`benchmark/prompt.txt`](benchmark/prompt.txt)
- Drag, wheel, keyboard, and model-authored camera inspection
- A shareable, synchronized any-two comparison view
- Serial local A/B benchmarking with GPU timer queries when available
- Explicit generation-harness metadata, including Codex CLI version/surface
- Provider-reported token usage, billing mode, and actual or API-equivalent cost metadata
- JSON result records, artifact hashes, schema, and repository validation
- 42 one-shot runs across 15 model identifiers, including matched five-effort Sol and Claude sweeps
- SDF-rendered catalog thumbnails generated from each renderable first response
- MIT licensing and contribution/security guidance

No package install or build step is required. The site uses browser-native ES
modules, WebGL2, and a tiny Node static server.

## Run locally

Requirements: Node.js 20 or newer and a browser with WebGL2.

```bash
npm start
```

Open <http://127.0.0.1:4173>. The landing page loads no run modules; choose
**Browse benchmark runs** to open the interactive catalog at `/results.html`.
Run all repository checks with:

```bash
npm test
```

Published runs have shareable URLs such as
`result.html?id=gpt-5-6-sol-run-01`; the result cards and active viewer link to
these full records directly.

The site can also be hosted directly from the repository root on GitHub Pages,
Cloudflare Pages, Netlify, or any static file server. It uses relative URLs and
needs no server-side routing.

## The thin-canvas contract

The host gives a submission only an `HTMLCanvasElement`. A result exports:

```js
export function createPelicanSdf(canvas) {
  // The model implements WebGL2, shaders, SDFs, camera, light, and controls.
  return {
    render(timeSeconds) {},
    setView(yaw, pitch, distance) {},
    getView() { return { yaw, pitch, distance }; },
    dispose() {},
  };
}
```

Those four lifecycle methods make deterministic inspection and uncapped timing
possible; they do not provide geometry or rendering help. Read the full contract
in [`benchmark/PROMPT.md`](benchmark/PROMPT.md).

## Benchmark integrity

The benchmark tells models directly that performance will be measured. The
canonical local profile uses a 960 × 540 canvas and multiple fixed views. It
prefers `EXT_disjoint_timer_query_webgl2`, reports equivalent throughput as
`1000 / median GPU ms`, and falls back to clearly labeled `gl.finish()` wall-clock
estimates.

FPS is never a universal model score:

- Stored deltas are shown only for matching environment fingerprints.
- A local A/B run pauses both previews and measures A, then B, serially.
- Canvas resizing, low internal resolution, blank output, or unchanged camera
  views are recorded as unmet requirements—not performance wins.
- Visual review is blind, multi-angle, and reported separately.
- Rendered artifacts remain results even when individual requirements are unmet;
  those requirements and their evidence stay visible.

The detailed rules and limitations are in
[`benchmark/METHODOLOGY.md`](benchmark/METHODOLOGY.md).

## Repository layout

```text
benchmark/                 versioned prompt, schema, and methodology
data/artifacts/             untouched generated ES modules
data/raw/                   raw responses, event streams, and run receipts
data/results/               provenance and measurement records
data/manifest.json          published result index
assets/thumbnails/          generated 480×270 previews of renderable SDF runs
index.html                  static landing page; no result code is loaded
results.html                interactive catalog and comparison lab
src/                        website, viewer host, and benchmark runner
scripts/                    server, scaffold, hashing, and validation
test/                       repository contract tests
```

## Add a result

Generate with the exact prompt in a fresh conversation and preserve the first
response—even if it fails.

For a reproducible Codex CLI trial, provide an immutable run id, exact model
slug, and reasoning effort:

```bash
npm run eval:run -- provider-model-effort-run-01 gpt-model-slug medium
npm run eval:ingest -- provider-model-effort-run-01
npm run eval:measure -- provider-model-effort-run-01
```

`eval:run` sends the byte-exact `benchmark/prompt.txt` to a fresh, ephemeral,
read-only invocation with user configuration and project rules disabled. It
refuses to overwrite a run and preserves `response.txt`, `events.jsonl`,
`stderr.txt`, and `receipt.json` under `data/raw/<id>/`. `eval:ingest` verifies
the receipt and permits only recorded transport normalization; it creates an
unpublished draft artifact and result record. `eval:measure` runs three serial
GPU trials and captures canonical and close views under `artifacts/evals/` for
review. Review the generated record and screenshots before adding it to the
manifest.

Codex JSON events expose input, cached-input, reasoning, output, and total token
counts. For GPT-5.6 Sol, the runner also calculates the standard API-equivalent
cost using OpenAI's published rates: `$5/M` uncached input, `$0.50/M` cached
input, and `$30/M` output:
`((input - cached) × 5 + cached × 0.5 + output × 30) / 1,000,000`.
The receipt cites the [official model pricing
page](https://developers.openai.com/api/docs/models/gpt-5.6-sol) and labels the
value as an estimate because the benchmark invocation itself uses a Codex
subscription. Recalculate a stored run with `npm run eval:price -- <run-id>`.

After measuring and publishing a result in the manifest, generate its card image
from the SDF with `npm run thumbnails -- <run-id>`; omit the id to regenerate
all renderable runs.

For another harness, scaffold the record manually:

```bash
npm run new-result -- provider-model-run-01
```

Replace the artifact stub with the untouched output, fill every `TODO`, record
the generation harness, and update byte/hash fields:

```bash
npm run hash -- data/artifacts/provider-model-run-01.js
```

Add the result JSON path to `data/manifest.json`, run `npm test`, inspect every
view and close zoom in a browser, and open a pull request. See
[`CONTRIBUTING.md`](CONTRIBUTING.md) for the full provenance and review checklist.

## Evaluation caveat

The 42 included entries were produced one-shot through Codex CLI, Claude Code
CLI, or the pi SDK with OpenRouter. Raw first responses, available event streams,
and receipts are retained; two early seed entries predate the receipted runner
and explicitly keep their missing usage fields. Renderable runs include
same-profile measurements, while compilation failures remain published with the
failure evidence and no fabricated timing or thumbnail. Results remain
`unverified` until provenance is independently reproduced. Blind visual scores
stay `null`; the repository never fills gaps with plausible guesses.

## Security

Result artifacts are executable JavaScript and GPU shader code. The public site
loads only curated files committed to this repository; it does not execute pasted
or remotely hosted submissions. Read [`SECURITY.md`](SECURITY.md) before changing
that boundary.

## License

Pelican SDF is available under the [MIT License](https://github.com/AzatJalilov/PelicanSdf/blob/main/LICENSE). Benchmark results keep
their provenance metadata; contributors must have the right to publish submitted
artifacts.
