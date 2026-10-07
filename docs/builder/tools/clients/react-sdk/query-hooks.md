---
title: Query hooks
sidebar_position: 3
---

# Query hooks

Query hooks read from the local store (and trigger a fetch when the cache is cold). Every query hook shares `{ isLoading, error, refetch }` alongside hook-specific data fields. Refetching is automatic after successful syncs, so most components don't need to call `refetch()` manually.

## `useAccounts`

Lists every account header tracked by the client. Since protocol 0.15, an account ID/header no longer identifies whether the account is a wallet or faucet; inspect the full account's components when you need that distinction.

```tsx
import { useAccounts } from "@miden-sdk/react";

function AccountList() {
  const { accounts, isLoading, error } = useAccounts();

  if (isLoading) return <p>Loading…</p>;
  if (error) return <p>{error.message}</p>;

  return (
    <>
      <h3>Accounts ({accounts.length})</h3>
      {accounts.map((account) => (
        <div key={account.id().toString()}>{account.id().toString()}</div>
      ))}
    </>
  );
}
```

Return type (`AccountsResult`):

```ts
{
  accounts: AccountHeader[];  // every tracked account
  wallets: AccountHeader[];   // deprecated alias that mirrors accounts
  faucets: AccountHeader[];   // deprecated; always empty
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}
```

## `useAccount(id)`

Full details for a single account, including per-asset balances decorated with symbol + decimals when metadata is available.

```tsx
import { useAccount } from "@miden-sdk/react";

function AccountDetails({ id, usdcFaucetId }: {
  id: string;
  usdcFaucetId: string; // canonical hex faucet ID, as returned by AccountId.toString()
}) {
  const { account, assets, getBalance, isLoading, error } = useAccount(id);

  if (isLoading) return <p>Loading…</p>;
  if (error) return <p>{error.message}</p>;
  if (!account) return <p>Not found</p>;

  return (
    <>
      <p>Account: {account.bech32id()}</p>
      <p>Nonce: {account.nonce().toString()}</p>
      <p>USDC balance: {getBalance(usdcFaucetId).toString()}</p>

      <ul>
        {assets.map((a) => (
          <li key={a.assetId}>
            {a.amount.toString()} {a.symbol ?? a.assetId}
          </li>
        ))}
      </ul>
    </>
  );
}
```

Return type (`AccountResult`):

```ts
{
  account: Account | null;
  assets: AssetBalance[]; // { assetId, amount, symbol?, decimals? }
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  getBalance: (assetId: string) => bigint;
}
```

`getBalance(assetId)` returns the raw balance in base units, or `0n` when no matching asset is found. Pass the canonical hex faucet ID used in `assets[].assetId` (as returned by `AccountId.toString()`); this helper compares strings directly and does not normalize bech32 IDs.

## `useNotes(filter?)`

Lists input notes (received) and consumable notes (ready to claim) with optional filtering. `consumableNotes` and `consumableNoteSummaries` exclude notes locked until a later block; sync again after they unlock.

```tsx
import { useNotes } from "@miden-sdk/react";

function NotesInbox({ account }: { account: string }) {
  const { notes, consumableNotes, noteSummaries, refetch } = useNotes({
    status: "committed",
    accountId: account,
  });

  return (
    <>
      <button onClick={refetch}>Refresh</button>
      <h3>Tracked input notes, all accounts ({notes.length})</h3>
      {noteSummaries.map((s) => (
        <div key={s.id}>
          {s.assets.map((a) => `${a.amount} ${a.symbol ?? a.assetId}`).join(", ")}
        </div>
      ))}

      <h3>Consumable by this account ({consumableNotes.length})</h3>
    </>
  );
}
```

Filter options (`NotesFilter`):

| Field | Values | Description |
| --- | --- | --- |
| `status` | `"all" \| "consumed" \| "committed" \| "expected" \| "processing"` | Lifecycle filter for `notes` and `noteSummaries`; does not filter the consumable lists |
| `accountId` | `AccountRef` | Restricts `consumableNotes` and `consumableNoteSummaries` to this account; does not filter `notes` or `noteSummaries` |
| `sender` | `string` | Sender ID (hex or bech32, normalized internally); filters only `noteSummaries` and `consumableNoteSummaries` |
| `excludeIds` | `string[]` | Excludes IDs only from `noteSummaries` and `consumableNoteSummaries`; raw records remain unchanged |

Return type (`NotesResult`):

```ts
{
  notes: InputNoteRecord[];              // raw SDK records
  consumableNotes: ConsumableNoteRecord[];
  noteSummaries: NoteSummary[];          // pre-computed { id, assets[], sender? }
  consumableNoteSummaries: NoteSummary[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}
```

`noteSummaries` is the pragmatic choice for UIs — it pre-extracts asset info and runs metadata resolution.

## `useNoteStream(options?)`

Temporal note tracking with first-seen timestamps and per-stream filtering. Useful for notification UIs that want to highlight new arrivals.

```tsx
import { useState } from "react";
import { useNoteStream } from "@miden-sdk/react";

function NewNotesToast() {
  const [since] = useState(() => Date.now());
  const { notes, latest, markHandled, markAllHandled } = useNoteStream({
    status: "committed",       // default "committed"
    since,                    // fixed at mount; drop notes seen earlier
    amountFilter: (amount) => amount > 0n,
  });

  return (
    <>
      {latest && <p>New: {latest.id}</p>}
      {notes.map((n) => (
        <div key={n.id}>
          {n.id} at {new Date(n.firstSeenAt).toISOString()}
          <button onClick={() => markHandled(n.id)}>dismiss</button>
        </div>
      ))}
      <button onClick={markAllHandled}>Dismiss all</button>
    </>
  );
}
```

`UseNoteStreamOptions` fields: `status`, `sender`, `since` (numeric timestamp), `excludeIds` (`Set<string>` or `string[]`), and `amountFilter` for predicate-based filtering. The stream also exposes `snapshot()` for passing state across unmount / remount boundaries.

## `useTransactionHistory(options?)`

Transaction records, with optional filters for specific IDs or a custom `TransactionFilter`.

```tsx
import { useTransactionHistory } from "@miden-sdk/react";

function HistoryTable() {
  const { records, isLoading } = useTransactionHistory();
  if (isLoading) return <p>Loading…</p>;

  return (
    <table>
      <tbody>
        {records.map((tx) => (
          <tr key={tx.id().toHex()}>
            <td>{tx.id().toHex()}</td>
            <td>{tx.blockNum().toString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

Options:

| Field | Description |
| --- | --- |
| `id` | Single transaction ID lookup |
| `ids` | List of transaction IDs |
| `filter` | Custom `TransactionFilter` (overrides `id` / `ids`) |
| `refreshOnSync` | Re-fetch after every auto-sync (default `true`) |

Result (`TransactionHistoryResult`):

```ts
{
  records: TransactionRecord[];
  record: TransactionRecord | null;   // convenience when a single id was provided
  status: TransactionStatus | null;   // convenience when a single id was provided
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}
```

In 0.17.0, `TransactionFilter` supports `all()`, `ids(...)`, and `uncommitted()`, but no account filter. Filter the returned records locally using `record.accountId().toString()` and a canonical hex account ID:

```ts
const accountRecords = records.filter(
  (record) => record.accountId().toString() === accountIdHex,
);
```

## `useSyncState`

Sync heights and manual-trigger controls.

```tsx
import { useSyncState } from "@miden-sdk/react";

function SyncBadge() {
  const { syncHeight, isSyncing, lastSyncTime, sync } = useSyncState();

  return (
    <button onClick={() => sync()} disabled={isSyncing}>
      Block {syncHeight ?? "—"} {isSyncing && "(syncing…)"}
    </button>
  );
}
```

Manual `sync()` composes with the auto-sync loop (configured via `autoSyncInterval` on `MidenProvider`) — call it when you want to force an immediate refresh.

## `useAssetMetadata(assetIds?)`

Symbol + decimals lookup for a batch of asset IDs. The argument is an optional `string[]`; pass an empty array (or nothing) to read the global cache without triggering new fetches.

```tsx
import { useAssetMetadata } from "@miden-sdk/react";

function TokenChip({ assetId }: { assetId: string }) {
  const { assetMetadata } = useAssetMetadata([assetId]);
  const meta = assetMetadata.get(assetId);
  return <span>{meta?.symbol ?? assetId}</span>;
}

function TokenLegend({ ids }: { ids: string[] }) {
  const { assetMetadata } = useAssetMetadata(ids);
  return (
    <>
      {ids.map((id) => {
        const m = assetMetadata.get(id);
        return <span key={id}>{m?.symbol ?? id}</span>;
      })}
    </>
  );
}
```

`assetMetadata` is a `Map<string, AssetMetadata>` keyed by asset ID. The hook dedupes and caches across components, so siblings that ask for overlapping IDs share cost.

## Next

- [Mutation hooks](./mutation-hooks.md) — create wallets, faucets, send tokens, consume notes.
- [Advanced](./advanced.md) — custom scripts, note import/export, session accounts.
- [Recipes](./recipes.md) — end-to-end patterns.
