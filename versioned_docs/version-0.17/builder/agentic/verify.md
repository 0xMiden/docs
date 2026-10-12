---
title: "Verify your app"
sidebar_label: "Verify your app"
description: "Check agent context, contract packages, local commitments, and browser behavior before moving to a hosted network."
---

# Verify your app

Record each check as passed, failed, or not run, with the command, working directory, exit code, and relevant assertion. Keep source commits, lockfiles, package paths, and logs with the result.

## Check installed context

Before building, complete [Check your setup](templates.md). That page covers release checks, installed package guides, optional read-only consumer checks, and the reviewed repair for missing frontend pointers. Revisit it if dependencies or agent instructions change.

## Repair missing frontend pointers

Follow the [installed-initializer repair](templates.md#repair-missing-frontend-pointers) after setup, review its file changes, and repeat the context check.

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
