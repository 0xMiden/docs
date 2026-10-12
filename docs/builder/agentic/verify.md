---
title: "Verify the result"
description: "Track build, contract, browser and network evidence as separate gates."
---

# Verify the result

Ask the agent to report what it observed, with commands, working directories, exit codes and relevant assertions. Mark each gate passed, failed or not run. Preserve the repository/submodule commits, resolved dependency versions and logs alongside the result.

| Gate | Required evidence | What remains unproven |
| --- | --- | --- |
| Context | Agent names files read; consumer locks, installed guide hashes, pointers and copied skills agree | Hook execution, compiler execution and live docs |
| Contract build | Both packages rebuilt; compiler and package format recorded | Runtime execution |
| MockChain | Relevant test executed and committed counter state asserted as 1 | Node admission, funding and real network commitment |
| Local node | Matching components, fresh state, publication/consumption commitments, final assertion and saved report/logs | Browser/wallet, fee-funded admission, private transport and upgrades |
| Frontend | Tests, typecheck/build and matching packages at consumer paths | A successful browser interaction |
| Browser | Configured chain/account, initial state, transaction and note IDs, commitments and updated state | Other signers, private transport or account upgrades |
| Target network | RPC/prover/transport compatibility, admission, funding and committed state | Production readiness or untested app paths |

## Reviewed evidence and open gates

At template PR #24 head `a43051aa7a9530f5d1ce08c003edb40f2f7936f7`, saved local-node reports and validator logs show publication and consumption commitment, final counter 1, exit 0 and shutdown. Wrong expected-count, unavailable/external RPC and state-reuse probes return nonzero. These are local acceptance results; PR #24 has no configured CI. Run the integrated [root local stage](first-app.md) for your checkout and app before marking your own gate passed.

At agent-tools PR #19 head `bc8d207980aaedd42a66d7ac2cf07d911415ef25`, 36 Python tests and three CI jobs pass. Its published-artifact acceptance explicitly downloads locked npm artifacts, runs the reviewed initializer and fixture-owned `prepare`, damages context and verifies nine skills regenerate exactly while preserving an agent-tools skill. This establishes that reference consumer's context preparation, not a browser transaction or coding-agent behavior.

The actual PR #24 Rust consumer passes the read-only checker, but its frontend fails the installed-package guide-pointer check. Keep that template context gate open until the reviewed initializer repair and checker rerun succeed. The [tools guide](tools.md) separates read-only checks from the initializer mutation.

Browser/wallet, fee-funded admission, private-note transport and account upgrades remain unverified by this evidence. A fee-free public local counter and a published context fixture cannot close those gates.

For the counter browser demo, record the initial count and the updated count after publishing and consuming the increment note. If starting from a counter already committed at 1, the next completed increment should display 2. Loading the page or obtaining a faucet note ID alone does not establish this result.

Check the generated MASP packages are the ones the frontend actually loads; a Rust build can pass while the browser uses stale files. Restart the frontend server after changing its environment configuration. Separate wallet-extension and private-note checks when your app adds them.

A completion hook is an execution convenience. Inspect which checks it ran and reproduce missing stages explicitly. Keep browser, local-node and hosted-network gates open until their evidence exists. Use [Recovery](recover.md) for failures and [Network handoff](network-handoff.md) for the next environment.
