---
title: "Output Notes"
sidebar_position: 4
description: "Create output notes, attach assets, set attachments, and compute recipients."
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

Returns a `NoteMetadata` struct (not a raw `Word`):

```rust
let metadata: NoteMetadata = output_note::get_metadata(note_idx);
```

See [Reading Notes — Note metadata](./reading-notes.md#note-metadata) for the `NoteMetadata` struct definition.

## Note attachments

Notes can carry auxiliary data as attachments. The attachment API uses `Felt`-typed discriminants to select the scheme and kind:

```rust
// Full form — specify scheme, kind, and payload
output_note::set_attachment(note_idx, attachment_scheme, attachment_kind, attachment_word);

// Word attachment — a single Word of inline data
output_note::set_word_attachment(note_idx, attachment_scheme, word_data);

// Array attachment — a commitment to data stored in the advice map
output_note::set_array_attachment(note_idx, attachment_scheme, commitment_word);
```


**Word attachments** store data directly in the note. **Array attachments** store a commitment (hash) to larger data that lives in the advice map — the consumer must have access to the corresponding advice map entries to read the full data.

## Computing a Recipient

When creating notes programmatically, you need a `Recipient` to pass to `output_note::create`. The `Recipient` is a hash that encodes the note script and inputs, ensuring only someone who knows these values can consume the note.

```rust
use miden::{Recipient, Digest};

let recipient = Recipient::compute(
    serial_num,       // Word: unique serial number for this note
    script_digest,    // Digest: hash of the note script
    inputs,           // Vec<Felt>: note inputs (e.g., target account ID)
);
```

The computation is: `hash(hash(hash(serial_num, [0;4]), script_root), inputs_commitment)`. `script_digest` and `script_root` refer to the same value — the hash of the note script program. The formula uses `script_root`; the Rust parameter is named `script_digest`.

## Example: creating and funding a note

A complete flow for creating a note inside an account component:

```rust
use miden::{output_note, Asset, Tag, NoteType, Recipient, Digest};

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
