import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("generation logs survive before a model returns its final response", async () => {
  const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
  const temporary = await mkdtemp(path.join(os.tmpdir(), "pelican-stream-test-"));
  const root = path.join(temporary, "repository");
  await mkdir(path.join(root, "scripts"), { recursive: true });
  await mkdir(path.join(root, "benchmark"), { recursive: true });
  await Promise.all([
    "scripts/run-model-eval.mjs", "scripts/eval-usage.mjs", "scripts/model-pricing.mjs", "benchmark/prompt.txt",
  ].map((file) => copyFile(path.join(repositoryRoot, file), path.join(root, file))));
  const id = `test-streaming-${process.pid}-${Date.now()}`;
  const raw = path.join(root, "data", "raw", id);
  const gate = path.join(temporary, "finish");
  const fake = path.join(temporary, "fake.mjs");
  const shim = path.join(temporary, process.platform === "win32" ? "codex.cmd" : "codex");
  await writeFile(fake, `
    import {access,writeFile} from 'node:fs/promises';
    if(process.argv.includes('--version')){console.log('codex-cli test');process.exit(0);}
    console.log(JSON.stringify({type:'thread.started',thread_id:'stream-test'}));
    console.error('stream-test: generation pending');
    while(true){try{await access(${JSON.stringify(gate)});break;}catch{await new Promise(r=>setTimeout(r,20));}}
    const output=process.argv[process.argv.indexOf('--output-last-message')+1];
    await writeFile(output,'export function createPelicanSdf(canvas) {}\\n');
    console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:10,cached_input_tokens:2,output_tokens:3,reasoning_output_tokens:1}}));
  `);
  const quote = (value) => "'" + value.replaceAll("'", "'\\''") + "'";
  await writeFile(shim, process.platform === "win32"
    ? `@"${process.execPath}" "${fake}" %*\r\n`
    : `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(fake)} "$@"\n`);
  if (process.platform !== "win32") await chmod(shim, 0o755);
  const child = spawn(process.execPath, ["scripts/run-model-eval.mjs", id, "gpt-6-astra", "low"], {
    cwd: root, env: { ...process.env, CODEX_BIN: shim }, windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let diagnostic = "", exited = false;
  child.stdout.on("data", (chunk) => { diagnostic += chunk; });
  child.stderr.on("data", (chunk) => { diagnostic += chunk; });
  const closed = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => { exited = true; resolve(code); });
  });
  try {
    let visible = false;
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline && !exited) {
      const events = await readFile(path.join(raw, "events.jsonl"), "utf8").catch(() => "");
      const stderr = await readFile(path.join(raw, "stderr.txt"), "utf8").catch(() => "");
      if (events.includes('"thread_id":"stream-test"') && stderr.includes("generation pending")) {
        visible = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.ok(visible, `Logs were not preserved while generation was pending: ${diagnostic}`);
    assert.equal(exited, false);
    await writeFile(gate, "finish");
    assert.equal(await closed, 0, diagnostic);
    const receipt = JSON.parse(await readFile(path.join(raw, "receipt.json"), "utf8"));
    assert.equal(receipt.usage.totalTokens, 13);
    assert.equal(receipt.response.bytes, 44);
  } finally {
    await writeFile(gate, "finish");
    await closed;
    assert.equal(path.dirname(path.resolve(raw)), path.resolve(root, "data", "raw"));
    assert.equal(path.dirname(path.resolve(temporary)), path.resolve(os.tmpdir()));
    await rm(raw, { recursive: true, force: true });
    await rm(temporary, { recursive: true, force: true });
  }
});
