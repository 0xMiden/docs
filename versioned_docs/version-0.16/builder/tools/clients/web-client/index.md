---
title: Overview
sidebar_position: 1
---

# Web SDK (@miden-sdk/miden-sdk)

The Web SDK is the JavaScript toolkit for the Miden network. In browsers, it wraps the Rust client as WebAssembly and exposes a typed API through the `MidenClient` class for web apps, wallets, dApps, and worker contexts. The same package provides a native Node.js entry backed by N-API and SQLite.

## Capabilities

- Read and write onchain state: accounts, notes, transactions, tags.
- Build and execute Miden transactions, including custom MASM scripts.
- Compile Miden Assembly into account components, transaction scripts, and note scripts directly in the browser.
- Generate zero-knowledge proofs locally via the in-browser prover, or offload proving to a remote or delegated prover.
- Manage keys through built-in Falcon/ECDSA keystores or external signer integrations.
- Exchange private notes through the Miden note transport network.
- Import / export account files, note files, and full store snapshots for backup and migration.

## Architecture

```text
┌────────────────────────────────────────────────┐
│  @miden-sdk/miden-sdk (npm)                    │
│                                                │
│  MidenClient    (typed TS API)                 │
│    │                                           │
│    ├─ accounts / transactions / notes /        │
│    │  tags / compile / keystore namespaces     │
│    │                                           │
│    └─ wraps WasmWebClient (Rust → WASM)        │
│                                                │
│  Browser default: prove / execute on a         │
│  dedicated Web Worker                          │
└────────────────────────────────────────────────┘
```

The browser build comes from the `web-client` Rust crate in [0xMiden/web-sdk](https://github.com/0xMiden/web-sdk), compiled with `wasm-bindgen`, and bundled with the WASM module, JavaScript bindings, and a dedicated Web Worker script. Under Node.js, the package selects its native N-API binding and SQLite storage instead.

## Resource management

In browsers, each `MidenClient` created with the default `useWorker: true` setting holds a dedicated Web Worker thread. When you no longer need a client — for example in a multi-wallet app that creates one client per active network — call `client.terminate()` to release its underlying resources. Node.js clients and browser clients created with `useWorker: false` do not allocate this worker, but should still be terminated when finished.

```typescript
import { MidenClient } from "@miden-sdk/miden-sdk";

const client = await MidenClient.createTestnet();

// ... use the client ...

// Release client resources when you are done
client.terminate();
```

In environments that support the TC39 [explicit resource management](https://github.com/tc39/proposal-explicit-resource-management) proposal, you can use `using` to let the runtime handle cleanup automatically:

```typescript
{
  using client = await MidenClient.createTestnet();
  // ... client.terminate() is called automatically when the block exits
}
```

After `terminate()`, subsequent client operations throw `Error("Client terminated")`.

## Where to go next

- [Setup](./setup.md) — install the SDK and create your first client.
- [Accounts](./accounts.md) — create wallets, faucets, and contract accounts; look up existing ones.
- [Transactions](./transactions.md) — mint, send, consume, swap, and run custom scripts.
- [Notes](./notes.md) — list, import, export, and transport private notes.
- [Compile](./compile.md) — turn Miden Assembly into account components and scripts.
- [Sync and store](./sync.md) — pull network state and manage the local database.
- [Testing](./testing.md) — drive a fully in-memory mock chain for fast, deterministic tests.

## Migrating from `WebClient`

The v0.13 flat `WebClient` class is deprecated. The current Web SDK uses `MidenClient` with resource-based namespaces (`client.accounts`, `client.transactions`, …). See the [Web SDK namespace migration guide](../../../migration/07-client-changes.md) for the original namespace migration.
