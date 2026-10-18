import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { extractCodexUsage, parseJsonLines } from "../scripts/eval-usage.mjs";
import { apiPricingNote, calculateApiCostUsd, getModelPricing } from "../scripts/model-pricing.mjs";

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

for (const [model, shortCost, longCost] of [
  ["gpt-6-astra", 0.132, 4.95],
  ["gpt-6.1-sol", 0.0262, 0.97],
  ["gpt-6-sol", 0.0264, 0.99],
  ["gpt-6-luna", 0.00132, 0.0495],
]) {
  test(`${model} estimates captured usage at Standard API rates`, () => {
    assert.equal(calculateApiCostUsd(model, {
      inputTokens: 10_000, cachedInputTokens: 2_000,
      outputTokens: 1_000, reasoningTokens: 600,
    }), shortCost);
    assert.equal(calculateApiCostUsd(model, {
      inputTokens: 300_000, cachedInputTokens: 100_000,
      outputTokens: 10_000, reasoningTokens: 6_000,
    }), longCost);
    assert.equal(calculateApiCostUsd(model, { inputTokens: null, outputTokens: 1_000 }), null);
  });
}

test("aggregate CLI usage cannot determine a per-request long-context pricing tier", () => {
  const usage = { inputTokens: 482174, cachedInputTokens: 408832, outputTokens: 55883 };
  assert.equal(calculateApiCostUsd("gpt-6-astra", usage, { aggregate: true }), null);
  assert.match(apiPricingNote("gpt-6-astra", usage), /per-request.*unknown/i);
  assert.equal(calculateApiCostUsd("gpt-6-astra", {
    inputTokens: 10000, cachedInputTokens: 2000, outputTokens: 1000,
  }, { aggregate: true }), 0.132);
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
