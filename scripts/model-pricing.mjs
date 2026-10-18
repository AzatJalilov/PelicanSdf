const PRICING = Object.freeze({
  ...Object.fromEntries([
    ["gpt-6-astra", 10, 1, 50],
    ["gpt-6.1-sol", 2, 0.1, 10],
    ["gpt-6-sol", 2, 0.2, 10],
    ["gpt-6-luna", 0.1, 0.01, 0.5],
  ].map(([model, inputUsdPerMillion, cachedInputUsdPerMillion, outputUsdPerMillion]) => [
    model,
    Object.freeze({
      inputUsdPerMillion,
      cachedInputUsdPerMillion,
      outputUsdPerMillion,
      longContextThreshold: 272_000,
      longContextInputMultiplier: 2,
      longContextOutputMultiplier: 1.5,
      source: "https://developers.openai.com/api/docs/pricing",
      publishedAt: null,
    }),
  ])),
  "gpt-5.6-sol": Object.freeze({
    inputUsdPerMillion: 5,
    cachedInputUsdPerMillion: 0.5,
    outputUsdPerMillion: 30,
    longContextThreshold: 272_000,
    longContextInputMultiplier: 2,
    longContextOutputMultiplier: 1.5,
    source: "https://developers.openai.com/api/docs/models/gpt-5.6-sol",
    publishedAt: "2026-07-09",
  }),
});

export function getModelPricing(model) {
  return PRICING[model] || null;
}

export function calculateApiCostUsd(model, usage, { aggregate = false } = {}) {
  const pricing = getModelPricing(model);
  if (!pricing) return null;
  const inputTokens = usage?.inputTokens;
  const outputTokens = usage?.outputTokens;
  if (!Number.isInteger(inputTokens) || inputTokens < 0) return null;
  if (!Number.isInteger(outputTokens) || outputTokens < 0) return null;
  // Session totals can exceed the threshold through many short requests.
  // Without request-level usage, the applicable pricing tier is unknown.
  if (aggregate && inputTokens > pricing.longContextThreshold) return null;

  const cachedInputTokens = Math.min(
    inputTokens,
    Number.isInteger(usage?.cachedInputTokens) && usage.cachedInputTokens >= 0
      ? usage.cachedInputTokens
      : 0,
  );
  const uncachedInputTokens = inputTokens - cachedInputTokens;
  const longContext = inputTokens > pricing.longContextThreshold;
  const inputMultiplier = longContext ? pricing.longContextInputMultiplier : 1;
  const outputMultiplier = longContext ? pricing.longContextOutputMultiplier : 1;
  const million = 1_000_000;
  const cost = (
    uncachedInputTokens * pricing.inputUsdPerMillion * inputMultiplier
    + cachedInputTokens * pricing.cachedInputUsdPerMillion * inputMultiplier
    + outputTokens * pricing.outputUsdPerMillion * outputMultiplier
  ) / million;
  return Number(cost.toFixed(9));
}

export function apiPricingNote(model, usage) {
  const pricing = getModelPricing(model);
  if (!pricing) return "Codex CLI subscription invocation; no matching API price is recorded.";
  if (usage?.inputTokens > pricing.longContextThreshold) {
    return "Codex CLI subscription invocation; accumulated input usage exceeds the long-context pricing threshold, but per-request token counts are unknown. API-equivalent cost is not reported because the applicable pricing tier cannot be determined; not a separate API charge.";
  }
  return `Codex CLI subscription invocation; API-equivalent standard price estimated from captured tokens at OpenAI's published ${model} rates ($${pricing.inputUsdPerMillion}/M uncached input, $${pricing.cachedInputUsdPerMillion}/M cached input, $${pricing.outputUsdPerMillion}/M output); not a separate API charge.`;
}
