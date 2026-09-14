import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("freezes root-absolute, canonical and legacy docs links", () => {
  const root = mkdtempSync(join(tmpdir(), "miden-doc-links-"));
  try {
    mkdirSync(join(root, "builder/tutorials"), { recursive: true });
    mkdirSync(join(root, "builder/get-started"), { recursive: true });
    mkdirSync(join(root, "reference/miden-vm"), { recursive: true });
    writeFileSync(join(root, "builder/get-started/index.md"), "# Get started\n");
    writeFileSync(join(root, "reference/miden-vm/overview.md"), "# VM\n");
    const source = join(root, "builder/tutorials/example.md");
    writeFileSync(source, [
      "[root](/builder/get-started/#install)",
      "[canonical](https://docs.miden.xyz/builder/get-started/#install)",
      "[legacy](https://docs.miden.xyz/miden-vm/overview#inputs-and-outputs)",
      "",
    ].join("\n"));

    const result = spawnSync(process.execPath, [
      new URL("./rebase-ingested-links.mjs", import.meta.url).pathname,
      root,
    ], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(source, "utf8"), [
      "[root](../get-started/index.md#install)",
      "[canonical](../get-started/index.md#install)",
      "[legacy](../../reference/miden-vm/overview.md#inputs-and-outputs)",
      "",
    ].join("\n"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
