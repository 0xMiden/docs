import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

type SupportedVersion = "current" | "0.17";
type JsonObject = Record<string, unknown>;

const ownIds = ["first-project", "account-components", "note-scripts"]
  .map((page) => `builder/smart-contracts/masm/${page}`);
const indexId = "builder/smart-contracts/masm/index";

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function selectedVersion(value: unknown): {
  name: SupportedVersion;
  sidebar: unknown[];
} | undefined {
  if (!isObject(value) || !isObject(value.version)) return undefined;
  const version = value.version;
  if (version.version !== "current" && version.version !== "0.17") return undefined;
  assert.ok(isObject(version.docsSidebars), `${version.version}: missing docsSidebars`);
  const sidebar = version.docsSidebars.builderSidebar;
  assert.ok(isArray(sidebar), `${version.version}: missing builderSidebar`);
  return { name: version.version, sidebar };
}

function categoryItems(items: unknown[], label: string, version: SupportedVersion): unknown[] {
  const category = items.find((item) =>
    isObject(item) && item.type === "category" && item.label === label,
  );
  assert.ok(isObject(category), `${version}: missing ${label} category`);
  assert.ok(isArray(category.items), `${version}: missing ${label} children`);
  return category.items;
}

function checkSidebar(sidebar: unknown[], version: SupportedVersion): void {
  const smartContracts = categoryItems(sidebar, "Smart Contracts", version);
  const masm = categoryItems(smartContracts, "MASM", version);
  const children = masm.map((item) => {
    assert.ok(isObject(item) && typeof item.docId === "string", `${version}: invalid MASM doc child`);
    return item.docId;
  });
  assert.deepEqual(children.slice(0, 3), ownIds, `${version}: wrong guide order`);
  for (const id of ownIds) {
    assert.equal(children.filter((child) => child === id).length, 1, `Duplicate guide: ${id}`);
  }
  assert.ok(!children.includes(indexId), "Duplicate index child");
}

function checkPagination(indexDocs: unknown[], version: SupportedVersion): void {
  const directory = version === "current" ? "docs" : "versioned_docs/version-0.17";
  const source = `@site/${directory}/${indexId}.md`;
  const index = indexDocs.find((doc) => isObject(doc) && doc.source === source);
  assert.ok(isObject(index), `${version}: missing MASM index metadata`);
  assert.ok(isObject(index.next), `${version}: missing MASM index Next link`);
  const prefix = version === "current" ? "/next" : "";
  assert.equal(index.next.permalink, `${prefix}/builder/smart-contracts/masm/first-project`);
}

export function checkNavigation(root: string): void {
  const metadata = resolve(root, ".docusaurus/docusaurus-plugin-content-docs/default");
  const indexDocs = readdirSync(metadata)
    .filter((file) => file.includes("masm-index-") && file.endsWith(".json"))
    .map((file) => readJson(resolve(metadata, file)));
  const checked = new Set<SupportedVersion>();
  for (const filename of readdirSync(resolve(metadata, "p"))) {
    if (!filename.endsWith(".json")) continue;
    const version = selectedVersion(readJson(resolve(metadata, "p", filename)));
    if (!version) continue;
    assert.ok(!checked.has(version.name), `Duplicate version metadata: ${version.name}`);
    checkSidebar(version.sidebar, version.name);
    checkPagination(indexDocs, version.name);
    checked.add(version.name);
  }
  assert.equal(checked.size, 2, "Build current and v0.17 docs before checking navigation");
}

if (require.main === module) {
  const root = resolve(__dirname, "../..");
  checkNavigation(root);
  console.log("Checked current/v0.17 MASM order, unique index, and landing-page pagination");
}
