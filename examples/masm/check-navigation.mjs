import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const metadata = resolve(root, ".docusaurus/docusaurus-plugin-content-docs/default");
const ownIds = ["first-project", "account-components", "note-scripts"]
  .map((page) => `builder/smart-contracts/masm/${page}`);
let checked = 0;
for (const filename of readdirSync(resolve(metadata, "p"))) {
  if (!filename.endsWith(".json")) continue;
  const { version } = JSON.parse(readFileSync(resolve(metadata, "p", filename), "utf8"));
  if (!["current", "0.17"].includes(version?.version)) continue;
  const smartContracts = version.docsSidebars.builderSidebar
    .find((item) => item.type === "category" && item.label === "Smart Contracts");
  const masm = smartContracts.items.find((item) => item.label === "MASM");
  const children = masm.items.map((item) => item.docId);
  assert.deepEqual(children.slice(0, 3), ownIds, `${version.version}: wrong guide order`);
  for (const id of ownIds) {
    assert.equal(children.filter((child) => child === id).length, 1, `Duplicate guide: ${id}`);
  }
  assert.ok(!children.includes("builder/smart-contracts/masm/index"), "Duplicate index child");
  const source = version.version === "current"
    ? "@site/docs/builder/smart-contracts/masm/index.md"
    : "@site/versioned_docs/version-0.17/builder/smart-contracts/masm/index.md";
  const index = readdirSync(metadata)
    .filter((file) => file.includes("masm-index-") && file.endsWith(".json"))
    .map((file) => JSON.parse(readFileSync(resolve(metadata, file), "utf8")))
    .find((doc) => doc.source === source);
  assert.equal(index.next.permalink, `${version.version === "current" ? "/next" : ""}/builder/smart-contracts/masm/first-project`);
  checked++;
}
assert.equal(checked, 2, "Build current and v0.17 docs before checking navigation");
console.log("Checked current/v0.17 MASM order, unique index, and landing-page pagination");
