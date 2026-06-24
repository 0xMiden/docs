---
title: Advanced
sidebar_position: 5
---

# Advanced hooks

Hooks beyond the core send / mint / consume trio: custom scripts, MASM compilation, session wallets, store backup, note serialization, and sync control.

## `useTransaction`

General-purpose transaction runner that accepts either a prebuilt `TransactionRequest` or a builder callback. This is the escape hatch when the higher-level hooks don't cover your flow.

```tsx
import { useTransaction } from "@miden-sdk/react";
import { TransactionRequestBuilder } from "@miden-sdk/miden-sdk";

const { execute, isLoading, stage } = useTransaction();

// Direct request
await execute({
  accountId: contractAccount,
  request: prebuiltRequest,
});

// Builder callback — receives the raw WebClient
await execute({
  accountId: contractAccount,
  request: (client) =>
    new TransactionRequestBuilder()
      .withCustomScript(txScript)
      .build(),
});
```

`UseTransactionResult` exposes `execute` (not `executeTransaction`), plus `result`, `isLoading`, `stage`, `error`, and `reset`.

`ExecuteTransactionOptions`:

| Field | Description |
| --- | --- |
| `accountId` | Account the transaction applies to |
| `request` | `TransactionRequest` or `(client: WebClient) => TransactionRequest \| Promise<TransactionRequest>` |
| `skipSync` | Skip pre-send auto-sync (default `false`) |
| `privateNoteTarget` | Deliver private output notes to this account after commit (any `AccountRef` form) |

The `privateNoteTarget` field is the 4-step pipeline shortcut: execute the tx, commit onchain, then auto-deliver the private note through the note transport to the target. Useful for "send private note" UIs where the recipient already has the React SDK running.

## `useExecuteProgram`

View call — executes a transaction script locally and returns the stack output. No prove, no submit, no state change. Think of it as Miden's `eth_call`.

```tsx
import { useExecuteProgram } from "@miden-sdk/react";

const { execute, isLoading, error } = useExecuteProgram();

const result = await execute({
  accountId: contractAccount,
  script: compiledTxScript,
  foreignAccounts: [counterAccount], // optional
});

// result.stack is a bigint[] — read indices directly
const count: bigint = result.stack[0];
console.log("Count:", count);
```

`UseExecuteProgramResult` exposes `execute` (not `executeProgram`), plus `result`, `isLoading`, `error`, and `reset`. No `stage` — view calls don't prove or submit.

The React hook flattens the 16-element stack into a plain `bigint[]`. `useMidenClient()` exposes the underlying WASM `WebClient` directly — its method is `client.executeProgram(...)` (not namespaced under `client.transactions`). See the [Web SDK transactions guide](../web-client/transactions.md#view-calls-executeprogram) for the imperative `MidenClient.transactions.executeProgram` equivalent and the `FeltArray` shape.

## `useCompile`

Compiles Miden Assembly into `AccountComponent`, `TransactionScript`, or `NoteScript`. Each result method is independently callable — call only what you need for the current operation.

```tsx
import { useCompile } from "@miden-sdk/react";
import { StorageSlot } from "@miden-sdk/miden-sdk";

const { component, txScript, noteScript, isReady } = useCompile();

// Account component
const counterComponent = await component({
  code: counterContractCode,
  slots: [StorageSlot.emptyValue("miden::tutorials::counter")],
});

// Transaction script (with optional libraries)
const script = await txScript({
  code: `
    use external_contract::counter_contract
    begin
      call.counter_contract::increment_count
    end
  `,
  libraries: [
    { namespace: "external_contract::counter_contract", code: counterContractCode },
  ],
});

// Note script — use the @note_script attribute on a library proc
const attachScript = await noteScript({
  code: `
    use miden::protocol::active_note
    use miden::core::sys

    @note_script
    pub proc on_consume
      # body runs when the consuming account redeems this note
      exec.sys::truncate_stack
    end
  `,
});
```

`UseCompileResult` exposes the three compile methods plus `isReady`. Loading and error state are tracked internally per call — catch errors at the individual `await` site. See the [Web SDK compile guide](../web-client/compile.md) for the full `CompileComponentOptions` / `CompileTxScriptOptions` / `CompileNoteScriptOptions` shapes.

## `useSessionAccount`

Drives the "session wallet" pattern — create a throw-away wallet, wait for a funding note, consume it, then hand control back to your app. Useful for one-off interactions that shouldn't touch a long-lived account.

```tsx
import { useSessionAccount } from "@miden-sdk/react";

const { initialize, sessionAccountId, isReady, step, error, reset } =
  useSessionAccount({
    // Called with the new session wallet's bech32 ID once it's created.
    // Your code is responsible for actually sending funds to it — e.g. by
    // triggering a send from a main wallet elsewhere in the app.
    fund: async (sessionAccountId) => {
      await sendFromMainWallet(sessionAccountId);
    },
    assetId: usdcFaucetId,      // optional
    walletOptions: { storageMode: "private" },
    pollIntervalMs: 3_000,      // default 3_000
    maxWaitMs: 60_000,          // default 60_000
  });

await initialize();
// step progresses: "idle" → "creating" → "funding" → "consuming" → "ready"
```

`UseSessionAccountReturn`:

| Field | Description |
| --- | --- |
| `initialize()` | Kicks off the create → fund → consume flow |
| `sessionAccountId` | bech32 ID of the session wallet once created |
| `isReady` | `true` after the funding note has been consumed |
| `step` | `SessionAccountStep` — one of the five states above |
| `error` | Non-null if any step failed |
| `reset()` | Clears session data (and any persisted state under `storagePrefix`) |

Session state persists under the configurable `storagePrefix` (default `"miden-session"`) so page reloads can resume mid-flow.

## `useExportStore` / `useImportStore`

Back up and restore the entire local store as a JSON dump. Handy for wallet backup/restore UIs.

```tsx
import { useExportStore, useImportStore, useMidenClient } from "@miden-sdk/react";

// Export — returns a JSON string
const { exportStore } = useExportStore();
const dump: string = await exportStore();
download(new Blob([dump]), "wallet-backup.json");

// Import (destructive — overwrites the target store)
// Positional: (storeDump, storeName, options?)
const { importStore } = useImportStore();
const client = useMidenClient();
const storeName = await client.storeIdentifier();
await importStore(uploadedDump, storeName, { skipSync: false });
```

`ImportStoreOptions` exposes `skipSync` (default `false`) so you can defer the post-import sync. There's no second "raw bytes" form — `importStore` takes the JSON dump string as its first argument and the target store name as its second.

## `useImportNote` / `useExportNote`

Serialize notes to bytes for QR delivery or import notes handed over out-of-band. These complement the private-note transport layer — use the transport when the recipient is online, and QR/bytes when they aren't.

```tsx
import { useExportNote, useImportNote } from "@miden-sdk/react";

const { exportNote } = useExportNote();
const noteBytes = await exportNote(noteId);
// encode noteBytes into a QR, link, email, etc.

const { importNote } = useImportNote();
await importNote(uploadedBytes);
```

## `useSyncControl`

Pause and resume the auto-sync loop without dismounting `MidenProvider`. Useful when a long operation needs consistent local state, or during battery-sensitive background work.

```tsx
import { useSyncControl } from "@miden-sdk/react";

const { pauseSync, resumeSync, isPaused } = useSyncControl();

// Before a long sequence
pauseSync();
// ... operations that need a stable snapshot ...
resumeSync();
```

`pauseSync()` stops the timer but doesn't cancel an in-flight sync — wait for `isSyncing` from `useSyncState()` to settle if you need a truly quiescent state.

## Next

- [Signers](./signers.md) — wire external wallets (Para, Turnkey, MidenFi) or build a custom signer.
- [Recipes](./recipes.md) — end-to-end patterns.
