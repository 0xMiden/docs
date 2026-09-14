---
title: "Components"
sidebar_position: 1
description: "Define Miden account components using the #[component] macro — storage, methods, and auto-generated bindings."
---

# Components

Components are the building blocks of Miden accounts. Each component defines a [storage](./storage) layout, exposes public methods, and can be composed with other components on the same account — for example, a wallet component + an auth component + custom logic. This modularity lets you reuse a wallet component across many accounts and test or upgrade components independently.

## The `#[component]` macro

A component has three Rust pieces: a `#[component_storage]` struct for storage fields, a `#[component]` trait for the public interface, and a `#[component] impl Trait for Storage` block for behavior:

```rust
use miden::{component, component_storage, felt, Felt, StorageMap, Word};

#[component_storage]
struct CounterContractStorage {
    #[storage(description = "counter contract storage map")]
    count_map: StorageMap<Word, Felt>,
}

#[component]
trait CounterContract {
    #[account_procedure]
    fn get_count(&self) -> Felt;
    #[account_procedure]
    fn increment_count(&mut self) -> Felt;
}

#[component]
impl CounterContract for CounterContractStorage {
    fn get_count(&self) -> Felt {
        let key = Word::new([felt!(0), felt!(0), felt!(0), felt!(1)]);
        self.count_map.get(key)
    }

    fn increment_count(&mut self) -> Felt {
        let key = Word::new([felt!(0), felt!(0), felt!(0), felt!(1)]);
        let current_value: Felt = self.count_map.get(key);
        let new_value = current_value + felt!(1);
        self.count_map.set(key, new_value);
        new_value
    }
}
```

The macros generate:

1. **Public API exports** describing the component's callable methods
2. **Storage metadata** mapping slot names to slot IDs (derived from the component package + field name)
3. **Runtime bindings** for the Miden execution environment

## Project manifest

Every account component crate also needs a `miden-project.toml` next to `Cargo.toml`:

```toml title="miden-project.toml"
[package]
name = "counter-contract"
version = "0.1.0"

[lib]
kind = "account-component"
namespace = "miden:counter-contract/counter-contract@0.1.0"
path = "src/lib.rs"

[dependencies]
miden-core = "*"
miden-protocol = "*"
```

The namespace interface segment must match the kebab-cased `#[component]` trait name. For generated WIT dependencies, see [Cross-Component Calls](../cross-component-calls#2-generated-wit-dependency).

## Storage struct

The storage struct defines the component's storage layout:

```rust
use miden::{component_storage, AccountId, Felt, StorageMap, StorageValue, Word};

#[component_storage]
struct MyContractStorage {
    #[storage(description = "owner account identifier")]
    owner: StorageValue<Word>,

    #[storage(description = "initialization flag")]
    initialized: StorageValue<Word>,

    #[storage(description = "user balances")]
    balances: StorageMap<AccountId, Felt>,
}
```

### Storage fields

Each field must be either `StorageValue<T>` (single-slot) or `StorageMap<K, V>` (map-slot), annotated with `#[storage]`:

```rust
#[storage(description = "human-readable description")]
field_name: StorageValue<Word>,

#[storage(description = "human-readable description")]
field_name: StorageMap<Word, Word>,
```

The `description` is optional and becomes part of the generated metadata. Slot IDs are derived from the component package name and the field name, so **renaming a field changes the slot ID**. Ordering does not matter, and `slot(N)` is not supported.

## Trait and impl block — methods

Declare callable methods on the `#[component]` trait, mark each one with `#[account_procedure]`, then implement that trait for the storage struct. Unmarked trait methods are not exported from the account interface. Authentication entrypoints use `#[auth_script]` instead; the two attributes cannot be combined.

### Read methods (`&self`)

Methods that take `&self` can read component storage but cannot mutate it through `self`:

```rust
fn get_balance(&self, depositor: AccountId) -> Felt {
    self.balances.get(depositor)
}
```

### Write methods (`&mut self`)

Methods that take `&mut self` can update component storage and call mutating methods on `self`:

```rust
fn deposit(&mut self, asset: Asset) {
    self.add_asset(asset);
}
```

### Private methods

Helpers that are not declared on the `#[component]` trait are private. Define them on the storage struct with a normal inherent impl, then call them from the component trait implementation:

```rust
impl MyContractStorage {
    fn require_initialized(&self) {
        let state: Word = self.initialized.get();
        assert!(state[0] == felt!(1));
    }
}

#[component]
impl MyContract for MyContractStorage {
    fn do_something(&mut self) {
        self.require_initialized();
        // ...
    }
}
```

### Supported parameter and return types

Public methods can use SDK types (`Felt`, `Word`, `Asset`, `AccountId`, `NoteIdx`) and custom types annotated with [`#[export_type]`](./custom-types).

## Auto-generated methods

The `#[component]` macro automatically provides methods on `self` for account operations.

### Mutation methods (`&mut self`)

```rust
// Add an asset to the account vault
self.add_asset(asset: Asset) -> Word

// Remove an asset from the account vault
self.remove_asset(asset: Asset) -> Word

// Increment the account nonce (only inside #[auth_script])
self.incr_nonce() -> Nonce
```

The kernel allows `incr_nonce` only from the account's authentication procedure,
and only once per transaction. Calling it from an ordinary account procedure
fails. Standard authentication components handle this increment automatically.

### Read-only methods (`&self`)

```rust
// Get the account ID
self.get_id() -> AccountId

// Get the account nonce
self.get_nonce() -> Nonce

// Get the value word stored under an asset key
self.get_asset(asset_key: Word) -> Word

// Check fungible or non-fungible asset ownership
self.has_asset(asset_id: Word) -> bool

// Compute commitment of account state changes
self.compute_delta_commitment() -> Word

// Check if a procedure was called during this transaction
self.was_procedure_called(proc_root: Word) -> bool

// Get storage and vault commitments
self.get_vault_root() -> Word
self.compute_commitment() -> Word
self.compute_storage_commitment() -> Word
// ... and more (see API Reference)
```

If storage or the vault has changed, `compute_delta_commitment` requires the
nonce to have been incremented. Compute such a delta inside the authentication
procedure after the increment; calling it earlier fails.

For the full list of auto-generated methods, see [Account Operations](./account-operations). To export your own types for use in public method signatures, see [Custom Types](./custom-types).

:::info API Reference
Full API docs on docs.rs: [`miden`](https://docs.rs/miden/latest/miden/) (top-level — `#[component]` macro)
:::
