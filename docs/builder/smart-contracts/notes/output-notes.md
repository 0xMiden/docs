---
title: "Output Notes"
sidebar_position: 4
description: "Create output notes, attach assets, add attachments, and compute recipients."
---

# Output Notes

The `output_note` module creates and updates notes during a transaction.

```rust
use miden::{output_note, Asset, NoteIdx, Tag, NoteType, Recipient};
```

## Create a note

```rust
let note_idx: NoteIdx = output_note::create(tag, note_type, recipient);
```

`create` returns a `NoteIdx` used by subsequent operations in the same transaction. It may only be called from an account component procedure. Transaction and note scripts must call an account procedure such as `BasicWallet::create_note` and use the returned index.

## Add assets to a note

```rust
output_note::add_asset(asset, note_idx);
```

`add_asset` only adds the asset to the output note; it does not remove it from the native account's vault. When funding a note from that vault, remove the asset first or use `BasicWallet::move_asset_to_note`.

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

`OutputNoteAssetsInfo` contains `commitment: Word` and `num_assets: u32`.

### Note metadata

`get_metadata()` returns the encoded metadata header:

```rust
let metadata: NoteMetadata = output_note::get_metadata(note_idx);
```

The SDK's `NoteMetadata` contains a single `header: Word`. Attachment content and its commitment are queried separately. On the protocol side, the full `NoteMetadata` combines `PartialNoteMetadata` (sender, note type, tag) with attachment headers and the attachments commitment. See [Reading Notes — Note metadata](./reading-notes#note-metadata) for details.

## Note attachments

Notes can carry auxiliary data as attachments. The attachment API uses a `Felt`-typed scheme identifier; the payload shape is selected by the function:

```rust
// Single-word attachment; the helper hashes and inserts the word.
output_note::add_word_attachment(note_idx, attachment_scheme, word_data);
```

Use `add_attachment` when you already have an attachment commitment and the raw data is present in the advice map. Use `add_attachment_from_memory` for multi-word data that should be hashed and inserted from memory. Attachments are committed into note metadata, and the consumer must have access to the corresponding advice map entries to read the full data.

## Computing a Recipient

When creating notes programmatically, an account component needs a `Recipient` to pass to `output_note::create`. The `Recipient` is a commitment to the note's serial number, script, and storage, which together define the conditions under which the note can be consumed.

The protocol computation is:

```
recipient = hash(hash(hash(serial_num, [0;4]), script_root), storage_commitment)
```

`script_root` is the hash of the note script program, and `storage_commitment` is the commitment to the note's storage values. MASM authors can use `note::compute_recipient` for an existing storage commitment or `note::compute_and_store_recipient` when the raw storage values should also be inserted into the advice map.

## Example: creating and funding a note

A complete flow for creating a note inside an account component:

```rust
use miden::{
    component, component_storage, felt, native_account, output_note, Asset, NoteIdx, NoteType,
    Recipient, Tag,
};

#[component_storage]
struct NoteSenderStorage;

#[component]
trait NoteSender {
    #[account_procedure]
    fn send_asset(&mut self, recipient: Recipient, asset: Asset, tag: Tag) -> NoteIdx;
}

#[component]
impl NoteSender for NoteSenderStorage {
    fn send_asset(&mut self, recipient: Recipient, asset: Asset, tag: Tag) -> NoteIdx {
        // 1. Create the note
        let note_idx = output_note::create(tag, NoteType::from(felt!(1)), recipient);

        // 2. Remove the asset from the native account's vault
        let _ = native_account::remove_asset(asset);

        // 3. Add the asset to the note
        output_note::add_asset(asset, note_idx);

        note_idx
    }
}
```

:::info API Reference
Full API docs on docs.rs: [`miden::output_note`](https://docs.rs/miden/latest/miden/output_note/)
:::
