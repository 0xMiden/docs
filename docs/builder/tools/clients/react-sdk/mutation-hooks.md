---
title: Mutation hooks
sidebar_position: 4
---

# Mutation hooks

Mutation hooks own the full transaction lifecycle — execute, prove, submit — and serialize under the Web SDK's concurrency lock so two components can't corrupt the WASM state.

Two result-shape families show up across this page:

**Transaction-producing hooks** (`useSend`, `useMultiSend`, `useMint`, `useConsume`, `useSwap`, `useTransaction`):

```ts
{
  [action]: (options) => Promise<Result>;  // send, sendMany, mint, ...
  result: Result | null;
  isLoading: boolean;
  stage: TransactionStage;
  error: Error | null;
  reset: () => void;
}
```

**Account-creation hooks** (`useCreateWallet`, `useCreateFaucet`, `useImportAccount`) don't go through the prove/submit pipeline, so they expose `isCreating` / `isImporting` instead of `isLoading` + `stage`:

```ts
{
  createWallet: (opts?) => Promise<Account>;
  wallet: Account | null;
  isCreating: boolean;     // or `isImporting` for useImportAccount
  error: Error | null;
  reset: () => void;
}
```

Polling helpers (`useWaitForCommit`, `useWaitForNotes`) are simpler still — they expose just the action. Per-hook exact shapes are called out below.

See [setup](./setup.md#hook-result-conventions) for the `TransactionStage` progression.

## `useCreateWallet`

Creates a new wallet account. Returns the `Account` object.

```tsx
import { useCreateWallet, AuthScheme } from "@miden-sdk/react";

function NewWalletButton() {
  const { createWallet, wallet, isCreating, error } = useCreateWallet();

  const handleCreate = async () => {
    const account = await createWallet({
      storageMode: "private",        // "private" | "public" | "network" (default private)
      mutable: true,                 // default true — updatable code
      authScheme: AuthScheme.Falcon, // default
    });
    console.log("Created:", account.bech32id());
  };

  return (
    <button onClick={handleCreate} disabled={isCreating}>Create wallet</button>
  );
}
```

`CreateWalletOptions` (all optional):

| Field | Default | Description |
| --- | --- | --- |
| `storageMode` | `"private"` | `"private"` / `"public"` / `"network"` |
| `mutable` | `true` | Whether code can be updated after deployment |
| `authScheme` | `AuthScheme.Falcon` | Signing scheme |
| `initSeed` | random | 32-byte seed for deterministic account-ID derivation |

## `useCreateFaucet`

Creates a fungible-token faucet.

```tsx
import { useCreateFaucet } from "@miden-sdk/react";

function NewFaucetButton() {
  const { createFaucet, faucet, isCreating } = useCreateFaucet();

  const handleCreate = async () => {
    const created = await createFaucet({
      tokenSymbol: "TEST",
      decimals: 8,             // default 8
      maxSupply: 10_000_000n,  // number | bigint
      storageMode: "public",   // default "private"; public allows FPI reads
    });
    console.log("Faucet:", created.bech32id());
  };

  return (
    <button onClick={handleCreate} disabled={isCreating}>Create faucet</button>
  );
}
```

`CreateFaucetOptions`:

| Field | Default | Description |
| --- | --- | --- |
| `tokenSymbol` | required | Display symbol (e.g. `"USDC"`) |
| `maxSupply` | required | `bigint \| number` |
| `decimals` | `8` | Token decimals |
| `storageMode` | `"private"` | Public faucets are discoverable/readable on-chain |
| `authScheme` | `AuthScheme.Falcon` | Signing scheme |

## `useSend`

Sends tokens from one account to another.

```tsx
import { useSend } from "@miden-sdk/react";

function SendForm({ from, to, usdcFaucetId }: Props) {
  const { send, isLoading, stage, error } = useSend();

  const handleSend = async () => {
    const { txId, note } = await send({
      from,
      to,
      assetId: usdcFaucetId,
      amount: 100n,
      noteType: "private",    // default "private"
    });
    console.log("Transaction:", txId);
  };

  return (
    <button onClick={handleSend} disabled={isLoading}>
      {isLoading ? `${stage}…` : "Send"}
    </button>
  );
}
```

`SendOptions`:

| Field | Required | Description |
| --- | --- | --- |
| `from` | yes | Sender `AccountRef` |
| `to` | yes | Recipient `AccountRef` |
| `assetId` | yes | Token faucet `AccountRef` |
| `amount` | unless `sendAll` | `bigint \| number` |
| `noteType` | — | `"private"` / `"public"` (default `"private"`) |
| `recallHeight` | — | Block height after which sender can reclaim the note |
| `timelockHeight` | — | Block height after which recipient can consume the note |
| `attachment` | — | `bigint[] \| Uint8Array \| number[]` — payload attached to the note |
| `skipSync` | — | Skip the pre-send auto-sync (default `false`) |
| `sendAll` | — | Drain full balance of `assetId` — when `true`, `amount` is ignored |
| `returnNote` | — | Return the `Note` object in the result (for out-of-band delivery, QR codes, etc.) |

`SendResult`: `{ txId: string; note: Note | null }`. `note` is non-null only when `returnNote: true`.

## `useMultiSend`

Batches multiple recipients into one transaction. All outputs must share the same sender and asset. The action function is named `sendMany`.

```tsx
import { useMultiSend } from "@miden-sdk/react";

const { sendMany, isLoading } = useMultiSend();

await sendMany({
  from: senderAccountId,
  assetId: faucetId,
  recipients: [
    { to: recipient1, amount: 500n, noteType: "private" },
    { to: recipient2, amount: 300n },
  ],
  noteType: "private", // default for recipients that don't override
});
```

`MultiSendOptions`:

| Field | Description |
| --- | --- |
| `from`, `assetId` | Single sender + single faucet for the whole batch |
| `recipients` | `MultiSendRecipient[]` — each `{ to, amount, noteType?, attachment? }` |
| `noteType` | Default for recipients that don't specify one (default `"private"`) |
| `skipSync` | Skip pre-send auto-sync |

## `useMint`

Mints tokens from a faucet you control into a recipient account.

```tsx
import { useMint } from "@miden-sdk/react";

const { mint, isLoading, stage } = useMint();

const result = await mint({
  targetAccountId: recipient,
  faucetId: myFaucet,
  amount: 10_000n,
  noteType: "private",  // default "private"
});
console.log("Mint tx:", result.transactionId);
```

`MintOptions`:

| Field | Description |
| --- | --- |
| `targetAccountId` | Recipient `AccountRef` |
| `faucetId` | Faucet `AccountRef` (must be owned by the caller) |
| `amount` | `bigint \| number` |
| `noteType` | `"private"` / `"public"` (default `"private"`) |

Returns `TransactionResult`: `{ transactionId: string }`.

## `useConsume`

Claims one or more notes into an account.

```tsx
import { useConsume } from "@miden-sdk/react";

const { consume, isLoading } = useConsume();

await consume({
  accountId: myAccountId,
  notes: [noteIdHex1, noteIdHex2],  // hex IDs, NoteId objects, InputNoteRecord, or Note
});
```

`ConsumeOptions`:

| Field | Description |
| --- | --- |
| `accountId` | Account consuming the notes |
| `notes` | `(string \| NoteId \| InputNoteRecord \| Note)[]` — mix-and-match accepted |

## `useSwap`

Atomic swap between two assets.

```tsx
import { useSwap } from "@miden-sdk/react";

const { swap, isLoading } = useSwap();

await swap({
  accountId: myWallet,
  offeredFaucetId: usdcFaucet,
  offeredAmount: 100n,
  requestedFaucetId: dagFaucet,
  requestedAmount: 200n,
  noteType: "public",          // default "private"
  paybackNoteType: "private",  // default "private"
});
```

## `useImportAccount`

Imports an account by ID (fetches from network), by previously-exported file, or by seed.

```tsx
import { useImportAccount, AuthScheme } from "@miden-sdk/react";

const { importAccount, account, isImporting, error } = useImportAccount();

// By ID — public accounts only
const imported = await importAccount({
  type: "id",
  accountId: "mtst1qy35...",
});

// By seed — public accounts only
await importAccount({
  type: "seed",
  seed: initSeed,        // Uint8Array
  mutable: true,         // default true
  authScheme: AuthScheme.Falcon,
});

// By file — works for both public and private accounts
await importAccount({
  type: "file",
  file: accountFileBytes, // AccountFile | Uint8Array | ArrayBuffer
});
```

The `type` discriminant is required. For private accounts, use the `"file"` variant — private account state isn't reconstructible from a seed alone.

## `useWaitForCommit` / `useWaitForNotes`

Polling helpers for transaction confirmation and note inbox arrivals. Both are minimal hooks — they only expose the action function.

### `useWaitForCommit`

Signature: `waitForCommit(txId, options?)` — `txId` is positional (hex string or `TransactionId`), `options` are merged with defaults.

```tsx
import { useWaitForCommit } from "@miden-sdk/react";

const { waitForCommit } = useWaitForCommit();
await waitForCommit(result.txId, {
  timeoutMs: 30_000,  // default 10_000
  intervalMs: 1_000,  // default 1_000
});
```

### `useWaitForNotes`

Exposes `waitForConsumableNotes(options)` and returns the matching `ConsumableNoteRecord[]` when the threshold is reached.

```tsx
import { useWaitForNotes } from "@miden-sdk/react";

const { waitForConsumableNotes } = useWaitForNotes();

const notes = await waitForConsumableNotes({
  accountId: recipient,
  minCount: 1,     // default 1
  timeoutMs: 30_000,
});
```

Both reject on timeout — wrap them in `try/catch` when you want a graceful fallback.

## Next

- [Advanced](./advanced.md) — custom scripts, MASM compilation, session accounts, store import/export.
- [Signers](./signers.md) — external wallets (Para, Turnkey, MidenFi) and custom signers.
- [Recipes](./recipes.md) — realistic patterns + link-outs to Philipp's full wallet tutorial.
