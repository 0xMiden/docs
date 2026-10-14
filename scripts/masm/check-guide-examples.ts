import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface GuideSpec {
  project: string;
  files: readonly string[];
}

export const guideSpecs: readonly GuideSpec[] = [
  {
    project: "first-project",
    files: ["Cargo.toml", "rust-toolchain.toml", "src/area.masm", "src/main.rs"],
  },
  {
    project: "account-components",
    files: ["Cargo.toml", "rust-toolchain.toml", "masm/settings.masm", "masm/update.masm", "src/main.rs"],
  },
  {
    project: "note-scripts",
    files: ["Cargo.toml", "rust-toolchain.toml", "masm/set-value.masm", "src/main.rs"],
  },
];

function presentedSource(root: string, project: string, filename: string): string {
  const source = readFileSync(resolve(root, "examples/masm", project, filename), "utf8");
  // The note guide presents the runnable host; rejection tests remain in the fixture.
  const testStart = source.indexOf("\n#[cfg(test)]");
  if (project === "note-scripts" && filename === "src/main.rs" && testStart !== -1) {
    return source.slice(0, testStart).trimEnd();
  }
  return source.trimEnd();
}

export function checkGuideExamples(root: string): number {
  let checked = 0;
  for (const { project, files } of guideSpecs) {
    const page = `builder/smart-contracts/masm/${project}.md`;
    const current = readFileSync(resolve(root, "docs", page), "utf8");
    const versioned = readFileSync(resolve(root, "versioned_docs/version-0.17", page), "utf8");
    assert.equal(current, versioned, `${project}: current and v0.17 guides differ`);

    const filenames: string[] = [];
    const sourceFences = /```(?:rust|masm|toml)([^\n]*)\n([\s\S]*?)\n```/g;
    for (const match of current.matchAll(sourceFences)) {
      const info = match[1];
      const snippet = match[2];
      assert.ok(info !== undefined && snippet !== undefined, "Incomplete source fence");
      const filename = info.match(/title="([^"]+)"/)?.[1];
      assert.ok(filename, `${project}: runnable source fence must name its file`);
      assert.ok(files.includes(filename), `${project}: unexpected source file ${filename}`);
      filenames.push(filename);
      assert.equal(
        snippet,
        presentedSource(root, project, filename),
        `${project}/${filename}: guide differs from executable source`,
      );
      checked++;
    }
    assert.deepEqual(
      filenames.sort(),
      [...files].sort(),
      `${project}: required source fence missing or duplicated`,
    );
  }
  assert.equal(checked, 13, "Expected all 13 executable/configuration source fences");
  return checked;
}

if (require.main === module) {
  const root = resolve(__dirname, "../..");
  const checked = checkGuideExamples(root);
  console.log(`Checked ${checked} code blocks and three current/v0.17 guide mirrors`);
}
