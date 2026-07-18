import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { extractCodexUsage, parseJsonLines } from "../scripts/eval-usage.mjs";
import { calculateApiCostUsd, getModelPricing } from "../scripts/model-pricing.mjs";

test("Codex JSON events expose cached, reasoning, output, and total tokens", () => {
  const events = parseJsonLines([
    '{"type":"turn.started"}',
    '{"type":"turn.completed","usage":{"input_tokens":12635,"cached_input_tokens":8960,"output_tokens":8278,"reasoning_output_tokens":2908}}',
  ].join("\n"));
  assert.deepEqual(extractCodexUsage(events), {
    inputTokens: 12635,
    cachedInputTokens: 8960,
    reasoningTokens: 2908,
    outputTokens: 8278,
    totalTokens: 20913,
  });
});

test("Sol API-equivalent cost discounts cached input and prices output once", () => {
  const pricing = getModelPricing("gpt-5.6-sol");
  assert.equal(pricing.source, "https://developers.openai.com/api/docs/models/gpt-5.6-sol");
  assert.equal(calculateApiCostUsd("gpt-5.6-sol", {
    inputTokens: 12635,
    cachedInputTokens: 8960,
    reasoningTokens: 2908,
    outputTokens: 8278,
  }), 0.271195);
});

test("Sol publishes the same five effort levels as each Claude sweep", async () => {
  const expected = ["low", "medium", "high", "xhigh", "max"];
  for (const effort of expected) {
    const result = JSON.parse(await readFile(
      new URL(`../data/results/gpt-5-6-sol-${effort}-run-01.json`, import.meta.url),
      "utf8",
    ));
    assert.equal(result.provenance.decoding, `reasoning effort: ${effort}; other decoding settings not exposed`);
    assert.equal(result.validation.state, "passed");
    assert.ok(Number.isInteger(result.generationUsage.reasoningTokens));
    assert.equal(
      result.generationUsage.apiCostUsd,
      calculateApiCostUsd(result.model, result.generationUsage),
    );
  }
});
