---
sidebar_position: 2
title: Design
---

# Design

The note transport node is intentionally small: it accepts note bytes, indexes them by note tag, and returns matching notes to clients.

## Note flow

1. A sender creates a private note in a Miden transaction.
2. After the note data is available locally, the sender calls `SendNote` with a serialized note header and note details.
3. The transport node parses the header, extracts the note ID and tag, and stores the header and details in SQLite.
4. A recipient calls `FetchNotes` for one or more tags and receives matching notes with a cursor.
5. The recipient stores the returned cursor and uses it on the next fetch.

The transport node does not connect to a Miden node and does not know whether a note has been committed onchain. Clients still need to import fetched notes and sync against the Miden network.

## Stored data

The transport node stores:

- note ID, derived from the serialized header;
- note tag, derived from the serialized header;
- serialized header bytes;
- serialized details bytes;
- creation timestamp;
- `seq`, a monotonic SQLite `AUTOINCREMENT` value.

The note ID column is unique. Re-sending the same note ID is rejected by the database instead of creating a duplicate row.

## Cursor pagination

`FetchNotes` uses a `seq` cursor:

```protobuf
message FetchNotesRequest {
    repeated fixed32 tags = 1;
    fixed64 cursor = 2;
}

message FetchNotesResponse {
    repeated TransportNote notes = 1;
    fixed64 cursor = 2;
}
```

The server returns notes matching any requested tag with `seq > cursor`, ordered by ascending `seq`, up to the server batch size. The response cursor is the highest `seq` returned. A client should persist that value and send it on the next request.

Current limits:

- A request may include up to 128 tags.
- A response returns up to 500 notes.
- There is no client-specified `limit` field in the protobuf API.

The multi-tag query runs in one database snapshot. This avoids a race where separate per-tag queries could advance the cursor past a note inserted between queries.

## Legacy cursor handling

Earlier designs used timestamp cursors. Existing clients may have stored timestamp-sized cursor values. The node treats cursor values above `1_000_000_000_000` as legacy timestamp cursors and resets the effective query cursor to `0`.

This lets upgraded clients recover instead of waiting for `seq` to reach an old timestamp-sized value.

## Streaming

`StreamNotes` opens a server-side stream for one tag:

```protobuf
message StreamNotesRequest {
    fixed32 tag = 1;
    fixed64 cursor = 2;
}

message StreamNotesUpdate {
    repeated TransportNote notes = 1;
    fixed64 cursor = 2;
}
```

Internally, a background task polls SQLite every 500 ms for new notes matching active subscriptions and forwards updates through bounded channels.

The current server implementation does not use the request cursor to initialize subscription state. Use `FetchNotes` for durable catch-up and cursor persistence, then use streaming only as a live update channel.

## Storage and retention

The node uses SQLite and embedded migrations. File-backed databases use a larger connection pool. In-memory databases use a single connection because SQLite `:memory:` databases are isolated per connection.

Notes older than the configured retention period are removed by a maintenance task.

## Block context

The current protobuf API does not include commitment block number, note metadata, or inclusion proof fields. The transport node stores only `header` and `details`.

This means the node cannot tell a client which block committed a fetched note. Clients must reconcile fetched notes with chain state themselves. The client-side lookback workaround and the proposed transport-level block context are tracked separately in [0xMiden/note-transport-service#68](https://github.com/0xMiden/note-transport-service/issues/68).

## What the node does not do

The node does not:

- validate note contents against chain state;
- connect to a Miden node;
- attach commitment block context;
- attach note inclusion proofs;
- inspect or decrypt note details;
- authenticate senders or recipients;
- guarantee delivery after the retention period.
