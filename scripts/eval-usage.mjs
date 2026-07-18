function firstInteger(...values) {
  return values.find((value) => Number.isInteger(value) && value >= 0) ?? null;
}

export function parseJsonLines(text) {
  const events = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      // Keep future non-JSON diagnostics in the raw event stream without
      // preventing usage extraction from the valid records around them.
    }
  }
  return events;
}

export function extractCodexUsage(events) {
  const receipts = events
    .map((event) => event?.usage)
    .filter((usage) => usage && typeof usage === "object");
  const usage = receipts.at(-1) || {};
  const inputTokens = firstInteger(usage.input_tokens, usage.inputTokens);
  const cachedInputTokens = firstInteger(
    usage.cached_input_tokens,
    usage.cachedInputTokens,
    usage.input_tokens_details?.cached_tokens,
    usage.inputTokensDetails?.cachedTokens,
  );
  const reasoningTokens = firstInteger(
    usage.reasoning_output_tokens,
    usage.reasoning_tokens,
    usage.reasoningTokens,
    usage.output_tokens_details?.reasoning_tokens,
    usage.outputTokensDetails?.reasoningTokens,
  );
  const outputTokens = firstInteger(usage.output_tokens, usage.outputTokens);
  const reportedTotal = firstInteger(usage.total_tokens, usage.totalTokens);
  return {
    inputTokens,
    cachedInputTokens,
    reasoningTokens,
    outputTokens,
    totalTokens: reportedTotal ?? (
      Number.isInteger(inputTokens) && Number.isInteger(outputTokens)
        ? inputTokens + outputTokens
        : null
    ),
  };
}
