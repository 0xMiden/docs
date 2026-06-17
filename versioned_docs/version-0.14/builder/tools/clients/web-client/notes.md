---
title: Notes
sidebar_position: 5
---

# Notes

Notes are the primary mechanism for transferring assets and data between accounts on Miden. This guide covers the `client.notes.*` surface: listing, lookup, import / export, private-note transport, and tags.

## List received notes

```typescript
import { MidenClient } from "@miden-sdk/miden-sdk";

const client = await MidenClient.createTestnet();

// All input notes
const all = await client.notes.list();

// Filter by status
const committed   = await client.notes.list({ status: "committed" });
const consumed    = await client.notes.list({ status: "consumed" });
const expected    = await client.notes.list({ status: "expected" });
const processing  = await client.notes.list({ status: "processing" });
const unverified  = await client.notes.list({ status: "unverified" });

// Filter by specific IDs
const specific = await client.notes.list({ ids: [noteId1, noteId2] });

for (const note of all) {
  console.log(note.id().toString());
}
```

Statuses:

- `"committed"` — onchain, consumable.
- `"consumed"` — already spent.
- `"expected"` — the client expects this note to arrive.
- `"processing"` — mid-consume.
- `"unverified"` — onchain, awaiting local verification.

## Retrieve a single note

```typescript
const note = await client.notes.get("0xnote...");
if (note) {
  console.log(note.id().toString());
}
```

Returns `null` when the note isn't tracked locally.

## List sent notes (output notes)

```typescript
const sent = await client.notes.listSent();

// With status filter
const committedSent = await client.notes.listSent({ status: "committed" });
```

## List consumable notes for an account

```typescript
const records = await client.notes.listAvailable({ account: wallet });

for (const record of records) {
  console.log("Note:", record.id().toString());
}
```

Returns the input notes available for the specified account. Use this to drive "inbox" UIs.

## Import and export

```typescript
import { MidenClient, NoteExportFormat } from "@miden-sdk/miden-sdk";

const client = await MidenClient.createTestnet();

// Import from a previously exported NoteFile
const noteId = await client.notes.import(noteFile);
console.log("Imported:", noteId.toString());

// Export — formats differ in completeness
const idOnly  = await client.notes.export("0xnote...", { format: NoteExportFormat.Id });
const full    = await client.notes.export("0xnote...", { format: NoteExportFormat.Full });
const details = await client.notes.export("0xnote...", { format: NoteExportFormat.Details });
```

`NoteExportFormat`:

- **`Id`** — just the note ID. Only works for public notes.
- **`Full`** — complete note data plus inclusion proof. Requires the note to have an onchain inclusion proof.
- **`Details`** — note ID, metadata, and creation block.

## Note transport (private notes)

Private notes are delivered through the Miden note transport service. The sender emits a note with `type: "private"`; the recipient fetches it from the transport network.

```typescript
// Send a private note
await client.notes.sendPrivate({
  note: "0xnote...",           // NoteInput
  to: "mtst1recipient...",     // recipient AccountRef
});

// Fetch — default is incremental (paginated)
await client.notes.fetchPrivate();

// Or fetch everything at once (initial-setup scenarios)
await client.notes.fetchPrivate({ mode: "all" });

// Now inspect the inbox
const notes = await client.notes.list();
console.log(`Fetched ${notes.length} notes`);
```

You need a note transport endpoint configured on the client — set `noteTransportUrl` in `ClientOptions`, or use a network factory (`createTestnet`, `createDevnet`) that preconfigures it.

## Tags

Tags are `u32` values that the sync process uses as a fuzzy filter to decide which notes to pull for your client. They come from three sources:

1. **Account tags** — auto-registered for every account the client tracks.
2. **Note tags** — auto-registered for notes the client expects.
3. **User tags** — manually added via `client.tags.add()`.

```typescript
await client.tags.add(12345);

const tags = await client.tags.list();
console.log("Tracked tags:", tags);

await client.tags.remove(12345);
```

Auto-generated tags (accounts, expected notes) cannot be removed — `remove()` only unregisters user-added tags. Use `NoteTag` helpers (exposed from the WASM module) to compute tag values from faucet IDs and account IDs.

## Next

- [Transactions](./transactions.md) — consume notes, send tokens, create output notes.
- [Compile](./compile.md) — author note scripts in MASM.
- [Sync and store](./sync.md) — the pipeline that feeds note state into your client.
