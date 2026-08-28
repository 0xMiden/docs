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
  console.log(note.id()?.toString());
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
  console.log(note.id()?.toString());
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
  console.log("Note:", record.id()?.toString());
}
```

Returns the input notes available for the specified account. Use this to drive "inbox" UIs.

## Import and export

```typescript
import { MidenClient, NoteExportFormat } from "@miden-sdk/miden-sdk";

const client = await MidenClient.createTestnet();

// Import from a previously exported NoteFile
const importedRef = await client.notes.import(noteFile);
console.log("Imported:", importedRef);

// Export — formats differ in completeness
const idOnly  = await client.notes.export("0xnote...", { format: NoteExportFormat.Id });
const full    = await client.notes.export("0xnote...", { format: NoteExportFormat.Full });
const details = await client.notes.export("0xnote...", { format: NoteExportFormat.Details });
```

`import()` returns a note ID as a hex string when the file includes one, or the details commitment for a `Details` file.

`NoteExportFormat`:

- **`Id`** — just the note ID. A recipient can import it only for a public note.
- **`Full`** — complete note data plus inclusion proof. Requires the note to have an onchain inclusion proof.
- **`Details`** — assets and recipient plus a sync hint containing the tag and after-block number. Metadata and attachments are recovered from the chain.

## Note transport (private notes)

Private notes are delivered through the Miden note transport service. The sender emits a note with `type: "private"`; the recipient fetches it from the transport network.

```typescript
// Relay an arbitrary private note. You can also pass an input note ID or
// record tracked by this client.
await client.notes.sendPrivate({
  note: privateNote,
  to: "mtst1recipient...",
  scanAfterBlockNum, // chain tip recorded when the transaction was submitted
});

// For an applied output note created by this client, let the SDK derive the
// scan-start block from its stored expected height.
await client.notes.sendPrivateOutput({
  noteId: "0xnote...",
  to: "mtst1recipient...",
});

// On the client that tracks the recipient, fetch incrementally from the
// stored transport cursor.
await recipientClient.notes.fetchPrivate();

// Now inspect the inbox
const notes = await recipientClient.notes.list();
console.log(`Tracked ${notes.length} notes`);
```

`scanAfterBlockNum` must be at or below the note's commitment block. A value above it is never scanned backward and can silently prevent delivery. `sendPrivateOutput()` avoids that footgun for applied output notes created by the same client. Newly tracked tags are backfilled by `client.sync()`; `fetchPrivate({ mode: "all" })` is no longer available.

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
