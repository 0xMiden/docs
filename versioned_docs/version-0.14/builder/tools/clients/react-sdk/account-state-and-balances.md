---
title: Account state and balances
sidebar_position: 4
---

# Account state and balances

This page shows the application flow most wallet and dApp frontends need:

1. mount `MidenProvider`,
2. resolve the active account,
3. sync before reading fresh state,
4. render fungible asset balances,
5. refresh after submitted transactions, and
6. run local view-call style reads with `useExecuteProgram()`.

The important boundary is:

- **Sync** pulls network state into the local client store.
- **Query hooks** such as `useAccounts()` and `useAccount()` read from that local store.
- **Mutation hooks** such as `useSend()`, `useMint()`, and `useConsume()` build, prove, and submit transactions.
- **`useExecuteProgram()`** runs locally and does not prove, submit, or change state.

For the full package README and source-level examples, see
[`miden-client/packages/react-sdk/README.md`](https://github.com/0xMiden/miden-client/blob/v0.14.5/packages/react-sdk/README.md).

## Provider setup

Mount `MidenProvider` once above every component that calls React SDK hooks. Enable auto-sync for normal app usage, and keep a manual refresh button for user-driven state updates.

```tsx
import { MidenProvider } from "@miden-sdk/react";

export function App() {
  return (
    <MidenProvider
      config={{
        rpcUrl: "testnet",
        prover: "testnet",
        noteTransportUrl: "testnet",
        autoSyncInterval: 15_000,
      }}
      loadingComponent={<p>Loading Miden...</p>}
      errorComponent={(error) => <p role="alert">{error.message}</p>}
    >
      <WalletHome />
    </MidenProvider>
  );
}

function WalletHome() {
  return <p>Miden wallet ready.</p>;
}
```

## Resolve the active account

When an external signer is connected, `useMiden()` exposes `signerAccountId`. In local-keystore flows, pick the account from `useAccounts()` instead, usually from a user selection or the first wallet in the local store.

```tsx
import { useMemo } from "react";
import { useAccounts, useMiden } from "@miden-sdk/react";

export function useActiveAccountId(selectedAccountId?: string): string | undefined {
  const { signerAccountId } = useMiden();
  const { wallets } = useAccounts();

  return useMemo(
    () => selectedAccountId ?? signerAccountId ?? wallets[0]?.id().toString(),
    [selectedAccountId, signerAccountId, wallets]
  );
}
```

If this returns `undefined`, the app has no connected signer and no local wallet yet. Render a connect/create-account state before calling transaction hooks.

## Render all fungible balances

`useAccount(accountId)` returns the full account plus `assets`, which are extracted from the account vault and decorated with token metadata when it is available.

```tsx
import {
  formatAssetAmount,
  useAccount,
  useSyncState,
} from "@miden-sdk/react";

type BalancePanelProps = {
  accountId?: string;
  fallbackDecimals?: number;
};

export function BalancePanel({
  accountId,
  fallbackDecimals = 8,
}: BalancePanelProps) {
  const { account, assets, isLoading, error, refetch } = useAccount(accountId);
  const { sync, isSyncing } = useSyncState();

  const refresh = async () => {
    await sync();
    await refetch();
  };

  if (!accountId) return <p>Connect or create a wallet to see balances.</p>;
  if (isLoading) return <p>Loading balances...</p>;
  if (error) return <p role="alert">{error.message}</p>;
  if (!account) return <p>Account not found in the local store.</p>;

  return (
    <section>
      <header>
        <p>{account.bech32id()}</p>
        <button onClick={refresh} disabled={isSyncing}>
          {isSyncing ? "Syncing..." : "Refresh"}
        </button>
      </header>

      {assets.length === 0 ? (
        <p>No fungible assets found for this account.</p>
      ) : (
        <ul>
          {assets.map((asset) => {
            const decimals = asset.decimals ?? fallbackDecimals;
            const label = asset.symbol ?? asset.assetId;

            return (
              <li key={asset.assetId}>
                {formatAssetAmount(asset.amount, decimals)} {label}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
```

`sync()` updates the local store from the node. `refetch()` then re-reads the account details for the current component. `useAccount()` also refreshes after successful provider syncs, but explicit `refetch()` keeps button-driven UI immediate.

## Render one token balance

For a single known faucet, use the `getBalance(assetId)` helper. It returns `0n` when the account does not hold that asset.

```tsx
import { formatAssetAmount, useAccount } from "@miden-sdk/react";

type TokenBalanceProps = {
  accountId?: string;
  faucetId: string;
  symbol?: string;
  decimals?: number;
};

export function TokenBalance({
  accountId,
  faucetId,
  symbol = "TOKEN",
  decimals = 8,
}: TokenBalanceProps) {
  const { getBalance, isLoading, error } = useAccount(accountId);
  const balance = getBalance(faucetId);

  if (!accountId) return <span>-</span>;
  if (isLoading) return <span>Loading...</span>;
  if (error) return <span>{error.message}</span>;

  return (
    <span>
      {formatAssetAmount(balance, decimals)} {symbol}
    </span>
  );
}
```

## Refresh after a submitted transaction

`useSend()` returns `{ txId }`. `useMint()` and `useConsume()` return `{ transactionId }`. In all cases, wait for the transaction to commit, then sync the client so query hooks can read the updated local state.

```tsx
import {
  useSend,
  useSyncState,
  useWaitForCommit,
} from "@miden-sdk/react";

type SendFormProps = {
  from: string;
  to: string;
  faucetId: string;
};

export function SendForm({ from, to, faucetId }: SendFormProps) {
  const { send, stage, isLoading, error } = useSend();
  const { waitForCommit } = useWaitForCommit();
  const { sync } = useSyncState();

  const submit = async () => {
    const result = await send({
      from,
      to,
      assetId: faucetId,
      amount: 100n,
      noteType: "private",
    });

    await waitForCommit(result.txId);
    await sync();
  };

  return (
    <>
      <button onClick={submit} disabled={isLoading}>
        {isLoading ? stage : "Send 100"}
      </button>
      {error && <p role="alert">{error.message}</p>}
    </>
  );
}
```

For `mint` and `consume`, the same pattern is:

```tsx
import {
  useConsume,
  useMint,
  useSyncState,
  useWaitForCommit,
} from "@miden-sdk/react";

type MintAndConsumeActionsProps = {
  accountId: string;
  faucetId: string;
  noteIds: string[];
};

export function MintAndConsumeActions({
  accountId,
  faucetId,
  noteIds,
}: MintAndConsumeActionsProps) {
  const { mint, stage: mintStage, isLoading: isMinting } = useMint();
  const { consume, stage: consumeStage, isLoading: isConsuming } = useConsume();
  const { waitForCommit } = useWaitForCommit();
  const { sync } = useSyncState();

  const mintNewTokens = async () => {
    const result = await mint({
      faucetId,
      targetAccountId: accountId,
      amount: 100n,
    });

    await waitForCommit(result.transactionId);
    await sync();
  };

  const consumeNotes = async () => {
    const result = await consume({
      accountId,
      notes: noteIds,
    });

    await waitForCommit(result.transactionId);
    await sync();
  };

  return (
    <>
      <button onClick={mintNewTokens} disabled={isMinting}>
        {isMinting ? mintStage : "Mint 100"}
      </button>
      <button onClick={consumeNotes} disabled={isConsuming || noteIds.length === 0}>
        {isConsuming ? consumeStage : "Consume notes"}
      </button>
    </>
  );
}
```

If a transaction creates a private note for another account, the recipient still needs to receive/import the note and consume it before the recipient's balance changes.

## Local view-call reads

Use `useExecuteProgram()` for local, static-call style reads against account code. It runs a compiled transaction script locally, returns the stack output, and does not submit a transaction.

```tsx
import { useExecuteProgram } from "@miden-sdk/react";
import type { TransactionScript } from "@miden-sdk/miden-sdk";

type CounterReadProps = {
  accountId: string;
  script: TransactionScript;
  foreignAccountId?: string;
};

export function CounterRead({
  accountId,
  script,
  foreignAccountId,
}: CounterReadProps) {
  const { execute, result, isLoading, error } = useExecuteProgram();

  const read = async () => {
    await execute({
      accountId,
      script,
      foreignAccounts: foreignAccountId ? [foreignAccountId] : [],
    });
  };

  return (
    <section>
      <button onClick={read} disabled={isLoading}>
        {isLoading ? "Reading..." : "Read counter"}
      </button>
      {error && <p role="alert">{error.message}</p>}
      {result && <p>Counter: {result.stack[0]?.toString() ?? "0"}</p>}
    </section>
  );
}
```

`foreignAccounts` is required only when the script reads another public account through foreign procedure invocation. View calls use the local client context, so set `skipSync: true` only when you intentionally want to read the current local snapshot without pulling fresh network state first.

## Checklist

- Wrap app code in `MidenProvider` before calling hooks.
- Use `signerAccountId` for external signer apps and `useAccounts()` for local wallet selection.
- Call `sync()` before user-visible reads that need fresh network state.
- Read balances from `useAccount(accountId).assets` or `getBalance(faucetId)`.
- After submitted transactions, wait for commit and sync again.
- Use `useExecuteProgram()` only for local reads; it does not prove, submit, or mutate account state.
