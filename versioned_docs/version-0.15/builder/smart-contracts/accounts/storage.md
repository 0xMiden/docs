---
title: "Storage"
sidebar_position: 2
description: "Persistent state management with StorageValue slots and StorageMaps in Miden smart contracts."
---

# Storage

Miden accounts have persistent storage organized into up to 255 name-addressable slots. Each slot holds either a single typed value (via `StorageValue<T>`) or a key-value map (via `StorageMap<K, V>`). Slots are identified by `StorageSlotId` values derived from slot names, which in turn are derived from the component package name and the field name. Renaming a field changes the slot ID and is a breaking change for stored data.

## Storage slots

An account can have up to **255 storage slots**. Each slot is declared as a field on your component struct:

```rust
use miden::{component_storage, StorageMap, StorageValue, Word};

#[component_storage]
struct MyContractStorage {
    #[storage(description = "configuration")]
    config: StorageValue<Word>,

    #[storage(description = "user balances")]
    balances: StorageMap<Word, Word>,
}
```
Slot IDs are derived from the component package name and the field name. Ordering does not matter, and `slot(N)` is not supported.

## StorageValue — Single-slot storage

A `StorageValue<T>` stores a single typed value at a fixed slot. It provides `get()` and `set()` methods. Note that `set()` returns the **previous** slot value, not the value written.

### Reading

```rust
pub fn get_config(&self) -> Word {
    self.config.get()
}

pub fn is_initialized(&self) -> bool {
    let state: Word = self.initialized.get();
    state[0] == felt!(1)
}
```

### Writing

`set()` returns the **previous value**:

```rust
pub fn initialize(&mut self) {
    let old: Word = self.initialized.set(
        Word::from([felt!(1), felt!(0), felt!(0), felt!(0)])
    );
    // old contains the previous value of the slot
}
```

### Packing multiple values

Since each slot holds a `Word` (4 Felts), pack related values together:

```rust
// Store limits as [max_per_tx, daily_max, 0, 0]
pub fn set_limits(&mut self, max_per_tx: u64, daily_max: u64) {
    self.limits.set(Word::from([
        Felt::new(max_per_tx).unwrap(),
        Felt::new(daily_max).unwrap(),
        felt!(0),
        felt!(0),
    ]));
}

// Read individual fields
pub fn get_max_per_tx(&self) -> u64 {
    let limits: Word = self.limits.get();
    limits[0].as_canonical_u64()
}
```

## StorageMap — Key-value storage

A `StorageMap<K, V>` stores typed key-value pairs where keys and values can be converted to and from `Word`. It provides `get()` and `set()` methods.

### Reading from a map

```rust
// With StorageMap<AccountId, Felt>, get returns a Felt.
pub fn get_balance(&self, account_id: AccountId) -> Felt {
    self.balances.get(account_id)
}
```

Scalar `Felt` map values are encoded in the low word limb (`[value, 0, 0, 0]`) in v0.15. This is handled by the typed `StorageMap<K, Felt>` conversion. For a full `Word` value, declare the map value type as `Word`:

```rust
// Get the full Word value
let full_value: Word = self.my_map.get(key);
```

### Writing to a map

`set()` returns the **previous value**:

```rust
pub fn set_balance(&mut self, account_id: AccountId, amount: Felt) {
    let old: Felt = self.balances.set(account_id, amount);
    // old contains the previous balance
}
```

### Map with Word values

```rust
pub fn store_data(&mut self, key: Word, value: Word) {
    let old: Word = self.data_map.set(key, value);
}

pub fn read_data(&self, key: Word) -> Word {
    self.data_map.get(key)
}
```

## Storage layout conventions

Each slot and each Felt within a Word can be documented with inline comments on the struct:

```rust
use miden::{component_storage, StorageMap, StorageValue, Word};

#[component_storage]
struct TokenVaultStorage {
    /// Config slot:
    /// [0] = max_supply (u64)
    /// [1] = is_paused (0 or 1)
    /// [2] = decimals
    /// [3] = unused
    #[storage(description = "vault configuration")]
    config: StorageValue<Word>,

    /// State slot:
    /// [0] = total_supply (u64)
    /// [1] = total_holders (u64)
    /// [2] = last_mint_block
    /// [3] = unused
    #[storage(description = "vault state")]
    state: StorageValue<Word>,

    /// Balance map slot:
    /// Key: [account_prefix, account_suffix, 0, 0]
    /// Value: [balance, last_activity_block, 0, 0]
    #[storage(description = "user balances")]
    balances: StorageMap<Word, Word>,
}
```

## Low-level storage access

Direct storage access outside the component traits uses the bindings:

```rust
use miden::storage;

// Direct slot access
let value: Word = storage::get_item(slot_id);
let old: Word = storage::set_item(slot_id, new_value);

// Direct map access
let value: Word = storage::get_map_item(slot_id, &key);
let old: Word = storage::set_map_item(slot_id, key, value);

// Initial values (at transaction start)
let initial: Word = storage::get_initial_item(slot_id);
let initial: Word = storage::get_initial_map_item(slot_id, &key);
```

These functions return values from before any modifications in the current transaction.

For Felt and Word conversion details, see [Types](../types). To export your own types for public APIs, see [Custom Types](./custom-types). For common storage patterns like access control and rate limiting, see [Patterns](../patterns).

:::info API Reference
Full API docs on docs.rs: [`miden::storage`](https://docs.rs/miden/latest/miden/storage/)
:::
