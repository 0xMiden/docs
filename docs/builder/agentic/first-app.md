---
title: "Build your first app"
description: "Use the counter to establish a contract transition before extending the app."
---

# Build your first app

Start with the existing counter. Explain its account storage, increment note and transaction flow from source before changing behavior. Use the pinned [agentic template](templates.md) if you need both Rust and React.

## Build and test the counter

After [setup](setup.md), compile from each contract directory so its toolchain applies:

```bash
(cd project-template/contracts/counter-account && cargo miden build --release)
(cd project-template/contracts/increment-note && cargo miden build --release)
(cd project-template/integration && cargo test -p integration --release --locked)
```

The integration working directory matters: helpers resolve `../contracts`. Inspect `integration/tests/counter_test.rs`; the expected counter assertion is a committed MockChain transition from 0 to 1. A command exiting successfully with no relevant test executed is not evidence for that transition. Read [Test your contract](../get-started/your-first-smart-contract/test.md) for the test structure.

Ask your agent:

> Explain the counter invariant from source, run the contract builds and integration test, and report the test name and observed assertion. List the runtime gates still open. Before changing the app, add assertions for the new invariant and expected failures.

## Verify the Rust flow before wiring the UI

MockChain checks the contract logic in a controlled chain. For an app-specific end-to-end check, adapt a client binary to a real local node with separate disposable state. Follow [Local node testing](../tools/clients/local-node-testing.md) and the project's local-node skill for the versioned node components and configuration.

The reviewed template pins do not ship a `validate_local` binary. Do not invent one or assume a bundled-node command from an older README is valid. Implement and verify an app-specific validator when needed; record publication, consumption, commitment and final state before claiming that gate passed.

## Connect the frontend

Rebuild both packages and inspect their emitted paths before copying them into `frontend-template/public/packages/`. Match the filenames requested by the frontend source and confirm that both came from the same build. Use the frontend README for its configuration keys and the deployed account ID on the selected chain.

```bash
(cd frontend-template && yarn test)
(cd frontend-template && yarn build)
```

These check frontend tests, TypeScript compilation and production bundling at the reviewed baseline. They do not exercise a browser transaction. Use [Verify the result](verify.md) to check loaded artifacts and actual browser state. For direct WebAssembly access follow the installed SDK locking guidance; avoid nesting calls that already acquire the SDK lock.

## Guided-flow availability

A separate template change proposes a `doctor` and stage runner for contracts, frontend, artifacts and explicit testnet opt-in. Those helpers are not required by this page and must not be assumed present in a released checkout. The commands above use the existing contract and frontend tooling.

Continue to [verification](verify.md), then prepare a [network handoff](network-handoff.md). Funding or submitting the counter demo is a separate action; passing these local commands does not authorize or establish it.
