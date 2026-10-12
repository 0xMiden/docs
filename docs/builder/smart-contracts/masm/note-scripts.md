---
title: "MASM Note Scripts"
description: "Read committed note storage, call an account component, and validate authenticated consumption with protocol v0.17."
sidebar_position: 3
---

# MASM Note Scripts

A note script runs when an account consumes a note. It validates the note's conditions and can call procedures on the consuming account. This guide builds a data-only command note: its storage contains `42`, and consumption changes the [Settings account component](./account-components.md) from `7` to `42`.

The contract code is MASM. The Rust runner compiles it and constructs a transaction using `miden-protocol`, `miden-standards`, and `miden-testing` **v0.17.1**. It is ordinary host-side Rust, separate from the [Rust guest-contract SDK](../rust/index.md).

## 1. Run the example

Complete the toolchain setup in [Your first MASM project](./first-project.md), then run the example in the docs repository:

```bash
git clone https://github.com/0xMiden/docs.git
cd docs/examples/masm/note-scripts
cargo run --locked
cargo test --locked
```

The checked-in `Cargo.lock` pins the dependency graph, including VM v0.35.0. `rust-toolchain.toml` selects Rust 1.98.1. The project uses the shared `../account-components/masm/settings.masm` component and its own `masm/set-value.masm` note script. The complete runner and six tests are in `src/main.rs`.

Expected runner output:

```text
settings value: 7 -> 42; note consumed
```

The harness seeds a public note into MockChain's genesis block, executes its consumption through the transaction kernel, and commits the result in a mock block. MockChain uses testing proofs; this exercise needs no node connection.

The example has this package configuration:

```toml title="Cargo.toml"
[package]
name = "masm-note-scripts"
version = "0.1.0"
edition = "2024"
rust-version = "1.98.1"
publish = false

[workspace]

[dependencies]
anyhow = "1"
miden-protocol = { version = "=0.17.1", features = ["std"] }
miden-standards = { version = "=0.17.1", features = ["std"] }
miden-testing = { version = "=0.17.1", features = ["std"] }
tokio = { version = "1", features = ["macros", "rt-multi-thread"] }

[dev-dependencies]
miden-tx = { version = "=0.17.1", features = ["std"] }
```

```toml title="rust-toolchain.toml"
[toolchain]
channel = "1.98.1"
profile = "minimal"
```

## 2. Read and validate note storage

Write the entry point as an exported library procedure marked `@note_script`. The kernel provides a four-element consumption-time argument word on entry; `dropw` discards it because this script reads committed storage instead:

```masm title="masm/set-value.masm"
use miden::protocol::active_note
use demo::settings

const STORAGE_PTR = 0

#! Inputs:  [ARGS, pad(12)]
#! Outputs: [pad(16)]
@note_script
pub proc main
    # This script uses committed storage and ignores consumption-time arguments.
    dropw

    # This command note carries data, not assets.
    exec.active_note::get_initial_num_assets
    assertz.err="settings note must not carry assets"

    # Read at most one Felt, then require exactly one.
    push.1 push.STORAGE_PTR exec.active_note::get_bounded_storage
    push.1 assert_eq.err="settings note expects exactly one storage item"

    # Prepare the account procedure's 16-element call frame.
    padw padw padw push.0.0.0 mem_load.STORAGE_PTR
    # => [value, pad(15)]
    call.settings::set_value
    # => [pad(16)]
    dropw dropw dropw dropw
end
```

`active_note::get_bounded_storage` takes `[destination_pointer, maximum_item_count]`. It rejects oversized storage before loading its preimage, copies the committed values into memory, and returns the actual item count. The next assertion rejects empty storage. `mem_load.0` then reads the single `Felt`.

The `call` enters the consuming account's `set_value` procedure with its required 16-element frame. `dropw` removes each word of padding returned by that call. See [Account components](./account-components.md) for the procedure's storage and stack contract.

Note storage is fixed when the note is created and bound into its recipient commitment. Consumption-time note arguments are a separate input. The runner passes them through `extend_note_args`; this script discards that word and reads only committed storage. The [custom-note Rust client tutorial](../../tutorials/recipes/rust/custom_note_how_to.md) demonstrates a script that also uses note arguments.

## 3. Compile the script and construct a note

The runner first installs the Settings component with `Auth::basic_ecdsa()`. This provides a real signature-based authentication component and a deterministic test authenticator. It then compiles the note with the component package dynamically linked. Dynamic linking resolves `settings::set_value` to the component's procedure root, which the consuming account must expose:

```rust title="src/main.rs"
use miden_protocol::account::component::AccountComponentMetadata;
use miden_protocol::account::{Account, AccountComponent, StorageSlot, StorageSlotName};
use miden_protocol::asset::Asset;
use miden_protocol::note::{
    Note, NoteAssets, NoteRecipient, NoteStorage, NoteTag, NoteType, PartialNoteMetadata,
};
use miden_protocol::transaction::RawOutputNote;
use miden_protocol::{Felt, Word};
use miden_standards::code_builder::CodeBuilder;
use miden_testing::{Auth, MockChain};
use std::collections::BTreeMap;

fn fixture(storage: Vec<Felt>, assets: Vec<Asset>) -> anyhow::Result<(MockChain, Account, Note)> {
    let slot = StorageSlotName::new("demo::settings::value")?;
    let code = CodeBuilder::default().compile_component_code(
        "demo::settings",
        include_str!("../../account-components/masm/settings.masm"),
    )?;
    let component = AccountComponent::new(
        code.clone(),
        vec![StorageSlot::with_value(slot, Word::from([7u32, 0, 0, 0]))],
        AccountComponentMetadata::new("Settings"),
    )?;

    let mut builder = MockChain::builder();
    let consumer =
        builder.add_existing_account_from_components(Auth::basic_ecdsa(), [component])?;
    let sender = builder.add_existing_wallet(Auth::basic_ecdsa())?;
    let script = CodeBuilder::default()
        .with_dynamically_linked_package(&code)?
        .compile_note_script(include_str!("../masm/set-value.masm"))?;
    let recipient = NoteRecipient::new(
        Word::from([1u32, 2, 3, 4]),
        script,
        NoteStorage::new(storage)?,
    );
    let metadata = PartialNoteMetadata::new(sender.id(), NoteType::Public)
        .with_tag(NoteTag::with_account_target(consumer.id()));
    let note = Note::new(NoteAssets::new(assets)?, metadata, recipient);

    // Seed the note into genesis so the consumer can provide its inclusion proof.
    builder.add_output_note(RawOutputNote::Full(note.clone()));
    Ok((builder.build()?, consumer, note))
}

async fn consume_and_commit(note_args: Word) -> anyhow::Result<()> {
    let (mut chain, consumer, note) = fixture(vec![Felt::from(42u32)], vec![])?;
    assert_eq!(note.assets().num_assets(), 0);
    assert!(chain.is_note_committed(&note.id()));
    assert!(chain.is_note_unspent(&note.nullifier()));

    let executed = chain
        .build_transaction(consumer.id())
        .authenticated_input_note(note.id())
        .extend_note_args(BTreeMap::from([(note.id(), note_args)]))
        .build()?
        .execute()
        .await?;
    assert_eq!(executed.input_notes().num_notes(), 1);
    assert_eq!(executed.output_notes().num_notes(), 0);

    chain.add_pending_executed_transaction(&executed)?;
    chain.prove_next_block()?;

    let slot = StorageSlotName::new("demo::settings::value")?;
    let committed = chain.committed_account(consumer.id())?;
    assert_eq!(
        committed.storage().get_item(&slot)?,
        Word::from([42u32, 0, 0, 0])
    );
    assert!(chain.is_note_consumed(&note.nullifier()));
    println!("settings value: 7 -> 42; note consumed");
    Ok(())
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    consume_and_commit(Word::empty()).await
}
```

For the successful case, `storage` is `vec![Felt::from(42u32)]` and `assets` is empty. The serial number and authentication keys are deterministic test data; generate fresh serial-number randomness and use the account owner's signing keys in an application.

The account-target tag helps the intended consumer discover the note. Tags do not enforce consumption conditions. This script permits any account that implements the linked Settings interface and authorizes the transaction. Add an account-ID check to the script and a corresponding storage schema when an application needs a specific consumer.

For a transfer to a particular account, use [standard P2ID notes](../standards/standard-notes.md) and the standard wallet's asset-moving procedures. This command note rejects assets instead of implementing a transfer flow.

## 4. Consume and commit

The runner requests authenticated consumption of the genesis note and checks the committed result.
`authenticated_input_note` supplies proof that the note exists in the chain. The consumer's account authentication separately requires its owner's signature over the transaction. MockChain registers the test signer when it builds the account; the test that removes the authenticator fails with `MissingAuthenticator`.

Execution produces an account update. Enqueueing the executed transaction and advancing the mock block commits that update and records the note's nullifier, preventing another committed consumption. MockChain retains the note record and can execute it again; proposing a second block rejects its spent nullifier. The successful test checks both the final storage value and the recorded nullifier.

## 5. Check rejection paths

`cargo test --locked` runs six tests:

| Case | Expected result |
|---|---|
| One storage item (`42`), no assets, signed consumer | Value becomes `42`; the note's nullifier is recorded. |
| Nonzero consumption-time arguments (`[99, 98, 97, 96]`) | Arguments are ignored; the committed storage still sets the value to `42`. |
| Empty storage | `settings note expects exactly one storage item` |
| Two storage items | `the number of note storage items exceeds the maximum accepted by the note script` |
| Any note asset | `settings note must not carry assets` |
| Missing consumer authenticator | `MissingAuthenticator` |

The table names the assertion messages in the script. Runtime diagnostics may show their hashed error codes instead; the tests use `MasmError` to match the exact assertion in either form. Rejected notes leave the committed account at `7` and their nullifiers unspent. To publish a custom note through the Rust client, continue with [Creating a custom note](../../tutorials/recipes/rust/custom_note_how_to.md). To create successor notes inside the VM, see [Creating notes in MASM](../../tutorials/recipes/rust/creating_notes_in_masm_tutorial.md).
