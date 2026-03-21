---
sidebar_position: 2
title: Create Your Project
description: Set up a new Miden project and understand the counter contract implementation.
---

In this section, you'll set up a new Miden project and understand the structure and implementation of both the counter account contract and increment note script.

## Setting Up Your Project

Create a new Miden project using the CLI:

```bash title=">_ Terminal"
miden new counter-project
cd counter-project
```

This creates a workspace with the following structure:

```text
counter-project/
├── contracts/                   # Each contract as individual crate
│   ├── counter-account/         # Example: Counter account contract
│   └── increment-note/          # Example: Increment note contract
├── integration/                 # Integration crate (scripts + tests)
│   ├── src/
│   │   ├── bin/                 # Rust binaries for on-chain interactions
│   │   ├── lib.rs
│   │   └── helpers.rs           # Temporary helper file
│   └── tests/                   # Test files
├── Cargo.toml                   # Workspace root
└── rust-toolchain.toml          # Rust toolchain specification
```

The project follows Miden's design philosophy of clean separation:

- **`contracts/`**: Your primary working directory for writing Miden smart contract code
- **`integration/`**: All on-chain interactions, deployment scripts, and tests

Each contract is organized as its own individual crate, providing independent versioning, dependencies, and clear isolation between different contracts.

## Building Your Contracts

You can build individual contracts by navigating to their directory and running the Miden build command:

```bash title=">_ Terminal"
# Build the counter account contract
cd contracts/counter-account
miden build

# Build the increment note contract
cd ../increment-note
miden build
```

This compiles the Rust contract code into a `.masp` package file, making it ready for deployment and interaction.

## Understanding the Counter Account Contract

Let's examine the counter account contract that comes with the project template. Open `contracts/counter-account/src/lib.rs`:

```rust title="contracts/counter-account/src/lib.rs"
// Do not link against libstd (i.e. anything defined in `std::`)
#![no_std]
#![feature(alloc_error_handler)]

// However, we could still use some standard library types while
// remaining no-std compatible, if we uncommented the following lines:
//
// extern crate alloc;

use miden::{component, felt, Felt, StorageMap, StorageMapAccess, Word};

/// Main contract structure for the counter example.
#[component]
struct CounterContract {
    /// Storage map holding the counter value.
    #[storage(description = "counter contract storage map")]
    count_map: StorageMap,
}

#[component]
impl CounterContract {
    /// Returns the current counter value stored in the contract's storage map.
    pub fn get_count(&self) -> Felt {
        // Define a fixed key for the counter value within the map
        let key = Word::from_u64_unchecked(0, 0, 0, 1);
        // Read the value associated with the key from the storage map
        self.count_map.get(&key)
    }

    /// Increments the counter value stored in the contract's storage map by one.
    pub fn increment_count(&mut self) -> Felt {
        // Define the same fixed key
        let key = Word::from_u64_unchecked(0, 0, 0, 1);
        // Read the current value
        let current_value: Felt = self.count_map.get(&key);
        // Increment the value by one
        let new_value = current_value + felt!(1);
        // Write the new value back to the storage map
        self.count_map.set(key, new_value);
        new_value
    }
}
```

### Counter Contract Walkthrough

#### No-std Environment

```rust
#![no_std]
```

Miden contracts run in a `no_std` environment, meaning they don't link against Rust's standard library. This is essential for blockchain execution where contracts need to be deterministic and lightweight.

#### Miden Library Imports

```rust
use miden::{component, felt, Felt, StorageMap, StorageMapAccess, Word};
```

These imports provide:

- **`component`**: Macro for defining contract components
- **`Felt`/`Word`**: Miden's native field element and word types
- **`StorageMap`**: Key-value storage within account storage slots
- **`StorageMapAccess`**: Needed for reading storage values (`get_count` function)

:::note[`felt` vs `Felt`]
`Felt` is the field element type representing values in the Goldilocks prime field (p = 2^64 - 2^32 + 1). `felt!(1)` is a compile-time macro that creates `Felt` values from integer literals with compile-time range validation. Currently `felt!` only accepts values up to 2^32 (compiler limitation); for larger values use `Felt::from_u64_unchecked()`.
:::

#### Contract Structure Definition

```rust
#[component]
struct CounterContract {
    /// Storage map holding the counter value.
    #[storage(description = "counter contract storage map")]
    count_map: StorageMap,
}
```

The `#[component]` attribute marks this as a Miden account component. The `count_map` field is a `StorageMap` stored in a named storage slot of the account. In v0.13, storage slots are identified by name rather than explicit index numbers — the slot name is derived automatically from the component's package name and field name (e.g., `miden::component::miden_counter_account::count_map`).

**Important**: Storage slots in Miden hold `Word` values, which are composed of four field elements (`Felt`). Each `Felt` is a 64-bit unsigned integer (u64). The `StorageMap` provides a key-value interface within a single storage slot, allowing you to store multiple key-value pairs within the four-element word structure.

#### Contract Implementation

```rust
impl CounterContract {
    // Function implementations...
}
```

The `CounterContract` implementation defines the external interface that other contracts and notes can call. This is the contract's public API.

#### Storage Key Strategy

```rust
let key = Word::from_u64_unchecked(0, 0, 0, 1);
```

Both functions in the counter contract use the same fixed key `[0, 0, 0, 1]` to store and retrieve the counter value within the storage map. The `Word::from_u64_unchecked` constructor creates a `Word` from four `u64` values. This demonstrates a simple but effective storage pattern.

## Understanding the Increment Note Script

Now let's examine the increment note script at `contracts/increment-note/src/lib.rs`:

```rust title="contracts/increment-note/src/lib.rs"
// Do not link against libstd (i.e. anything defined in `std::`)
#![no_std]
#![feature(alloc_error_handler)]

// However, we could still use some standard library types while
// remaining no-std compatible, if we uncommented the following lines:
//
// extern crate alloc;
// use alloc::vec::Vec;

use miden::*;

use crate::bindings::miden::counter_account::counter_account;

#[note]
struct IncrementNote;

#[note]
impl IncrementNote {
    #[note_script]
    fn run(self, _arg: Word) {
        let initial_value = counter_account::get_count();
        counter_account::increment_count();
        let expected_value = initial_value + Felt::from_u32(1);
        let final_value = counter_account::get_count();
        assert_eq(final_value, expected_value);
    }
}
```

### Increment Note Script Walkthrough

#### No-std Setup

Similar to the account contract, the note script uses `#![no_std]` with the same allocator and panic handler setup.

#### Miden Imports

```rust
use miden::*;

use crate::bindings::miden::counter_account::counter_account;
```

The wildcard import brings in all Miden note script functionality. The `counter_account` binding imports the interface functions from the counter contract, allowing the note script to call them.

#### Note Script Structure

Note scripts use a struct-based pattern. The `#[note]` attribute on both the struct and `impl` block marks this as a Miden note script component:

```rust
#[note]
struct IncrementNote;

#[note]
impl IncrementNote {
    #[note_script]
    fn run(self, _arg: Word) { ... }
}
```

The struct definition (`IncrementNote`) provides a named type for the note script. Unlike account contracts, note scripts don't store persistent data — the struct serves as the entry point container.

Learn more about [note scripts in the Miden documentation](/core-concepts/protocol/note/).

#### The Note Script Function

```rust
#[note_script]
fn run(self, _arg: Word) {
    let initial_value = counter_account::get_count();
    counter_account::increment_count();
    let expected_value = initial_value + Felt::from_u32(1);
    let final_value = counter_account::get_count();
    assert_eq(final_value, expected_value);
}
```

The `#[note_script]` attribute marks this method as the entry point for note execution. The `self` parameter is required for methods in the `impl` block. The function:

1. **Gets the initial counter value** using the imported `counter_account::get_count()` function
2. **Calls increment_count()** to increment the counter on the target account
3. **Verifies the operation succeeded** by checking the final value matches expectations

This demonstrates how note scripts interact with account contracts through their public interfaces, calling functions to change state.

The counter example demonstrates a complete interaction pattern: the account contract manages persistent state, while the note script provides a mechanism to trigger state changes through note consumption.

## Next Steps

Now that you understand the contract code structure, let's move on to [deploying your contract](./deploy) and learn how the integration folder enables interaction with your contracts on the Miden network.

---
