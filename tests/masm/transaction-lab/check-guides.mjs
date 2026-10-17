import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const fixture = dirname(fileURLToPath(import.meta.url));
const repo = resolve(fixture, "../../..");
const pages = ["transaction-scripts", "testing-mockchain", "debugging"];
let checked = 0;

for (const page of pages) {
  const path = `builder/smart-contracts/masm/${page}.md`;
  const current = readFileSync(resolve(repo, "docs", path), "utf8");
  const versioned = readFileSync(resolve(repo, "versioned_docs/version-0.17", path), "utf8");
  assert.equal(current, versioned, `${page}: current and v0.17 content drifted`);
  for (const match of current.matchAll(/```(?:rust|masm) title="([^"]+)"\n([\s\S]*?)\n```/g)) {
    assert.equal(match[2], readFileSync(resolve(fixture, match[1]), "utf8").trimEnd(), `${page}: ${match[1]} drifted`);
    checked++;
  }
}

assert.equal(checked, 4, "Expected all four executable source blocks");
console.log(`Verified ${checked} source blocks and all three v0.17 mirrors`);
