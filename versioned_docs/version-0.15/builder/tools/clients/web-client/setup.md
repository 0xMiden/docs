---
title: Setup
sidebar_position: 2
---

# Setting up the Web SDK

## Install

Add `@miden-sdk/miden-sdk` to your project.

```bash
npm install @miden-sdk/miden-sdk
# or
yarn add @miden-sdk/miden-sdk
# or
pnpm add @miden-sdk/miden-sdk
```

The SDK targets modern browsers (Chrome, Firefox, Safari, Edge) with WebAssembly and Web Worker support. It also runs under Node 20+ when the host provides those primitives.

## Create a client

Every operation goes through a `MidenClient` instance. Four factories cover the common cases:

| Factory | Use for |
| --- | --- |
| `MidenClient.createTestnet()` | Miden testnet — RPC, prover, and note transport preconfigured |
| `MidenClient.createDevnet()` | Miden devnet — same shape, devnet endpoints |
| `MidenClient.createMock()` | Deterministic in-memory chain for tests — no network |
| `MidenClient.create({ ... })` | Custom endpoints (localhost, self-hosted node, or any shorthand) |

```typescript
import { MidenClient } from "@miden-sdk/miden-sdk";

// Miden testnet (most common for dApps under development)
const client = await MidenClient.createTestnet();

// Local node — "localhost" / "local" shorthand resolves to http://localhost:57291
const local = await MidenClient.create({ rpcUrl: "localhost" });

// Any custom URL
const custom = await MidenClient.create({
  rpcUrl: "https://my-node.example.com",
});

// Mock chain (see the Testing guide)
const mock = await MidenClient.createMock();
```

All factories are async — the SDK has to load its WebAssembly module and spin up a Web Worker before the client is usable.

## `ClientOptions` reference

All four factories accept the same `ClientOptions` shape. The differences are in what each factory pre-fills before the options are applied.

### Field reference

| Option | Type | Description |
| --- | --- | --- |
| `rpcUrl` | `"testnet" \| "devnet" \| "localhost" \| "local" \| string` | Node RPC endpoint. Shorthands expand to the hosted Miden endpoints; any other string is treated as a raw URL. |
| `noteTransportUrl` | `"testnet" \| "devnet" \| string` | Note transport service endpoint. Required for private-note `sendPrivate` / `fetchPrivate`. |
| `proverUrl` | `"local" \| "devnet" \| "testnet" \| string` | Default prover for transactions. `"local"` runs in the browser; remote shorthands and URLs route to a remote / delegated prover. |
| `autoSync` | `boolean` | When `true`, the client runs one sync pass before the promise resolves. |
| `seed` | `string \| Uint8Array` | Seed for deterministic RNG. Strings are hashed to 32 bytes via SHA-256. |
| `storeName` | `string` | Store isolation key (IndexedDB database name in browsers). Set this to keep multiple clients' data separate in the same origin. |
| `keystore` | `{ getKey, insertKey, sign }` | External keystore callbacks. Leave unset to use the built-in keystore. |

### Factory defaults

Any option not passed falls back to the factory default, then to an SDK default.

| Factory | `rpcUrl` | `proverUrl` | `noteTransportUrl` | `autoSync` |
| --- | --- | --- | --- | --- |
| `createTestnet(opts?)` | `"testnet"` | `"testnet"` | `"testnet"` | `true` |
| `createDevnet(opts?)` | `"devnet"` | `"devnet"` | `"devnet"` | `true` |
| `create(opts?)` **with** `rpcUrl` | your value | `"local"` | _none_ | `false` |
| `create(opts?)` **without** `rpcUrl` | _delegates to `createTestnet(opts)`_ | ← | ← | ← |
| `createMock(opts?)` | _(no network)_ | _(dummy proving)_ | _(in-memory)_ | _(manual)_ |

`create()` without an `rpcUrl` is not a separate "custom" client — it forwards its options to `createTestnet()`. If you want a no-prover, no-autosync client against localhost, pass `rpcUrl: "localhost"` explicitly.

### Testnet with an in-browser prover

```typescript
// Testnet — but prove locally in the browser instead of offloading
const client = await MidenClient.createTestnet({ proverUrl: "local" });
```

### Keeping two isolated clients in the same origin

```typescript
const a = await MidenClient.createTestnet({ storeName: "wallet-a" });
const b = await MidenClient.createTestnet({ storeName: "wallet-b" });
```

Each call creates its own IndexedDB database. The two wallets' state never crosses over.

## Keystores and authentication

The built-in keystore handles signing for the common flows: `client.accounts.create()` generates a Falcon key, persists it, and the client uses it automatically during `client.transactions.*` calls.

When you need explicit control — for example when creating a contract account with a pre-derived seed, or wiring an external signer — build an `AuthSecretKey` directly:

```typescript
import { AuthSecretKey } from "@miden-sdk/miden-sdk";

// Falcon key (the default auth scheme for regular wallets)
const seed = crypto.getRandomValues(new Uint8Array(32));
const auth = AuthSecretKey.rpoFalconWithRNG(seed);
```

The caller is responsible for retaining `auth` as long as the account is in use: the client holds a reference for signing, but the secret material only exists on the caller side until it is handed to the keystore.

See [Accounts](./accounts.md) for full examples covering wallets, contracts, and faucets. For advanced setups — external signers, hardware wallets — the `keystore` option on `ClientOptions` wires the SDK to your own `sign`/`getKey`/`insertKey` callbacks.

## Remote provers and per-transaction overrides

Local proving in the browser is CPU-intensive for larger transactions. Override globally via `ClientOptions.proverUrl`, or per transaction via the `prover` field:

```typescript
// Globally: every transaction uses the remote prover by default
const client = await MidenClient.create({
  rpcUrl: "testnet",
  proverUrl: "https://prover.example.com",
});

// Per-transaction: pass a TransactionProver instance
await client.transactions.send({
  account: wallet,
  to: recipient,
  token: faucet,
  amount: 100n,
  prover: customProver,
});
```

See [Transactions](./transactions.md) for the full lifecycle.

## Minimal example

```typescript
import { MidenClient } from "@miden-sdk/miden-sdk";

async function demo() {
  const client = await MidenClient.createTestnet();
  await client.sync();

  const wallet = await client.accounts.create();
  console.log("Wallet:", wallet.id().toString());

  client.terminate();
}

demo().catch(console.error);
```

For a testable, offline-friendly version of this pattern, see [Testing](./testing.md).
