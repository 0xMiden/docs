import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { test, type TestContext } from "node:test";
import { checkGuideExamples, guideSpecs } from "./check-guide-examples.js";
import { checkNavigation } from "./check-navigation.js";

const repository = resolve(__dirname, "../..");
const pageDirectory = "builder/smart-contracts/masm";
const metadataDirectory = ".docusaurus/docusaurus-plugin-content-docs/default";
const guideIds = ["first-project", "account-components", "note-scripts"]
  .map((page) => `${pageDirectory}/${page}`);

function temporaryRoot(context: TestContext): string {
  const root = mkdtempSync(resolve(tmpdir(), "masm-checkers-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function write(root: string, path: string, contents: string): void {
  const destination = resolve(root, path);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, contents);
}

function guideFixture(context: TestContext): string {
  const root = temporaryRoot(context);
  for (const { project, files } of guideSpecs) {
    const paths = [
      `docs/${pageDirectory}/${project}.md`,
      `versioned_docs/version-0.17/${pageDirectory}/${project}.md`,
      ...files.map((file) => `tests/masm/${project}/${file}`),
    ];
    for (const path of paths) {
      const destination = resolve(root, path);
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(resolve(repository, path), destination);
    }
  }
  return root;
}

function rewriteFirstGuide(root: string, transform: (page: string) => string, mirror = true): void {
  const path = `${pageDirectory}/first-project.md`;
  const changed = transform(readFileSync(resolve(root, "docs", path), "utf8"));
  write(root, `docs/${path}`, changed);
  if (mirror) write(root, `versioned_docs/version-0.17/${path}`, changed);
}

test("all 13 source fences match executable files and their versioned mirrors", (context) => {
  assert.equal(checkGuideExamples(guideFixture(context)), 13);
});

test("removing a configuration fence from both mirrors is rejected", (context) => {
  const root = guideFixture(context);
  rewriteFirstGuide(root, (page) => page.replace(/```toml title="Cargo.toml"\n[\s\S]*?\n```/, ""));
  assert.throws(() => checkGuideExamples(root), /required source fence missing or duplicated/);
});

test("duplicating a source fence is rejected", (context) => {
  const root = guideFixture(context);
  rewriteFirstGuide(root, (page) => {
    const fence = page.match(/```toml title="Cargo.toml"\n[\s\S]*?\n```/)?.[0];
    assert.ok(fence);
    return `${page}\n${fence}\n`;
  });
  assert.throws(() => checkGuideExamples(root), /required source fence missing or duplicated/);
});

test("source fences must name a supported executable file", (context) => {
  const root = guideFixture(context);
  rewriteFirstGuide(root, (page) => page.replace('title="Cargo.toml"', 'title="other.toml"'));
  assert.throws(() => checkGuideExamples(root), /unexpected source file other.toml/);
});

test("untitled source fences are rejected", (context) => {
  const root = guideFixture(context);
  rewriteFirstGuide(root, (page) => page.replace(' title="Cargo.toml"', ""));
  assert.throws(() => checkGuideExamples(root), /runnable source fence must name its file/);
});

test("guide source drift is rejected even when both mirrors agree", (context) => {
  const root = guideFixture(context);
  write(root, "tests/masm/first-project/src/area.masm", "begin push.99 end\n");
  assert.throws(() => checkGuideExamples(root), /guide differs from executable source/);
});

test("current and v0.17 prose must also remain identical", (context) => {
  const root = guideFixture(context);
  rewriteFirstGuide(root, (page) => `${page}\nChanged prose.\n`, false);
  assert.throws(() => checkGuideExamples(root), /current and v0.17 guides differ/);
});

function versionMetadata(version: string, children: readonly unknown[] = guideIds.map((docId) => ({ docId }))) {
  return {
    version: {
      version,
      docsSidebars: {
        builderSidebar: [{
          type: "category", label: "Smart Contracts", items: [{
            type: "category", label: "MASM", items: children,
          }],
        }],
      },
    },
  };
}

function navigationFixture(context: TestContext): string {
  const root = temporaryRoot(context);
  for (const version of ["current", "0.17"]) {
    write(root, `${metadataDirectory}/p/${version}.json`, JSON.stringify(versionMetadata(version)));
    const directory = version === "current" ? "docs" : "versioned_docs/version-0.17";
    const prefix = version === "current" ? "/next" : "";
    write(root, `${metadataDirectory}/masm-index-${version}.json`, JSON.stringify({
      source: `@site/${directory}/${pageDirectory}/index.md`,
      next: { permalink: `${prefix}/${pageDirectory}/first-project` },
    }));
  }
  return root;
}

function rewriteVersion(root: string, children: readonly unknown[]): void {
  write(root, `${metadataDirectory}/p/current.json`, JSON.stringify(versionMetadata("current", children)));
}

test("navigation accepts the ordered guides followed by the merged transaction guides", (context) => {
  const root = navigationFixture(context);
  const ids = [...guideIds, ...["transaction-scripts", "testing-mockchain", "debugging"].map((page) => `${pageDirectory}/${page}`)];
  rewriteVersion(root, ids.map((docId) => ({ docId })));
  assert.doesNotThrow(() => checkNavigation(root));
});

test("navigation ignores archived versions", (context) => {
  const root = navigationFixture(context);
  write(root, `${metadataDirectory}/p/archive.json`, JSON.stringify({ version: { version: "0.16" } }));
  assert.doesNotThrow(() => checkNavigation(root));
});

test("navigation rejects an incorrect guide order", (context) => {
  const root = navigationFixture(context);
  rewriteVersion(root, [...guideIds].reverse().map((docId) => ({ docId })));
  assert.throws(() => checkNavigation(root), /wrong guide order/);
});

test("navigation rejects duplicate guide children", (context) => {
  const root = navigationFixture(context);
  rewriteVersion(root, [...guideIds, guideIds[0]].map((docId) => ({ docId })));
  assert.throws(() => checkNavigation(root), /Duplicate guide/);
});

test("navigation rejects an index listed as its own child", (context) => {
  const root = navigationFixture(context);
  rewriteVersion(root, [...guideIds, `${pageDirectory}/index`].map((docId) => ({ docId })));
  assert.throws(() => checkNavigation(root), /Duplicate index child/);
});

test("landing-page Next must point to the first guide", (context) => {
  const root = navigationFixture(context);
  write(root, `${metadataDirectory}/masm-index-current.json`, JSON.stringify({
    source: `@site/docs/${pageDirectory}/index.md`,
    next: { permalink: `/next/${pageDirectory}/index` },
  }));
  assert.throws(() => checkNavigation(root), /first-project/);
});

test("both supported versions must have generated metadata", (context) => {
  const root = navigationFixture(context);
  rmSync(resolve(root, `${metadataDirectory}/p/0.17.json`));
  assert.throws(() => checkNavigation(root), /Build current and v0.17 docs/);
});

test("a duplicate version cannot stand in for the missing other version", (context) => {
  const root = navigationFixture(context);
  rmSync(resolve(root, `${metadataDirectory}/p/0.17.json`));
  write(root, `${metadataDirectory}/p/duplicate.json`, JSON.stringify(versionMetadata("current")));
  assert.throws(() => checkNavigation(root), /Duplicate version metadata/);
});

test("selected version metadata must contain a sidebar array", (context) => {
  const root = navigationFixture(context);
  write(root, `${metadataDirectory}/p/current.json`, JSON.stringify({
    version: { version: "current", docsSidebars: { builderSidebar: null } },
  }));
  assert.throws(() => checkNavigation(root), /missing builderSidebar/);
});

test("navigation reports a missing MASM category", (context) => {
  const root = navigationFixture(context);
  write(root, `${metadataDirectory}/p/current.json`, JSON.stringify({
    version: { version: "current", docsSidebars: { builderSidebar: [{
      type: "category", label: "Smart Contracts", items: [],
    }] } },
  }));
  assert.throws(() => checkNavigation(root), /missing MASM category/);
});

test("MASM children must contain doc IDs", (context) => {
  const root = navigationFixture(context);
  rewriteVersion(root, [{ docId: null }]);
  assert.throws(() => checkNavigation(root), /invalid MASM doc child/);
});
