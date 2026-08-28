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
fn run(arg: Word, account: &mut Wallet) { ... }

// Without account access
#[tx_script]
fn run(arg: Word) { ... }
```

| Constraint | Details |
|------------|---------|
| Function name | Must be `run` (enforced by the macro) |
| Return type | `()` |
| Required arg | One `Word` (the script argument, passed by the transaction executor) |
| Optional arg | `&AccountWrapper` or `&mut AccountWrapper`, where `AccountWrapper` is declared with `#[account(package::Interface)]` |
| Generics | Not allowed |
| Async | Not allowed |

## miden-project.toml

```toml
[package]
name = "basic-wallet-tx-script"
version = "0.1.0"

[lib]
kind = "tx-script"
namespace = "miden:base/transaction-script@1.0.0"
path = "src/lib.rs"

[dependencies]
miden-core = "*"
miden-protocol = "*"
basic-wallet = { path = "../basic-wallet" }

[package.metadata.miden.dependencies]
basic-wallet = { wit = "../basic-wallet/target/generated-wit/" }
```

## Example: basic-wallet-tx-script

This example decodes structured input from the advice map and asks the account's
wallet component to create the output note. `output_note::create` is restricted
to account-component context, so a transaction script cannot call it directly.

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

use miden::{account, adv_load_preimage, intrinsics::advice::adv_push_mapvaln, *};

#[account(basic_wallet::BasicWallet)]
pub struct Wallet;

// Input layout constants
const TAG_INDEX: usize = 0;
const NOTE_TYPE_INDEX: usize = 1;
const RECIPIENT_START: usize = 2;
const RECIPIENT_END: usize = 6;
const ASSET_START: usize = 6;
const ASSET_END: usize = 14;

#[tx_script]
fn run(arg: Word, account: &mut Wallet) {
    let num_felts = adv_push_mapvaln(arg.clone());
    let num_felts_u64 = num_felts.as_canonical_u64();
    assert_eq!(Felt::from_u32((num_felts_u64 % 4) as u32), felt!(0));

    let num_words = Felt::new(num_felts_u64 / 4).unwrap();
    let commitment = arg;
    let input = adv_load_preimage(num_words, commitment);

    let tag = input[TAG_INDEX];
    let note_type = input[NOTE_TYPE_INDEX];
    let recipient: [Felt; 4] =
        input[RECIPIENT_START..RECIPIENT_END].try_into().unwrap();

    let note_idx =
        account.create_note(tag.into(), note_type.into(), recipient.into());

    // Contract-side assets contain an ID word followed by a value word.
    let asset: [Felt; 8] = input[ASSET_START..ASSET_END].try_into().unwrap();
    let asset_key: [Felt; 4] = asset[..4].try_into().unwrap();
    let asset_value: [Felt; 4] = asset[4..].try_into().unwrap();
    let asset = Asset::new(asset_key, asset_value);

    account.move_asset_to_note(asset, note_idx);
}
```

### Walkthrough

1. **`arg: Word`** is the commitment used to look up the structured input in the advice map.
2. **`adv_push_mapvaln(arg)`** loads the preimage length, and `adv_load_preimage(...)` retrieves the tag, note type, recipient, and two-word asset.
3. **`account.create_note(...)`** crosses into the installed wallet component, where note creation is permitted.
4. **`account.move_asset_to_note(...)`** removes the asset from the account vault and attaches it to the new note.

:::note
Host code must insert a 16-felt, word-aligned preimage into the advice map:
tag (1), note type (1), recipient (4), asset (8), and two zero padding felts.
Hash all 16 felts and pass that commitment as the transaction-script argument.
Keep the host and guest field order in sync.
:::

:::tip
`adv_push_mapvaln` and `adv_load_preimage` are part of the advice provider — the mechanism for supplying auxiliary data to a transaction. See [Advice Provider](./advice-provider) for the full function reference.
:::

## Related

- [Transaction Context](./transaction-context) — `tx` module (block info, note commitments, expiration)
- [Cross-Component Calls](../cross-component-calls) — how `&mut Account` works in tx scripts
- [Reading Notes](../notes/reading-notes) — reading input notes by index inside tx scripts
