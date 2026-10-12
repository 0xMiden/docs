import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { prepareLocalDocs } from "./prepare-local-docs.mjs";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "local-docs-"));
  t.after(() => rmSync(root, { recursive: true }));
  const write = (path, content) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  };
  write("versions.json", '["0.17"]');
  write("versioned_docs/version-0.17/reference/protocol/asset.md", "snapshot asset\n");
  write("versioned_docs/version-0.17/builder/tools/clients/rust-client/index.md", "snapshot client\n");
  write("versioned_docs/version-0.17/builder/miden-guardian/index.md", "snapshot authored landing\n");
  write("versioned_docs/version-0.17/builder/get-started/new-guide.md", "snapshot authored guide\n");
  write("docs/builder/tools/clients/rust-client/index.md", "existing local edit\n");
  return { root, write };
}

test("fills absent ingested inputs and records their exact bytes", (t) => {
  const { root } = fixture(t);
  const manifest = prepareLocalDocs(root, "0.17");
  assert.equal(readFileSync(join(root, "docs/reference/protocol/asset.md"), "utf8"), "snapshot asset\n");
  assert.deepEqual(manifest.files, [{
    path: "docs/reference/protocol/asset.md",
    sha256: createHash("sha256").update("snapshot asset\n").digest("hex"),
  }]);
});

test("preserves current edits and does not resurrect absent authored pages", (t) => {
  const { root } = fixture(t);
  prepareLocalDocs(root, "0.17");
  assert.equal(readFileSync(join(root, "docs/builder/tools/clients/rust-client/index.md"), "utf8"), "existing local edit\n");
  assert.equal(existsSync(join(root, "docs/builder/miden-guardian/index.md")), false);
  assert.equal(existsSync(join(root, "docs/builder/get-started/new-guide.md")), false);
});

test("a repeat run creates nothing and preserves modified generated inputs", (t) => {
  const { root, write } = fixture(t);
  prepareLocalDocs(root, "0.17");
  write("docs/reference/protocol/asset.md", "local change\n");
  assert.deepEqual(prepareLocalDocs(root, "0.17").files, []);
  assert.equal(readFileSync(join(root, "docs/reference/protocol/asset.md"), "utf8"), "local change\n");
});

test("rejects absent snapshots and path traversal before copying", (t) => {
  const { root } = fixture(t);
  for (const version of ["0.18", "../0.17", ""]) {
    assert.throws(() => prepareLocalDocs(root, version), /snapshot/i);
  }
  assert.equal(existsSync(join(root, "docs/reference/protocol/asset.md")), false);
});

function cliFixture(t) {
  const fixtureRoot = fixture(t);
  fixtureRoot.write("scripts/prepare-local-docs.mjs", readFileSync(new URL("./prepare-local-docs.mjs", import.meta.url), "utf8"));
  const run = (manifest) => spawnSync(process.execPath, [
    join(fixtureRoot.root, "scripts/prepare-local-docs.mjs"), "--snapshot", "0.17", "--manifest", manifest,
  ], { encoding: "utf8" });
  return { ...fixtureRoot, run };
}

test("CLI refuses to overwrite an existing manifest before changing inputs", (t) => {
  const { root, run } = cliFixture(t);
  const manifest = join(tmpdir(), `${basename(root)}-manifest.json`);
  t.after(() => rmSync(manifest, { force: true }));
  writeFileSync(manifest, "original hash evidence\n");
  const result = run(manifest);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /exists/i);
  assert.equal(readFileSync(manifest, "utf8"), "original hash evidence\n");
  assert.equal(existsSync(join(root, "docs/reference/protocol/asset.md")), false);
});

test("CLI rejects a manifest inside the repository before copying", (t) => {
  const { root, run } = cliFixture(t);
  const result = run(join(root, "docs/reference/protocol/asset.md"));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /outside/i);
  assert.equal(existsSync(join(root, "docs/reference/protocol/asset.md")), false);
});
