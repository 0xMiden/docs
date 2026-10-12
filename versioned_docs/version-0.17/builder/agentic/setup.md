---
title: "Set up your agent"
sidebar_label: "Set up your agent"
description: "Match project instructions, toolchain versions, and installed SDK guidance before building with a coding agent."
---

# Set up your agent

Start your agent in the project root. Ask it to read `AGENTS.md` or `CLAUDE.md`, the template README, and the instructions in each subproject it will change.

## Check the release

Keep the checked-in lockfiles and submodule pins. From an agentic-template checkout:

```bash
git rev-parse HEAD
git submodule status --recursive
(cd project-template && rustc --version)
(cd project-template && midenup show active-toolchain)
(cd frontend-template && node --version)
(cd frontend-template && yarn --version)
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

| Agent | Project context | Skill location |
| --- | --- | --- |
| Codex | `AGENTS.md` and its referenced guides | `.agents/skills/` |
| Claude Code | `CLAUDE.md`, plus imported or directly referenced package guides | `.claude/skills/` |
| Cursor | Project instructions and selected skill files | `.cursor/skills/` |

Ask the agent to name the files it read and explain the release tuple. File presence alone does not establish discovery. Claude hooks and slash commands are agent-specific; run build and test stages explicitly when your agent does not execute them.

## Reuse installed SDK guidance

Browser API instructions ship with the installed npm packages. Read their `AGENTS.md` and `skills/` directories under:

- `node_modules/@miden-sdk/miden-sdk`
- `node_modules/@miden-sdk/react`
- `node_modules/@miden-sdk/vite-plugin`

Keep those packages as the source for browser APIs. [Agent tools](tools.md) provides Rust, MASM, and protocol knowledge; it does not supply a duplicate frontend bundle.

An install or `prepare` exit can hide a failed context sync. [Verify package guides, pointers, and copied skills](verify.md) before relying on automatic guidance. The consumer checker targets stable v0.17, even when you are reading the separate Current/Next documentation channel.

A useful first request:

> Read the project and installed package guides. Explain the app's state and transaction flow, identify missing prerequisites, and list the build and test commands with their working directories before changing code.

Continue to [Choose a template](templates.md).
