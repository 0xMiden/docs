# Miden Docs — CLAUDE.md

## Project
Docusaurus v3 documentation site for the Miden ecosystem. Deployed at docs.miden.xyz.

## Key Directories
- `docs/` — current docs (reference, builder/)
- `docs/builder/` — developer-facing: tools, develop, get-started, smart-contracts, migration
- `docs/reference/` — protocol design docs
- `versioned_docs/` — pinned version snapshots
- `src/` — custom React components, pages, CSS
- `static/` — images, assets
- `.release/release-manifest.yml` — version info (read by docusaurus.config.ts)

## Commands
```bash
npm run build          # Full production build — ALWAYS run before PRing
npm run start          # Dev server with hot reload
npm run typecheck      # TypeScript check
npm run clear          # Clear Docusaurus cache (if builds are stale)
npm run generate:og    # Regenerate static Open Graph images
```

## Rules
- **Always `npm run build` before creating PRs** — catches broken links and build errors
- **Always verify URLs** — `curl -sL -o /dev/null -w "%{http_code}" <url>` before adding/changing links
- **Broken links**: `onBrokenLinks: "warn"` in config — treat warnings as errors for PRs
- Math: uses remark-math + rehype-katex for LaTeX
- Algolia search is configured

## Conventions
- Conventional commits: `docs:`, `fix:`, `feat:`
- Batch related small fixes into single PRs
- PR titles should be descriptive, not just "update docs"
- Keep markdown clean: no trailing whitespace, consistent heading levels
- Internal links: use relative paths, not absolute URLs
- Images go in `static/img/` with descriptive names
- Open Graph cards: when adding or moving a top-level docs section, update
  `src/utils/ogImages.ts` and `scripts/generate-og-images.mjs`. `npm run build`
  runs `npm run generate:og` first, so include any generated `static/img/og/*.png`
  changes in the PR.

## Gotchas
- `versioned_docs/` and `versioned_sidebars/` are auto-generated — don't edit manually unless you need to update the versioned_docs release contents
- `sidebars.ts` controls navigation — update when adding/removing pages
- Release manifest YAML drives version display — don't edit unless releasing
- Some custom components in `src/` — check before adding new ones
