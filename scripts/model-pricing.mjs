const PRICING = Object.freeze({
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

export function calculateApiCostUsd(model, usage) {
  const pricing = getModelPricing(model);
  if (!pricing) return null;
  const inputTokens = usage?.inputTokens;
  const outputTokens = usage?.outputTokens;
  if (!Number.isInteger(inputTokens) || inputTokens < 0) return null;
  if (!Number.isInteger(outputTokens) || outputTokens < 0) return null;

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

export function apiPricingNote(model) {
  const pricing = getModelPricing(model);
  if (!pricing) return "Codex CLI subscription invocation; no matching API price is recorded.";
  return `Codex CLI subscription invocation; API-equivalent standard price estimated from captured tokens at OpenAI's published ${model} rates ($${pricing.inputUsdPerMillion}/M uncached input, $${pricing.cachedInputUsdPerMillion}/M cached input, $${pricing.outputUsdPerMillion}/M output); not a separate API charge.`;
}
