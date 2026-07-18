import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { buildSite } from "../scripts/build-site.mjs";
import { verifyPublicBundle } from "../scripts/verify-public-bundle.mjs";

test("the production bundle contains only intentional public files", async () => {
  const repositoryTemp = path.join(process.cwd(), ".bundle-test-");
  const outputRoot = await mkdtemp(repositoryTemp);
  try {
    const built = await buildSite(outputRoot);
    const verified = await verifyPublicBundle(outputRoot);
    assert.equal(built.rawResponseCount, 40);
    assert.equal(verified.resultCount, 42);
    assert.ok(verified.files.includes("data/raw/claude-fable-5-low-run-01/response.txt"));
    assert.ok(!verified.files.some((file) => file.endsWith("events.jsonl")));
    assert.ok(!verified.files.some((file) => file.endsWith("receipt.json")));
    assert.match(await readFile(path.join(outputRoot, "index.html"), "utf8"), /Pelican SDF/);
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});

test("the README names the canonical public website", async () => {
  const readme = await readFile(path.join(process.cwd(), "README.md"), "utf8");
  assert.match(readme, /https:\/\/pelican\.vibe-overflow\.com\//);
});
