---
title: "Check your setup"
sidebar_label: "Check your setup"
description: "After agentic-template setup, verify source pins, installed tools, package guidance, and the context your coding agent actually loads."
---

# Check your setup

Complete [Set up agentic-template](setup.md) first, including the recursive clone and installer. The checks below assume that workspace and its dependencies exist. Run commands from its root unless a different directory is shown.

## Check the release

After setup completes, run from the agentic-template root. Keep the checked-in lockfiles and submodule pins:

```bash
bash scripts/journey.sh doctor
git rev-parse HEAD
git submodule status --recursive
(cd project-template && rustc --version)
(cd project-template && midenup show active-toolchain)
(cd frontend-template && node --version)
(cd frontend-template && yarn --version)
python3 --version
```

The v0.17 template uses the following versions. They differ intentionally; do not change every package to `0.17.0`.

| Layer | Version |
| --- | --- |
| Miden channel / compiler / guest Rust SDK | `0.17.0` / `0.11.0` / `0.15.0` |
| Protocol / Rust client and store / VM | `0.17.1` / `0.17.2` / `0.35.0` |
| Disposable local-node components | `0.17.0`, digest-pinned |
| Browser core / React, adapters and tooling | `0.17.1` / `0.17.0` |
| Contract Rust toolchain | `nightly-2026-09-01` |

The project submodule is pinned to `e941949b1cb244f1557ace1c58dca0dc7a898da8`; the frontend is pinned to `71fb5bb0a205224d04a7d0264fad2cecc8d4478d`. Compare your checkout before using this workflow.

The v0.17 docs snapshot also contains Rust client and node sources at `0.17.3`. Those pages do not upgrade a project pinned to `0.17.2`. Use [Migration](../migration/index.md) when changing releases, rebuild format-7 contract packages, and keep v0.16 stores and serialized artifacts separate.

## Load the right instructions

Open the agent at the agentic-template root. Read the root `CLAUDE.md` and README, then the instructions in each subproject you will change. If your agent does not discover `CLAUDE.md` automatically, supply it explicitly.

| Agent | Project context | Skill location |
| --- | --- | --- |
| Codex | `AGENTS.md` and its referenced guides | `.agents/skills/` |
| Claude Code | `CLAUDE.md`, plus imported or directly referenced package guides | `.claude/skills/` |
| Cursor | Project instructions and selected skill files | `.cursor/skills/` |

Ask the agent to name the files it read and explain the release tuple. File presence alone does not establish discovery. Claude hooks and slash commands are agent-specific; run build and test stages explicitly when your agent does not execute them.

## Reuse installed SDK guidance

In `frontend-template`, browser API instructions ship with the installed npm packages. Read their `AGENTS.md` and `skills/` directories under:

- `node_modules/@miden-sdk/miden-sdk`
- `node_modules/@miden-sdk/react`
- `node_modules/@miden-sdk/vite-plugin`

Keep those packages as the source for browser APIs. The optional [agent-tools bundle](tools.md) provides Rust, MASM, and protocol knowledge; it does not supply a duplicate frontend bundle.

An install or `prepare` exit can hide a failed context sync. [Check package guides, pointers, and copied skills](#optional-automated-context-check) before relying on automatic guidance. The consumer checker targets stable v0.17, even when you are reading the separate Current/Next documentation channel.

A useful first request:

> Read the project and installed package guides. Explain the app's state and transaction flow, identify missing prerequisites, and list the build and test commands with their working directories before changing code.

## Optional automated context check

For a file-based context check, use Python 3.11+ and the [agent-tools](https://github.com/0xMiden/agent-tools) checker. If you do not already have its checkout, clone it beside agentic-template while your shell remains at the agentic-template root:

```bash
git clone https://github.com/0xMiden/agent-tools.git ../agent-tools
```

Then check the installed template subprojects:

```bash
python3 ../agent-tools/scripts/agent_tools.py check-consumer \
  --project project-template --profile rust \
  --docs-version 0.17 --docs-channel stable
python3 ../agent-tools/scripts/agent_tools.py check-consumer \
  --project frontend-template --profile web --agent codex \
  --docs-version 0.17 --docs-channel stable
```

The Rust check reads `Cargo.lock` and `miden-toolchain.toml`. The Web check requires the installed dependencies from setup and compares exact declarations, resolved npm v2/v3 or Yarn v1 locks, guides/skills, copied skills, root guide pointers, and the `prepare` declaration. Its reference versions are core SDK `0.17.1` and React/Vite/initializer `0.17.0`; validate other versions or lock formats separately.

Use `--agent claude` or `--agent cursor` for those environments. Claude needs either an `@AGENTS.md` import or the package-guide pointers directly in `CLAUDE.md`. The checker targets stable v0.17; `--docs-channel current` refers to unstable Current/Next and fails this release-context check.

Its JSON deliberately leaves live docs, compiler execution, and hook execution unverified. A passing file check is not evidence that an agent loaded instructions or a hook ran. Installing the extra agent-tools skill bundle is optional and is not required to run this checker.

## Repair missing frontend pointers

The pinned frontend can have correctly synced skills but missing root package-guide pointers. Inspect the installed initializer if the guides are not referenced by the frontend's root instructions or the Web check reports that gap. After reviewing its changes, run it in the frontend directory without changing your shell's workspace root:

```bash
(cd frontend-template && node node_modules/@miden-sdk/create/dist/cli.js)
git -C frontend-template diff
```

This is a write operation: it creates guide pointers, agent imports, the prepare declaration, and synced copies. Preserve project instructions and unrelated skills, review the diff, and repeat the context check. A `prepare` exit of zero alone is insufficient because the published hook can tolerate a sync failure.

Continue to [Build your first app](first-app.md) once the toolchain and the agent's context are ready. Use [Troubleshoot](recover.md) for a failed check.
