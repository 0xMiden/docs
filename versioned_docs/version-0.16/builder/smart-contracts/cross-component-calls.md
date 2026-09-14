---
title: "Cross-Component Calls"
sidebar_position: 5.5
description: "Call methods across account components and from note scripts."
---

# Cross-Component Calls

Miden [components](./accounts/components) can call each other's methods. Since accounts can have multiple components (e.g., wallet + auth + custom logic), those components need to communicate. [Note scripts](./notes/note-scripts) can also call methods on the account's components.

## How it works

When you build a component with `miden build`, the compiler writes its compiled
package and generates WIT describing the methods marked with
`#[account_procedure]`. Other projects use the package plus that WIT to call
those methods.

```
counter-account (package)
    → exports counter-contract (component interface)
        → counter-note imports the interface
            → calls account.get_count()
```

## Using `#[note]` macros (recommended)

The simplest way to make cross-component calls from note scripts is through the `#[note]` macro with an `Account` parameter:

```rust
use miden::{account, note, Word};

#[account(counter_account::CounterContract)]
pub struct CounterAccount;

#[note]
struct CounterNote;

#[note]
impl CounterNote {
    #[note_script]
    pub fn run(self, _arg: Word, account: &mut CounterAccount) {
        account.increment_count();
    }
}
```

The `_arg: Word` parameter contains the note argument (`NOTE_ARGS`) supplied by the transaction when the note is consumed. It's unused in this example (prefixed with `_`), but note scripts can use it for transaction-specific data like expected account IDs or amounts.

The `#[account(...)]` wrapper declares which package interface the script will call. Its methods correspond to the referenced component's account procedures.

## Calling foreign accounts

The same `#[account(...)]` wrapper can call a different account through foreign procedure invocation (FPI). Construct it with the target `AccountId`, then call the imported methods:

```rust
use miden::{account, AccountId, Felt};

#[account(counter_account::CounterContract)]
struct CounterAccount;

fn read_foreign_count(counter_account_id: AccountId) -> Felt {
    let counter = CounterAccount::new(counter_account_id);
    counter.get_count()
}
```

Key points:
- The `#[account(package::Interface)]` path names the interface exported by the dependency package and described by its generated WIT, not just the package.
- An account parameter in a note or transaction script refers to the transaction's native account.
- `AccountWrapper::new(account_id)` creates a foreign account caller routed through FPI.

## Project manifest configuration

Cross-component calls require dependency declarations in `miden-project.toml`.

### 1. Package dependency

```toml
[dependencies]
miden-core = "*"
miden-protocol = "*"
basic-wallet = { path = "../basic-wallet" }
```

This tells the compiler where to find the component package.

### 2. Generated WIT dependency

The compiled dependency package embeds its generated WIT interface. The SDK reads that interface to create Rust bindings for `#[account(...)]`.

Do not also set `package.metadata.miden.dependencies.<name>.wit` for a package that embeds WIT: the SDK rejects the duplicate interface source.

### Complete example

```toml title="counter-note/miden-project.toml"
[package]
name = "counter-note"
version = "0.1.0"

[lib]
kind = "note"
namespace = "miden:counter-note/miden-counter-note@0.1.0"
path = "src/lib.rs"

[dependencies]
miden-core = "*"
miden-protocol = "*"
counter-account = { path = "../counter-account" }

```

The consumer's build resolves the `counter-account` path dependency and uses the interface embedded in its compiled package. No separate `target/generated-wit/` path is required.

## Example: Counter note calling counter contract

```rust title="counter-note/src/lib.rs"
#![no_std]
#![feature(alloc_error_handler)]

use miden::{account, note, Felt, Word};

#[account(counter_account::CounterContract)]
pub struct CounterAccount;

#[note]
struct CounterNote;

#[note]
impl CounterNote {
    #[note_script]
    pub fn run(self, _arg: Word, account: &mut CounterAccount) {
        // Call get_count() on the counter contract component
        let initial_value = account.get_count();

        // Call increment_count() — modifies the account's storage
        account.increment_count();

        // Verify the count increased
        let expected_value = initial_value + Felt::from_u32(1);
        let final_value = account.get_count();
        assert_eq!(final_value, expected_value);
    }
}
```

## When to use which pattern

| Pattern | Use when |
|---------|----------|
| `#[note]` with `&mut AccountWrapper` | Note needs to call the native account's component methods |
| `AccountWrapper::new(account_id)` | Component, note, or transaction script needs to call a foreign account through FPI |
| Multiple `#[account(...)]` wrappers | A script needs to call multiple known component interfaces |

:::info API Reference
Full API docs on docs.rs: [`miden`](https://docs.rs/miden/latest/miden/) (`#[account]`, `#[note]`, and `#[component]` macros)
:::
