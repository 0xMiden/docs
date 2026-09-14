---
title: Recipes
sidebar_position: 7
---

# Recipes

Short patterns covering the common cases. For longer walkthroughs — building a full wallet app from scratch, including UI — see the [React wallet tutorial](https://github.com/0xMiden/tutorials/blob/main/docs/src/web-client/react_wallet_tutorial.md) in the tutorials repo, which uses these hooks end-to-end.

## Show transaction progress

`useSend()` exposes `isLoading` and `stage`; use them for optimistic UI:

```tsx
import { useSend } from "@miden-sdk/react";

function SendButton({ from, to, assetId }: Props) {
  const { send, stage, isLoading, error } = useSend();

  const handleSend = async () => {
    try {
      await send({ from, to, assetId, amount: 100n });
    } catch (err) {
      console.error("Send failed:", err);
    }
  };

  return (
    <>
      <button onClick={handleSend} disabled={isLoading}>
        {isLoading ? `${stage}…` : "Send"}
      </button>
      {error && <p role="alert">{error.message}</p>}
    </>
  );
}
```

## Format token amounts

```tsx
import { formatAssetAmount, parseAssetAmount } from "@miden-sdk/react";

// Display: 1_000_000n with 8 decimals → "0.01"
const display = formatAssetAmount(balance, 8);

// User input: "0.01" with 8 decimals → 1_000_000n
const amount = parseAssetAmount("0.01", 8);
```

## Display a note summary

```tsx
import { getNoteSummary, formatNoteSummary } from "@miden-sdk/react";

const summary = getNoteSummary(note);
const text = summary ? formatNoteSummary(summary) : "Unknown note";
```

`noteSummaries` from `useNotes()` already runs `getNoteSummary` for you — these helpers are for ad-hoc formatting elsewhere.

## Wait for confirmation after a send

```tsx
import { useSend, useWaitForCommit } from "@miden-sdk/react";

const { send } = useSend();
const { waitForCommit } = useWaitForCommit();

const result = await send({ from, to, assetId, amount: 100n });
await waitForCommit(result.txId);
```

## Drop to the raw client

```tsx
import { useMidenClient } from "@miden-sdk/react";

function SyncHeightPeek() {
  const client = useMidenClient();

  const showSyncHeight = async () => {
    const height = await client.getSyncHeight();
    console.log("Sync height:", height);
  };

  return <button onClick={showSyncHeight}>Show sync height</button>;
}
```

`useMidenClient()` throws if the provider isn't ready. Render the component only after `useMiden().isReady`, or provide `MidenProvider`'s `loadingComponent`.

## Serialize a custom raw-client flow

When several raw-client calls must run as one provider-serialized flow, use `runExclusive`. Prevent repeated calls to a mutation hook with that hook's loading state instead.

```tsx
import { useMiden, useMidenClient } from "@miden-sdk/react";

function CompoundFlow() {
  const { runExclusive } = useMiden();
  const client = useMidenClient();

  const run = () =>
    runExclusive(async () => {
      await client.syncState();
      // ...other raw-client calls in the same flow
    });

  return <button onClick={run}>Run</button>;
}
```

`runExclusive<T>(fn)` takes a zero-argument async function. Built-in transaction hooks coordinate their own client calls, so don't wrap a hook such as `send()` in `runExclusive`; use it only for your own raw-client flow.

## Separate stores for multiple signers

`MidenProvider`'s config does not accept a `storeName` directly. Per-user isolation flows through the active signer: each `SignerContext.Provider` supplies its own `storeName` field, and `MidenProvider` reads that when initialising the underlying client. See the [Signers](./signers.md#custom-signer-providers) guide for a custom signer that picks a unique store name per connected user (typically the wallet address or a hash of it).

For apps that switch between several signers, use [`MultiSignerProvider` and `SignerSlot`](./signers.md#multisignerprovider). `MidenProvider` switches to the store associated with the active signer. Don't mount multiple `MidenProvider`s expecting independent clients: the React SDK state store is shared.

## Account IDs — hex and bech32 interchangeably

Account ID parameters accept either format:

```tsx
import { toBech32AccountId, useAccount } from "@miden-sdk/react";

// Both formats are accepted.
const byHex = useAccount(hexAccountId);
const byBech32 = useAccount(bech32Address);

// Convert for display
byHex.account?.bech32id();
toBech32AccountId(hexAccountId);
```

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `"Client not ready"` thrown by a hook | Component rendered before `MidenProvider` finished initializing. Guard with `useMiden().isReady` or render via `MidenProvider`'s `loadingComponent`. |
| Transactions stuck in `"proving"` | Remote prover unreachable. Check `prover` config and network; consider `prover: { primary: "testnet", fallback: "local" }`. |
| Notes not appearing after mint | Call `sync()` from `useSyncState()` or verify `autoSyncInterval` isn't `0`. |
| Bech32 address has wrong prefix | `rpcUrl` doesn't match the network you intended. `"testnet"` → `mtst1...`, `"devnet"` → `mdev1...`. |
| WASM init fails in dev | Ensure your bundler serves `.wasm` with the `application/wasm` MIME type. Vite does this automatically; some custom setups don't. |
| `"A send is already in progress"` | The same `useSend` instance received another call before the previous one completed. Disable the trigger with `isLoading` and `await` the previous call. |

## Next

- Longer walkthrough: [React wallet tutorial](https://github.com/0xMiden/tutorials/blob/main/docs/src/web-client/react_wallet_tutorial.md) — builds a complete wallet app on top of these hooks.
- Reference: [Setup](./setup.md), [Query hooks](./query-hooks.md), [Mutation hooks](./mutation-hooks.md), [Advanced](./advanced.md), [Signers](./signers.md).
