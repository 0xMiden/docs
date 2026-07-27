#!/usr/bin/env node

import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const tutorialsDir = resolve(process.argv[2] ?? "");

if (!process.argv[2] || !existsSync(tutorialsDir)) {
  console.error(
    "Usage: node scripts/fix-ingested-tutorial-links.mjs <tutorials-directory>",
  );
  process.exit(1);
}

function markdownFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return markdownFiles(path);
    }
    return /\.(md|mdx)$/.test(entry) ? [path] : [];
  });
}

let filesChanged = 0;
let linksRebased = 0;

for (const path of markdownFiles(tutorialsDir)) {
  const original = readFileSync(path, "utf8");
  const relativePath = relative(tutorialsDir, path);
  let updated = original;

  if (
    relativePath.startsWith(`recipes${sep}rust${sep}`) ||
    relativePath.startsWith(`recipes${sep}web${sep}`)
  ) {
    updated = updated.replace(
      /\]\(\.\.\/miden_node_setup(\.md)?/g,
      "](../../miden_node_setup$1",
    );
  }

  if (relativePath === join("miden-bank", "index.md")) {
    updated = updated.replace(/(\bhref:\s*['"])miden-bank\//g, "$1./");
  }

  if (updated !== original) {
    linksRebased += (
      original.match(/miden_node_setup|href:\s*['"]miden-bank\//g) ?? []
    ).length;
    writeFileSync(path, updated);
    filesChanged += 1;
  }
}

console.log(
  `fix-ingested-tutorial-links: rebased ${linksRebased} link(s) across ${filesChanged} file(s)`,
);
