---
title: Query hooks
sidebar_position: 3
---

# Query hooks

Query hooks read from the local store (and trigger a fetch when the cache is cold). Every query hook shares `{ isLoading, error, refetch }` alongside hook-specific data fields. Refetching is automatic after successful syncs, so most components don't need to call `refetch()` manually.

## `useAccounts`

Lists every account tracked by the client, pre-categorised into wallets and faucets.

```tsx
import { useAccounts } from "@miden-sdk/react";

function AccountList() {
  const { accounts, wallets, faucets, isLoading, error } = useAccounts();

  if (isLoading) return <p>Loading…</p>;
  if (error) return <p>{error.message}</p>;

  return (
    <>
      <h3>Wallets ({wallets.length})</h3>
      {wallets.map((w) => <div key={w.id().toString()}>{w.id().toString()}</div>)}

      <h3>Faucets ({faucets.length})</h3>
      {faucets.map((f) => <div key={f.id().toString()}>{f.id().toString()}</div>)}
    </>
  );
}
```

Return type (`AccountsResult`):

```ts
{
  accounts: AccountHeader[];  // every tracked account
  wallets: AccountHeader[];   // regular accounts
  faucets: AccountHeader[];   // token faucets
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}
```

## `useAccount(id)`

Full details for a single account, including per-asset balances decorated with symbol + decimals when metadata is available.

```tsx
import { useAccount } from "@miden-sdk/react";

function AccountDetails({ id }: { id: string }) {
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

`getBalance(assetId)` is a convenience for single-asset reads — returns `0n` when the account doesn't hold that asset.

## `useNotes(filter?)`

Lists input notes (received) and consumable notes (ready to claim) with optional filtering.

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
      <h3>Received ({notes.length})</h3>
      {noteSummaries.map((s) => (
        <div key={s.id}>
          {s.assets.map((a) => `${a.amount} ${a.symbol ?? a.assetId}`).join(", ")}
        </div>
      ))}

      <h3>Consumable ({consumableNotes.length})</h3>
    </>
  );
}
```

Filter options (`NotesFilter`):

| Field | Values | Description |
| --- | --- | --- |
| `status` | `"all" \| "consumed" \| "committed" \| "expected" \| "processing"` | Filter by note lifecycle state |
| `accountId` | `AccountRef` | Only notes relevant to this account |
| `sender` | `string` | Account ID in any accepted format (hex or bech32) — normalised internally |
| `excludeIds` | `string[]` | Skip these note IDs (useful for hiding notes your UI already rendered elsewhere) |

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
import { useNoteStream } from "@miden-sdk/react";

function NewNotesToast() {
  const { notes, latest, markHandled, markAllHandled } = useNoteStream({
    status: "committed",       // default "committed"
    since: Date.now(),         // numeric timestamp; drop notes seen earlier
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

For account-scoped history use a `TransactionFilter` that targets the account — see the `@miden-sdk/miden-sdk` `TransactionFilter` API.

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
