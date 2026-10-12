---
title: "Diagnose and recover"
description: "Identify the failed stage and preserve keys, stores and unrelated agent context."
---

# Diagnose and recover

Capture the failing command, working directory, exit code and first useful error. Check the release tuple before changing dependencies. Retry the smallest failed stage and preserve existing keys, stores and unrelated agent files.

| Symptom | Check and next step |
| --- | --- |
| Missing subproject or binary | Initialize checked-in submodules and inspect declared Cargo targets; the project submodule has no `validate_local`; check template PR #24 integration before using the root local stage |
| midenup rejects the manifest | Use a manifest-compatible midenup version; preserve its existing home and toolchains rather than deleting them |
| Rust MSRV or compiler mismatch | Run in the contract or integration directory so checked-in toolchain overrides apply; keep the lockfile |
| Contract package cannot parse | Rebuild both packages with the pinned compiler and verify format 7 and consumer filenames |
| Agent misses a skill | Show the selected file directly, verify editor discovery, and preserve other installed skills |
| SDK context is stale | Inspect installed versions, guide pointers and copied bytes; review the published initializer's edits, then rerun the consumer check |
| Consumer check rejects docs channel | Declare stable `0.17`; a current/Next page is not stable release context |
| Root local stage fails | Read its report and logs; resolve port conflicts, missing rebuilt packages or the pinned nightly without reusing old state |
| Wrong expected-count check fails | Expected count 2 deliberately returns nonzero; confirm both commitments and the final assertion in its validator log |
| Browser account not found | Confirm configured account ID and chain, synchronize, and restart the server after environment changes |
| Recursive WebAssembly/locking failure | Follow installed SDK serialization guidance; avoid wrapping already-locking hooks in another lock |
| Funding or commitment wait | Inspect admission, note ID, sync state and transaction status; a timeout does not cancel a submitted transaction |
| RPC/genesis/version rejection | Align client, node, prover and transport; use separate disposable state for a new chain |
| Hook reports success | Inspect its commands and skipped stages; build success does not close browser or network gates |

Before retrying a network action, check whether the transaction or note already committed. Keep IDs and state so you can distinguish a failed request from a successful submission whose response was lost.

After template PR #24 integration, the root local runner creates a fresh run directory and stops only its own Compose project; it preserves the recorded containers and state. Use the report's run/project identity for any later cleanup under your own cleanup policy.

For other local-node experiments create a separate store, keystore and data directory. Inspect any helper's deletion target before running it. Do not wipe an existing wallet or store to make a compatibility error disappear. Follow [Local node testing](../tools/clients/local-node-testing.md) and [Migration](../migration/index.md) for version-specific requirements.

Return to [Verify the result](verify.md) and record the repaired stage and any remaining blocked gates.
