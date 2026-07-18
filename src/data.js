const manifestUrl = new URL("../data/manifest.json", import.meta.url);

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url.pathname}: ${response.status}`);
  return response.json();
}

export async function loadResults() {
  const entries = await fetchJson(manifestUrl);
  if (!Array.isArray(entries)) throw new Error("Result manifest must be an array.");

  const results = await Promise.all(entries.map(async (entry) => {
    const resultUrl = new URL(entry, manifestUrl);
    const result = await fetchJson(resultUrl);
    return {
      ...result,
      resultUrl: resultUrl.href,
      artifactUrl: new URL(result.artifact, resultUrl).href,
      rawResponseUrl: result.provenance.rawResponse
        ? new URL(result.provenance.rawResponse, resultUrl).href
        : null,
    };
  }));

  const ids = new Set();
  for (const result of results) {
    if (ids.has(result.id)) throw new Error(`Duplicate result id: ${result.id}`);
    ids.add(result.id);
  }

  return results;
}

export async function loadPrompt() {
  const url = new URL("../benchmark/prompt.txt", import.meta.url);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load canonical prompt: ${response.status}`);
  return response.text();
}
