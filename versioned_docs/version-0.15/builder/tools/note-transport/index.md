---
sidebar_position: 1
title: Note Transport
description: "Off-chain relay service for private note delivery on Miden."
pagination_prev: null
---

# Note Transport

The Miden note transport service is an off-chain relay for private note delivery. It gives senders a place to publish serialized private notes and gives recipients a way to fetch notes that match the tags they monitor.

Private note contents are not published on-chain. The chain stores note commitments, while the full note data must reach the recipient through another channel. Note transport is the standard network service for that off-chain delivery path.

## Start here

<CardGrid cols={3}>
  <Card title="Design" href="./design" eyebrow="Architecture">
    How the node stores notes, assigns cursors, routes by tag, and handles current protocol boundaries.
  </Card>
  <Card title="Operators" href="./operators" eyebrow="Run a node">
    CLI flags, Docker Compose, telemetry, storage, ports, retention, and production cautions.
  </Card>
  <Card title="Users" href="./users" eyebrow="gRPC API">
    Request and response shapes for send, fetch, stream, stats, plus the recommended client sync pattern.
  </Card>
</CardGrid>

## API surface

| RPC | Use it for | Current behavior |
| --- | --- | --- |
| `SendNote` | Publish one transported note. | The `header` must decode as a Miden `NoteHeader`; `details` are stored as opaque bytes. |
| `FetchNotes` | Durable catch-up by tag. | Returns notes for one or more tags using a server-assigned `seq` cursor. |
| `StreamNotes` | Live updates for one tag. | Use it after a fetch cycle; current subscriptions do not initialize from the request cursor. |
| `Stats` | Basic operational counts. | Returns aggregate note and tag counts. Per-tag statistics are defined in protobuf but not populated yet. |

## Transport model

- **Private payload delivery.** The Miden chain stores note commitments. Note transport carries the full private note data that recipients need to import locally.
- **Tag-based routing.** Notes are indexed by the 32-bit `NoteTag` embedded in note metadata. The node has no account registry or recipient identity model.
- **Client-owned privacy policy.** The node parses note headers only. Clients decide which tags to monitor and whether note details should be encrypted before sending.
- **Temporary mailbox.** Notes are retained for the configured retention window. Delivery is best-effort and clients must persist fetch cursors.

## Current boundaries

- **No chain-state validation.** The node does not connect to a Miden node and does not prove that a stored note was committed on-chain.
- **No block context yet.** The current API does not attach commitment block numbers, note metadata, or inclusion proofs to fetched notes. This is tracked in [0xMiden/note-transport-service#68](https://github.com/0xMiden/note-transport-service/issues/68).
- **Duplicate notes are rejected.** SQLite stores note IDs with a uniqueness constraint. Sending the same note twice fails instead of creating duplicate rows.
- **Cursor values are server-owned.** Fetch pagination uses the monotonic SQLite `seq` value returned by the server. Clients should persist returned cursors, not fabricate them.

## Current implementation

The current node implementation is a Rust gRPC service backed by SQLite. It stores each note with a monotonic `seq` value assigned at insert time, uses that value for `FetchNotes` pagination, and can export traces and metrics through OpenTelemetry.
