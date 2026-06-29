#!/usr/bin/env node
// Ingest OpenZeppelin/guardian `docs/` (raw, README-style markdown — no frontmatter,
// mixed with infra files) into the Docusaurus tree as `docs/builder/miden-guardian/`.
//
// Unlike the 0xMiden reference repos (which ship Docusaurus-ready markdown), the
// Guardian docs need transforming, so this script:
//   1. copies only the human doc `.md` pages, excluding infra files
//      (docker-compose.yml, *.env*, *.json, *.sh, *.gitignore, grafana/prometheus);
//   2. normalizes filenames (UPPER_SNAKE.md -> lower-kebab.md) and flattens the
//      guide subdirs (guides/<topic>/README.md -> guides/<topic>.md, guides/README.md
//      -> guides/overview.md); the top-level README.md is dropped (a custom authored
//      index.md replaces it);
//   3. injects frontmatter (title from the H1, sidebar_position from the order map)
//      and strips the now-duplicate leading H1;
//   4. rewrites links — internal doc links become normalized relative `.md` links
//      (validated by onBrokenLinks); links to excluded/repo files (../…, infra files)
//      become absolute GitHub blob URLs at the ingested ref (line anchors preserved);
//      external URLs are left untouched;
//   5. emits `_category_.json` for the architecture/guides/runbooks subcategories.
//
// The authored `index.md` is never written by this script and is restored by the
// workflow (git checkout) after ingestion.
//
// Usage: node scripts/ingest-guardian.mjs <srcDocsDir> <destDir> [ref]

import {
  readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync,
} from "fs";
import { join, dirname, relative, posix } from "path";

const [srcDir, destDir, ref = "v0.15.0"] = process.argv.slice(2);
if (!srcDir || !destDir || !existsSync(srcDir)) {
  console.error(`ingest-guardian: usage: node scripts/ingest-guardian.mjs <srcDocsDir> <destDir> [ref]; src not found: ${srcDir}`);
  process.exit(1);
}
const REPO = "OpenZeppelin/guardian";
const blob = (repoPath) => `https://github.com/${REPO}/blob/${ref}/${repoPath}`;

// --- foldering: which subcategory each top-level OZ page lands in (by kebab name) ---
const TOP_FOLDER = {
  "concepts": "getting-started", "quickstart": "getting-started", "local-dev": "getting-started",
  "configuration": "reference", "openapi": "reference", "multisig-sdk": "reference",
  "production": "operations", "dashboard": "operations",
  "server-aws-deploy": "operations", "troubleshooting": "operations",
};
// --- sidebar ordering (by dest path, no extension) ---
const ORDER = {
  "getting-started/concepts": 1, "getting-started/quickstart": 2, "getting-started/local-dev": 3,
  "architecture/services": 1, "architecture/infra": 2,
  "guides/overview": 1, "guides/aws-signers": 2, "guides/miden-dashboard": 3,
  "guides/observability": 4, "guides/postgres-tls": 5,
  "operations/production": 1, "operations/dashboard": 2,
  "operations/server-aws-deploy": 3, "operations/troubleshooting": 4,
  "reference/configuration": 1, "reference/openapi": 2, "reference/multisig-sdk": 3,
  "runbooks/secrets": 1, "runbooks/enable-db-tls": 2,
};
const CATEGORIES = {
  "getting-started": { label: "Getting Started", position: 1 },
  "architecture": { label: "Architecture", position: 2 },
  "guides": { label: "Guides", position: 3 },
  "operations": { label: "Operations", position: 4 },
  "reference": { label: "Reference", position: 5 },
  "runbooks": { label: "Runbooks", position: 6 },
};

const kebab = (base) => base.replace(/\.md$/i, "").toLowerCase().replace(/_/g, "-");

// Map a docs-relative source path to its docs-relative destination, or null if excluded.
// README.md maps to index.md for LINK resolution; the copy loop skips it (custom index).
function destFor(srcRel) {
  const parts = srcRel.split("/");
  if (!srcRel.toLowerCase().endsWith(".md")) return null;
  if (parts.length === 1) {
    if (parts[0].toLowerCase() === "readme.md") return "index.md"; // link target only
    const name = kebab(parts[0]);
    const folder = TOP_FOLDER[name];
    return folder ? `${folder}/${name}.md` : `${name}.md`; // fallback flat for unmapped new pages
  }
  const [top, ...rest] = parts;
  if (top === "architecture" && rest.length === 1) return `architecture/${kebab(rest[0])}.md`;
  if (top === "runbooks" && rest.length === 1) return `runbooks/${kebab(rest[0])}.md`;
  if (top === "guides") {
    if (rest.length === 1 && rest[0].toLowerCase() === "readme.md") return "guides/overview.md";
    if (rest.length === 2 && rest[1].toLowerCase() === "readme.md") return `guides/${rest[0]}.md`;
  }
  return null; // anything else (infra files, nested non-README) is excluded
}

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const allFiles = walk(srcDir).map((abs) => relative(srcDir, abs).split(/[\\/]/).join(posix.sep));
const docPages = allFiles.filter((rel) => destFor(rel) && destFor(rel) !== "index.md");

// --- Make raw CommonMark MDX-safe. The OZ source isn't authored for MDX, so it
// contains constructs the MDX compiler/renderer rejects: autolinks (<https://…>)
// and curly braces ({ faucetId } is parsed as a JS expression). Fence- and
// inline-code-aware so code samples are left verbatim; only prose is touched.
function sanitizeMdx(body) {
  let fence = false;
  return body.split("\n").map((line) => {
    if (/^\s*```/.test(line)) { fence = !fence; return line; }
    if (fence) return line;
    // keep `inline code` spans verbatim; sanitize the prose between them
    return line.replace(/(`[^`]*`)|([^`]+)/g, (m, code, text) => {
      if (code) return code;
      return text
        .replace(/<((?:https?|ftp|mailto):[^>\s]+)>/g, "[$1]($1)") // autolink -> []()
        .replace(/[{}]/g, (c) => "\\" + c);                        // escape MDX braces
    });
  }).join("\n");
}

// --- link rewriting ---
const LINK_RE = /(\]\()([^)\s]+?)(#[^)\s]*)?(\))/g;

function rewriteLinks(srcRel, body) {
  const srcDestRel = destFor(srcRel); // e.g. guides/overview.md
  const srcDestDir = posix.dirname(srcDestRel);
  return body.replace(LINK_RE, (m, open, target, anchor = "", close) => {
    if (/^(https?:|mailto:|#|\/\/)/.test(target)) return m; // external / anchor-only / protocol-rel
    // Resolve the link target against the source FILE's docs-relative dir.
    const docsRel = posix.normalize(posix.join(posix.dirname(srcRel), target));
    const targetDest = docsRel.startsWith("..") ? null : destFor(docsRel);
    if (targetDest) {
      // internal doc page -> relative .md link from this page's dest dir
      let rel = posix.relative(srcDestDir, targetDest);
      if (!rel.startsWith(".")) rel = `./${rel}`;
      return `${open}${rel}${anchor}${close}`;
    }
    // points at an excluded/repo file -> GitHub blob URL at the ref.
    // repo path = normalize the target against the file's position under `docs/`.
    const repoPath = posix.normalize(posix.join("docs", posix.dirname(srcRel), target)).replace(/^\.\//, "");
    return `${open}${blob(repoPath)}${anchor}${close}`;
  });
}

function injectFrontmatter(destRel, body) {
  const lines = body.split("\n");
  let title = null, h1Idx = -1;
  for (let i = 0; i < lines.length; i++) {
    const mm = lines[i].match(/^#\s+(.+?)\s*$/);
    if (mm) { title = mm[1]; h1Idx = i; break; }
  }
  if (!title) title = kebab(posix.basename(destRel)).replace(/-/g, " ");
  // drop the H1 line (+ one trailing blank) to avoid a duplicate title
  if (h1Idx >= 0) {
    lines.splice(h1Idx, 1);
    if (lines[h1Idx] !== undefined && lines[h1Idx].trim() === "") lines.splice(h1Idx, 1);
  }
  const key = destRel.replace(/\.md$/, "");
  const pos = ORDER[key];
  const fm = [
    "---",
    `title: ${JSON.stringify(title)}`,
    ...(pos !== undefined ? [`sidebar_position: ${pos}`] : []),
    "---",
    "",
  ].join("\n");
  return fm + lines.join("\n").replace(/^\n+/, "");
}

// --- clean prior ingested output (keep only the authored index.md) ---
if (existsSync(destDir)) {
  for (const name of readdirSync(destDir)) {
    if (name === "index.md") continue;
    rmSync(join(destDir, name), { recursive: true, force: true });
  }
}

// --- copy + transform ---
let written = 0;
for (const srcRel of docPages) {
  const destRel = destFor(srcRel);
  const raw = readFileSync(join(srcDir, srcRel), "utf8");
  const out = injectFrontmatter(destRel, rewriteLinks(srcRel, sanitizeMdx(raw)));
  const destPath = join(destDir, destRel);
  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, out);
  written++;
}

// --- emit _category_.json for subcategories ---
for (const [dir, meta] of Object.entries(CATEGORIES)) {
  const d = join(destDir, dir);
  if (existsSync(d)) {
    writeFileSync(join(d, "_category_.json"), JSON.stringify({ label: meta.label, position: meta.position }, null, 2) + "\n");
  }
}

console.log(`ingest-guardian: wrote ${written} page(s) to ${destDir} from ${REPO}@${ref}`);
