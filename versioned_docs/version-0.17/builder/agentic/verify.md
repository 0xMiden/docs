---
title: "Verify the result"
description: "Track build, contract, browser and network evidence as separate gates."
---

# Verify the result

Ask the agent to report what it observed, with commands, working directories, exit codes and relevant assertions. Mark each gate passed, failed or not run. Preserve the repository/submodule commits, resolved dependency versions and logs alongside the result.

| Gate | Required evidence | What remains unproven |
| --- | --- | --- |
| Context | Agent names the files read; installed package versions and instructions agree | Automatic discovery in other editors |
| Contract build | Both packages rebuilt; compiler and package format recorded | Runtime execution |
| MockChain | Relevant test executed and committed counter state asserted as 1 | Node admission, funding and real network commitment |
| Local node | Matching components, disposable state, publish/consume commitments and final assertion | Hosted network and browser behavior |
| Frontend | Tests, typecheck/build and matching packages at consumer paths | A successful browser interaction |
| Browser | Configured chain/account, initial state, transaction and note IDs, commitments and updated state | Other signers, private transport or account upgrades |
| Target network | RPC/prover/transport compatibility, admission, funding and committed state | Production readiness or untested app paths |

For the counter browser demo, record the initial count and the updated count after publishing and consuming the increment note. If starting from a counter already committed at 1, the next completed increment should display 2. Loading the page or obtaining a faucet note ID alone does not establish this result.

Check the generated MASP packages are the ones the frontend actually loads; a Rust build can pass while the browser uses stale files. Restart the frontend server after changing its environment configuration. Separate wallet-extension and private-note checks when your app adds them.

A completion hook is an execution convenience. Inspect which checks it ran and reproduce missing stages explicitly. Keep browser, local-node and hosted-network gates open until their evidence exists. Use [Recovery](recover.md) for failures and [Network handoff](network-handoff.md) for the next environment.
