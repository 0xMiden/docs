---
sidebar_position: 4
title: Users
---

# Users

This page covers integrating with the note transport gRPC API.

## API surface

The service is defined in `proto/proto/miden_note_transport.proto`.

```protobuf
service MidenNoteTransport {
    rpc SendNote(SendNoteRequest) returns (SendNoteResponse);
    rpc FetchNotes(FetchNotesRequest) returns (FetchNotesResponse);
    rpc StreamNotes(StreamNotesRequest) returns (stream StreamNotesUpdate);
    rpc Stats(google.protobuf.Empty) returns (StatsResponse);
}
```

## Send a note

`SendNote` stores one note:

```protobuf
message SendNoteRequest {
    TransportNote note = 1;
}

message SendNoteResponse {}

message TransportNote {
    bytes header = 1;
    bytes details = 2;
}
```

`header` must be a serialized Miden `NoteHeader`. The node parses it to extract the note ID and tag. `details` is opaque to the transport node and may contain encrypted note details.

The server rejects:

- requests without a note;
- headers that cannot be parsed as `NoteHeader`;
- details larger than the configured `--max-note-size`;
- duplicate note IDs.

## Fetch notes

`FetchNotes` returns notes for one or more tags:

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

Use this flow:

1. Start with `cursor = 0`.
2. Send all tags the client wants to check, up to 128 tags.
3. Import or process the returned notes.
4. Persist the response `cursor`.
5. Repeat with the stored cursor.

The response cursor is the highest server-side `seq` value returned in that response. Never fabricate cursor values; use values returned by the server.

The server batch size is 500 notes. If a response contains many notes, call `FetchNotes` again with the returned cursor until the response is empty or smaller than the batch size.

## Stream notes

`StreamNotes` provides a server-side stream for one tag:

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

Use streaming as a live update channel. For durable sync, first call `FetchNotes` and persist its cursor.

Current behavior to account for:

- The protobuf request includes a `cursor`, but the current server implementation does not seed subscription state from that field.
- Subscriptions are per tag.
- The streamer polls for updates every 500 ms.
- If a subscriber cannot keep up with the bounded channel, the subscription is dropped.

On reconnect, run `FetchNotes` with your persisted cursor before opening a new stream.

## Stats

`Stats` returns aggregate counts:

```protobuf
message StatsResponse {
    uint64 total_notes = 1;
    uint64 total_tags = 2;
    repeated TagStats notes_per_tag = 3;
}

message TagStats {
    fixed32 tag = 1;
    uint64 note_count = 2;
    google.protobuf.Timestamp last_activity = 3;
}
```

The current server returns `total_notes` and `total_tags`. Per-tag statistics are not populated yet.

## Client sync pattern

A typical client should:

1. Configure a note transport endpoint.
2. Track the note tags it needs to monitor.
3. Fetch notes during sync using the stored transport cursor.
4. Import fetched notes into the client.
5. Sync with the Miden node to reconcile note commitments.
6. Persist the returned transport cursor only after the fetched notes have been handled successfully.

The transport node does not provide commitment block numbers or inclusion proofs. Clients must still handle chain-state reconciliation. The block-context improvement is tracked in [0xMiden/note-transport-service#68](https://github.com/0xMiden/note-transport-service/issues/68).

## Troubleshooting

### Notes do not appear

- Check that the sender actually called `SendNote`.
- Check that the recipient is fetching the same tag stored in the note header.
- Check whether the note expired under the node retention policy.
- Reset the local transport cursor to `0` if client state is suspected to be ahead of the server.

### Duplicate send fails

The database stores note IDs uniquely. Sending the same note twice is rejected instead of producing two stored rows.

### Streaming misses notes

Use `FetchNotes` for catch-up. Streaming is not a replacement for durable cursor sync in the current implementation.

### Large notes are rejected

The `--max-note-size` setting applies to the note details size. Increase it on the operator side only if the deployment is prepared to accept larger payloads.
