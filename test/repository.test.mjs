import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("landing page is static and does not load benchmark runs", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  for (const id of ["landing-title", "method"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /href=["']\.\/results\.html["']/);
  assert.doesNotMatch(html, /<canvas\b/);
  assert.doesNotMatch(html, /<script\b/);
  assert.doesNotMatch(html, /data\/(?:results|artifacts)|src\/app\.js/);
  assert.doesNotMatch(html, /Landing payload|artifact modules|ARTIFACTS NOT LOADED/i);
});

test("results catalog lists runs without loading a default artifact", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("../results.html", import.meta.url), "utf8"),
    readFile(new URL("../src/app.js", import.meta.url), "utf8"),
  ]);
  for (const id of ["result-grid", "compare-left-canvas", "compare-right-canvas", "prompt-text"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.doesNotMatch(html, /id=["']hero-canvas["']/);
  assert.doesNotMatch(app, /heroViewer|activateResult|benchmarkHero/);
  assert.match(app, /url\.searchParams\.has\("run"\).*updateUrl\(\{ run: null \}\)/);
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

test("public pages link to GitHub without contribution or license promos", async () => {
  const expected = "https://github.com/AzatJalilov/PelicanSdf";
  const pages = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../results.html", import.meta.url), "utf8"),
    readFile(new URL("../result.html", import.meta.url), "utf8"),
  ]);
  for (const page of pages) {
    assert.match(page, new RegExp(expected.replaceAll(".", "\\.")));
    assert.doesNotMatch(page, /Add a result|Add a benchmark result|license-note|MIT licensed/i);
  }
});

test("public pages reuse the Sol Max pelican-on-bicycle brand artwork", async () => {
  const pages = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../results.html", import.meta.url), "utf8"),
    readFile(new URL("../result.html", import.meta.url), "utf8"),
  ]);
  for (const page of pages) {
    assert.equal(page.match(/src=["']\.\/assets\/pelican-bicycle-mark\.svg["']/g)?.length, 2);
    assert.doesNotMatch(page, /<svg\s+class=["']brand-mark["']/);
  }

  const [mark, favicon] = await Promise.all([
    readFile(new URL("../assets/pelican-bicycle-mark.svg", import.meta.url), "utf8"),
    readFile(new URL("../assets/favicon.svg", import.meta.url), "utf8"),
  ]);
  assert.match(mark, /<title[^>]*>Pelican riding a bicycle<\/title>/);
  assert.match(favicon, /<title[^>]*>Pelican cyclist<\/title>/);
  for (const svg of [mark, favicon]) {
    assert.match(svg, /role=["']img["']/);
    assert.match(svg, /<desc\b/);
    assert.ok((svg.match(/<circle\b/g) || []).length >= 4);
    assert.doesNotMatch(svg, /<(?:image|script|filter|mask|foreignObject)\b/i);
  }
});

function jpegDimensions(buffer) {
  assert.equal(buffer[0], 0xff);
  assert.equal(buffer[1], 0xd8);
  for (let index = 2; index + 8 < buffer.length;) {
    if (buffer[index] !== 0xff) {
      index += 1;
      continue;
    }
    const marker = buffer[index + 1];
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: buffer.readUInt16BE(index + 5), width: buffer.readUInt16BE(index + 7) };
    }
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      index += 2;
      continue;
    }
    const length = buffer.readUInt16BE(index + 2);
    if (length < 2) break;
    index += 2 + length;
  }
  throw new Error("JPEG has no supported frame header");
}

test("every renderable published SDF has a generated catalog thumbnail", async () => {
  const manifest = JSON.parse(await readFile(new URL("../data/manifest.json", import.meta.url), "utf8"));
  let renderable = 0;
  let failed = 0;
  for (const entry of manifest) {
    const result = JSON.parse(await readFile(new URL(`../data/${entry}`, import.meta.url), "utf8"));
    if (result.validation.state === "failed") {
      failed += 1;
      continue;
    }
    renderable += 1;
    const thumbnail = await readFile(new URL(`../assets/thumbnails/${result.id}.jpg`, import.meta.url));
    assert.deepEqual(jpegDimensions(thumbnail), { width: 480, height: 270 }, result.id);
  }
  assert.equal(renderable + failed, manifest.length);
});
