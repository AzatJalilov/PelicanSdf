import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { extractCodexUsage, parseJsonLines } from "./eval-usage.mjs";
import { apiPricingNote, calculateApiCostUsd, getModelPricing } from "./model-pricing.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const ids = process.argv.slice(2);
if (!ids.length || ids.some((id) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))) {
  throw new Error("Usage: npm run eval:price -- run-id [run-id ...]");
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function mergeUsage(existing, captured) {
  return Object.fromEntries(
    ["inputTokens", "cachedInputTokens", "reasoningTokens", "outputTokens", "totalTokens"]
      .map((key) => [key, Number.isInteger(captured[key]) ? captured[key] : (existing?.[key] ?? null)]),
  );
}

const report = [];
for (const id of ids) {
  const rawDir = path.join(root, "data", "raw", id);
  const receiptPath = path.join(rawDir, "receipt.json");
  const eventsPath = path.join(rawDir, "events.jsonl");
  const resultPath = path.join(root, "data", "results", `${id}.json`);
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  const pricing = getModelPricing(receipt.model);
  if (!pricing) throw new Error(`${id}: no API pricing is recorded for ${receipt.model}`);

  const events = parseJsonLines(await readFile(eventsPath, "utf8"));
  receipt.usage = mergeUsage(receipt.usage, extractCodexUsage(events));
  const apiCostUsd = calculateApiCostUsd(receipt.model, receipt.usage);
  if (!Number.isFinite(apiCostUsd)) throw new Error(`${id}: captured input/output token counts are required`);
  const note = apiPricingNote(receipt.model);
  receipt.billing = {
    ...(receipt.billing || {}),
    mode: "subscription",
    apiCostUsd,
    note,
    pricing: {
      inputUsdPerMillion: pricing.inputUsdPerMillion,
      cachedInputUsdPerMillion: pricing.cachedInputUsdPerMillion,
      outputUsdPerMillion: pricing.outputUsdPerMillion,
      source: pricing.source,
      publishedAt: pricing.publishedAt,
    },
  };
  await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + "\n", "utf8");

  if (await exists(resultPath)) {
    const result = JSON.parse(await readFile(resultPath, "utf8"));
    result.generationUsage = {
      ...result.generationUsage,
      ...receipt.usage,
      apiCostUsd,
      billingMode: "subscription",
      source: `data/raw/${id}/events.jsonl`,
      notes: note,
    };
    await writeFile(resultPath, JSON.stringify(result, null, 2) + "\n", "utf8");
  }

  report.push({ id, model: receipt.model, usage: receipt.usage, apiCostUsd, pricingSource: pricing.source });
}

console.log(JSON.stringify(report, null, 2));
