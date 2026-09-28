---
sidebar_position: 10
title: "Rust Contract SDK & Compiler"
description: "Rebuild every contract with cargo-miden 0.11, Asset.key becomes Asset.id, the reference-block accessors are renamed, and auth summaries and hand-built P2ID recipients break silently"
---

# Rust Contract SDK & Compiler

:::info Which "Rust SDK"?
Two different things get called the Rust SDK. This page is about the **`miden` crate and the `midenc` / `cargo-miden` compiler**, used to write account components, notes and transaction scripts *in Rust* and compile them to Miden packages (`.masp`). The `miden-client` library, used to build applications that talk to a Miden node (it lives in the `0xMiden/rust-sdk` repository), is covered in [Client Changes](./client-changes).
:::

:::warning Breaking Change
Every contract package must be rebuilt with `midenc` / `cargo-miden` 0.11: packages written by 0.10.x use package format 6.0.0, which 0.17 tooling rejects. In the SDK, `Asset.key` is now `Asset.id: AssetId` and the `tx` reference-block accessors were renamed. Several changes still fail at run time once the build is green, most dangerously: custom auth components must hash the versioned transaction summary, hand-built P2ID recipients need four storage items and the 0.17 P2ID script root (get either one wrong and the note locks its assets for good), and raw FPI inputs are no longer word-reversed.
:::

## Quick Fix

Bump the SDK in every contract crate. A prerelease must be named exactly: `miden = "0.15"` does not match `0.15.0-rc.3`.

```toml title="Cargo.toml (each contract crate)"
[dependencies]
miden = "0.15.0-rc.3"                            # was "0.14"

[build-dependencies]
miden-sdk-build-script-support = "0.15.0-rc.3"   # was "0.14"
```

Point the project at the 0.17 toolchain channel, install it and rebuild, then fix the renames most contracts hit:

```toml title="miden-toolchain.toml"
[toolchain]
channel = "0.17.0"        # was "0.16.0"
```

```bash
midenup install 0.17.0    # midenc + cargo-miden 0.11.0-rc.3
cargo miden build         # rebuild every contract; Miden path dependencies are rebuilt with it
```

```rust
// Before (0.16)
let held = active_account::has_asset(asset.key);
let block_number = tx::get_block_number();
let block_commit = tx::get_block_commitment();

// After (0.17)
let held = active_account::has_asset(asset.id);
let block_number = tx::get_reference_block_number();
let block_commit = tx::get_reference_block_commitment();
```

If you encounter errors, continue reading for detailed migration steps.

---

## Summary

This page covers the contract toolchain (`midenc`, `cargo-miden` and the `cargo miden new` templates) and the `miden` SDK crates. The toolchain change is mechanical but mandatory: every package is rebuilt, and the version skew between the compiler and the client that 0.16 had is gone. The SDK API changes (`Asset.id`, the reference-block accessors, `compute_commitment`, the attachment loaders, raw externs) fail to compile with a clear rustc error, and `is_fungible` / `amount` in host unit tests fail at link time. Five changes fail only at run time: custom auth components that hash the 0.16 summary layout (they compile again as soon as the block-commitment rename is fixed), hand-built P2ID recipients with two storage items or a 0.16 P2ID script root, raw FPI calls written for the old word reversal, hand-built asset ids with the 0.16 metadata byte, and `compute_commitment` reached through FPI. Read those sections even if your build is green.

---

## Versions

| Component | 0.16 line | 0.17 line |
| --- | --- | --- |
| `midenc` / `cargo-miden` | 0.10.x | 0.11.0-rc.3 |
| `miden` SDK crates (`miden`, `miden-base`, `miden-base-macros`, `miden-base-sys`, `miden-stdlib-sys`, `miden-sdk-alloc`, `miden-field-repr`, `miden-field-repr-derive`, `miden-tx-script-args`, `miden-sdk-build-script-support`, `midenc-frontend-wasm-metadata`) | 0.14.0 | 0.15.0-rc.3 |
| `cargo miden new` template bundle | 0.32.1 | 0.33.0-rc.3 |
| midenup channel (`miden-toolchain.toml`) | `0.16.0` | `0.17.0` |
| Protocol it builds against (`miden-protocol`, `miden-standards`) | `=0.16.0-rc.4` | `=0.17.0-rc.7` |
| VM crates it builds against | 0.29 | 0.33.0 |
| `.masp` package format | 6.0.0 | 7.0.0 |
| MSRV / nightly | 1.99 / `nightly-2026-09-01` | unchanged |

- **The 0.16 version skew is gone.** Client `0.17.0-rc.3` and `0.17.0-rc.4` depend on protocol `0.17.0-rc.7` and VM 0.33, exactly what compiler 0.11.0-rc.3 pins, and the midenup `0.17.0` channel ships the same set (midenc / cargo-miden 0.11.0-rc.3, protocol 0.17.0-rc.7, core / VM 0.33.0).
- **The MSRV is still 1.99 plus a nightly toolchain**, higher than the 1.98.1 of the protocol and client crates. Your toolchain must satisfy the highest requirement among the components you build.
- **Host-side test and integration crates** move with the protocol. The project scaffold's `integration` crate pins:

```toml title="integration/Cargo.toml"
# Before (0.16)
miden-client              = { version = "0.16.0-rc.1", features = ["tonic"] }
miden-client-sqlite-store = { version = "0.16.0-rc.1", package = "miden-client-sqlite-store" }
miden-standards           = { version = "0.16.0-rc.4", features = ["testing"] }
miden-testing             = "0.16.0-rc.4"
miden-mast-package        = { version = "0.29", default-features = false }

# After (0.17)
miden-client              = { version = "0.17.0-rc.3", features = ["tonic"] }
miden-client-sqlite-store = { version = "0.17.0-rc.3", package = "miden-client-sqlite-store" }
miden-standards           = { version = "=0.17.0-rc.7", features = ["testing"] }
miden-testing             = "=0.17.0-rc.7"
miden-mast-package        = { version = "0.33.0", default-features = false }
```

:::note Queued after 0.17.0-rc.7
Protocol `next` already pins VM 0.34.0 while still versioned `0.17.0-rc.7`. If stable protocol 0.17.0 ships on VM 0.34, compiler 0.11.0-rc.3 (VM 0.33.0, exact protocol pin) lags behind the client again until a new compiler release. The package format is 7.0.0 in both VM 0.33.0 and 0.34.0.
:::

---

## Rebuild every contract package with `cargo-miden` 0.11

### Summary

The 0.11 compiler links against VM 0.33 and protocol `0.17.0-rc.7`, and the packages it writes use package format 7.0.0. Packages written by 0.10.x (format 6.0.0, VM 0.29, the protocol `0.16.0-rc.4` kernel) cannot be loaded by a 0.17 client, by `midenc`, or by the SDK macros that read dependency packages.

### Affected Code

```toml title="miden-toolchain.toml"
[toolchain]
channel = "0.17.0"      # was "0.16.0"
profile = "empty"
components = ["midenc", "cargo-miden", "core", "protocol"]
```

```bash
midenup install 0.17.0        # midenc + cargo-miden 0.11.0-rc.3, protocol 0.17.0-rc.7, core/vm 0.33.0
cargo miden build             # rebuild every contract; Miden path dependencies are rebuilt with it
```

### Migration Steps

1. Install the 0.17 toolchain: `midenup install 0.17.0`, or `cargo +nightly-2026-09-01 install cargo-miden --version 0.11.0-rc.3 --locked` (cargo-miden needs a nightly toolchain). Update the CI step that runs `midenup install` too.
2. Bump `miden` and `miden-sdk-build-script-support` to `"0.15.0-rc.3"` in every contract crate.
3. Delete old `target/` outputs and rebuild every package. `cargo miden build` rebuilds Miden path dependencies itself; rebuild any dependency you reference as a prebuilt `.masp` file first, because the SDK macros read a dependency's embedded WIT and MAST from its `.masp`.
4. Rebuild host-side fixtures that load `.masp` files (tests, scripts, deployment tooling). The CLI's bundled component packages in `.miden/packages` must be refreshed too, and custom packages you pass to the CLI rebuilt; see [Client Changes](./client-changes#cli-re-create-midenpackages-after-upgrading).

:::caution The compiler changelog does not tell you to rebuild
The compiler changelog for 0.11.0-rc.1 to rc.3 has no migration section and never says `.masp` files must be rebuilt. rc.3's "compiled packages need no changes" holds only relative to rc.2. Packages built by 0.10.x use package format 6.0.0 and the 0.16 kernel: rebuild all of them.
:::

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `invalid value: unsupported version. Got '[6, 0, 0]', but only '[7, 0, 0]' is supported` | Loading a `.masp` built by midenc 0.10.x with VM 0.33 crates (client 0.17, midenc 0.11) | Rebuild the package with cargo-miden 0.11. |
| `failed to deserialize dependency package '<path>'` ... `The package may have been produced by a different Miden toolchain version` | An SDK macro (`#[account(..)]`, `generate!`) read a dependency package built by the old toolchain | Rebuild the dependency first. |

---

## `Asset.key` is now `Asset.id: AssetId`

### Summary

The SDK `Asset` now mirrors protocol 0.17, where an asset is an asset id plus a value (see [Assets, Vault & Faucet Changes](./asset-vault-faucet)). Its first word is a typed `id: AssetId` instead of `key: Word`. `AssetId` is `#[repr(transparent)]` over the `Word`, so the ABI is unchanged. The value stays a plain `Word`; the SDK has no `AssetValue` type.

`active_account::get_asset`, `active_account::has_asset`, `native_account::get_initial_asset` and the `ActiveAccount::get_asset` / `has_asset` trait methods take an `AssetId`. In WIT, the `asset` record's first field changed from `key: word` to `id: asset-id`, so bindings generated by `generate!` and `#[account(..)]` expose `.id` too.

New with it: the `AssetId` readers `faucet_id()`, `asset_class()` and `composition()`, the `AssetClass` and `AssetComposition` types, `Asset::id()`, and the `miden::asset` module (`id_into_faucet_id`, `id_into_asset_class`, `id_into_composition`).

### Affected Code

```rust
// Before (0.16)
fn set_asset_qty(pub_key: Word, asset: Asset, qty: AssetAmount) {
    let mut my_account = MyAccount::default();
    let owner_key: Word = my_account.owner_public_key.get();
    if pub_key == owner_key {
        my_account.asset_qty_map.set(asset.key, qty);
    }
}

// vault queries take a raw Word
let held = active_account::has_asset(asset.key);
let value: Word = active_account::get_asset(key_word);
let initial: Word = native_account::get_initial_asset(key_word);
```

```rust
// After (0.17)
fn set_asset_qty(pub_key: Word, asset: Asset, qty: AssetAmount) {
    let mut my_account = MyAccount::default();
    let owner_key: Word = my_account.owner_public_key.get();
    if pub_key == owner_key {
        my_account.asset_qty_map.set(asset.id.inner, qty);
    }
}

// vault queries take an AssetId
use miden::AssetId;
let held = active_account::has_asset(asset.id);
let value: Word = active_account::get_asset(AssetId::from(key_word));
let initial: Word = native_account::get_initial_asset(AssetId::from(key_word));

// new readers on the id (each executes a protocol library procedure)
let faucet: AccountId = asset.id.faucet_id();
let class: AssetClass = asset.id.asset_class();
let fungible = asset.id.composition() == AssetComposition::Fungible;
```

Unchanged and still compiling: `Asset::new(word, value)` and `Asset::new([f0, f1, f2, f3], value)` (`AssetId` implements `From<Word>` and `From<[Felt; 4]>`), `Word::from(asset.id)`, `faucet::mint(asset)`, `native_account::add_asset(asset)` and `output_note::add_asset(asset, idx)`.

### Migration Steps

1. Replace `asset.key` with `asset.id` where an `AssetId` is accepted, or with `asset.id.inner` / `Word::from(asset.id)` where a raw `Word` is needed (storage-map keys, hashing, note storage).
2. Wrap raw words passed to `get_asset`, `has_asset` and `get_initial_asset` in `AssetId::from(..)`.
3. In generated bindings for components that take or return an `Asset`, read `.id` instead of `.key`. Rebuild the dependency so its embedded WIT has the `asset-id` record.
4. Use `asset.id.faucet_id()` / `composition()` instead of decoding the id limbs by hand; the layout changed (see [Hand-built asset ids need the 0.17 metadata byte](#hand-built-asset-ids-need-the-017-metadata-byte)).

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| ``error[E0609]: no field `key` on type `Asset` `` (note: ``available fields are: `id`, `value` ``) | Field renamed | Use `asset.id` or `asset.id.inner`. |
| `error[E0308]: mismatched types` ... ``expected `AssetId`, found `Word` `` | `get_asset` / `has_asset` / `get_initial_asset` take an `AssetId` | Pass `asset.id` or `AssetId::from(word)`. |

---

## Reference-block accessors renamed; `tx::get_block_commitment` takes a block number

### Summary

`tx::get_block_number()` is now `tx::get_reference_block_number()`, and `tx::get_block_commitment()` is now `tx::get_reference_block_commitment()`. The name `tx::get_block_commitment` is reused for `get_block_commitment(block_number: BlockNumber) -> Word`, which reads a block up to and including the reference block and panics for a later one. An older block must already be tracked by the transaction's partial blockchain (for example the block that created an authenticated input note, or a block added with the Rust client's `TransactionRequestBuilder::block_numbers`, new in client 0.17.0-rc.4); otherwise execution fails. The MASM procedures were renamed the same way; see [MASM Changes](./masm-changes).

### Affected Code

```rust
// Before (0.16)
let block_number = tx::get_block_number();
assert!(block_number >= timelock_height);

let block_commit = tx::get_block_commitment();
```

```rust
// After (0.17)
let block_number = tx::get_reference_block_number();
assert!(block_number >= timelock_height);

let block_commit = tx::get_reference_block_commitment();
// new: the commitment of an earlier block the transaction tracks
// (panics for blocks after the reference block)
let older = tx::get_block_commitment(some_block_number);
```

### Migration Steps

1. Rename `tx::get_block_number()` to `tx::get_reference_block_number()`.
2. Rename zero-argument `tx::get_block_commitment()` calls to `tx::get_reference_block_commitment()`. Do not "fix" the arity error by passing a number unless you want a historical block.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| ``error[E0425]: cannot find function `get_block_number` in module `tx` `` | Renamed | Use `tx::get_reference_block_number()`. |
| `error[E0061]: this function takes 1 argument but 0 arguments were supplied` (on `tx::get_block_commitment()`) | Name reused with a block-number argument | Use `tx::get_reference_block_commitment()`. |

---

## Custom auth components must hash the versioned transaction summary

### Summary

Protocol 0.17 changed the signed transaction-summary preimage from the 0.16 six-word layout to a versioned one: the two parameter words move first, element 0 is `version = 1`, and element 1 packs `expiration_delta << 32 | block_number`, leaving six user parameters. A Rust auth component that still hashes the 0.16 layout compiles again once `tx::get_block_commitment()` is renamed to `tx::get_reference_block_commitment()`, and then fails at signing time. Fixing only the rename error leaves the old layout in place. The protocol side of this change is on [Transaction Changes](./transaction-changes).

### Affected Code

```rust
// Before (0.16)
let block_commit = tx::get_block_commitment();
let expiration_delta = tx::get_expiration_block_delta();
let params_head =
    Word::from([expiration_delta.into(), final_nonce.into(), felt!(0), felt!(0)]);
let params_tail = Word::from([felt!(0), felt!(0), felt!(0), felt!(0)]);
let tx_summary = [
    acct_delta_commit,
    input_notes_commit,
    output_notes_commit,
    block_commit,
    params_head,
    params_tail,
];
let msg: Word = hash_words(&tx_summary).into();
adv_insert(msg, &tx_summary);
```

```rust
// After (0.17)
const TX_SUMMARY_VERSION: u32 = 1;

let block_commit = tx::get_reference_block_commitment();
let block_number = tx::get_reference_block_number();
let expiration_delta = tx::get_expiration_block_delta();
let metadata = Felt::from_u32(expiration_delta as u32) * Felt::new_unchecked(1 << 32)
    + block_number.as_felt();
let params_head = Word::from([
    Felt::from_u32(TX_SUMMARY_VERSION),
    metadata,
    final_nonce.into(),
    felt!(0),
]);
let params_tail = Word::from([felt!(0), felt!(0), felt!(0), felt!(0)]);
// parameters first, block commitment last
let tx_summary = [
    params_head,
    params_tail,
    acct_delta_commit,
    input_notes_commit,
    output_notes_commit,
    block_commit,
];
let msg: Word = hash_words(&tx_summary).into();
adv_insert(msg, &tx_summary);
```

### Migration Steps

1. Reorder the preimage: the two parameter words first, then the account delta, input notes, output notes and block commitments.
2. Put `1` in element 0 and the packed metadata in element 1, and shift the user parameters (final nonce first) down.
3. Read the block number with `tx::get_reference_block_number()`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `failed to construct transaction summary` | The host could not rebuild the summary from the advice-map preimage | Use the versioned layout. |
| `transaction summary layout version is {actual} but only version 1 is supported` | Element 0 of the preimage is not `1` (the 0.16 layout) | Put the version first. |

---

## Hand-built P2ID recipients need four storage items and the 0.17 script root

### Summary

The standard P2ID script now expects `[target_id_suffix, target_id_prefix, salt_0, salt_1]` and asserts exactly four storage items. A contract that computes a recipient for the 0.17 P2ID script root with the old two-item storage still creates the note, but no one can consume it.

The P2ID script itself was rewritten, so **the P2ID script root changed too**. The `miden` SDK has no binding that returns the standard P2ID root, so a contract gets it as data (note storage, component storage, a tx-script argument) or as a constant, and any of those still holding the 0.16 root is wrong. A recipient built on the 0.16 root commits the note to the 0.16 P2ID script, not the 0.17 one. That script asserts exactly two storage items, so a four-item note built on it is just as unconsumable. The P2ID changes on the protocol side are covered on [Note Changes](./note-changes#p2id-storage-has-four-items-script-root-recipients-and-note-ids-change).

:::danger Assets sent this way are lost
P2ID has no reclaim path. A P2ID note created with two storage items, or with four storage items on the 0.16 P2ID script root, can never be consumed, and its assets cannot be recovered. Fix every place that builds P2ID storage, and replace every P2ID script root your contract reads, before your contract creates notes on a 0.17 network.
:::

### Affected Code

```rust
// Before (0.16)
let recipient = note::build_recipient(
    serial_num,
    self.p2id_script_root,
    vec![self.creator.suffix, self.creator.prefix],
);
```

```rust
// After (0.17): self.p2id_script_root must hold the 0.17 root (see below)
let recipient = note::build_recipient(
    serial_num,
    self.p2id_script_root,
    vec![self.creator.suffix, self.creator.prefix, felt!(0), felt!(0)],
);
```

On the host, take the root from `miden-standards` 0.17 and write it into the storage the contract reads it from, instead of storing a value captured under 0.16:

```rust
// After (0.17), host side
use miden_protocol::Word;
use miden_standards::note::P2idNote;

let p2id_script_root: Word = P2idNote::script_root().into();
// put p2id_script_root into the note storage, component storage or tx-script argument
// that the contract reads as its P2ID root
```

### Migration Steps

1. Replace every stored or hard-coded P2ID script root with the 0.17 one, taken on the host from `P2idNote::script_root()` in the `miden-standards` version your network runs. Do not hard-code the value in the contract.
2. Append two salt felts wherever you build P2ID storage: zero, unless both parties agreed on a secret salt.
3. Make the off-chain side derive the expected recipient with the same salt.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `P2ID note expects exactly 4 note storage items` (when the note is consumed) | Two-item storage | Build four-item storage. A note already created this way cannot be recovered. |

---

## `compute_commitment` moved to `native_account` and rejects foreign accounts

### Summary

`active_account::compute_commitment()` and `ActiveAccount::compute_commitment` are gone. Use `native_account::compute_commitment()` / `NativeAccount::compute_commitment`.

Inside a `#[component]` impl, `self.compute_commitment()` keeps compiling: the macro brings both traits into scope and `#[component_storage]` implements both. `#[account(..)]` wrapper types used by note and tx scripts implement only `ActiveAccount`, so `account.compute_commitment()` there no longer compiles and has no replacement (it always required the account context and trapped at run time).

The kernel now computes the commitment of the **native** account only. If a component procedure that calls `compute_commitment` runs against a foreign account (reached through FPI), the transaction aborts. Under 0.16 it returned the foreign account's commitment.

### Affected Code

```rust
// Before (0.16)
let commitment = active_account::compute_commitment();
fn commit<T: ActiveAccount>(t: &T) -> Word { t.compute_commitment() }
```

```rust
// After (0.17)
let commitment = native_account::compute_commitment();
fn commit<T: NativeAccount>(t: &T) -> Word { t.compute_commitment() }

// unchanged inside a component
let init_comm = miden::native_account::get_initial_commitment();
let curr_comm = self.compute_commitment();
```

The new `native_account::has_state_changed()` is a more direct way to express the no-auth pattern above (it performs the same two reads).

### Migration Steps

1. Replace `active_account::compute_commitment()` with `native_account::compute_commitment()`.
2. Change generic bounds and UFCS calls from `ActiveAccount` to `NativeAccount`.
3. Move any `account.compute_commitment()` call from a note or tx script into a component method.
4. Do not call `compute_commitment` from a procedure that FPI can reach; pass the commitment another way.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| ``error[E0425]: cannot find function `compute_commitment` in module `active_account` `` | Moved | Use `native_account::compute_commitment()`. |
| ``error[E0599]: no method named `compute_commitment` found for reference `&T` in the current scope`` | Generic bound on `ActiveAccount` | Bound on `NativeAccount`. |
| ``error[E0599]: no method named `compute_commitment` found for ...`` naming your `#[account(..)]` wrapper type | Called on a wrapper in a note or tx script | Move the call into a component method. |
| `the active account is not native` | `compute_commitment` reached through FPI | Keep it out of FPI-reachable procedures. |

---

## `is_fungible` and `amount` call the protocol library: host unit tests fail to link

### Summary

`Asset::is_fungible()` and `Asset::amount()` now read the composition through the protocol library's `asset::id_into_composition` procedure, and the new `AssetId::faucet_id()` / `asset_class()` / `composition()` work the same way. There is no native implementation of those symbols, so a host (non-Wasm) test binary that reaches any of these methods fails to link. With the 0.16 SDK the same test ran natively, because the SDK decoded the bit itself. The SDK changelog notes the protocol-library call but not that host tests stop linking.

On the VM, the call costs a procedure call, and `is_fungible()` / `amount()` panic if the composition bits hold an unrecognized value.

### Affected Code

```rust
// Host-side unit test: passes with the 0.16 SDK, fails to LINK with 0.17
#[test]
fn host_side_amount() {
    let asset = Asset::new(id_word, value_word);
    assert!(asset.is_fungible());
}
```

### Migration Steps

1. Move tests that call `is_fungible`, `amount` or the `AssetId` readers into VM-executed tests, for example a `MockChain` test.
2. In host-only helpers, read the value word directly (`asset.value[0]` is the fungible amount) instead of calling `amount()`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `Undefined symbols for architecture arm64: "_miden::protocol::asset::id_into_composition"` (macOS linker output) | A native test reaches a protocol-library extern | Run the test on the VM / `MockChain`. |

---

## `cargo miden new` needs `cargo-miden` 0.11

### Summary

`cargo miden new` fetches the newest `templates/v*` release **in the minor series of its embedded bundle**, and a stable build never picks a prerelease. `cargo-miden` 0.10.2 embeds templates 0.32.1, so it keeps generating 0.16-line projects (`miden = "0.14"`, channel `0.16.0`). `cargo-miden` 0.11.0-rc.3 embeds templates 0.33.0-rc.3.

The generated guest code is the same in both template releases; only versions changed, plus the same host-side edit at two call sites in the scaffold's integration crate (`src/helpers.rs` and `tests/counter_test.rs`), because `AccountComponent::from_package` takes the package by value in protocol 0.17 (see [Account Changes](./account-changes)).

### Affected Code

```rust
// Before (0.16): integration/tests/counter_test.rs
let counter_component = AccountComponent::from_package(&contract_package, &init_storage_data)
    .context("failed to build account component from counter package")?;
```

```rust
// After (0.17)
let counter_component =
    AccountComponent::from_package(contract_package.as_ref().clone(), &init_storage_data)
        .context("failed to build account component from counter package")?;
```

### Migration Steps

1. Upgrade `cargo-miden` to 0.11.0-rc.3 (for example with `midenup install 0.17.0`) before running `cargo miden new`.
2. In an existing scaffolded project, apply the pins from [Versions](#versions): contract crates, the integration crate, `miden-toolchain.toml`, and the CI `midenup install 0.17.0` step.
3. Pass an owned `Package` to `AccountComponent::from_package`.
4. Keep contract crates out of the host workspace, as the scaffold does (`exclude = ["contracts/"]`). `miden-base-macros`, a dependency of `miden`, pins `miden-protocol = "=0.17.0-rc.7"`, so a single workspace whose host crates need a later 0.17.x protocol release is likely to fail dependency resolution.

:::caution The standalone account template still lacks `#[account_procedure]`
The `cargo miden new --account` template declares `fn add(&self, a: Felt, b: Felt) -> Felt;` without `#[account_procedure]`, while the `--tx-script` template calls `account.add(a, b)`. Add the attribute yourself. The full-project scaffold's `counter-account` marks both of its methods.
:::

---

## Raw FPI inputs and outputs are no longer word-reversed

### Summary

`tx::ForeignProcedureInputs::new(values)` now puts `values[i]` in slot `i` (slot 0 on top of the callee's stack), and `ForeignProcedureOutputs::get(i)` reads slot `i`. Before, every group of four felts was reversed, so a `Word` reached the callee reversed and inputs shorter than 16 felts sat underneath the zero padding. Code that compensated for the old order, and MASM callees written against it, now get wrong values without any error. Typed FPI through `#[account(..)]` wrappers is unaffected.

The SDK changelog lists this change without `[BREAKING]`, but existing raw-FPI callers and MASM callees silently receive a different felt order.

### Affected Code

```rust
// Before (0.16)
tx::ForeignProcedureInputs::new([key[0], key[1], key[2], key[3]])
// callee had to expect the word reversed:  push.[44, 33, 22, 11] assert_eqw
```

```rust
// After (0.17)
tx::ForeignProcedureInputs::new(key.into_elements())
// callee sees the word in order:           push.[11, 22, 33, 44] assert_eqw
// outputs: a Word the callee leaves on top reads back as
// Word::new([out.get(0), out.get(1), out.get(2), out.get(3)])
```

### Migration Steps

1. Remove any manual reversal around `ForeignProcedureInputs::new` and `ForeignProcedureOutputs::get`.
2. Re-check MASM callees that were written to match the old reversed layout.

---

## Hand-built asset ids need the 0.17 metadata byte

### Summary

The low byte of the asset id's third limb is now `version` (bits 0-3, currently 1) plus `composition` (bits 4-5); protocol 0.16 kept the composition in bits 0-1. The fungible byte is now `0x11`. An id built by hand with the old fungible byte `0x01` now reads as version 1 with composition `None`, so `is_fungible()` returns `false` and `amount()` panics with "asset is not fungible". The protocol-side encoding change is on [Assets, Vault & Faucet Changes](./asset-vault-faucet).

### Affected Code

```rust
// Before (0.16): fungible asset id built by hand
let id = Word::new([felt!(0), felt!(0), felt!(1), felt!(0)]);
```

```rust
// After (0.17), only if you must build one: suffix limb = faucet_id_suffix | 0x11
let id = Word::new([felt!(0), felt!(0), faucet_suffix_with_metadata_0x11, faucet_prefix]);
let asset = Asset::new(id, Word::new([amount, felt!(0), felt!(0), felt!(0)]));
```

### Migration Steps

1. Stop synthesizing asset ids in contracts. Take them from the host (note storage, tx-script arguments) or from assets the kernel returns.
2. If you must build one, use `0x11` for fungible and check it with `asset.id.composition()`.

---

## Advice-map attachment helpers renamed to `note::load_*`

### Summary

Protocol 0.17 made the `note::write_*_to_memory` MASM helpers internal, so the SDK now implements them with public core-library advice primitives and names them after what they do. Only the `note::` module is affected; the `active_note::`, `input_note::` and `output_note::` `write_attachment_*_to_memory` wrappers keep their names.

### Affected Code

```rust
// Before (0.16)
let commitments = note::write_attachment_commitments_to_memory(attachments_commitment);
let attachment  = note::write_attachment_to_memory(attachment_commitment);
let indexed     = note::write_indexed_attachment_to_memory(&commitments, idx);
```

```rust
// After (0.17)
let commitments = note::load_attachment_commitments(attachments_commitment);
let attachment  = note::load_attachment(attachment_commitment);
let indexed     = note::load_indexed_attachment(&commitments, idx);
```

Validation moved into the SDK: the loaders assert "attachment preimage exceeds protocol limit" and "attachment must contain whole words", and `load_indexed_attachment` indexes the slice (an out-of-range index is a Rust bounds panic) instead of delegating to a kernel procedure.

### Migration Steps

1. Rename the three `note::` calls as shown. Signatures are unchanged.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| ``error[E0425]: cannot find function `write_attachment_to_memory` in module `note` `` | Renamed | Use `note::load_attachment` (and the two siblings). |

---

## New SDK trait methods can make existing calls ambiguous

### Summary

The SDK traits that the macros implement and import automatically gained methods:

- `ActiveAccount::has_storage_slot`
- `NativeAccount::compute_commitment`, `has_state_changed`, `has_initial_asset`
- `ActiveNote::get_initial_assets_info`, `get_initial_num_assets`, `get_asset`, `get_note_id`, `get_storage_info`, `remove_asset`

If a type you own also gets a method of the same name from another trait in scope, method-call syntax becomes ambiguous. Examples: a dependency component exposing `has_storage_slot` on an `#[account(..)]` wrapper, or your own trait implemented for a `#[note]` struct with a `get_asset` method. Inherent methods still win.

### Migration Steps

1. Disambiguate with UFCS, for example `<Wallet as MyInterface>::has_storage_slot(&account, id)` or `<MyNote as active_note::ActiveNote>::get_asset(&self, 0)`.

---

## Other changes

- **`midenc` no longer resolves `miden-precompiles` as a built-in library.** VM 0.33 merges the precompiles into the core library, which is linked implicitly as before. Remove `-l precompiles` / `-l miden-precompiles` from `midenc` invocations; an explicit flag now falls through to a search-path lookup and fails. Tool authors: `midenc_session::LinkLibrary::precompiles()` is gone, and `LinkLibrary::core()` covers it. The midenup `0.17.0` channel no longer lists a `miden-precompiles.masp` artifact.
- **Raw extern bindings renamed or made private.** `output_note::extern_output_note_get_assets_info` is now `pub(crate)` (use `output_note::get_assets_info(note_idx)`). `tx::extern_tx_get_block_number` is now `tx::extern_tx_get_reference_block_number`, and `tx::extern_tx_get_block_commitment` now takes a block number (the new `extern_tx_get_reference_block_commitment` has the old shape). Prefer the safe wrappers. The `tx` extern changes are in neither the SDK changelog nor its migration notes.
- **Cycle counts moved.** Asset reads now execute a protocol procedure, and the kernel changed, so identical contracts cost different cycles (from compiler 0.10.2 to 0.11.0-rc.3, the basic-wallet P2ID consume went 5030 → 5008 cycles and the prologue 3473 → 3883). Do not hard-code cycle budgets across the upgrade.
- **Host code that mirrors felt encodings** (`miden-tx-script-args`, `miden-field-repr`) now sits on `miden-field` 0.33.0, where `Word` no longer has host-side `serde` derives. `Felt` is unchanged.
- **Coming from compiler 0.10.1** (the version the 0.16 guide was checked against): since 0.10.2, `cargo miden build` logging is configured with `MIDENC_TRACE` and `CARGO_MIDEN_LOG` is no longer read, and `midenc --manifest-path` is honored.

Additive in this line (no action needed):

- `tx::get_fee_asset_id() -> AssetId` and `tx::compute_fee(num_extra_cycles, exclude_notes_commitment) -> AssetAmount`. The SDK still binds no `miden::standards` fee procedures.
- `output_note::compute_note_id`, `input_note::find_note(NoteId) -> Option<NoteIdx>`, `input_note::get_note_id` / `get_asset` / `remove_asset` / `get_initial_num_assets`, and the matching `active_note::` functions.
- `storage::has_storage_slot(slot_id)` (also the `ActiveAccount::has_storage_slot` trait method), `native_account::has_state_changed` / `has_initial_asset`, the `NoteId` type and `tx::FOREIGN_PROCEDURE_SLOTS`.
- `#[note_script]` entrypoints may take `mut self`, which is needed to call `ActiveNote::remove_asset(&mut self, ..)`.
- Not bound yet: protocol `active_note::remove_all_assets`, `input_note::remove_all_assets` and `native_account::upgrade`.

---

## Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `invalid value: unsupported version. Got '[6, 0, 0]', but only '[7, 0, 0]' is supported` | A `.masp` built by midenc 0.10.x | Rebuild with cargo-miden 0.11. |
| `failed to deserialize dependency package '<path>'` | A dependency package built by the old toolchain | Rebuild the dependency first. |
| ``error[E0609]: no field `key` on type `Asset` `` | `Asset.key` renamed | Use `asset.id` or `asset.id.inner`. |
| `error[E0308]: mismatched types` ... ``expected `AssetId`, found `Word` `` | Vault queries take an `AssetId` | Pass `asset.id` or `AssetId::from(word)`. |
| ``error[E0425]: cannot find function `get_block_number` in module `tx` `` | Renamed | Use `tx::get_reference_block_number()`. |
| `error[E0061]: this function takes 1 argument but 0 arguments were supplied` | `tx::get_block_commitment` now takes a block number | Use `tx::get_reference_block_commitment()`. |
| ``error[E0425]: cannot find function `compute_commitment` in module `active_account` `` | Moved | Use `native_account::compute_commitment()`. |
| ``error[E0425]: cannot find function `write_attachment_to_memory` in module `note` `` | Renamed | Use `note::load_attachment` and its siblings. |
| ``error[E0603]: function `extern_output_note_get_assets_info` is private`` | Visibility reduced | Use `output_note::get_assets_info`. |
| `Undefined symbols for architecture arm64: "_miden::protocol::asset::id_into_composition"` (macOS linker output; other linkers report an undefined `miden::protocol::asset::id_into_composition` symbol) | A host unit test calls `is_fungible`, `amount` or an `AssetId` reader | Run the test on the VM / `MockChain`. |
| `unable to locate library 'miden-precompiles' using any of the provided search paths` | Explicit `-l miden-precompiles` | Drop the flag. |
| `transaction summary layout version is {actual} but only version 1 is supported` | Auth component hashes the 0.16 summary layout | Use the versioned layout. |
| `P2ID note expects exactly 4 note storage items` | Hand-built P2ID recipient with two storage items | Build four-item storage; the existing note cannot be recovered. |
| `the active account is not native` | `compute_commitment` reached through FPI | Keep it out of FPI-reachable procedures. |
