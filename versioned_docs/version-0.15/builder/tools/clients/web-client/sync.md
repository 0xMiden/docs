---
title: Sync and store
sidebar_position: 7
---

# Sync and store

Every operation the Web SDK performs reads from — or writes to — a local store. This page covers how to keep that store in sync with the Miden network, and how to back up / restore the store itself.

## `client.sync()`

Pulls updates from the Miden node and applies them to the local store. Returns a `SyncSummary` describing what changed.

```typescript
import { MidenClient } from "@miden-sdk/miden-sdk";

const client = await MidenClient.createTestnet();

const summary = await client.sync();

console.log("Block:", summary.blockNum());
console.log("Committed notes:", summary.committedNotes().length);
console.log("Consumed notes:", summary.consumedNotes().length);
console.log("Committed txs:", summary.committedTransactions().length);
console.log("Updated accounts:", summary.updatedAccounts().length);
```

`SyncSummary` accessors:

- `blockNum(): number` — tip block the summary is based on.
- `committedNotes(): NoteId[]` — notes committed in this sync window.
- `consumedNotes(): NoteId[]` — notes consumed in this sync window.
- `committedTransactions(): TransactionId[]` — transactions that were committed.
- `updatedAccounts(): AccountId[]` — accounts whose onchain state advanced.

## Timeout handling

```typescript
const summary = await client.sync();
```

`client.sync()` does not take a timeout option. If a UI needs a wall-clock timeout, wrap the promise at the application layer.

## Auto-sync on creation

The network factories (`createTestnet`, `createDevnet`) default `autoSync: true`, so one sync runs before the client is returned. `create()` defaults to `false`; pass `autoSync: true` explicitly if you want the same behaviour for a custom endpoint:

```typescript
const client = await MidenClient.create({
  rpcUrl: "localhost",
  autoSync: true,
});
```

## Current sync height

Cheap check of the locally-known tip, no network call:

```typescript
const height: number = await client.getSyncHeight();
console.log("Local tip:", height);
```

## Store backup and restore

The SDK exposes two **standalone** functions (not methods on `MidenClient`) for snapshotting the entire store:

```typescript
import { exportStore, importStore } from "@miden-sdk/miden-sdk";

// Dump the store identified by storeName into a JSON string.
const storeName = await client.storeIdentifier(); // or pass your own storeName
const dump = await exportStore(storeName);

// Later — on another device, or after a page refresh — restore it.
await importStore(storeName, dump);
```

- `exportStore(storeName)` → `Promise<string>` — returns a JSON dump of the IndexedDB store.
- `importStore(storeName, dump)` → `Promise<void>` — replaces all existing data in the target store with the dump.

`importStore` is destructive. It overwrites the target store entirely — keep a backup if you need the previous state.

These helpers are package-level exports, not methods on `MidenClient`, so they can run without an active client — for example in a worker that performs scheduled backups.

## Next

- [Testing](./testing.md) — running a deterministic, in-memory mock chain for tests.
- [Transactions](./transactions.md) — how network state feeds back into transaction flows.
