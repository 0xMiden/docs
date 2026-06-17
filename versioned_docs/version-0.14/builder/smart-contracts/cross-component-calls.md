---
title: "Cross-Component Calls"
sidebar_position: 5.5
description: "Call methods across account components and from note scripts."
---

# Cross-Component Calls

Miden [components](./accounts/components) can call each other's methods. Since accounts can have multiple components (e.g., wallet + auth + custom logic), those components need to communicate. [Note scripts](./notes/note-scripts) also need to call methods on the account's components to transfer assets.

## How it works

When you build a component with `miden build`, the compiler generates an interface describing its public methods. Other projects can import this interface to call those methods.

```
counter-contract (component)
    → generates interface
        → counter-note imports the interface
            → calls counter_contract::get_count()
```

## Using `#[note]` macros (recommended)

The simplest way to make cross-component calls from note scripts is through the `#[note]` macro with an `Account` parameter:

```rust
use crate::bindings::Account;
use miden::{active_note, Asset};

#[note]
struct P2idNote;

#[note]
impl P2idNote {
    #[note_script]
    pub fn run(self, _arg: Word, account: &mut Account) {
        // Iterate over the note's assets and transfer each to the account
        for asset in active_note::get_assets() {
            account.receive_asset(asset);
        }
    }
}
```

The `_arg: Word` parameter is the note's first input Word, passed automatically when the note is consumed. It's unused in this example (prefixed with `_`), but note scripts can use it for recipient-specific data like expected account IDs or amounts.

The `Account` type is auto-generated from the bindings of the dependent component. Its methods correspond to the component's public methods.

## Using `generate!()` directly

For more control (e.g., calling multiple components), use `miden::generate!()` to manually generate bindings:

```rust title="cross-ctx-note/src/lib.rs"
#![no_std]
#![feature(alloc_error_handler)]

#[global_allocator]
static ALLOC: miden::BumpAlloc = miden::BumpAlloc::new();

use miden::*;

miden::generate!();
bindings::export!(MyNote);

use bindings::{
    exports::miden::base::note_script::Guest,
    miden::cross_ctx_account::foo::process_felt,
};

struct MyNote;

impl Guest for MyNote {
    fn run(_arg: Word) {
        let input = Felt::from_u32(11);
        let output = process_felt(input);
        assert_eq!(output, felt!(53));
    }
}
```

Key points:
- `miden::generate!()` generates the `bindings` module from component interfaces
- `bindings::export!(MyNote)` registers `MyNote` as the implementation
- `process_felt` is imported from the `cross-ctx-account` component
- The import path follows the package structure: `bindings::miden::cross_ctx_account::foo::process_felt`

## Cargo.toml configuration

Cross-component calls require two dependency declarations:

### 1. Miden dependencies (for `cargo-miden` linking)

```toml
[package.metadata.miden.dependencies]
"miden:basic-wallet" = { path = "../basic-wallet" }
```

This tells `cargo-miden` where to find the component for linking.

### 2. Component dependencies (for binding generation)

```toml
[package.metadata.component.target.dependencies]
"miden:basic-wallet" = { path = "../basic-wallet/target/generated-wit/" }
```

This points to the generated interface files used to create Rust bindings.

### Complete example

```toml title="counter-note/Cargo.toml"
[package]
name = "counter-note"
version = "0.1.0"
edition = "2024"

[lib]
crate-type = ["cdylib"]

[dependencies]
miden = { path = "../../sdk/sdk" }

[package.metadata.miden]
project-kind = "note-script"

[package.metadata.component]
package = "miden:counter-note"

# Miden dependency — the component we want to call
[package.metadata.miden.dependencies]
"miden:counter-contract" = { path = "../counter-contract" }

# Component dependency — generated interface for binding generation
[package.metadata.component.target.dependencies]
"miden:counter-account" = { path = "../counter-contract/target/generated-wit/" }
```

:::info Build order matters
The dependent component must be built first so its interface files exist. Build `counter-contract` before building `counter-note`.
:::

## Example: Counter note calling counter contract

```rust title="counter-note/src/lib.rs"
#![no_std]
#![feature(alloc_error_handler)]

use miden::*;

// Import the counter contract's generated bindings
use crate::bindings::miden::counter_contract::counter_contract;

#[note]
struct CounterNote;

#[note]
impl CounterNote {
    #[note_script]
    pub fn run(self, _arg: Word) {
        // Call get_count() on the counter contract component
        let initial_value = counter_contract::get_count();

        // Call increment_count() — modifies the account's storage
        counter_contract::increment_count();

        // Verify the count increased
        let expected_value = initial_value + Felt::from_u32(1);
        let final_value = counter_contract::get_count();
        assert_eq!(final_value, expected_value);
    }
}
```

## When to use which pattern

| Pattern | Use when |
|---------|----------|
| `#[note]` with `&mut Account` | Note needs to call a single account component's methods |
| `generate!()` + `Guest` trait | Note needs to call multiple components or needs full control |
| Direct module imports | Calling specific functions from a known component interface |

:::info API Reference
Full API docs on docs.rs: [`miden`](https://docs.rs/miden/latest/miden/) (`generate!()` macro)
:::
