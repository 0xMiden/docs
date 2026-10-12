---
title: Network
sidebar_position: 4
description: "Choose Miden Testnet or Mainnet, isolate client state, and configure network services explicitly."
---

# Choose your network

Use **Testnet** to learn, build, and test with test assets. Use **Mainnet** for production with real funds only after Miden confirms access, supported versions, and service availability.

**Network and version are separate choices.** Selecting the v0.17 documentation or a toolchain named `mainnet` does not select your client's network or prove that Mainnet is live. Pin compatible client, compiler, and protocol releases for the target network; do not assume Mainnet and Testnet run the same version.

## Network availability

Verification snapshot: **12 October 2026**. Recheck before connecting or funding.

| | Testnet | Mainnet |
| --- | --- | --- |
| Purpose | Development and testing | Planned production network with real funds |
| Availability | [Testnet status](https://status.testnet.miden.io/) reported healthy services and node/prover v0.17.1 during this check | Public availability unconfirmed; Mainnet RPC and status DNS did not resolve during this check |
| Access | Check account eligibility; registration may require an invitation | Launch eligibility and registration policy unconfirmed; obtain instructions from Miden before onboarding |
| Funds | Test assets; never treat faucet balances as real funds | Real assets and transaction fees; confirmed funding route and native fee asset required before use |

A configured endpoint or successful website load is not proof that transactions can be submitted. Do not infer Mainnet URLs by replacing `testnet` in a URL. Devnet is a separate development environment; see [local testing](./clients/local-node-testing.md) for a node you control.

## Services to configure

Use the [live Testnet status dashboard](https://status.testnet.miden.io/) to verify the selected services. The following Testnet URLs were checked against that dashboard; they are configuration values, not guarantees of future uptime.

| Service | Testnet | Dependency |
| --- | --- | --- |
| Node RPC | `https://rpc.testnet.miden.io` | Query state and submit proven transactions; native clients use gRPC over TLS, browsers require gRPC-Web support |
| Remote transaction prover | `https://tx-prover.testnet.miden.io` | Optional when proving locally; verify compatibility and trust the service with the transaction witness supplied for proving |
| Note transport | `https://transport.testnet.miden.io` | Required for automatic private-note delivery/fetch; RPC availability alone does not establish transport availability |
| Explorer | [Testnet MidenScan](https://testnet.midenscan.com) | Check committed transactions on the same network; an explorer does not submit or prove transactions |
| Test faucet | [Testnet faucet](https://faucet.testnet.miden.io/) | Test assets; check the network's native fee asset separately from demonstration tokens |

The pinned Rust client defines a Mainnet RPC preset (`https://rpc.mainnet.miden.io`) and transport preset (`https://transport.mainnet.miden.io`). These are **source-defined configuration only; service availability is unconfirmed**. A Mainnet explorer, prover, funding route, and status inventory are not confirmed here. Obtain the complete supported configuration from Miden before using Mainnet.

## Set up Testnet explicitly

First [install the toolchain](../get-started/setup/installation.md). In a fresh directory, create a local client configuration rather than reusing a global store:

```bash
mkdir miden-testnet
cd miden-testnet
miden client init --local --network testnet \
  --note-transport-endpoint https://transport.testnet.miden.io
miden client sync
```

The v0.17 CLI writes `.miden/miden-client.toml`, a local SQLite store, and keystore. Inspect the RPC, transport, store paths, and proving settings before creating or funding an account. Proving defaults to local; add `--remote-prover-endpoint https://tx-prover.testnet.miden.io` to initialization if you intentionally choose remote proving.

For the [Web SDK](./clients/web-client/setup.md), set the network and browser store explicitly:

```typescript
import { MidenClient } from "@miden-sdk/miden-sdk";

const client = await MidenClient.create({
  rpcUrl: "https://rpc.testnet.miden.io",
  noteTransportUrl: "https://transport.testnet.miden.io",
  proverUrl: "local",
  storeName: "my-app-testnet-v017",
  autoSync: true,
});
```

The checked Rust v0.17.3 and Web SDK v0.17.0 sources map their Testnet transport default to `https://transport.miden.io`; the live dashboard lists `https://transport.testnet.miden.io`. These examples select the dashboard URL explicitly. Recheck defaults when changing SDK versions.

## Account access and funding

Create the account locally using [CLI basics](../get-started/setup/cli-basics.md). Account creation locally does not publish it onchain or establish eligibility. If the selected network requires an invitation, obtain a valid unused code from the network operator through Miden's official onboarding/support channels, and register that account on that network. Keep access codes and credentials out of source control, documentation, and shared logs.

Registration, funding, and onchain publication are distinct steps. The node may supply a funding note through its configured funding service on registration; verify receipt and consume the note through the client that owns the account. Otherwise use the supported funding route for that network. See [native-fee funding](../get-started/notes.md#bootstrap-native-fee-funding) for the bootstrap flow. Test tokens never fund Mainnet. Read the native fee asset and fee parameters from the selected chain's protocol configuration; do not assume a token named MID or a tutorial token pays gas. The checked Testnet dashboard identifies USDCx as its native asset; that does not establish Mainnet's fee asset or funding policy.

## Before switching to Mainnet

1. Obtain confirmed launch availability, access eligibility, RPC/genesis identity, supported software versions, native fee asset, and funding instructions from Miden. Do not send funds while these remain unconfirmed.
2. Create a separate project directory, client store, and keystore for Mainnet. For a browser, use a distinct `storeName`; for Node/native clients, isolate filesystem store and keystore paths as well. Never switch the RPC underneath an existing Testnet store.
3. Set RPC, prover, and transport independently from the confirmed configuration. The CLI supports `--network mainnet`, but accepting that flag does not confirm a live service. Do not use `"mainnet"` as a Web SDK shorthand without checking your SDK's support; use a confirmed full RPC URL.
4. Sync and compare the reported network/genesis and protocol configuration with the operator's published values. Label the network in your UI, validate recipient network addresses and asset IDs, and stop on mismatch; a hex account ID or token symbol alone is insufficient.
5. Before signing, verify the recipient, amount, fee asset, and selected network. After submission, wait for commitment and verify on that network's confirmed explorer. Never silently fall back from Mainnet to Testnet, or from an unavailable service to a different network.

## Verification sources

- [Pinned Rust client endpoint definitions](https://github.com/0xMiden/rust-sdk/blob/a4d9bbd66bf64b42d30c13de30561dd97467540a/crates/rust-client/src/rpc/endpoint.rs), [CLI initialization](https://github.com/0xMiden/rust-sdk/blob/a4d9bbd66bf64b42d30c13de30561dd97467540a/bin/miden-cli/src/commands/init.rs), [transport presets](https://github.com/0xMiden/rust-sdk/blob/a4d9bbd66bf64b42d30c13de30561dd97467540a/crates/rust-client/src/note_transport/mod.rs), and [registration behavior](https://github.com/0xMiden/rust-sdk/blob/a4d9bbd66bf64b42d30c13de30561dd97467540a/crates/rust-client/src/rpc/mod.rs).
- [Web SDK v0.17.0 client configuration](https://github.com/0xMiden/web-sdk/blob/9dc53fad3beae6a3849cedd2af3d7cfdefedb8d8/crates/web-client/js/client.js).
- [Testnet service status](https://status.testnet.miden.io/) for service health, versions, and native asset. Health observations are time-specific, and this guide does not certify Mainnet launch readiness.
