---
title: "Note Scripts"
sidebar_position: 1
description: "Write note scripts using #[note] and #[note_script] macros to define logic that executes when notes are consumed."
---

# Note Scripts

Note scripts define the logic that executes when a note is consumed. They determine **who** can consume a note and **what happens** to its assets.

## The `#[note]` pattern

A note script consists of a struct (holding note storage fields) and an impl block with a `#[note_script]` method:

```rust
use miden::{account, AccountId, Word, active_note, note};

#[account(basic_wallet::BasicWallet)]
pub struct Wallet;

#[note]
struct MyNote {
    target_account_id: AccountId,
}

#[note]
impl MyNote {
    #[note_script]
    pub fn run(self, _arg: Word, account: &mut Wallet) {
        // Script logic here
    }
}
```

The `#[note]` macro:
1. Deserializes note storage into struct fields
2. Exports the `run` function as the note's entry point

## Struct fields as note storage

Fields on the `#[note]` struct are populated from the note's storage data when the note is consumed:

```rust
#[note]
struct MyNote {
    target_account_id: AccountId,  // Deserialized from note storage
}
```

The compiler maps struct fields to note storage values based on their order and type. Supported field types include `AccountId`, `Felt`, `Word`, and other SDK types.

If you don't need inputs, use a unit struct:

```rust
#[note]
struct CounterNote;
```

## `#[note_script]` method requirements

The `#[note_script]` method has specific signature constraints:

| Constraint | Details |
|------------|---------|
| Receiver | `self` (by value only — not `&self` or `&mut self`) |
| Return type | `()` |
| Required arg | One `Word` argument (the note script argument) |
| Account arg | `&AccountWrapper` or `&mut AccountWrapper`, where `AccountWrapper` is declared with `#[account(package::Interface)]` |

### Parameter ordering

The `Word` and `&mut AccountWrapper` parameters can appear in either order:

```rust
// Both are valid:
pub fn run(self, _arg: Word, account: &mut Wallet) { ... }
pub fn run(self, account: &mut Wallet, _arg: Word) { ... }
```

### With account access

When you include `&mut Wallet` (or `&Wallet`), the note script can call methods on the account's components:

```rust
#[note_script]
pub fn run(self, _arg: Word, account: &mut Wallet) {
    let assets = active_note::get_assets();
    for asset in assets {
        account.receive_asset(asset);  // Cross-component call
    }
}
```

Declare the account wrapper with `#[account(package::Interface)]` and point `miden-project.toml` at the dependency's generated WIT — see [Cross-Component Calls](../cross-component-calls).

### Without account access

Use this pattern for **trigger or command notes** that carry no assets and only execute logic. If your note transfers assets or calls account methods, include the relevant `&mut AccountWrapper`.

```rust
#[note_script]
pub fn run(self, _arg: Word) {
    // For logic-only notes that carry no assets.
    // Cannot call account methods — see the counter note example below.
}
```

## Example: Counter note (cross-component calls)

A note that calls methods on the account's component:

:::note
All note script crates require `#![no_std]` and `#![feature(alloc_error_handler)]` at the crate root. These are omitted from examples for brevity.
:::

```rust title="counter-note/src/lib.rs"
use miden::{account, note, Felt, Word};

#[account(counter_account::CounterContract)]
pub struct CounterAccount;

#[note]
struct CounterNote;

#[note]
impl CounterNote {
    #[note_script]
    pub fn run(self, _arg: Word, account: &mut CounterAccount) {
        let initial_value = account.get_count();
        account.increment_count();
        let expected_value = initial_value + Felt::from_u32(1);
        let final_value = account.get_count();
        assert_eq!(final_value, expected_value);
    }
}
```

This note takes the active account as `&mut CounterAccount` and calls the counter component through its generated interface. See [Cross-Component Calls](../cross-component-calls).

## miden-project.toml for note scripts

Note script crates require a `miden-project.toml` and must declare dependencies on any account components they interact with:

```toml title="miden-project.toml"
[package]
name = "counter-note"
version = "0.1.0"

[lib]
kind = "note"
namespace = "miden:counter-note/counter-note@0.1.0"

[dependencies]
miden-core = "*"
miden-protocol = "*"
counter-account = { path = "../counter-account" }

[package.metadata.miden.dependencies]
counter-account = { wit = "../counter-account/target/generated-wit/" }
```

## Related

- [Cross-Component Calls](../cross-component-calls) — how `#[account(...)]` wrappers and generated interfaces work
- [Transaction Context](../transactions/transaction-context) — transaction scripts with `#[tx_script]`
