import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("landing page is static and does not load benchmark runs", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  for (const id of ["landing-title", "method", "contribute"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /href=["']\.\/results\.html["']/);
  assert.doesNotMatch(html, /<canvas\b/);
  assert.doesNotMatch(html, /<script\b/);
  assert.doesNotMatch(html, /data\/(?:results|artifacts)|src\/app\.js/);
});

test("results catalog owns the interactive benchmark surfaces", async () => {
  const html = await readFile(new URL("../results.html", import.meta.url), "utf8");
  for (const id of ["hero-canvas", "result-grid", "compare-left-canvas", "compare-right-canvas", "prompt-text"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /src=["']\.\/src\/app\.js["']/);
});

test("rendered results report unmet requirements without becoming overall failures", async () => {
  const result = JSON.parse(await readFile(new URL("../data/results/gpt-5-5-run-01.json", import.meta.url), "utf8"));
  assert.equal(result.validation.state, "warnings");
  assert.deepEqual(
    result.validation.unmetRequirements.map((finding) => finding.requirement),
    ["Useful full-subject framing", "Two-finger pinch zoom"],
  );
  assert.equal(result.validation.warnings.length, 0);
});

test("every gallery result links to a dedicated, inspectable run page", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("../result.html", import.meta.url), "utf8"),
    readFile(new URL("../src/app.js", import.meta.url), "utf8"),
  ]);
  for (const id of ["run-canvas", "invocation-record", "usage-record", "validation", "run-prompt-text", "run-source"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(app, /result\.html\?id=/);
  assert.doesNotMatch(html, /id=["']detail-dialog["']/);
});

test("canonical prompt exposes only a blank canvas", async () => {
  const prompt = await readFile(new URL("../benchmark/prompt.txt", import.meta.url), "utf8");
  assert.match(prompt, /supplies only a blank HTMLCanvasElement/);
  assert.match(prompt, /implement everything else yourself/);
  assert.match(prompt, /measure uncapped frame throughput/i);
  assert.doesNotMatch(prompt, /harness provides these functions/i);
});

test("license is the standard MIT grant", async () => {
  const license = await readFile(new URL("../LICENSE", import.meta.url), "utf8");
  assert.match(license, /MIT License/);
  assert.match(license, /Permission is hereby granted, free of charge/);
});
