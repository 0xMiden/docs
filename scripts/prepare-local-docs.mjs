import { createHash } from "node:crypto";
import { constants, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Only fill upstream-owned inputs. Authored pages and all existing files remain
// untouched, including uncommitted work and previously ingested content.
const upstreamDirectories = [
  "reference/protocol/", "reference/miden-vm/", "reference/node/", "reference/compiler/",
  "builder/tools/clients/rust-client/", "builder/tools/clients/img/", "builder/tools/clients/theme/",
  "builder/tools/cli/", "builder/tools/note-transport/", "builder/tools/bridging/",
  "builder/tutorials/miden-bank/", "builder/tutorials/components/", "builder/tutorials/img/",
  "builder/tutorials/theme/", "builder/tutorials/recipes/rust/", "builder/tutorials/recipes/web/",
  "builder/tutorials/recipes/img/", "builder/miden-guardian/",
];
const upstreamFiles = new Set([
  "builder/tools/clients/common-errors.md", "builder/tools/clients/_category_.yml",
  "builder/tutorials/miden_node_setup.md",
]);
const authoredFiles = new Set([
  "builder/tutorials/miden-bank/index.md",
  "builder/tutorials/recipes/rust/_category_.json", "builder/tutorials/recipes/web/_category_.json",
  "builder/miden-guardian/index.md", "builder/miden-guardian/_category_.json",
]);

function walk(dir, prefix = "") {
  return readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .flatMap((entry) => {
      const path = `${prefix}${entry.name}`;
      if (entry.isDirectory()) return walk(join(dir, entry.name), `${path}/`);
      return entry.isFile() ? [path] : [];
    });
}

export function prepareLocalDocs(root, snapshot) {
  const versions = JSON.parse(readFileSync(join(root, "versions.json"), "utf8"));
  if (!/^\d+\.\d+$/.test(snapshot) || !versions.includes(snapshot)) {
    throw new Error(`Unknown snapshot: ${snapshot}`);
  }
  const source = join(root, "versioned_docs", `version-${snapshot}`);
  if (!existsSync(source)) throw new Error(`Snapshot directory is missing: ${source}`);
  const files = [];
  for (const path of walk(source)) {
    if (authoredFiles.has(path) || !(upstreamFiles.has(path) || upstreamDirectories.some((dir) => path.startsWith(dir)))) continue;
    const target = join(root, "docs", path);
    if (existsSync(target)) continue;
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(source, path), target, constants.COPYFILE_EXCL);
    files.push({ path: `docs/${path}`, sha256: createHash("sha256").update(readFileSync(target)).digest("hex") });
  }
  return { snapshot, files };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const options = {};
    for (let i = 0; i < args.length; i += 2) {
      if (!["--snapshot", "--manifest"].includes(args[i]) || !args[i + 1]) {
        throw new Error("Usage: npm run prepare:docs -- --snapshot 0.17 [--manifest /path/to/manifest.json]");
      }
      options[args[i]] = args[i + 1];
    }
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    let manifestPath = options["--manifest"] && resolve(options["--manifest"]);
    if (manifestPath) {
      // macOS /var and /tmp are aliases. Resolve existing ancestors before
      // deciding whether an output path could overlap repository inputs.
      let ancestor = manifestPath;
      const missingParts = [];
      while (!existsSync(ancestor)) {
        missingParts.unshift(basename(ancestor));
        ancestor = dirname(ancestor);
      }
      manifestPath = join(realpathSync(ancestor), ...missingParts);
      const pathFromRoot = relative(root, manifestPath);
      if (!pathFromRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && !isAbsolute(pathFromRoot)) {
        throw new Error("Keep the manifest outside the repository to avoid overwriting build inputs.");
      }
      if (existsSync(manifestPath)) throw new Error(`Manifest already exists: ${manifestPath}; keep it or choose a new path.`);
    }
    const manifest = prepareLocalDocs(root, options["--snapshot"] || "");
    if (manifestPath) writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
    console.log(`Prepared ${manifest.files.length} missing inputs from snapshot ${manifest.snapshot}; existing files preserved.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
