#!/usr/bin/env node
// Rebase root-absolute internal links in an ingested reference section.
//
// Each section under docs/reference/<x>/ is ingested from a repo whose docs are
// their OWN standalone Docusaurus site (baseUrl "/"), so internal links are
// authored root-absolute, e.g. `](/full-node/installation)`. Once mounted under
// /reference/<x>/ here — and served per-version (/next/…, /0.15/…, bare) — those
// absolute links lose both the mount prefix AND the version segment, so they 404.
//
// We convert each root-absolute link to a RELATIVE link to the target `.md` file.
// Docusaurus resolves relative `.md` links at build time, version-aware and
// validated by onBrokenLinks — so they work in every version the section appears
// in, and survive being snapshotted by cut-versions.
//
// Usage: node scripts/rebase-ingested-links.mjs <sectionDir>
// Unresolvable targets (e.g. cross-site or genuinely dead) are left untouched and
// reported, so the build's link checker still surfaces them.

import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join, relative, dirname, posix } from "path";

const sectionDir = process.argv[2];
if (!sectionDir || !existsSync(sectionDir)) {
  console.error(`rebase-ingested-links: section dir not found: ${sectionDir}`);
  process.exit(0); // no-op rather than fail the deploy if a section is absent
}

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

// Resolve a section-root-absolute target (e.g. "full-node/installation",
// "full-node/", "rpc") to an actual doc file under the section, or null.
const resolveTarget = (targetPath) => {
  const clean = targetPath.replace(/^\//, "").replace(/\/$/, "");
  const noExt = clean.replace(/\.mdx?$/, "");
  const candidates = noExt === ""
    ? ["index.md", "index.mdx"]
    : [`${noExt}.md`, `${noExt}.mdx`, `${noExt}/index.md`, `${noExt}/index.mdx`];
  for (const c of candidates) {
    const abs = join(sectionDir, c);
    if (existsSync(abs)) return abs;
  }
  return null;
};

let filesChanged = 0;
let linksRebased = 0;
const unresolved = [];

// Match markdown links/images whose target starts with "/" (root-absolute),
// excluding protocol-relative ("//") and pure anchors. Capture target + optional #anchor.
const LINK_RE = /(\]\()(\/(?!\/)[^)\s#]*)(#[^)\s]*)?(\))/g;

for (const file of walk(sectionDir)) {
  if (!/\.mdx?$/.test(file)) continue;
  const src = readFileSync(file, "utf8");
  let touched = false;

  const out = src.replace(LINK_RE, (m, open, target, anchor = "", close) => {
    const resolved = resolveTarget(target);
    if (!resolved) {
      unresolved.push(`${relative(sectionDir, file)} -> ${target}`);
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
  `rebase-ingested-links: ${sectionDir} — rebased ${linksRebased} link(s) across ${filesChanged} file(s)` +
    (unresolved.length ? `; ${unresolved.length} unresolved (left as-is):\n  - ${unresolved.join("\n  - ")}` : "")
);
