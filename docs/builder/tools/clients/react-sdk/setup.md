---
title: Setup
sidebar_position: 2
---

# Setting up the React SDK

## Install

The React SDK has a hard peer dependency on `@miden-sdk/miden-sdk` — install both:

```bash
npm install @miden-sdk/react @miden-sdk/miden-sdk
# or
yarn add @miden-sdk/react @miden-sdk/miden-sdk
# or
pnpm add @miden-sdk/react @miden-sdk/miden-sdk
```

React 18 or newer is required.

## Wrap your app in `MidenProvider`

`MidenProvider` loads the Web SDK's WebAssembly module, spins up the dedicated worker, wires the keystore, and kicks off the auto-sync loop. Put it at the root of your React tree — typically in `App.tsx` or your Next.js root layout.

```tsx
import { MidenProvider } from "@miden-sdk/react";

function App() {
  return (
    <MidenProvider config={{ rpcUrl: "testnet" }}>
      <YourApp />
    </MidenProvider>
  );
}
```

Every hook in the rest of this section assumes a `MidenProvider` is mounted somewhere above it.

## Configuration

```tsx
<MidenProvider
  config={{
    rpcUrl: "testnet",           // "devnet" | "testnet" | "localhost" | custom URL
    prover: "testnet",           // "local" | "devnet" | "testnet" | custom URL
    autoSyncInterval: 15_000,    // ms; set to 0 to disable auto-sync
    noteTransportUrl: "https://transport.miden.io", // optional; required for private notes
  }}
  loadingComponent={<Loading />} // rendered while WASM boots
  errorComponent={<Error />}     // rendered if init fails
>
  <YourApp />
</MidenProvider>
```

### `MidenConfig` fields

| Field | Type | Description |
| --- | --- | --- |
| `rpcUrl` | `"devnet" \| "testnet" \| "localhost" \| string` | Node RPC endpoint. Shorthands expand to hosted Miden endpoints; any other string is treated as a raw URL. |
| `prover` | `"local" \| "devnet" \| "testnet" \| string \| ProverConfig` | Default prover. `"local"` runs in-browser. `ProverConfig` supports a `primary` + `fallback` pair if you want automatic fallback. |
| `autoSyncInterval` | `number` | Milliseconds between automatic sync pulls. `0` disables the loop (you can still call `sync()` manually). Default: 15000. |
| `noteTransportUrl` | `string` | Full note transport service URL. Required for `sendPrivate` / `fetchPrivate`. |
| `proverTimeoutMs` | `number` | Per-transaction prover timeout. |
| `seed` | `Uint8Array` | 32-byte RNG seed for deterministic account-ID derivation in tests. |

### Network shorthands

| Shorthand | Meaning |
| --- | --- |
| `devnet` | Development / pre-production testing, fake tokens |
| `testnet` | Pre-production testing against the hosted Miden testnet |
| `localhost` | Local node at `http://localhost:57291` |

`MidenProvider` expands the `rpcUrl` network shorthands but not `noteTransportUrl`. Pass the full transport URL (`https://transport.miden.io` for testnet or `https://transport.devnet.miden.io` for devnet).

### `loadingComponent` and `errorComponent`

- `loadingComponent` is rendered while the provider initializes the client.
- `errorComponent` is rendered if initialization fails. It accepts either a `ReactNode` or `(error: Error) => ReactNode`.

Both are optional. Without them, the provider renders its children; use `isReady`, `isInitializing`, and `error` to control their loading and error states.

## Client lifecycle

`useMiden()` is the raw context hook. Most apps never need it — the specialized hooks are easier — but it's there when you want to reach into lifecycle state directly.

```tsx
import { useMiden } from "@miden-sdk/react";

function Status() {
  const { isReady, isInitializing, error, sync } = useMiden();

  if (error) return <p>Init error: {error.message}</p>;
  if (isInitializing || !isReady) return <p>Loading Miden…</p>;

  return <button onClick={() => sync()}>Sync</button>;
}
```

- `isReady` — `true` once the client has initialized. For an external signer, also check `signerConnected`; client readiness does not imply that the wallet is connected.
- `isInitializing` — `true` while client initialization is in progress.
- `error` — non-null if init failed.
- `sync()` — trigger a manual sync pass outside the auto-sync loop.
- `runExclusive<T>(fn: () => Promise<T>): Promise<T>` — serialize a block of async work under the internal lock. `fn` takes no arguments; reach for the client via `useMidenClient()` if you need one inside. See [serialized raw-client flows](./recipes.md#serialize-a-custom-raw-client-flow).

`useMidenClient()` is a shortcut that returns the ready `WebClient` directly, throwing if the provider isn't ready yet:

```tsx
import { useMiden, useMidenClient } from "@miden-sdk/react";

function LoadSyncHeightButton() {
  const { isReady } = useMiden();
  if (!isReady) return <button disabled>Loading Miden…</button>;
  return <ReadyLoadSyncHeightButton />;
}

function ReadyLoadSyncHeightButton() {
  const client = useMidenClient();

  const loadHeight = async () => {
    const height = await client.getSyncHeight();
    console.log("Block:", height);
  };

  return <button onClick={loadHeight}>Load sync height</button>;
}
```

Use it for APIs the React SDK hooks don't expose. Keep the readiness check in a parent component so `useMidenClient()` is only called after initialization, without changing the order of hooks between renders.

## Hook result conventions

Each hook exports its own result interface — `UseSendResult`, `AccountsResult`, `NotesResult`, and so on — rather than a generic `QueryResult<T>` wrapper. Data lives in named fields (e.g. `accounts` and `records`) not inside a common `data` key. The shared machinery is narrower than that:

### Query hooks

Every query hook exposes at least:

```ts
{
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}
```

Plus the hook-specific data fields. For example:

```tsx
const { accounts, isLoading, error } = useAccounts();

if (isLoading) return <Spinner />;
if (error) return <p>{error.message}</p>;
return <AccountList accounts={accounts} />;
```

### Mutation hooks

Every mutation hook exposes:

```ts
{
  // Domain-specific action function — `send` for useSend, `mint` for useMint, etc.
  [action]: (options) => Promise<Result>;
  result: Result | null;
  isLoading: boolean;
  stage: TransactionStage;
  error: Error | null;
  reset: () => void;
}
```

The action function name mirrors the hook: `useSend` returns `send`, `useMint` returns `mint`, `useConsume` returns `consume`. That keeps call sites readable without destructured renames.

Transaction-producing mutations progress through the `TransactionStage` states:

```ts
type TransactionStage =
  | "idle"
  | "executing"
  | "proving"
  | "submitting"
  | "complete";
```

Pattern:

```tsx
const { send, stage, isLoading, error } = useSend();

return (
  <>
    <button
      onClick={() => send({ from, to, assetId, amount: 100n })}
      disabled={isLoading}
    >
      {isLoading ? `${stage}…` : "Send"}
    </button>
    {error && <p role="alert">{error.message}</p>}
  </>
);
```

See [Mutation hooks](./mutation-hooks.md) for the full surface.

## Account ID formats

Hooks that take an account ID accept either format. Given a full `Account` (for example, from `useAccount`) passed to your component as a prop:

```tsx
const accountIdHex = account.id().toString();
const accountIdBech32 = account.bech32id();

useAccount(accountIdHex);
useAccount(accountIdBech32);
```

The SDK normalises internally — you don't need to convert yourself. Bech32 prefixes encode the network: `mtst1…` on testnet, `mdev1…` on devnet. The prefix is derived from the `rpcUrl` you configured on `MidenProvider`.

## Next

- [Query hooks](./query-hooks.md) — read account, note, sync, and metadata state.
- [Mutation hooks](./mutation-hooks.md) — create wallets, send, mint, consume, swap.
- [Advanced](./advanced.md) — custom scripts, session wallets, import/export.
- [Signers](./signers.md) — integrate Para, Turnkey, MidenFi, or a custom wallet.
