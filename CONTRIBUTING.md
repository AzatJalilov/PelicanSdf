# Contributing to Pelican SDF

Thanks for helping make model-generated graphics easier to inspect and compare.
Contributions can add benchmark results, improve the evaluator/site, or propose a
new version of the protocol. Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before opening a result pull request

1. Start a fresh text-only conversation.
2. Send [`benchmark/prompt.txt`](benchmark/prompt.txt) byte-for-byte, with no
   examples, images, tools, or repair prompt.
3. Preserve the complete first response. Do not fix syntax, shader math, controls,
   or composition. Removing accidental Markdown fences is allowed only when the
   normalization is recorded.
4. Record the exact model, provider, date, decoding parameters, and generation
   harness. A harness is the surface around the model—API client, Codex CLI,
   chat application, agent runtime, or other orchestration. Include its name,
   version, surface, sandbox, and relevant system context when known.
5. Save the provider's token-usage receipt and per-invocation API cost. Record
   input, cached-input, reasoning, output, and total tokens when exposed. State
   whether billing was API-metered, subscription, or local. For subscription
   runs, an API-equivalent estimate may be recorded only from captured token
   counts and a cited published price; label it as an estimate. Otherwise the
   unavailable per-call price is `null`, not `$0`.
6. Never guess missing metadata or benchmark measurements. Use `null` and explain
   why usage or cost was unavailable.

The primary track is one-shot. Repaired and best-of-N submissions need a distinct,
versioned track before they can be merged.

## Scaffold and publish a result

The repository includes a reproducible Codex CLI path. Use an immutable id, an
exact model slug, and an explicit supported reasoning effort:

```bash
npm run eval:run -- provider-model-effort-run-01 gpt-model-slug medium
npm run eval:ingest -- provider-model-effort-run-01
npm run eval:measure -- provider-model-effort-run-01
npm run thumbnails -- provider-model-effort-run-01
```

The runner reads `benchmark/prompt.txt` as bytes, starts a fresh ephemeral
read-only invocation with user configuration and project rules disabled, and
refuses to overwrite existing raw evidence. It writes the complete response,
JSONL event stream, stderr, and a receipt containing prompt/response hashes,
harness settings, timings, usage, and billing mode to `data/raw/<id>/`.

Ingestion verifies both hashes and allows only explicitly recorded BOM, wrapping
Markdown-fence, CRLF, or trailing-LF normalization. It never repairs generated
code. Measurement writes three-trial metrics and inspection images to
`artifacts/evals/<id>/`; review those outputs and transfer the accepted metrics
and validation findings into the result record before publishing it.

For GPT-5.6 Sol, the runner captures Codex JSON token usage and records an
API-equivalent standard-price estimate from OpenAI's published uncached-input,
cached-input, and output rates. Recalculate an existing receipt and result with:

```bash
npm run eval:price -- gpt-5-6-sol-medium-run-01
```

This estimate is not a separate charge to the subscription. The receipt keeps
the price source and rates used for the calculation.

For a different generation harness, create the draft manually:

```bash
npm run new-result -- provider-model-run-01
```

This creates a draft artifact and result record but does not publish it. Replace
the artifact with the untouched response, fill the record, and calculate its
exact byte count and hash:

```bash
npm run hash -- data/artifacts/provider-model-run-01.js
```

Update `metrics.sourceBytes` and `artifactSha256`, then add
`results/provider-model-run-01.json` to `data/manifest.json`.

Run:

```bash
npm test
npm start
```

In the browser, check:

- initial three-quarter composition and unmistakable pelican/bicycle silhouette
- full 360° horizontal orbit and useful pitch range
- close zoom on the beak, feet/pedals, handlebar contacts, and frame
- mouse/pointer drag, wheel, two-finger pinch, arrow keys, and `+` / `-`
- twelve canonical views without blank frames, clipping, or context loss
- one local benchmark without resizing or console/WebGL errors
- comparison against an existing result, including synchronized view

Update `validation` with the checks you completed, each unmet mandatory
requirement and its concrete evidence, and any non-blocking warnings you
observed. A rendered result with unmet requirements uses `state: "warnings"`;
reserve `state: "failed"` for artifacts that cannot produce an inspectable
render because of a contract, compilation, or runtime error. Leave
visual scores and canonical measurements `null` unless the documented review or
reference-machine process was completed.

## Pull request checklist for results

- [ ] Exact prompt version and SHA-256 are recorded.
- [ ] Raw first response is preserved; normalization is documented.
- [ ] Exact model and provider are recorded without marketing aliases.
- [ ] Generation harness name, version, surface, and context are recorded.
- [ ] Token usage, billing mode, actual API cost or clearly labeled API-equivalent estimate, and receipt/source are recorded or explicitly `null` with a reason.
- [ ] Every renderable published result has an SDF-generated thumbnail.
- [ ] Unknown values are `null`.
- [ ] Artifact stays within 32,768 UTF-8 bytes and uses no external resources.
- [ ] `npm test` passes.
- [ ] Interactive/visual checks were performed; unmet requirements include
      evidence, and non-blocking warnings are preserved separately.
- [ ] No model-authored code was silently repaired.

## Site and evaluator changes

Keep the runtime dependency-free unless a dependency solves a documented problem
that cannot reasonably be handled with browser/Node APIs. Preserve progressive
enhancement, keyboard access, reduced-motion behavior, and the static-hosting
contract. Do not weaken the rule that performance comparisons require matching
environment fingerprints.

Protocol changes—including prompt wording, lifecycle methods, resolution, timing,
or validation rules—require a new version. Historical results remain tied to the
old version.

## Security boundary

Artifact modules are executable. Do not add arbitrary URL loading, paste-to-run,
or public upload execution. Result code must be repository-curated and reviewed.
Report vulnerabilities as described in [`SECURITY.md`](SECURITY.md).
