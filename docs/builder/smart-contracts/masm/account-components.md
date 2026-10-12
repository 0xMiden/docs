---
title: "MASM account components"
description: "Build a reusable MASM component with named storage and execute its procedures in a signed transaction."
sidebar_position: 2
---

# MASM account components

An account component combines reusable procedures with the storage slots they own. Build a settings component that stores one value, exposes a getter and setter, and changes the value from `7` to `42` in a locally executed transaction.

The procedures are MASM contracts. Rust assembles them and constructs a test account on the host; it does not compile Rust guest contracts. For a deployed example using the Rust client to manage a MASM account, see [Deploying a Counter Contract](../../tutorials/recipes/rust/counter_contract_tutorial.md).

## Prerequisites

Complete [Your first MASM project](./first-project.md), or have Rust **1.98.1** installed through `rustup`. This guide pins the published protocol, standards and testing crates to **0.17.1**; they use VM **0.35.0**. It runs entirely offline after dependencies are downloaded, with no node or funded account required.

```bash
mkdir -p masm-account-components/{src,masm}
cd masm-account-components
```

Create the project files:

```toml title="Cargo.toml"
[package]
name = "masm-account-components"
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
```

```toml title="rust-toolchain.toml"
[toolchain]
channel = "1.98.1"
profile = "minimal"
```

## 1. Define the component's interface and storage

```masm title="masm/settings.masm"
use miden::protocol::active_account
use miden::protocol::native_account

const VALUE_SLOT = word("demo::settings::value")

#! Inputs:  [pad(16)]
#! Outputs: [value, pad(15)]
@account_procedure
pub proc get_value
    push.VALUE_SLOT[0..2] exec.active_account::get_item
    # => [value, 0, 0, 0, pad(16)]
    movdn.4 dropw
    # => [value, pad(15)]
end

#! Inputs:  [value, pad(15)]
#! Outputs: [pad(16)]
@account_procedure
pub proc set_value
    push.0.0.0 movup.3
    # => [value, 0, 0, 0, pad(15)]
    push.VALUE_SLOT[0..2] exec.native_account::set_item dropw
    # => [pad(16)]
end
```

`@account_procedure` marks each exported procedure as part of the account's callable interface. Invoke these procedures with `call`, which creates an isolated execution context. Each call accepts and returns a 16-element operand stack; `pad(n)` denotes unused elements. The caller prepares that frame and removes it when the call finishes.

The slot name `demo::settings::value` must match the name used by the Rust constructor. `word("...")` derives its identifier; `[0..2]` selects the two elements used by the kernel's storage API. Named slots avoid depending on where another component's storage appears in the assembled account.

`active_account::get_item` reads the value word. The getter retains its first element and restores the call frame. The setter constructs `[value, 0, 0, 0]`, writes it through `native_account::set_item`, and discards the previous word returned by that procedure. The VM pads the remaining frame back to 16 elements.

## 2. Call the component from a transaction

```masm title="masm/update.masm"
use demo::settings

@transaction_script
pub proc main
    padw padw padw
    push.0.0.0.42
    call.settings::set_value
    call.settings::get_value
    push.42 assert_eq.err="settings getter returned the wrong value"
    dropw dropw dropw drop drop drop
end
```

The transaction script passes `42`, calls the setter, then verifies the getter before returning. `use demo::settings` resolves against the compiled component package linked by the host below. Calls still execute the procedures installed on the account; linking a package does not grant permission to call code absent from that account.

## 3. Assemble the component and execute the transaction

```rust title="src/main.rs"
use miden_protocol::Word;
use miden_protocol::account::component::AccountComponentMetadata;
use miden_protocol::account::{AccountComponent, StorageSlot, StorageSlotName};
use miden_standards::code_builder::CodeBuilder;
use miden_testing::{Auth, MockChain};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let slot = StorageSlotName::new("demo::settings::value")?;
    let code = CodeBuilder::default()
        .compile_component_code("demo::settings", include_str!("../masm/settings.masm"))?;
    let component = AccountComponent::new(
        code.clone(),
        vec![StorageSlot::with_value(
            slot.clone(),
            Word::from([7u32, 0, 0, 0]),
        )],
        AccountComponentMetadata::new("Settings"),
    )?;
    assert_eq!(component.procedures().count(), 2);

    let mut builder = MockChain::builder();
    let account =
        builder.add_existing_account_from_components(Auth::basic_falcon(), [component])?;
    let chain = builder.build()?;
    assert_eq!(
        account.storage().get_item(&slot)?,
        Word::from([7u32, 0, 0, 0])
    );

    let script = CodeBuilder::default()
        .with_dynamically_linked_package(&code)?
        .compile_tx_script(include_str!("../masm/update.masm"))?;
    let executed = chain
        .build_transaction(account.id())
        .tx_script(script)
        .build()?
        .execute()
        .await?;
    let mut updated = account;
    updated.apply_patch(executed.account_patch())?;
    assert_eq!(
        updated.storage().get_item(&slot)?,
        Word::from([42u32, 0, 0, 0])
    );
    println!("settings value: 7 -> 42");
    Ok(())
}
```

`CodeBuilder` configures the assembler with the protocol and standards libraries. `AccountComponent::new` combines the compiled code, initial slot value, and component metadata. This example supplies storage directly; metadata is named here rather than used as a storage-initialization schema.

`Auth::basic_falcon()` adds a single-signature authentication component and registers a test signing key with `MockChain`. It is separate from the settings component. The consuming account must authorize the transaction; the setter itself adds no sender or role restriction. Add an application-specific authorization check if you need a more restrictive policy.

`execute()` returns an account patch without submitting to a network. Applying that patch to the local account lets the assertions inspect the resulting storage. This example does not advance the mock chain or prove a production transaction.

## 4. Run it

```bash
cargo generate-lockfile
cargo run --locked
```

After Cargo's build output, expect:

```text
settings value: 7 -> 42
```

The program checks the two-procedure interface, initial storage, getter return value, and final storage. Keep `Cargo.lock` in source control. The complete project, including its lockfile, is in `examples/masm/account-components` in the docs repository.

## Next steps

- [MASM note scripts](./note-scripts.md) — call this same setter from a programmable note.
- [Account components reference](../../../reference/protocol/account/components.md) and [account storage reference](../../../reference/protocol/account/storage.md) — composition and storage rules.
- [Miden Standards account components](../standards/account-components.md) — reusable authentication, wallets and other components.
- [Deploying a Counter Contract](../../tutorials/recipes/rust/counter_contract_tutorial.md) — Rust client orchestration and network submission for a MASM account.
