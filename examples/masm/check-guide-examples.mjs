import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const projects = ["first-project", "account-components", "note-scripts"];
let checked = 0;
for (const project of projects) {
  const page = `builder/smart-contracts/masm/${project}.md`;
  const current = readFileSync(resolve(root, "docs", page), "utf8");
  const versioned = readFileSync(resolve(root, "versioned_docs/version-0.17", page), "utf8");
  assert.equal(current, versioned, `${project}: current and v0.17 guides differ`);
  for (const match of current.matchAll(/```\w+ title="([^"]+)"\n([\s\S]*?)\n```/g)) {
    const [, filename, snippet] = match;
    const source = readFileSync(resolve(root, "examples/masm", project, filename), "utf8");
    // The guide presents the runnable host; rejection tests remain in the fixture.
    const presented = filename === "src/main.rs" && project === "note-scripts"
      ? source.split("\n#[cfg(test)]")[0].trimEnd()
      : source.trimEnd();
    assert.equal(snippet, presented, `${project}/${filename}: guide differs from executable source`);
    checked++;
  }
}
assert.ok(checked >= 12, "Expected all three complete projects to be documented");
console.log(`Checked ${checked} code blocks and three current/v0.17 guide mirrors`);
