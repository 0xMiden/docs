---
title: "Output Notes"
sidebar_position: 4
description: "Create output notes, attach assets, add attachments, and compute recipients."
---

# Output Notes

The `output_note` module creates notes from inside account component code and transaction scripts. Use it to send assets to other accounts by creating notes that carry assets and a recipient hash.

```rust
use miden::{output_note, Asset, NoteIdx, Tag, NoteType, Recipient};
```

## Create a note

```rust
let note_idx: NoteIdx = output_note::create(tag, note_type, recipient);
```


To construct a tag targeting a specific account, use `NoteTag::with_account_target(account_id)` from `miden_protocol::note`.

Returns a `NoteIdx` used to reference this note in subsequent operations within the same transaction.

## Add assets to a note

```rust
output_note::add_asset(asset, note_idx);
```

Call `add_asset` multiple times with the same `note_idx` to attach several assets to one note. A note can carry both fungible and non-fungible assets.

## Query output note state

```rust
// Asset commitment and count
let info: OutputNoteAssetsInfo = output_note::get_assets_info(note_idx);

// All assets on the note
let assets: Vec<Asset> = output_note::get_assets(note_idx);

// The recipient hash
let recipient: Recipient = output_note::get_recipient(note_idx);
```

`OutputNoteAssetsInfo` contains `commitment: Word` and `num_assets: Felt`.

### Note metadata

Returns note metadata:

```rust
let metadata: NoteMetadata = output_note::get_metadata(note_idx);
```

On the v0.15 protocol side, `NoteMetadata` combines `PartialNoteMetadata` (sender, note type, tag) with attachment headers and the attachments commitment. See [Reading Notes — Note metadata](./reading-notes#note-metadata) for details.

## Note attachments

Notes can carry auxiliary data as attachments. The attachment API uses a `Felt`-typed scheme identifier; the payload shape is selected by the function:

```rust
// Single-word attachment; the helper hashes and inserts the word.
output_note::add_word_attachment(note_idx, attachment_scheme, word_data);
```


Use `add_attachment` when you already have an attachment commitment and the raw data is present in the advice map. Use `add_attachment_from_memory` for multi-word data that should be hashed and inserted from memory. Attachments are committed into note metadata, and the consumer must have access to the corresponding advice map entries to read the full data.

## Computing a Recipient

When creating notes programmatically, you need a `Recipient` to pass to `output_note::create`. The `Recipient` is a hash that encodes the note script and storage commitment, ensuring only someone who knows these values can consume the note.

The protocol computation is:

```
recipient = hash(hash(hash(serial_num, [0;4]), script_root), storage_commitment)
```

`script_root` is the hash of the note script program, and `storage_commitment` is the commitment to the note's storage values. MASM authors can use `note::compute_recipient` for an existing storage commitment or `note::compute_and_store_recipient` when the raw storage values should also be inserted into the advice map.

## Example: creating and funding a note

A complete flow for creating a note inside an account component:

```rust
use miden::{output_note, Asset, NoteType, Recipient, Tag};

pub fn send_assets(recipient: Recipient, asset: Asset, tag: Tag) {
    // 1. Create the note
    let note_idx = output_note::create(tag, NoteType::Public, recipient);

    // 2. Attach assets
    output_note::add_asset(asset, note_idx);
}
```

:::info API Reference
Full API docs on docs.rs: [`miden::output_note`](https://docs.rs/miden/latest/miden/output_note/)
:::
