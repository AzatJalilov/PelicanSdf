import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const defaultOutputRoot = path.join(repositoryRoot, "dist");
const allowedTopLevel = new Set([
  "assets",
  "benchmark",
  "data",
  "index.html",
  "result.html",
  "results.html",
  "src",
]);
const forbiddenNames = new Set([
  ".env",
  ".git",
  "events.jsonl",
  "receipt.json",
  "stderr.txt",
  "thinking.txt",
]);
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bAIza[0-9A-Za-z_-]{30,}\b/,
  /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/,
];
const textExtensions = new Set([".css", ".html", ".js", ".json", ".md", ".svg", ".txt"]);

async function listFiles(root, current = root) {
  const files = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(root, absolute));
    else if (entry.isFile()) files.push(path.relative(root, absolute).replaceAll(path.sep, "/"));
    else throw new Error(`Public bundle contains a non-regular file: ${absolute}`);
  }
  return files;
}

function resolvePublicReference(resultPath, reference) {
  return path.resolve(path.dirname(resultPath), reference);
}

async function assertFile(filePath, outputRoot, label) {
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(`${outputRoot}${path.sep}`)) {
    throw new Error(`${label} escapes the public bundle: ${filePath}`);
  }
  if (!(await stat(resolved)).isFile()) throw new Error(`${label} is missing: ${filePath}`);
}

export async function verifyPublicBundle(outputRoot = defaultOutputRoot) {
  const resolvedOutput = path.resolve(outputRoot);
  const entries = await readdir(resolvedOutput, { withFileTypes: true });
  for (const entry of entries) {
    if (!allowedTopLevel.has(entry.name)) throw new Error(`Unexpected public top-level entry: ${entry.name}`);
  }

  const files = await listFiles(resolvedOutput);
  for (const relative of files) {
    const basename = path.posix.basename(relative);
    if (forbiddenNames.has(basename) || basename.endsWith(".log") || /\.(?:key|pem|p12|pfx)$/i.test(basename)) {
      throw new Error(`Sensitive file is not allowed in the public bundle: ${relative}`);
    }
    if (relative.startsWith("data/raw/") && !relative.endsWith("/response.txt")) {
      throw new Error(`Only raw response.txt provenance may be published: ${relative}`);
    }
    if (textExtensions.has(path.extname(relative).toLowerCase())) {
      const content = await readFile(path.join(resolvedOutput, relative), "utf8");
      if (secretPatterns.some((pattern) => pattern.test(content))) {
        throw new Error(`Credential-like content found in public file: ${relative}`);
      }
      if (/[A-Za-z]:\\Users\\[^\\\s]+\\/i.test(content) || /\/(?:home|Users)\/[^/\s]+\//.test(content)) {
        throw new Error(`Local user path found in public file: ${relative}`);
      }
    }
  }

  for (const required of [
    "index.html",
    "results.html",
    "result.html",
    "src/app.js",
    "src/result.js",
    "benchmark/prompt.txt",
    "benchmark/result.schema.json",
    "data/manifest.json",
  ]) {
    if (!files.includes(required)) throw new Error(`Required public file is missing: ${required}`);
  }

  const manifestPath = path.join(resolvedOutput, "data", "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  for (const entry of manifest) {
    const resultPath = path.resolve(path.dirname(manifestPath), entry);
    await assertFile(resultPath, resolvedOutput, `Result record ${entry}`);
    const result = JSON.parse(await readFile(resultPath, "utf8"));
    await assertFile(resolvePublicReference(resultPath, result.artifact), resolvedOutput, `${result.id} artifact`);
    if (result.provenance?.rawResponse) {
      await assertFile(resolvePublicReference(resultPath, result.provenance.rawResponse), resolvedOutput, `${result.id} raw response`);
    }
  }

  console.log(`Verified ${files.length} explicitly published files for ${manifest.length} results.`);
  return { fileCount: files.length, resultCount: manifest.length, files };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await verifyPublicBundle();
}
