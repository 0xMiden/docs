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

When a note script runs, `active_note` provides access to the current note's inputs, assets, and metadata:

```rust
use miden::active_note;
```

### Inputs

Note inputs are custom `Felt` values set by the note creator (e.g., a target account ID, an expiration block height). The recommended way to access inputs is through the `#[note]` struct — fields are automatically deserialized from inputs:

```rust
#[note]
struct MyNote {
    target_account_id: AccountId,  // Deserialized from note inputs automatically
}
```

See [Note Scripts](./note-scripts) for the full `#[note]` pattern. The low-level `active_note::get_inputs()` function is also available for advanced use cases:

```rust
let inputs: Vec<Felt> = active_note::get_inputs();
```

### Assets

```rust
let assets: Vec<Asset> = active_note::get_assets();
```

### Identity and metadata

```rust
let sender: AccountId = active_note::get_sender();
let recipient: Recipient = active_note::get_recipient();
let script_root: Word = active_note::get_script_root();
let serial_num: Word = active_note::get_serial_number();
```

### Note metadata

`get_metadata()` returns a `NoteMetadata` struct containing the note's attachment and header:

```rust
let metadata: NoteMetadata = active_note::get_metadata();
```

`NoteMetadata` has two fields:

```rust
pub struct NoteMetadata {
    pub attachment: Word,  // auxiliary data attached to the note
    pub header: Word,      // metadata header (sender, tag, etc.)
}
```

## `input_note` — querying notes by index

Inside transaction scripts or account code, use `input_note` to read data from any input note being consumed in the current transaction. Each function takes a `NoteIdx` identifying which note to query:

```rust
use miden::input_note;
```

### Assets

```rust
let info: InputNoteAssetsInfo = input_note::get_assets_info(note_idx);
let assets: Vec<Asset> = input_note::get_assets(note_idx);
```

`InputNoteAssetsInfo` contains `commitment: Word` and `num_assets: Felt`.

### Identity and metadata

```rust
let sender: AccountId = input_note::get_sender(note_idx);
let recipient: Recipient = input_note::get_recipient(note_idx);
let script_root: Word = input_note::get_script_root(note_idx);
let serial_num: Word = input_note::get_serial_number(note_idx);
```

### Inputs

```rust
let inputs_info: InputNoteInputsInfo = input_note::get_inputs_info(note_idx);
```

:::note
Unlike `active_note::get_inputs()` which returns the full `Vec<Felt>` of input values, `input_note` only exposes the inputs commitment and count — not the actual values. The transaction kernel only has commitments for input notes that are not currently executing. To read actual input values, use `active_note::get_inputs()` inside the note script itself.
:::

`InputNoteInputsInfo` contains `commitment: Word` and `num_inputs: Felt`.

### Note metadata

Returns the same `NoteMetadata` struct as `active_note`:

```rust
let metadata: NoteMetadata = input_note::get_metadata(note_idx);
```

## Examples

### Reading inputs in a note script

A note script that reads the target account ID from inputs and verifies the consumer:

```rust
use miden::{AccountId, Word, active_note, note};

#[note]
struct P2idNote {
    target_account_id: AccountId,
}

#[note]
impl P2idNote {
    #[note_script]
    pub fn run(self, _arg: Word, account: &mut Account) {
        assert_eq!(account.get_id(), self.target_account_id);

        let assets = active_note::get_assets();
        for asset in assets {
            account.receive_asset(asset);
        }
    }
}
```

### Reading input notes in a transaction script

A transaction script that reads data from a consumed input note:

```rust
use miden::*;

#[tx_script]
pub fn run(arg: Word) {
    // Query the first input note (index 0)
    let idx = NoteIdx { inner: felt!(0) };
    let assets = input_note::get_assets(idx);
    let sender = input_note::get_sender(idx);
}
```

:::info API Reference
Full API docs on docs.rs: [`miden::active_note`](https://docs.rs/miden/latest/miden/active_note/), [`miden::input_note`](https://docs.rs/miden/latest/miden/input_note/)
:::
