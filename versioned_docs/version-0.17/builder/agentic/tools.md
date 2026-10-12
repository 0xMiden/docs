---
title: "Agentic tools"
description: "Use ecosystem skills and command prompts without confusing them with executable services."
---

# Agentic tools

[Agent tools](https://github.com/0xMiden/agent-tools) contains release-scoped Rust, MASM and protocol knowledge skills and Markdown command prompts. Read a skill's `SKILL.md` to understand its scope and prerequisites. Read command prompt files before using an editor's slash-command integration.

## Discover and select context

Clone the repository into a separate location and inspect `skills/`, `commands/` and the README's compatibility table. Choose the skills for your task rather than replacing an existing editor skill directory. Keep project-specific instructions and installed SDK guidance intact.

When your agent cannot discover a skill automatically, provide its file path and ask it to read it. If you manually install selected files, use the discovery directory documented by your editor, inspect collisions first, and verify the copied content and loaded context afterward.

## Prompts and execution

A review or dependency-audit prompt describes work for the agent to perform. It does not itself run a scanner, grant permissions, start infrastructure or prove that the checks ran. Report actual commands, exit codes and output. Scope signing, submission and state changes separately from reading source or compiling code.

There is no Miden MCP runtime in this bundle. Frontend API guidance belongs to the installed Web SDK packages described in [Setup](setup.md), not a duplicate agent-tools frontend bundle.

## Installer availability

[Agent-tools PR #19](https://github.com/0xMiden/agent-tools/pull/19) implements the project-local helper and consumer checks. **Integration gate:** run the following commands from an agent-tools checkout containing that integrated change, using Python 3.10+. Until then, read the existing prompt files directly or use your editor's documented discovery mechanism.

```bash
python3 scripts/agent_tools.py list
python3 scripts/agent_tools.py check
# Preview only; choose an existing project and review destination/collision checks.
python3 scripts/agent_tools.py install --project /path/to/project --agent codex
# Writes selected prompt copies and the marked AGENTS.md index.
python3 scripts/agent_tools.py install --project /path/to/project --agent codex --apply
python3 scripts/agent_tools.py check --project /path/to/project --agent codex
```

Preview creates no destination files. `--apply` preserves unrelated context and SDK skills, and refuses collisions, symlink destinations and malformed markers. Keep the same agent/selection when checking; use repeated `--skill` arguments to narrow installation. The CLI's README describes Claude/Cursor discovery paths and Claude-only command registration. These are local file operations, not package installation or runtime checks.

## Check consumer versions and context

After PR #19 integration, declare the stable docs release explicitly. From the agent-tools checkout:

```bash
python3 scripts/agent_tools.py check-consumer \
  --project /path/to/agentic-template/project-template --profile rust \
  --docs-version 0.17 --docs-channel stable
python3 scripts/agent_tools.py check-consumer \
  --project /path/to/agentic-template/frontend-template --profile web --agent codex \
  --docs-version 0.17 --docs-channel stable
```

The Rust profile reads `Cargo.lock` and `miden-toolchain.toml`; it does not run a compiler or validate package/store format. The Web profile checks exact declarations, npm v2/v3 or Yarn v1 resolved locks, installed guide/skill hashes, copied skill bytes, root package-guide pointers and the `prepare` declaration. Its tested reference pins are core SDK `0.17.1` and React/Vite/initializer `0.17.0`. Other pins or lock formats require separate validation; do not automatically bump them. Claude additionally needs a frontend `CLAUDE.md` import of `@AGENTS.md`.

`current`/Next is unstable and fails this stable release-context check. JSON retains `docs_live_verified: false`, `compiler_execution_verified: false` for Rust and `hook_execution_verified: false` for Web. A passing read-only check does not prove those actions occurred.

At the reviewed PR #24 head, the actual Rust consumer passes; its frontend still fails because its root `AGENTS.md` lacks installed-package guide pointers. This is an open template context-acceptance gap, separate from the passing published reference-consumer acceptance. Inspect the installed initializer before using it to repair that gap; after reviewing the intended edits, run it from the frontend directory:

```bash
node node_modules/@miden-sdk/create/dist/cli.js
```

That command writes root pointers/imports, the prepare declaration and synced skills. Review its diff and rerun the Web consumer check. It is a mutation, not a read-only verification command. Preserve existing project and agent-tools context rather than replacing entire instruction or skill directories.

For recovery, remove only files you installed and can identify; preserve unrelated skills and project context. Use [Diagnose and recover](recover.md) for build and runtime failures.
