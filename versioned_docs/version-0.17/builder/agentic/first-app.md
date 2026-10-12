---
title: "Build your first app"
description: "Use the counter to establish a contract transition before extending the app."
---

# Build your first app

Start with the existing counter. Explain its account storage, increment note and transaction flow from source before changing behavior. Use the pinned [agentic template](templates.md) if you need both Rust and React.

## Build and test the counter

After [setup](setup.md), use midenup's `miden` command to compile from each contract directory so its toolchain applies:

```bash
(cd project-template/contracts/counter-account && miden build --release)
(cd project-template/contracts/increment-note && miden build --release)
(
  cd project-template/integration &&
  MIDENUP_HOME="$(midenup show home)" &&
  export MIDENUP_HOME &&
  cargo test -p integration --release --locked
)
```

The pinned integration helper also builds the contracts. Setting `MIDENUP_HOME` makes it invoke `miden build`; without it, the helper falls back to `cargo miden`, which a midenup installation does not put on your shell's `PATH`. The subshell uses your existing midenup home and keeps this environment change local to the test run.

The integration working directory matters: helpers resolve `../contracts`. Inspect `integration/tests/counter_test.rs`; the expected counter assertion is a committed MockChain transition from 0 to 1. A command exiting successfully with no relevant test executed is not evidence for that transition. Read [Test your contract](../get-started/your-first-smart-contract/test.md) for the test structure.

Ask your agent:

> Explain the counter invariant from source, run the contract builds and integration test, and report the test name and observed assertion. List the runtime gates still open. Before changing the app, add assertions for the new invariant and expected failures.

## Verify the Rust flow before wiring the UI

MockChain checks the contract logic in a controlled chain. [Template PR #24](https://github.com/0xMiden/agentic-template/pull/24) implements a root app-specific counter validator against real node services. **Integration gate:** the following commands require that code PR to be integrated into your checkout; they are not commands supplied by the pinned project submodule.

```bash
# From the agentic-template root, after the integrated setup path.
bash scripts/journey.sh contracts
MIDEN_ALLOW_LOCAL=1 bash scripts/journey.sh local
```

The contracts stage rebuilds both packages through the integration test. The local stage requires Python 3, Docker with Compose, the pinned Rust nightly and those rebuilt packages. It builds and starts a unique Compose project with digest-pinned node `0.17.0` components, while the Rust client/store remain `0.17.2`. The chain is public and fee-free and uses insecure disposable fixtures. It does not use an existing wallet or a hosted network.

Each run creates fresh state under `local-node-runs/<id>/`, verifies publication and consumption commitments and asserts `PASS committed counter value: 1`. Inspect `report.json`, `validator.log` and `node.log`: the report records `kind: real-local-node`, readiness, validator exit code, node errors, shutdown and `passed`. RPC `58291` and health `58292` bind only to `127.0.0.1`; choose unused ports with the runner's `--rpc-port` and `--health-port` options. The runner stops only its own Compose project and preserves containers and state for review.

The reviewed code also supports an intentional failure check. After integration, this command starts another disposable local run and must return nonzero after both commitments, because one increment produces 1:

```bash
python3 scripts/local_node.py --expected-count 2
```

Saved local acceptance evidence at the reviewed head shows success at count 1 and nonzero exits for the wrong assertion, unavailable/external RPC and existing client state. PR #24 has no configured repository CI; these are local results. They do not establish browser/wallet behavior, fee-funded admission, private-note transport or account upgrades.

The pinned project submodule still has no `validate_local` target. Use the root local stage after integration; do not substitute an older bundled-node command. For another app, adapt this example's invariants and real-node flow, and follow [Local node testing](../tools/clients/local-node-testing.md) for versioned component configuration.

## Connect the frontend

Rebuild both packages and inspect their emitted paths before copying them into `frontend-template/public/packages/`. Match the filenames requested by the frontend source and confirm that both came from the same build. Use the frontend README for its configuration keys and the deployed account ID on the selected chain. After template PR #24 integration, `bash scripts/journey.sh artifacts` copies the rebuilt packages to the frontend's hyphenated filenames; `bash scripts/journey.sh frontend` runs its tests and build. Confirm [consumer context](tools.md) separately before relying on automatic agent guidance.

```bash
(cd frontend-template && yarn test)
(cd frontend-template && yarn build)
```

These check frontend tests, TypeScript compilation and production bundling at the reviewed baseline. They do not exercise a browser transaction. Use [Verify the result](verify.md) to check loaded artifacts and actual browser state. For direct WebAssembly access follow the installed SDK locking guidance; avoid nesting calls that already acquire the SDK lock.

## Guided-flow availability

The root `doctor`, `contracts`, `frontend`, `artifacts`, `local` and `testnet` stages are implemented in template PR #24 and remain gated on its integration. Existing Cargo/Yarn commands above remain the fallback when your checkout lacks those helpers. The local counter evidence is specific to the reviewed version tuple and app; rerun its assertions for your own changes.

Continue to [verification](verify.md), then prepare a [network handoff](network-handoff.md). Funding or submitting the counter demo is a separate action; passing these local commands does not authorize or establish it.
