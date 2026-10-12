---
title: "Build your first app"
sidebar_label: "Build your first app"
description: "Build and test the Rust counter, validate committed state on a local node, and prepare the React frontend."
---

# Build your first app

Use the [full-stack template](templates.md) to build the counter first. Ask your agent to explain the counter's storage, increment note, and publication/consumption flow from source before changing behavior.

## Build and test the contracts

Run from the agentic-template root after setup:

```bash
(
  MIDENUP_HOME="$(midenup show home)"
  export MIDENUP_HOME
  bash scripts/journey.sh contracts
)
```

The stage runs `cargo test -p integration --release --locked` from `project-template/integration`. Its helpers rebuild both contract packages and assert a committed MockChain transition from 0 to 1. `MIDENUP_HOME` makes the pinned helper use `miden build`; without it, the helper falls back to `cargo miden`, which a midenup installation may not expose on `PATH`.

Check that `counter_test` ran and its assertion passed. For direct builds, run `miden build --release` inside each contract directory so the toolchain overrides apply. See [Test your contract](../get-started/your-first-smart-contract/test.md) for the test structure.

## Validate on a real local node

With Python, Docker Compose, the pinned Rust nightly, and rebuilt packages available:

```bash
MIDEN_ALLOW_LOCAL=1 bash scripts/journey.sh local
```

This starts a fresh public, fee-free chain with digest-pinned node `0.17.0` components and Rust client/store `0.17.2`. It uses disposable insecure fixtures, publishes and consumes the increment note, waits for both commitments, and checks:

```text
PASS committed counter value: 1
```

Each run writes `report.json`, `validator.log`, and `node.log` under `local-node-runs/<id>/`. Check `passed`, `validator_exit_code`, `node_error_count`, and `node_stopped`. The runner stops only its uniquely named Compose project and preserves state for inspection.

RPC `58291` and health `58292` bind to `127.0.0.1`. Choose unused ports with `python3 scripts/local_node.py --rpc-port 59291 --health-port 59292` if needed. The pinned project submodule has no `validate_local` target; this validator lives at the workspace root.

To test the failure path, start another disposable run with an intentionally wrong expected value:

```bash
python3 scripts/local_node.py --expected-count 2
```

It must return nonzero after both commitments: one increment produces 1. For another app, adapt the assertions in `examples/local-counter/`. This fee-free public flow does not validate fee-funded admission, private transport, browser signers, or account upgrades.

## Prepare the frontend

```bash
bash scripts/journey.sh artifacts
bash scripts/journey.sh frontend
```

`artifacts` copies the rebuilt packages to `frontend-template/public/packages/counter-account.masp` and `increment-note.masp`. `frontend` runs unit tests, TypeScript compilation, and a production build. Confirm the frontend loads those packages rather than stale copies.

Set the counter address and network configuration using the frontend README. Then, from the frontend directory:

```bash
yarn dev
```

A local validator run does not configure the browser's network for you. Follow [Network handoff](network-handoff.md) before using a hosted counter. Check the initial count, publish and consume an increment, and confirm the updated committed count. Tests and a successful page load do not establish this browser result.

## Extend the app

Define the new state invariant and expected failures. Add MockChain assertions, adapt the real-node flow, then mirror that proven transaction flow in the UI. Follow installed SDK guidance for direct WASM calls and locking; avoid nesting hooks that already acquire the SDK lock.

Continue to [Verify your app](verify.md) or [Troubleshoot](recover.md) a failed stage.
