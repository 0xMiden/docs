---
title: "Start here: release and agent context"
description: "Inspect versions, project instructions and installed SDK context before asking an agent to build."
---

# Start here: release and agent context

## Record your starting point

Use an isolated checkout and keep its lockfiles and submodule pins. Before installing or editing, ask the agent to read the root `AGENTS.md` or `CLAUDE.md`, the selected template README, and the instructions in each subproject it will touch.

Record the repository commit, submodule commits, `miden-toolchain.toml`, `rust-toolchain.toml`, Cargo lockfile and frontend package lockfile. For an existing recursive template checkout:

```bash
git rev-parse HEAD
git submodule status --recursive
```

Run tool version checks from the project directory so its toolchain overrides apply:

```bash
rustc --version
cargo --version
midenup --version
node --version
yarn --version
```

Read [Installation](../get-started/setup/installation.md) for the toolchain setup and [Migration](../migration/index.md) when moving an older project to v0.17.

## Match the compatibility tuple

The reviewed agentic-template baseline uses project pin `e941949b1cb244f1557ace1c58dca0dc7a898da8` and frontend pin `71fb5bb0a205224d04a7d0264fad2cecc8d4478d`.

| Layer | Template baseline |
| --- | --- |
| Miden channel / compiler / guest Rust SDK | `0.17.0` / `0.11.0` / `0.15.0` |
| Protocol / Rust client and store / VM | `0.17.1` / `0.17.2` / `0.35.0` |
| Browser core / React, adapters and tooling | `0.17.1` / `0.17.0` |
| Contract Rust toolchain | `nightly-2026-09-01` |

These versions intentionally differ. The v0.17 docs snapshot contains Rust client and node sources at `0.17.3`; that does not upgrade a template pinned to `0.17.2`. Check the resolved dependencies before borrowing an example. Rebuild contract packages for format 7 when migrating; do not reuse v0.16 stores or serialized artifacts as v0.17 inputs.

## Choose your agent entry

| Agent | Context to inspect | Verification fallback |
| --- | --- | --- |
| Claude Code | Root `CLAUDE.md`, project `.claude/skills/`, configured commands and hooks | Read hook output; run build/test commands explicitly if a hook was skipped |
| Codex | Root `AGENTS.md` and the referenced project/package guidance | Run the commands explicitly; Claude hooks and slash commands are not portable |
| Other editor agents | The editor's project instructions and supported skill discovery paths | Supply the relevant files directly and run commands explicitly |

An instruction file existing on disk does not prove your agent loaded it. Ask it to name the files it read and summarize the pinned versions. Agent UI discovery and automatic hook execution need separate verification in your chosen environment.

## Reuse installed browser context

Web SDK guidance ships with the installed npm packages. Inspect their `AGENTS.md` and `skills/` directories under `node_modules/@miden-sdk/miden-sdk`, `@miden-sdk/react` and `@miden-sdk/vite-plugin`. Check any project pointers or synced skills after installation. If the installed package provides a skill-sync command, follow its own instructions and verify the resulting files.

Keep that version-matched context as the source for browser APIs. Do not copy a second frontend skill bundle from agent-tools. SDK installation details remain in [Web SDK setup](../tools/clients/web-client/setup.md) and [React setup](../tools/clients/react-sdk/setup.md).

A useful opening request:

> Read the project instructions and installed package guidance. Report the release tuple, available commands and working directories. Explain which actions install dependencies, write state or submit transactions. Identify missing prerequisites before making changes.

Continue to [Choose a starter](templates.md).
