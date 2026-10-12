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

A project-local discovery, preview, install and check helper is being prepared in a separate code change. Until that change is integrated, use the repository's existing files and your editor's documented discovery mechanism. Do not invoke a proposed installer script merely because a draft guide mentions it.

For recovery, remove only files you installed and can identify; preserve unrelated skills and project context. Use [Diagnose and recover](recover.md) for build and runtime failures.
