---
title: Overview
sidebar_position: 1
---

# React SDK (@miden-sdk/react)

The React SDK is a thin layer on top of the [Web SDK](../web-client/index.md). It wraps the underlying WASM `WebClient` with a React context (`MidenProvider`), a family of hooks (`useMiden`, `useAccount`, `useSend`, …), automatic sync polling, and a concurrency lock so multiple components never trip over the same WASM instance.

## When to use it

Reach for the React SDK when your application is already a React app (Next.js, Vite + React, React Native, Electron + React, etc.). The hooks:

- own lifecycle management (the WASM worker, signer wiring, auto-sync loop),
- expose per-hook result interfaces with a domain-named action (`send`, `mint`, `createWallet`, …) plus `isLoading` / `isCreating` / `isImporting`, `error`, and `reset`,
- serialize mutations so concurrent component interactions don't corrupt the WASM state.

If you are building a non-React app — a service worker, a Node backend, a vanilla-TS dApp — use the imperative [Web SDK](../web-client/index.md) directly.

You can always reach the underlying WASM client from any hook via `useMidenClient()` when a hook doesn't cover what you need — it returns the low-level `WebClient`, not the imperative `MidenClient` wrapper.

## What's in the package

| Surface | Purpose |
| --- | --- |
| [`MidenProvider`](./setup.md) | Root React context; loads WASM, wires the client, runs auto-sync |
| [`useMiden()`](./setup.md#client-lifecycle) | Raw lifecycle hook (`isReady`, `sync`, `runExclusive`) |
| [`useMidenClient()`](./setup.md#client-lifecycle) | Shortcut for the ready WASM `WebClient` |
| [Query hooks](./query-hooks.md) | `useAccount(s)`, `useNotes`, `useNoteStream`, `useTransactionHistory`, `useSyncState`, `useAssetMetadata` |
| [Account state and balances](./account-state-and-balances.md) | Active account selection, sync boundaries, balance rendering, and refresh-after-transaction patterns |
| [Mutation hooks](./mutation-hooks.md) | `useCreateWallet`, `useCreateFaucet`, `useImportAccount`, `useSend`, `useMultiSend`, `useMint`, `useConsume`, `useSwap` |
| [Advanced hooks](./advanced.md) | `useTransaction`, `useExecuteProgram`, `useCompile`, `useSessionAccount`, `useExportStore`, `useImportStore`, `useImportNote`, `useExportNote`, `useSyncControl`, `useWaitForCommit`, `useWaitForNotes` |
| [External signers](./signers.md) | `MultiSignerProvider`, `SignerContext`, `useSigner`, `useMultiSigner` — pluggable wallet integrations (Para, Turnkey, MidenFi, custom) |
| Utilities | `formatAssetAmount`, `parseAssetAmount`, `getNoteSummary`, `toBech32AccountId`, `createNoteAttachment` / `readNoteAttachment`, … |

Each hook exports its own result interface — not a generic `{ data, isLoading, error }` wrapper. Data lives in named fields (e.g. `accounts`, `wallets`, `records`, `wallet`, `faucet`). Transaction-producing mutations additionally expose a `stage` field that advances through `idle → executing → proving → submitting → complete`. See [setup](./setup.md#hook-result-conventions) for per-family details.

## Where to go next

- [Setup](./setup.md) — install the package, wrap your app in `MidenProvider`, configure the network.
- [Query hooks](./query-hooks.md) — read accounts, notes, sync state, and asset metadata.
- [Account state and balances](./account-state-and-balances.md) — practical account selection, sync, balances, and refresh examples.
- [Mutation hooks](./mutation-hooks.md) — create wallets and faucets, send, mint, consume, swap.
- [Advanced](./advanced.md) — custom scripts, MASM compilation, session accounts, note import/export.
- [Signers](./signers.md) — external wallets (Para, Turnkey, MidenFi) and custom signer providers.
- [Recipes](./recipes.md) — end-to-end patterns and a pointer to Philipp's full wallet tutorial.
