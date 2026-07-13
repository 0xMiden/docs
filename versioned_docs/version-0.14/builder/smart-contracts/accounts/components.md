---
title: "Components"
sidebar_position: 1
description: "Define Miden account components using the #[component] macro — storage, methods, and auto-generated bindings."
---

# Components

Components are the building blocks of Miden accounts. Each component defines a [storage](./storage) layout, exposes public methods, and can be composed with other components on the same account — for example, a wallet component + an auth component + custom logic. This modularity lets you reuse a wallet component across many accounts and test or upgrade components independently.

## The `#[component]` macro

Apply `#[component]` to both a struct definition and its impl block:

```rust
use miden::{component, felt, Felt, StorageMap, Word};

#[component]
struct CounterContract {
    #[storage(description = "counter contract storage map")]
    count_map: StorageMap,
}

#[component]
impl CounterContract {
    pub fn get_count(&self) -> Felt {
        let key = Word::from_u64_unchecked(0, 0, 0, 1);
        self.count_map.get(&key)
    }

    pub fn increment_count(&mut self) -> Felt {
        let key = Word::from_u64_unchecked(0, 0, 0, 1);
        let current_value: Felt = self.count_map.get(&key);
        let new_value = current_value + felt!(1);
        self.count_map.set(key, new_value);
        new_value
    }
}
```

The macro generates:

1. **Public API exports** describing the component's callable methods
2. **Storage metadata** mapping slot names to slot IDs (derived from the component package + field name)
3. **Runtime bindings** for the Miden execution environment

## Struct definition

The struct defines the component's storage layout:

```rust
#[component]
struct MyContract {
    #[storage(description = "owner account identifier")]
    owner: Value,

    #[storage(description = "user balances")]
    balances: StorageMap,
}
```

### Storage fields

Each field must be either `Value` (single-slot) or `StorageMap` (map-slot), annotated with `#[storage]`:

```rust
#[storage(description = "human-readable description")]
field_name: Value,

#[storage(description = "human-readable description")]
field_name: StorageMap,
```

The `description` is optional and becomes part of the generated metadata. Slot IDs are derived from the component package name (from `[package.metadata.component]`) and the field name, so **renaming a field changes the slot ID**. Ordering does not matter, and `slot(N)` is not supported.

## Impl block — methods

### Read methods (`&self`)

Methods that take `&self` are **read-only** — they can query storage and account state but cannot modify anything:

```rust
pub fn get_balance(&self, depositor: AccountId) -> Felt {
    let key = Word::from([depositor.prefix, depositor.suffix, felt!(0), felt!(0)]);
    self.balances.get(&key)
}
```

### Write methods (`&mut self`)

Methods that take `&mut self` can **modify state** — write to storage, add/remove assets, create notes:

```rust
pub fn deposit(&mut self, asset: Asset) {
    self.add_asset(asset);
}
```

:::info ZK proof implications
Read methods (`&self`) produce proofs that don't include state transitions. Write methods (`&mut self`) produce proofs that do. The distinction is enforced by the compiler and determines which kernel operations are available.
:::

### Private methods

Methods without `pub` are private — they can be called from other methods in the same component but are not exported:

```rust
fn require_initialized(&self) {
    let state: Word = self.initialized.read();
    assert!(state[0] == felt!(1));
}

pub fn do_something(&mut self) {
    self.require_initialized();
    // ...
}
```

### Supported parameter and return types

Public methods can use SDK types (`Felt`, `Word`, `Asset`, `AccountId`, `NoteIdx`) and custom types annotated with [`#[export_type]`](./custom-types).

## Auto-generated methods

The `#[component]` macro automatically provides methods on `self` for account operations.

### Mutation methods (`&mut self`)

```rust
// Add an asset to the account vault
self.add_asset(asset: Asset) -> Asset

// Remove an asset from the account vault
self.remove_asset(asset: Asset) -> Asset

// Increment the account nonce (replay protection)
self.incr_nonce() -> Felt

// Compute commitment of account state changes (read-only)
self.compute_delta_commitment() -> Word

// Check if a procedure was called during this transaction (read-only)
self.was_procedure_called(proc_root: Word) -> bool
```

### Read-only methods (`&self`)

```rust
// Get the account ID
self.get_id() -> AccountId

// Get the account nonce
self.get_nonce() -> Felt

// Get fungible asset balance for a faucet
self.get_balance(faucet_id: AccountId) -> Felt

// Check non-fungible asset ownership
self.has_non_fungible_asset(asset: Asset) -> bool

// Get storage and vault commitments
self.get_vault_root() -> Word
self.compute_commitment() -> Word
self.compute_storage_commitment() -> Word
// ... and more (see API Reference)
```

For the full list of auto-generated methods, see [Account Operations](./account-operations). To export your own types for use in public method signatures, see [Custom Types](./custom-types).

:::info API Reference
Full API docs on docs.rs: [`miden`](https://docs.rs/miden/latest/miden/) (top-level — `#[component]` macro)
:::
