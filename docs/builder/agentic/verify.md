---
title: "Verify your app"
sidebar_label: "Verify your app"
description: "Check agent context, contract packages, local commitments, and browser behavior before moving to a hosted network."
---

# Verify your app

Record each check as passed, failed, or not run, with the command, working directory, exit code, and relevant assertion. Keep source commits, lockfiles, package paths, and logs with the result.

## Check installed context

From an [agent-tools](https://github.com/0xMiden/agent-tools) checkout, using Python 3.11+:

```bash
python3 scripts/agent_tools.py check-consumer \
  --project /path/to/agentic-template/project-template --profile rust \
  --docs-version 0.17 --docs-channel stable
python3 scripts/agent_tools.py check-consumer \
  --project /path/to/agentic-template/frontend-template --profile web --agent codex \
  --docs-version 0.17 --docs-channel stable
```

The Rust check reads `Cargo.lock` and `miden-toolchain.toml`. The Web check compares exact declarations, resolved npm v2/v3 or Yarn v1 locks, installed guides/skills, copied skills, root guide pointers, and the `prepare` declaration. Its reference versions are core SDK `0.17.1` and React/Vite/initializer `0.17.0`; validate other versions or lock formats separately.

Use `--agent claude` or `--agent cursor` for those environments. Claude needs either an `@AGENTS.md` import or the package-guide pointers directly in `CLAUDE.md`.

The checker targets stable v0.17. `--docs-channel current` refers to unstable Current/Next and fails this release-context check. Its JSON deliberately leaves live docs, compiler execution, and hook execution unverified. A passing file check is not evidence that an agent loaded the instructions or a hook ran.

## Repair missing frontend pointers

The pinned frontend can have correctly synced skills but missing root package-guide pointers. If the Web check reports that gap, inspect the installed initializer, then run it from the frontend directory:

```bash
node node_modules/@miden-sdk/create/dist/cli.js
```

This writes guide pointers, agent imports, the prepare declaration, and synced copies. Review the diff and rerun the Web check. Preserve project instructions and unrelated skills. A `prepare` exit of zero alone is insufficient because the published hook can tolerate a sync failure.

## Verify each runtime stage

| Stage | Evidence to keep |
| --- | --- |
| Contract build | Both packages rebuilt with the pinned compiler; format and consumer paths checked |
| MockChain | The relevant test ran and asserted the committed counter value |
| Local node | Fresh state, publication and consumption commitments, final assertion, report and component logs |
| Frontend | Unit tests, typecheck/build, and the exact packages loaded by the app |
| Browser | Correct chain/account, initial count, transaction/note IDs, commitments, and updated count |
| Hosted network | Compatible RPC/prover/transport, admission, funding, and final committed state |

For a counter already committed at 1, the next completed browser increment should display 2. A faucet note ID, a built bundle, or a loaded page is an intermediate result.

The template's local acceptance covers a fee-free public counter and failure guards. Published SDK context acceptance covers a reference consumer's initializer and prepare behavior. Neither establishes browser/wallet behavior, fee-funded admission, private transport, or account upgrades; test those paths when your app uses them.

Inspect completion-hook output and run skipped stages explicitly. Use [Troubleshooting](recover.md) for failures and [Network handoff](network-handoff.md) for the next environment.
