---
title: Advanced
sidebar_position: 5
---

# Advanced hooks

Hooks beyond the core send / mint / consume trio: custom scripts, transaction previews, MASM compilation, session wallets, store backup, note serialization, and sync control.

## `useTransaction`

General-purpose transaction runner that accepts either a prebuilt `TransactionRequest` or a builder callback. This is the escape hatch when the higher-level hooks don't cover your flow.

```tsx
import { useTransaction } from "@miden-sdk/react";
import { AccountId } from "@miden-sdk/miden-sdk";

const { execute, isLoading, stage } = useTransaction();

// Direct request
await execute({
  accountId: contractAccount,
  request: prebuiltRequest,
});

// Builder callback — receives the raw WebClient
await execute({
  accountId: contractAccount,
  request: async (client) =>
    (await client.feeAwareTransactionRequestBuilder(AccountId.fromHex(contractAccount)))
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
| `anchor` | Execute against a reference block captured with `useChainAnchor`; omit for 0.17 multisig requests |

The `privateNoteTarget` field is the 4-step pipeline shortcut: execute the tx, commit onchain, then auto-deliver the private note through the note transport to the target. Useful for "send private note" UIs where the recipient already has the React SDK running.

## `useChainAnchor` and `usePreview`

Use `usePreview` when a transaction summary is proposed on one client and authorized or executed on another. For a 0.17 multisig, build from `feeAwareTransactionRequestBuilder` and execute at the synced tip. The request carries the bound block that keeps its summary reproducible; no `ChainAnchor` is needed.

Build and preview in separate UI steps. The prepared request is React state, so it becomes available on the render after `prepare()` completes:

```tsx
import { useState } from "react";
import { useMiden, usePreview, useTransaction } from "@miden-sdk/react";
import { AccountId } from "@miden-sdk/miden-sdk";
import type {
  TransactionRequest, TransactionRequestBuilder, TransactionSummary,
} from "@miden-sdk/miden-sdk";

type MultisigProposalProps = {
  accountId: string; // hex account ID
  buildRequest: (builder: TransactionRequestBuilder) => TransactionRequest | Promise<TransactionRequest>;
  sendProposal: (request: Uint8Array, summary: Uint8Array) => Promise<void>;
  collectAuthorization: (
    summary: TransactionSummary,
    request: TransactionRequest,
  ) => Promise<TransactionRequest>;
};

function MultisigProposal({
  accountId,
  buildRequest,
  sendProposal,
  collectAuthorization,
}: MultisigProposalProps) {
  const { client, sync, runExclusive } = useMiden();
  const { preview, isPreviewing } = usePreview();
  const { execute, isLoading } = useTransaction();
  const [request, setRequest] = useState<TransactionRequest | null>(null);
  const [authorizedRequest, setAuthorizedRequest] =
    useState<TransactionRequest | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const busy = isPreparing || isPreviewing || isAuthorizing || isLoading;

  const prepare = async () => {
    if (!client) return;
    setAuthorizedRequest(null);
    setRequest(null);
    setIsPreparing(true);
    try {
      await sync();
      const builder = await runExclusive(() =>
        client.feeAwareTransactionRequestBuilder(AccountId.fromHex(accountId)),
      );
      setRequest(await buildRequest(builder));
    } finally {
      setIsPreparing(false);
    }
  };

  const previewAndShare = async () => {
    if (!client || !request) return;
    setAuthorizedRequest(null);
    setIsAuthorizing(true);
    try {
      await sync();
      const syncHeight = await runExclusive(() => client.getSyncHeight());
      if (syncHeight < Math.max(0, ...request.blockNumbers())) {
        throw new Error("The client has not synced to the proposal's bound block");
      }
      const summary = await preview({ accountId, request });
      await sendProposal(request.serialize(), summary.serialize());
      setAuthorizedRequest(await collectAuthorization(summary, request));
    } finally {
      setIsAuthorizing(false);
    }
  };

  const executeAuthorized = async () => {
    if (!authorizedRequest) return;
    await execute({ accountId, request: authorizedRequest });
    setAuthorizedRequest(null);
  };

  return (
    <>
      <button onClick={prepare} disabled={!client || busy}>
        Build proposal
      </button>
      <button onClick={previewAndShare} disabled={!request || busy}>
        Preview and share
      </button>
      <button onClick={executeAuthorized} disabled={!authorizedRequest || busy}>
        Execute authorized request
      </button>
    </>
  );
}
```

`buildRequest` adds the application's actions to the supplied builder. Keep its auth arguments intact: do not call `withFeeConversionSalt` or `withAuthArg`. `collectAuthorization` gathers signatures and returns the same request with authorization advice attached. Co-signers deserialize the received request, sync to its declared blocks, derive its summary without an anchor, and compare commitments before signing.

`preview()` does not sync automatically and rejects with `TRANSACTION_ALREADY_AUTHORIZED` when no additional authorization is needed; execute directly in that case. `useChainAnchor` remains available for other flows whose summary binds the execution reference block. Pass the same anchor to preview and execute, and free it when finished.

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
  namespace: "external_contract::counter_contract",
  slots: [StorageSlot.emptyValue("miden::tutorials::counter")],
});

// Transaction script (with optional libraries)
const script = await txScript({
  code: `
    use external_contract::counter_contract

    @transaction_script
    pub proc main
      call.counter_contract::increment_count
    end
  `,
  libraries: [{ component: counterComponent }],
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
import { useMiden, useSessionAccount } from "@miden-sdk/react";
import { getWasmOrThrow } from "@miden-sdk/miden-sdk/lazy";

// Resolve the numeric authentication enum once, before rendering this module.
const { AuthScheme } = await getWasmOrThrow();

export function SessionWallet({
  fund,
}: {
  fund: (sessionAccountId: string) => Promise<void>;
}) {
  const { isReady: clientReady } = useMiden();
  const { initialize, sessionAccountId, isReady, step, error, reset } =
    useSessionAccount({
      // The callback receives the new wallet's hex ID. Send a funding note
      // containing native fee tokens, plus any assets the session needs.
      fund,
      walletOptions: {
        storageMode: "private",
        authScheme: AuthScheme.AuthRpoFalcon512,
      },
      pollIntervalMs: 3_000,
      maxWaitMs: 60_000,
    });

  return (
    <>
      <button
        onClick={() => void initialize().catch(console.error)}
        disabled={!clientReady || step !== "idle"}
      >
        {step === "idle" ? "Start session" : step}
      </button>
      {isReady && <p>Session ready: {sessionAccountId}</p>}
      {error && <p role="alert">{error.message}</p>}
      <button onClick={reset}>Reset session</button>
    </>
  );
}
```

In React SDK 0.17.0, pass the raw numeric authentication enum explicitly, as above; the
hook's default resolves to an undefined enum member. The `fund` callback belongs
to your application. It must register the account if the network requires an
invitation, then supply a note containing the native fee asset so the new wallet
can pay for its first consume transaction.

Funding notes must be consumable at the last synced block; the hook waits while they are block-locked.

The flow progresses through `idle` → `creating` → `funding` → `consuming` → `ready`. The hook reaches `ready` after submitting the consumption transaction; it does not wait for on-chain confirmation.

`UseSessionAccountReturn`:

| Field | Description |
| --- | --- |
| `initialize()` | Kicks off the create → fund → consume flow |
| `sessionAccountId` | Hex ID of the session wallet once created |
| `isReady` | `true` after the funding-note consumption transaction has been submitted |
| `step` | `SessionAccountStep` — one of the five states above |
| `error` | Non-null if any step failed |
| `reset()` | Clears session data (and any persisted state under `storagePrefix`) |

Session state persists under the configurable `storagePrefix` (default `"miden-session"`) so page reloads can resume mid-flow.

## `useExportStore` / `useImportStore`

Back up and restore the entire local store as a JSON dump. Handy for wallet backup/restore UIs. Use a dump from a compatible SDK version. Store import is not a migration from the v0.16 data format to v0.17.

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

`exportNote` requires an output-note ID tracked by this client. An
imported input note alone is insufficient and returns `No output note found`.

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
