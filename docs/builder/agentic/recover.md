---
title: "Troubleshoot"
sidebar_label: "Troubleshoot"
description: "Resolve toolchain, context, node, and transaction errors while preserving keys, stores, and project instructions."
---

# Troubleshoot

Capture the failed command, working directory, exit code, and first useful error. Check the release tuple before changing dependencies, then retry the smallest failed stage.

## Common failures

| Symptom | Next step |
| --- | --- |
| Missing subproject or helper | Initialize checked-in submodules and check your workspace version. Use the root `local` stage; the project submodule has no `validate_local` target |
| midenup rejects the manifest | Use a manifest-compatible midenup version and preserve its existing home/toolchains |
| `cargo miden` not found in integration tests | Export `MIDENUP_HOME` in the build subshell so the helper uses `miden build`, as shown in [First app](first-app.md) |
| Rust MSRV or compiler mismatch | Run in the contract or integration directory so checked-in overrides apply; keep the lockfile |
| Contract package cannot parse | Rebuild both packages with the pinned compiler; check format 7 and frontend filenames |
| Agent misses a skill | Supply the file directly and check the editor's discovery path; preserve unrelated skills |
| SDK context or pointers are missing | Review the installed initializer's edits, run it, then repeat the [consumer check](templates.md#optional-automated-context-check) |
| Consumer check rejects the docs channel | Declare stable `0.17`; Current/Next is separate unstable context |
| Local stage cannot start | Read the report/logs; check Docker, unused ports, rebuilt packages, and the pinned nightly |
| Wrong expected-count run fails | Expected count 2 intentionally fails. Confirm both commitments and the final assertion in `validator.log` |
| Browser account not found | Confirm account ID and chain, synchronize, and restart the server after changing environment variables |
| Recursive WASM/locking error | Follow installed SDK serialization guidance; avoid wrapping already-locking hooks in another lock |
| Funding or commitment wait | Inspect admission, note ID, sync, and transaction status before retrying |

## Preserve state when recovering

The local runner creates a new run directory and stops only its own Compose project. It retains containers and state; use the recorded run identity for cleanup under your own policy. Do not reset an existing wallet, keystore, or store to fix compatibility errors.

For network retries, first check whether the transaction or note already committed. A timeout does not cancel a submission. Keep the IDs and state needed to distinguish a failed request from a successful submission whose response was lost.

Follow [Local node testing](../tools/clients/local-node-testing.md) and [Migration](../migration/index.md) for version-specific setup. Return to [Verification](verify.md) and record the repaired stage and remaining checks.
