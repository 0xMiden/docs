---
sidebar_position: 2
title: Testnet mock bridge sandbox
description: "Run the mock NEAR Intents 1Click-style bridge sandbox against Sepolia and public Miden testnet."
---

# Testnet mock bridge sandbox

The mock bridge sandbox is a local Bridge API for testing app integrations with
a NEAR Intents 1Click-style flow. It exposes the public `/v0/*` integration
surface while using Sepolia native ETH and public Miden testnet behind the
scenes.

The sandbox repository is
[BrianSeong99/miden-testnet-bridge](https://github.com/BrianSeong99/miden-testnet-bridge).

<Callout variant="warn" title="Do not use mainnet funds">
This sandbox is testnet-only. Use Sepolia ETH, test-only keys, and fresh Miden
testnet state. Do not use production keys or mainnet assets.
</Callout>

## What it provides

- A local Bridge API shaped like a 1Click integration:
  `/v0/tokens`, `/v0/quote`, `/v0/deposit/submit`, and `/v0/status`.
- Sepolia native ETH inbound deposits to public Miden testnet payouts.
- Miden public `BridgeOutV1` notes for outbound testnet releases to Sepolia.
- Solver behavior inside the sandbox service so builders can test app flows
  without operating a separate solver.
- Evidence output with Sepolia transaction hashes, Miden transaction IDs, and
  lifecycle statuses.

## Prerequisites

- Docker with Compose v2.
- Rust toolchain for running the live evidence helper.
- `curl`, `jq`, and OpenSSL.
- A Sepolia RPC endpoint.
- Sepolia ETH on two test-only keys:
  - solver key, used by the bridge service for Sepolia release transactions;
  - test-user key, used by the live evidence runner to send deposits.

The default public Miden testnet RPC is `https://rpc.testnet.miden.io`. The
example Sepolia RPC below uses Tenderly's public endpoint.

## Start the Sepolia profile

```bash
git clone https://github.com/BrianSeong99/miden-testnet-bridge.git
cd miden-testnet-bridge
cp .env.sepolia.example .env
```

Fill `.env` with testnet-only values:

```text
EVM_RPC_URL=https://gateway.tenderly.co/public/sepolia
MASTER_MNEMONIC=<builder-controlled-test-mnemonic>
SOLVER_PRIVATE_KEY=<funded-sepolia-solver-private-key>
DEMO_EVM_FUNDED_PRIVATE_KEY=<funded-sepolia-test-user-private-key>
MIDEN_MASTER_SEED_HEX=<fresh-32-byte-hex-seed>
```

Generate a fresh Miden seed:

```bash
perl -0pi -e "s/MIDEN_MASTER_SEED_HEX=.*/MIDEN_MASTER_SEED_HEX=$(openssl rand -hex 32)/" .env
```

Start the sandbox:

```bash
make sepolia
```

Check readiness:

```bash
curl -s http://localhost:8080/healthz
curl -s http://localhost:8080/readyz | jq .
```

## Monitor the sandbox

Use `bridgectl` for local status and flow inspection:

```bash
./bin/bridgectl status
./bin/bridgectl tokens
./bin/bridgectl flows
./bin/bridgectl flow <correlation-id>
make sepolia-logs
make sepolia-reset
```

The `/demo/*` and `/lab` endpoints in the sandbox are local helpers. App
integrations should use only the `/v0/*` endpoints described in the
[API reference](./api-reference).

## Run live testnet evidence

After both Sepolia keys are funded, run:

```bash
RUSTFLAGS='-C debug-assertions=no' cargo run --bin sepolia_e2e 2>&1 | tee sepolia-e2e-live.log
```

The evidence runner drives both directions:

1. Sepolia native ETH deposit -> `/v0/deposit/submit` -> solver-signed public
   P2ID mint on Miden -> recipient claim.
2. Miden public `BridgeOutV1` note -> bridge consume on Miden -> Sepolia native
   ETH release.

The run prints `SEPOLIA_E2E_EVIDENCE` lines with correlation IDs, Sepolia
transaction hashes, Miden transaction IDs, and final balance deltas.

## Published evidence

The sandbox repository includes a terminal walkthrough video and a published
evidence page:

- [Terminal walkthrough](https://github.com/BrianSeong99/miden-testnet-bridge#terminal-walkthrough)
- [Smoke test report](https://brianseong99.github.io/miden-testnet-bridge/smoke-test-report.html)

Use those artifacts as examples of what to capture when reporting bridge test
results: command line, lifecycle statuses, Sepolia transaction hashes, Miden
transaction IDs, and explorer links.
