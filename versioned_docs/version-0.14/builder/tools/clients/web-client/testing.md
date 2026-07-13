---
title: Testing
sidebar_position: 8
---

# Testing with the mock client

`MidenClient.createMock()` returns a client backed by a fully in-memory mock chain. It exposes the same resource API as the real client — `accounts`, `transactions`, `notes`, `tags`, `compile`, `keystore` — so tests for your application code don't need parallel mocking logic. It also adds a handful of mock-specific helpers for driving the chain manually.

Use it for unit tests, CI, and offline development. It is orders of magnitude faster than hitting testnet, and it works on flaky networks.

## Create

```typescript
import { MidenClient } from "@miden-sdk/miden-sdk";

const client = await MidenClient.createMock();
```

`createMock()` accepts `MockOptions`:

| Option | Type | Description |
| --- | --- | --- |
| `seed` | `string \| Uint8Array` | RNG seed. Strings are hashed to 32 bytes via SHA-256. |
| `serializedMockChain` | `Uint8Array` | Restore a previously serialized chain state. |
| `serializedNoteTransport` | `Uint8Array` | Restore a previously serialized note-transport state. |

## Basic flow

The mock chain does not create blocks automatically — advance it with `proveBlock()` after each transaction batch. Between `proveBlock()` and subsequent reads, call `client.sync()` to hydrate the store.

```typescript
import { MidenClient, AccountType } from "@miden-sdk/miden-sdk";

const client = await MidenClient.createMock();

const wallet = await client.accounts.create();
const faucet = await client.accounts.create({
  type: AccountType.FungibleFaucet,
  symbol: "TEST",
  decimals: 8,
  maxSupply: 10_000_000n,
});

client.proveBlock();
await client.sync();

await client.transactions.mint({
  account: faucet,
  to: wallet,
  amount: 1000n,
});

client.proveBlock();
await client.sync();

const result = await client.transactions.consumeAll({ account: wallet });
console.log(`Consumed ${result.consumed} notes`);

client.proveBlock();
await client.sync();

const balance = await client.accounts.getBalance(wallet, faucet);
console.log(`Balance: ${balance}`); // 1000n
```

## Dummy proving

Transaction proving is automatically replaced with `LocalTransactionProver.prove_dummy()` on mock clients. You don't configure anything — any transaction method that would normally prove is instead given a dummy proof that the mock chain accepts. Key consequences:

- Near-instant transactions, regardless of script complexity.
- No prover configuration required — `proverUrl` is ignored on mock clients.
- Dummy proofs are **not** valid on real chains.

## Mock-only helpers

The `MidenClient` class exposes a few methods that only make sense on mock clients. Guard them behind `usesMockChain()` if your code needs to work against both mock and real clients.

```typescript
if (client.usesMockChain()) {
  client.proveBlock();
}

const chainBytes     = client.serializeMockChain();
const transportBytes = client.serializeMockNoteTransportNode();
```

| Method | Purpose |
| --- | --- |
| `client.proveBlock()` | Advance the mock chain by one block. |
| `client.usesMockChain()` | `true` on mock clients; `false` on real clients. |
| `client.serializeMockChain()` | Snapshot mock chain state as bytes. |
| `client.serializeMockNoteTransportNode()` | Snapshot mock note transport state as bytes. |

## Snapshot and restore

Serialize the state of a running mock client, then restore it in a new client. Useful for long-running test scaffolds that want a shared starting state:

```typescript
// Setup: create client, advance chain, fund accounts, etc.
const setup = await MidenClient.createMock();
// ...
const chainState     = setup.serializeMockChain();
const transportState = setup.serializeMockNoteTransportNode();
setup.terminate();

// In a test, restore from the snapshot
const client = await MidenClient.createMock({
  serializedMockChain: chainState,
  serializedNoteTransport: transportState,
});
```

## Private-note transport

The mock client ships its own in-memory note transport. The same `sendPrivate` / `fetchPrivate` flow works:

```typescript
import { MidenClient } from "@miden-sdk/miden-sdk";

const client = await MidenClient.createMock();

await client.notes.sendPrivate({
  note: "0xnote...",
  to: "mtst1recipient...",
});

await client.notes.fetchPrivate();

const notes = await client.notes.list();
console.log(`Received ${notes.length} notes`);
```
