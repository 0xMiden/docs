---
title: "Reading Notes"
sidebar_position: 3
description: "Read the active note's data and access input notes by index during transactions."
---

# Reading Notes

Miden provides two modules for reading note data, each for a different execution context:

- **`active_note`** — used inside **note scripts**. Reads data from the note currently being executed (the note whose `#[note_script]` is running).
- **`input_note`** — used inside **transaction scripts** and **account code**. Reads data from any input note by index, useful when a transaction consumes multiple notes and needs to inspect them.

## `active_note` — the executing note

When a note script runs, `active_note` provides access to the current note's storage, creation-time assets, and metadata:

```rust
use miden::active_note;
```

### Storage

Note storage is a sequence of `Felt` values set by the note creator (e.g., a target account ID, an expiration block height). The recommended way to access it is through the `#[note]` struct — fields are automatically deserialized from the note's storage:

```rust
#[note]
struct MyNote {
    target_account_id: AccountId,  // Deserialized from note storage automatically
}
```

See [Note Scripts](./note-scripts) for the full `#[note]` pattern. The low-level `active_note::get_storage()` function is also available for advanced use cases:

```rust
let storage: Vec<Felt> = active_note::get_storage();
```

### Assets

```rust
let assets: Vec<Asset> = active_note::get_initial_assets();
```

The name makes the semantics explicit: these are the assets the note carried when it was created, before any in-transaction movement. This is an inspection API; iterating over this vector does not remove assets from the note's current state.

:::warning Rust SDK limitation
The protocol exposes stateful `active_note::remove_asset` and `active_note::remove_all_assets` procedures in MASM, but the Rust SDK does not yet bind them. Do not implement asset consumption by passing values from `get_initial_assets()` directly to an account. Until the bindings land, use a standard note such as P2ID/P2IDE or write the removal flow in MASM.
:::

### Identity and metadata

```rust
let sender: AccountId = active_note::get_sender();
let recipient: Recipient = active_note::get_recipient();
let script_root: Word = active_note::get_script_root();
let serial_num: Word = active_note::get_serial_number();
```

### Note metadata

`get_metadata()` returns the encoded metadata header:

```rust
let metadata: NoteMetadata = active_note::get_metadata();
```

In the onchain Rust SDK, `NoteMetadata` contains a single `header: Word`; attachments and their commitment are queried separately.

In `miden-protocol`, the user-facing metadata used to construct a note is `PartialNoteMetadata`:

```rust
pub struct PartialNoteMetadata {
    sender: AccountId,
    note_type: NoteType,
    tag: NoteTag,
}
```

The protocol's full `NoteMetadata` wraps that partial metadata together with attachment headers and an attachments commitment. Its `to_metadata_word()` method produces the same four-felt header returned by the onchain SDK: sender suffix plus type/version, sender prefix, tag, and attachment schemes.

## `input_note` — querying notes by index

Inside transaction scripts or account code, use `input_note` to read data from any input note being consumed in the current transaction. Each function takes a `NoteIdx` identifying which note to query:

```rust
use miden::input_note;
```

### Assets

```rust
let info: input_note::InputNoteAssetsInfo = input_note::get_initial_assets_info(note_idx);
let assets: Vec<Asset> = input_note::get_initial_assets(note_idx);
```

`InputNoteAssetsInfo` contains `commitment: Word` and `num_assets: u32`.

### Identity and metadata

```rust
let sender: AccountId = input_note::get_sender(note_idx);
let recipient: Recipient = input_note::get_recipient(note_idx);
let script_root: Word = input_note::get_script_root(note_idx);
let serial_num: Word = input_note::get_serial_number(note_idx);
```

### Storage

```rust
let storage_info: input_note::InputNoteStorageInfo = input_note::get_storage_info(note_idx);
```

:::note
Unlike `active_note::get_storage()`, the `input_note` API only exposes the storage commitment and item count. To read the storage values, use `active_note::get_storage()` while that note is executing.
:::

`InputNoteStorageInfo` contains `commitment: Word` and `num_storage_items: u32`.

### Note metadata

Returns the same metadata shape as `active_note`:

```rust
let metadata: NoteMetadata = input_note::get_metadata(note_idx);
```

## Examples

### Reading storage and inspecting initial assets

A note script that reads the target account ID from storage, verifies the consumer, and inspects the creation-time asset list:

```rust
use miden::{AccountId, Word, account, active_note, note};

#[account(basic_wallet::BasicWallet)]
pub struct Wallet;

#[note]
struct InspectionNote {
    target_account_id: AccountId,
}

#[note]
impl InspectionNote {
    #[note_script]
    pub fn run(self, _arg: Word, account: &mut Wallet) {
        assert_eq!(account.get_id(), self.target_account_id);

        // Inspection only: this does not remove assets from the active note.
        let _initial_assets = active_note::get_initial_assets();
    }
}
```

### Reading input notes in a transaction script

A transaction script that reads data from a consumed input note:

```rust
use miden::*;

#[tx_script]
pub fn run(_arg: Word) {
    // Query the first input note (index 0)
    let idx = NoteIdx { inner: felt!(0) };
    let _assets = input_note::get_initial_assets(idx);
    let _sender = input_note::get_sender(idx);
}
```

:::info API Reference
Full API docs on docs.rs: [`miden::active_note`](https://docs.rs/miden/0.14.0-rc.1/miden/active_note/), [`miden::input_note`](https://docs.rs/miden/0.14.0-rc.1/miden/input_note/)
:::
