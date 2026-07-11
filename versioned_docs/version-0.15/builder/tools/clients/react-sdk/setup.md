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
    noteTransportUrl: "testnet", // optional; required for private notes
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
| `noteTransportUrl` | `"devnet" \| "testnet" \| string` | Note transport service. Required for `sendPrivate` / `fetchPrivate`. |
| `proverTimeoutMs` | `number` | Per-transaction prover timeout. |
| `seed` | `Uint8Array` | 32-byte RNG seed for deterministic account-ID derivation in tests. |

### Network shorthands

| Shorthand | Meaning |
| --- | --- |
| `devnet` | Development / pre-production testing, fake tokens |
| `testnet` | Pre-production testing against the hosted Miden testnet |
| `localhost` | Local node at `http://localhost:57291` |

### `loadingComponent` and `errorComponent`

- `loadingComponent` is rendered during the brief WASM load phase (first render only).
- `errorComponent` is rendered if initialization fails. It accepts either a `ReactNode` or `(error: Error) => ReactNode`.

Both are optional. Leaving them unset uses sensible defaults.

## Client lifecycle

`useMiden()` is the raw context hook. Most apps never need it — the specialized hooks are easier — but it's there when you want to reach into lifecycle state directly.

```tsx
import { useMiden } from "@miden-sdk/react";

function Status() {
  const { isReady, isInitializing, error, sync, runExclusive } = useMiden();

  if (isInitializing) return <p>Loading Miden…</p>;
  if (error) return <p>Init error: {error.message}</p>;

  return <button onClick={() => sync()}>Sync</button>;
}
```

- `isReady` — `true` once the WASM module, keystore, and signer are fully initialised.
- `isInitializing` — `true` during the first load.
- `error` — non-null if init failed.
- `sync()` — trigger a manual sync pass outside the auto-sync loop.
- `runExclusive<T>(fn: () => Promise<T>): Promise<T>` — serialize a block of async work under the internal lock. `fn` takes no arguments; reach for the client via `useMidenClient()` if you need one inside. See [race conditions](./recipes.md#prevent-race-conditions).

`useMidenClient()` is a shortcut that returns the ready `WebClient` directly, throwing if the provider isn't ready yet:

```tsx
import { useMidenClient } from "@miden-sdk/react";

function AdvancedCall() {
  const client = useMidenClient();
  const header = await client.getBlockHeaderByNumber(100);
  // ...
}
```

Use it for APIs the React SDK hooks don't expose.

## Hook result conventions

Each hook exports its own result interface — `UseSendResult`, `AccountsResult`, `NotesResult`, and so on — rather than a generic `QueryResult<T>` wrapper. Data lives in named fields (e.g. `accounts`, `wallets`, `faucets`) not inside a common `data` key. The shared machinery is narrower than that:

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
const { wallets, faucets, isLoading, error, refetch } = useAccounts();

if (isLoading) return <Spinner />;
if (error) return <p>{error.message}</p>;
return <AccountList wallets={wallets} faucets={faucets} />;
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
  <button
    onClick={() => send({ from, to, assetId, amount: 100n })}
    disabled={isLoading}
  >
    {isLoading ? `${stage}…` : "Send"}
  </button>
);
```

See [Mutation hooks](./mutation-hooks.md) for the full surface.

## Account ID formats

Every hook accepts either form:

```tsx
useAccount("0x1234567890abcdef");   // hex
useAccount("mtst1qy35...");         // bech32 (testnet prefix)

// Convert for display
account.bech32id(); // "mtst1qy35..." on testnet
```

The SDK normalises internally — you don't need to convert yourself. Bech32 prefixes encode the network: `mtst1…` on testnet, `mdev1…` on devnet. The prefix is derived from the `rpcUrl` you configured on `MidenProvider`.

## Next

- [Query hooks](./query-hooks.md) — read account, note, sync, and metadata state.
- [Mutation hooks](./mutation-hooks.md) — create wallets, send, mint, consume, swap.
- [Advanced](./advanced.md) — custom scripts, session wallets, import/export.
- [Signers](./signers.md) — integrate Para, Turnkey, MidenFi, or a custom wallet.
