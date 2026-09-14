#!/usr/bin/env node
// Rebase root-absolute internal links within an ingested docs tree.
//
// Each section under docs/reference/<x>/ is ingested from a repo whose docs are
// their OWN standalone Docusaurus site (baseUrl "/"), so internal links are
// authored root-absolute, e.g. `](/full-node/installation)`. Once mounted under
// /reference/<x>/ here — and served per-version (/next/…, /0.15/…, bare) — those
// absolute links lose both the mount prefix AND the version segment, so they 404.
//
// We convert each resolvable root-absolute link to a RELATIVE link to the target
// `.md` file. The input may be a reference section or a complete version snapshot.
// Docusaurus resolves relative `.md` links at build time, version-aware and
// validated by onBrokenLinks — so they work in every version the section appears
// in, and survive being snapshotted by cut-versions.
//
// Usage: node scripts/rebase-ingested-links.mjs <docsTreeDir>
// Unresolvable targets (e.g. cross-site or genuinely dead) are left untouched and
// reported, so the build's link checker still surfaces them.

import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join, relative, dirname, posix } from "path";

const docsTreeDir = process.argv[2];
if (!docsTreeDir || !existsSync(docsTreeDir)) {
  console.error(`rebase-ingested-links: docs tree not found: ${docsTreeDir}`);
  process.exit(0); // no-op rather than fail the deploy if a section is absent
}

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

// Older source docs still use pre-v0.4 public routes. Resolve those aliases to
// their current files so canonical docs.miden.xyz links can be frozen too.
const LEGACY_TARGET_ALIASES = new Map([
  ["miden-vm/overview", "reference/miden-vm/overview"],
  ["miden-node/rpc", "reference/node/rpc"],
  ["core-concepts/miden-vm", "reference/miden-vm"],
  ["core-concepts/compiler", "reference/compiler"],
  ["builder/migration/account-changes", "builder/migration/03-account-changes"],
  ["builder/smart-contracts/accounts", "builder/smart-contracts/accounts/introduction"],
  ["builder/tutorials/rust-compiler/testing", "builder/tutorials/helpers/testing"],
  ["builder/tutorials/rust-compiler/debugging", "builder/tutorials/helpers/debugging"],
  ["builder/tutorials/rust-compiler/pitfalls", "builder/tutorials/helpers/pitfalls"],
]);

// Resolve a tree-root-absolute target (e.g. "full-node/installation" when the
// tree is a reference section, or "reference/node/full-node/installation" when
// the tree is a full version snapshot) to an actual doc file, or null.
const resolveTarget = (targetPath) => {
  const localPath = targetPath.replace(/^https:\/\/docs\.miden\.xyz/, "");
  const clean = localPath.replace(/^\//, "").replace(/\/$/, "");
  const aliased = LEGACY_TARGET_ALIASES.get(clean) || clean;
  const noExt = aliased.replace(/\.mdx?$/, "");
  const candidates = noExt === ""
    ? ["index.md", "index.mdx"]
    : [`${noExt}.md`, `${noExt}.mdx`, `${noExt}/index.md`, `${noExt}/index.mdx`];
  for (const c of candidates) {
    const abs = join(docsTreeDir, c);
    if (existsSync(abs)) return abs;
  }
  return null;
};

let filesChanged = 0;
let linksRebased = 0;
const unresolved = [];

// Match root-absolute and canonical docs.miden.xyz Markdown targets, excluding
// protocol-relative URLs and pure anchors. Capture target + optional #anchor.
const LINK_RE = /(\]\()((?:https:\/\/docs\.miden\.xyz)?\/(?!\/)[^)\s#]*)(#[^)\s]*)?(\))/g;

for (const file of walk(docsTreeDir)) {
  if (!/\.mdx?$/.test(file)) continue;
  const src = readFileSync(file, "utf8");
  let touched = false;

  const out = src.replace(LINK_RE, (m, open, target, anchor = "", close) => {
    const resolved = resolveTarget(target);
    if (!resolved) {
      unresolved.push(`${relative(docsTreeDir, file)} -> ${target}`);
      return m; // leave untouched; build link-checker will flag if truly broken
    }
    // Relative path from the current file's directory to the target file (POSIX).
    let rel = relative(dirname(file), resolved).split(/[\\/]/).join(posix.sep);
    if (!rel.startsWith(".")) rel = `./${rel}`;
    touched = true;
    linksRebased++;
    return `${open}${rel}${anchor}${close}`;
  });

  if (touched) {
    writeFileSync(file, out);
    filesChanged++;
  }
}

console.log(
  `rebase-ingested-links: ${docsTreeDir} — rebased ${linksRebased} link(s) across ${filesChanged} file(s)` +
    (unresolved.length ? `; ${unresolved.length} unresolved (left as-is):\n  - ${unresolved.join("\n  - ")}` : "")
);
