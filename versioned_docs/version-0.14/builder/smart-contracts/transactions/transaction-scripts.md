---
title: "Transaction Scripts"
sidebar_position: 3
description: "Write transaction scripts with #[tx_script] to orchestrate multi-note transactions and build output notes."
---

# Transaction Scripts

A transaction script is a top-level function that runs once per transaction, after all note scripts have executed. Use it to orchestrate logic that spans multiple consumed notes — moving assets from the account vault into output notes, calling account methods via [cross-component calls](../cross-component-calls), or running anything that must happen after all note scripts finish.

## `#[tx_script]` signature

```rust
// With account access
#[tx_script]
fn run(arg: Word, account: &mut Account) { ... }

// Without account access
#[tx_script]
fn run(arg: Word) { ... }
```

| Constraint | Details |
|------------|---------|
| Function name | Must be `run` (enforced by the macro) |
| Return type | `()` |
| Required arg | One `Word` (the script argument, passed by the transaction executor) |
| Optional arg | `&Account` or `&mut Account` |
| Generics | Not allowed |
| Async | Not allowed |

## Cargo.toml

```toml
[package.metadata.miden]
project-kind = "transaction-script"
```

## Example: basic-wallet-tx-script

This example reads note parameters from the advice map and creates an output note:

```rust
// Do not link against libstd (i.e. anything defined in `std::`)
#![no_std]
#![feature(alloc_error_handler)]

// However, we could still use some standard library types while
// remaining no-std compatible, if we uncommented the following lines:
//
//
// extern crate alloc;
// use alloc::vec::Vec;

use miden::{intrinsics::advice::{adv_load_preimage, adv_push_mapvaln}, *};

use crate::bindings::Account;

// Input layout constants
const TAG_INDEX: usize = 0;
const NOTE_TYPE_INDEX: usize = 1;
const RECIPIENT_START: usize = 2;
const RECIPIENT_END: usize = 6;
const ASSET_START: usize = 6;
const ASSET_END: usize = 10;

#[tx_script]
fn run(arg: Word, account: &mut Account) {
    let num_felts = adv_push_mapvaln(arg.clone());
    let num_felts_u64 = num_felts.as_u64();
    assert_eq!(Felt::from_u32((num_felts_u64 % 4) as u32), felt!(0));
    let num_words = Felt::from_u64_unchecked(num_felts_u64 / 4);
    let commitment = arg;
    let input = adv_load_preimage(num_words, commitment);
    let tag = input[TAG_INDEX];
    let note_type = input[NOTE_TYPE_INDEX];
    let recipient: [Felt; 4] = input[RECIPIENT_START..RECIPIENT_END].try_into().unwrap();
    let note_idx = output_note::create(tag.into(), note_type.into(), recipient.into());
    let asset: [Felt; 4] = input[ASSET_START..ASSET_END].try_into().unwrap();
    account.move_asset_to_note(asset.into(), note_idx);
}
```

### Walkthrough

1. **`arg: Word`** is a map key used to look up the transaction data in the advice map
2. **`adv_push_mapvaln(arg)`** reads the number of felts stored at that key
3. **`adv_load_preimage(num_words, commitment)`** retrieves the actual data (tag, note_type, recipient, asset) from the advice map
4. **`output_note::create(tag, note_type, recipient)`** creates the output note
5. **`account.move_asset_to_note(asset, note_idx)`** moves the asset from the account vault into the newly created note

:::note
This script uses the advice map to pass structured input data. The caller encodes the note parameters (tag, note_type, recipient, asset) as a preimage and passes the commitment hash as the `arg` Word.
:::

:::tip
`adv_push_mapvaln` and `adv_load_preimage` are part of the advice provider — the mechanism for supplying auxiliary data to a transaction. See [Advice Provider](./advice-provider) for the full function reference.
:::

## Related

- [Transaction Context](./transaction-context) — `tx` module (block info, note commitments, expiration)
- [Cross-Component Calls](../cross-component-calls) — how `&mut Account` works in tx scripts
- [Reading Notes](../notes/reading-notes) — reading input notes by index inside tx scripts
