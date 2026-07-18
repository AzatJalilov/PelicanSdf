import { cp, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const defaultOutputRoot = path.join(repositoryRoot, "dist");

const publicFiles = ["index.html", "result.html", "results.html"];
const publicDirectories = ["assets", "benchmark", "src"];
const publicDataDirectories = ["artifacts", "results"];

async function copyFromRepository(source, outputRoot, destination = source) {
  await cp(path.join(repositoryRoot, source), path.join(outputRoot, destination), {
    recursive: true,
  });
}

export async function buildSite(outputRoot = defaultOutputRoot) {
  const resolvedOutput = path.resolve(outputRoot);
  if (resolvedOutput === repositoryRoot || !resolvedOutput.startsWith(`${repositoryRoot}${path.sep}`)) {
    throw new Error(`Public output must stay inside the repository: ${resolvedOutput}`);
  }

  await rm(resolvedOutput, { recursive: true, force: true });
  await mkdir(resolvedOutput, { recursive: true });

  for (const file of publicFiles) await copyFromRepository(file, resolvedOutput);
  for (const directory of publicDirectories) await copyFromRepository(directory, resolvedOutput);

  await mkdir(path.join(resolvedOutput, "data"), { recursive: true });
  await copyFromRepository("data/manifest.json", resolvedOutput);
  for (const directory of publicDataDirectories) {
    await copyFromRepository(`data/${directory}`, resolvedOutput);
  }

  const rawRoot = path.join(repositoryRoot, "data", "raw");
  const rawEntries = await readdir(rawRoot, { withFileTypes: true });
  let rawResponseCount = 0;
  for (const entry of rawEntries) {
    if (!entry.isDirectory()) continue;
    const source = path.join(rawRoot, entry.name, "response.txt");
    const destination = path.join(resolvedOutput, "data", "raw", entry.name, "response.txt");
    try {
      await mkdir(path.dirname(destination), { recursive: true });
      await cp(source, destination);
      rawResponseCount += 1;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  console.log(`Built public site at ${resolvedOutput} with ${rawResponseCount} raw responses.`);
  return { outputRoot: resolvedOutput, rawResponseCount };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildSite();
}
