import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run hash -- path/to/file");
  process.exit(1);
}

const bytes = await readFile(file);
const info = await stat(file);
const hash = createHash("sha256").update(bytes).digest("hex");
console.log(`${path.normalize(file)}\nbytes  ${info.size}\nsha256 ${hash}`);
