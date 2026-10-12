import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const projects = ["first-project", "account-components", "note-scripts"];
const expectedFiles = {
  "first-project": ["Cargo.toml", "rust-toolchain.toml", "src/area.masm", "src/main.rs"],
  "account-components": ["Cargo.toml", "rust-toolchain.toml", "masm/settings.masm", "masm/update.masm", "src/main.rs"],
  "note-scripts": ["Cargo.toml", "rust-toolchain.toml", "masm/set-value.masm", "src/main.rs"],
};
let checked = 0;
for (const project of projects) {
  const page = `builder/smart-contracts/masm/${project}.md`;
  const current = readFileSync(resolve(root, "docs", page), "utf8");
  const versioned = readFileSync(resolve(root, "versioned_docs/version-0.17", page), "utf8");
  assert.equal(current, versioned, `${project}: current and v0.17 guides differ`);
  const filenames = [];
  for (const match of current.matchAll(/```(?:rust|masm|toml)([^\n]*)\n([\s\S]*?)\n```/g)) {
    const [, info, snippet] = match;
    const title = info.match(/title="([^"]+)"/);
    assert.ok(title, `${project}: runnable source fence must name its file`);
    const filename = title[1];
    filenames.push(filename);
    const source = readFileSync(resolve(root, "examples/masm", project, filename), "utf8");
    // The guide presents the runnable host; rejection tests remain in the fixture.
    const presented = filename === "src/main.rs" && project === "note-scripts"
      ? source.split("\n#[cfg(test)]")[0].trimEnd()
      : source.trimEnd();
    assert.equal(snippet, presented, `${project}/${filename}: guide differs from executable source`);
    checked++;
  }
  assert.deepEqual(filenames.sort(), expectedFiles[project].toSorted(), `${project}: required source fence missing or duplicated`);
}
assert.equal(checked, 13, "Expected all 13 executable/configuration source fences");
console.log(`Checked ${checked} code blocks and three current/v0.17 guide mirrors`);
