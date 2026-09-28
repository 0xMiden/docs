---
sidebar_position: 4
title: "Note Changes"
description: "P2ID storage gains two salt elements, every standard note script root changes, config notes move to note::config, and TX_FEE notes leave their assets in the note"
---

# Note Changes

:::warning Breaking Change
Every standard note script changed, so every script root hard-coded from 0.16 is wrong. P2ID storage grew from two items to four, which changes every P2ID recipient and note ID even with no code change, and a P2ID recipient still built by hand with two items produces a note nobody can consume. Config notes moved to `miden_standards::note::config`, and TX_FEE notes no longer hand their assets to the consumer, so a plain wallet can no longer consume one.
:::

## Quick Fix

```rust
// Before (0.16)
use miden_standards::note::{PauseConfig, PauseConfigNote};
let managed = note.account();

// After (0.17)
use miden_standards::note::config::{PauseConfig, PauseConfigNote};
let managed = note.target();
```

Then replace every hard-coded standard note script root with `P2idNote::script_root()`, `MintNote::script_root()`, `StandardNote::X.script().root()` and so on, taken from the version you run.

If you encounter errors, continue reading for detailed migration steps.

---

## Summary

Every standard note script was rewritten in 0.17: targeting and reclaiming moved into shared modules, storage is read with a bound, the MINT scripts were unified, config notes renamed "selector" to "variant" and must be public, P2ID gained a salt, and TX_FEE stopped moving assets. Together they change every standard script root, and none of them fails to compile. Notes built through the standard builders keep working; what breaks is anything that caches a root, matches an error string, or builds a standard note's storage by hand.

The Rust API changes do fail to compile, and they are mechanical: config notes moved to `note::config` and their `account()` getter became `target()`, `MintNoteStorage` collapsed to two variants, `StandardNote::num_storage_items` returns a `NumStorageItems`, `FeeSponsorshipNote` takes a `FungibleAsset`, `NoteExecutionHint` gained an `Unknown` variant, and `PswapNote::parent_depth` returns a `u32`.

Three changes fail only at run time: consuming a two-item P2ID note, consuming a TX_FEE note with an account that does not collect its assets, and consuming a hand-built private config note.

---

## P2ID storage has four items: script root, recipients and note IDs change

### Summary

P2ID note storage is now `[target_id_suffix, target_id_prefix, salt_0, salt_1]`: four items, with a salt that defaults to zero. The P2ID script root changes, so every P2ID recipient and note ID differs from 0.16, even with a zero salt.

The builder API is source compatible: `.target(id)` still works, and `.salt([Felt; 2])` is new. So nothing fails to compile. What breaks is code that builds P2ID recipients by hand with two storage items, parses 0.16 P2ID storage with `P2idNoteStorage::try_from(&[Felt])`, hard-codes the P2ID script root, or derives the SWAP or PSWAP payback recipient itself. AggLayer's public MINT payload grew from 22 to 24 elements with it.

A secret salt stops anyone from brute-forcing the target from the storage commitment. A zero salt gives no such protection, and the note tag still reveals bits derived from the target account.

:::danger A two-item P2ID recipient locks the assets
A recipient computed for the 0.17 P2ID script root with the old two-item storage still creates a note, but consuming it fails with `P2ID note expects exactly 4 note storage items`. P2ID has no reclaim path, so the assets in that note cannot be recovered. For contracts written with the `miden` SDK, see [Rust Contract SDK & Compiler](./rust-sdk-compiler).
:::

### Affected Code

**Rust**

```rust
// After (0.17): an optional salt hides the target from commitment guessing
let note: Note = P2idNote::builder()
    .sender(sender)
    .target(target)
    .salt(secret_salt) // [Felt; 2], sampled uniformly at random and kept private
    .serial_number(serial)
    .asset(asset)
    .build()?
    .into();
```

Without the note builder, build the recipient with `P2idNoteStorage::new(target).with_salt(salt).into_recipient(serial)`.

**MASM**

`p2id::prepare_note` and `p2id::create_output_note` keep their signatures and write a zero salt. The standard script's own `prepare_note` shows the new layout:

```masm
# Before (0.16) - notes/p2id.masm prepare_note
push.2 locaddr.STORAGE_PTR
# => [storage_ptr, num_storage_items=2, SERIAL_NUM, SCRIPT_ROOT, tag, note_type]
exec.note::compute_and_store_recipient
```

```masm
# After (0.17) - notes/p2id.masm prepare_note
push.0.0 loc_store.SALT_0_PTR loc_store.SALT_1_PTR
# ... movdn.5 movdn.5 procref.main swapw (unchanged)
push.NUM_STORAGE_ITEMS locaddr.STORAGE_PTR
# => [storage_ptr, num_storage_items=4, SERIAL_NUM, SCRIPT_ROOT, tag, note_type]
exec.note::compute_and_store_recipient
```

### Migration Steps

1. In Rust, build P2ID notes only through `P2idNote::builder()` or `P2idNoteStorage::new(target).with_salt(salt).into_recipient(serial)`.
2. In MASM, use `p2id::prepare_note` / `p2id::create_output_note` where possible. If you compute a P2ID recipient yourself, write four storage items and pass `num_storage_items = 4`.
3. Recompute every stored P2ID script root or recipient digest.
4. To keep the target private, set a random salt, keep it secret, and make sure the off-chain side derives the expected recipient with the same salt.
5. Do not parse the storage of 0.16 P2ID notes with the 0.17 `P2idNoteStorage::try_from`; re-create the note with 0.17.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `P2ID note expects exactly 4 note storage items` | Consuming a note that uses the 0.17 P2ID script with two-item storage | Build the recipient with `P2idNoteStorage`. A note already created this way cannot be recovered. |
| `the number of note storage items exceeds the maximum accepted by the note script` | More than four items (the script reads storage with `active_note::get_bounded_storage`) | Write exactly four. |
| `NoteError::InvalidNoteStorageLength { expected: 4, actual: 2 }` | `P2idNoteStorage::try_from` on 0.16 storage | Re-create the note with 0.17. |

---

## Every standard note script root changes

### Summary

Every standard note script was touched, so no script root hard-coded from 0.16 matches `XNote::script_root()` any more: P2ID, P2IDE, SWAP, PSWAP, MINT, BURN, TX_FEE, FEE_SPONSORSHIP and every config note. Nothing fails to compile; cached roots simply stop matching the notes you create.

Config note scripts now also assert that the note is public, so a hand-built private config note fails at consumption. The builders already produce public notes.

:::info The changelog names only the config notes
The changelog says only that the config note script roots change. The P2ID, P2IDE, SWAP, PSWAP, MINT, BURN, TX_FEE and fee-sponsorship roots change as well. The P2ID, MINT, PSWAP and TX_FEE entries describe the behaviour change without saying the root moves, and P2IDE, SWAP, BURN and fee-sponsorship are covered only by the shared-module and bounded-storage entries.
:::

### Migration Steps

1. Replace hard-coded note script roots with `P2idNote::script_root()`, `MintNote::script_root()`, `StandardNote::X.script().root()` and so on, from the version you run.
2. If you build config notes by hand, make them `NoteType::Public`.
3. Update string matches on consumption errors; see the next section.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `pause config note must be public` (one per config note: `<name> config note must be public`) | Hand-built private config note | Use the builder, or `NoteType::Public`. |
| Note script root mismatch | Root cached from a 0.16 build | Take the root from the 0.17 `StandardNote` API. |

---

## Standard note scripts share consumer checks, and their errors are renamed

### Summary

Standard note scripts now enforce targeting through `miden::standards::note::note_target` and reclaiming through `miden::standards::note::note_reclaim`, config notes renamed "selector" to "variant", and scripts with bounded storage load it through `active_note::get_bounded_storage`. The error messages change with them, and so do the constants generated from them in `miden_standards::errors::standards` (available with the `testing` feature), which lost 30 names. The selector → variant rename leaves the config note storage layouts unchanged; only constant names and messages move.

| 0.16 constant: message | 0.17 constant: message |
| --- | --- |
| `ERR_P2ID_TARGET_ACCT_MISMATCH`: `P2ID's target account address and transaction address do not match` | `ERR_NOTE_ACTIVE_ACCOUNT_IS_NOT_TARGET_ACCOUNT`: `the active account is not the target account the note commits to` |
| `ERR_<X>_CONFIG_TARGET_ACCOUNT_MISMATCH`: `<x> config note attachment target account does not match the consuming account` (X is ALLOWLIST, BLOCKLIST, FAUCET_METADATA, FAUCET_POLICY, MIN_BURN_AMOUNT, NETWORK_ACCOUNT, OWNER, PAUSE or RBAC), and `ERR_CONSTANT_FEE_POLICY_CONFIG_ACCOUNT_MISMATCH` | `ERR_NOTE_ACTIVE_ACCOUNT_IS_NOT_NETWORK_TARGET_ACCOUNT`: `the active account is not the target account named by the note's network account target attachment` |
| `ERR_<X>_CONFIG_UNKNOWN_SELECTOR`: `<x> config note selector does not match a known action` (every X above except MIN_BURN_AMOUNT) | `ERR_<X>_CONFIG_UNKNOWN_VARIANT`: `<x> config note variant does not match a known action` |
| `ERR_P2IDE_RECLAIM_DISABLED`, `ERR_FEE_SPONSORSHIP_RECLAIM_DISABLED` | `ERR_RECLAIM_DISABLED`: `note reclaim is disabled` |
| `ERR_P2IDE_RECLAIM_HEIGHT_NOT_REACHED`, `ERR_FEE_SPONSORSHIP_RECLAIM_HEIGHT_NOT_REACHED` | `ERR_RECLAIM_HEIGHT_NOT_REACHED`: `failed to reclaim the note because the reclaim block height is not reached yet` |
| `ERR_P2IDE_RECLAIM_ACCT_IS_NOT_RECLAIMER`, `ERR_FEE_SPONSORSHIP_RECLAIM_ACCT_IS_NOT_RECLAIMER` | `ERR_RECLAIM_ACCOUNT_IS_NOT_RECLAIMER`: `failed to reclaim the note because the reclaiming account is not the reclaimer` |
| `ERR_FUNGIBLE_MINT_NOTE_ASSET_NOT_FROM_THIS_FAUCET` | `ERR_MINT_NOTE_ASSET_NOT_FROM_THIS_FAUCET` |
| `ERR_TX_FEE_UNEXPECTED_NUMBER_OF_STORAGE_ITEMS`, `ERR_FEE_BOUND_DENOMINATOR_ZERO`, `ERR_FEE_PAYMENT_EXCEEDS_BOUND`, `ERR_FEE_PAYMENT_FAUCET_NOT_NATIVE` | Removed, with the fee-path changes |
| (none) | `ERR_<X>_CONFIG_NOTE_IS_NOT_PUBLIC`: `<x> config note must be public` (all ten config notes, including CONSTANT_FEE_POLICY) |
| (none) | `ERR_NOTE_TOO_MANY_STORAGE_ITEMS`: `the number of note storage items exceeds the maximum accepted by the note script` (a protocol constant, in `miden_protocol::errors::protocol`, also behind `testing`) |
| `ERR_P2ID_UNEXPECTED_NUMBER_OF_STORAGE_ITEMS`: `P2ID note expects exactly 2 note storage items` | Same name: `P2ID note expects exactly 4 note storage items` |
| `ERR_NON_FUNGIBLE_MINT_UNEXPECTED_NUMBER_OF_STORAGE_ITEMS`: `non-fungible MINT script expects exactly 9 storage items for private or 16+ storage items for public output notes` | Same name: `non-fungible MINT script expects exactly 13 storage items for private or 20+ storage items for public output notes` |

The AggLayer note scripts moved to `note_target` too: `ERR_B2AGG_TARGET_ACCOUNT_MISMATCH`, `ERR_CLAIM_TARGET_ACCT_MISMATCH`, `ERR_CONFIG_AGG_BRIDGE_TARGET_ACCOUNT_MISMATCH`, `ERR_DEREGISTER_AGG_FAUCET_TARGET_ACCOUNT_MISMATCH`, `ERR_REMOVE_GER_TARGET_ACCOUNT_MISMATCH` and `ERR_UPDATE_GER_TARGET_ACCOUNT_MISMATCH` are gone, replaced by `ERR_NOTE_ACTIVE_ACCOUNT_IS_NOT_NETWORK_TARGET_ACCOUNT`.

:::info The `Consumers:` line is a convention
The changelog says every note script now states who may consume it on a `Consumers:` line and enforces that. The line is a doc-comment convention of the standard scripts: nothing checks it, and your own note scripts do not need one.
:::

### Affected Code

The shared target check, as your own note script can now write it:

```masm
# Before (0.16) - notes/p2id.masm
exec.active_account::get_id
exec.account_id::eq assert.err=ERR_P2ID_TARGET_ACCT_MISMATCH
```

```masm
# After (0.17) - notes/p2id.masm
use miden::standards::note::note_target

exec.note_target::assert_active_account_is_target_account   # [target_id_suffix, target_id_prefix] -> []
```

Rust tests that assert the error code:

```rust
// Before (0.16)
use miden_standards::errors::standards::ERR_P2ID_TARGET_ACCT_MISMATCH;

// After (0.17)
use miden_standards::errors::standards::ERR_NOTE_ACTIVE_ACCOUNT_IS_NOT_TARGET_ACCOUNT;
```

### Migration Steps

1. Update tests that match standard-note error strings or `miden_standards::errors::standards::*` constants, per the table.
2. In your own note scripts, you can use `note_target::assert_active_account_is_target_account` / `assert_active_account_is_network_target_account`, `note_reclaim::assert_reclaimable`, and `active_note::get_bounded_storage` (`[dest_ptr, max_num_storage_items] -> [num_storage_items]`) for fixed-size storage buffers. None of this is mandatory.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `unresolved import` for a `miden_standards::errors::standards::ERR_*` constant | Constant renamed or removed | Use the 0.17 name from the table. |
| `the active account is not the target account the note commits to` | P2ID consumed by an account other than its target (0.16: `P2ID's target account address and transaction address do not match`) | Consume with the target account. |

---

## Config notes moved to `note::config`, and `account()` is now `target()`

### Summary

All ten config note types and their config enums are reachable only under `miden_standards::note::config`; the old `miden_standards::note::XConfigNote` paths are gone, with no re-export. Six of them also renamed their `account()` getter to `target()`, matching the builder field that was already called `target`. Non-config notes (`P2idNote`, `MintNote`, `BurnNote`, ...) stay in `miden_standards::note`.

Moved to `miden_standards::note::config`: `AllowlistConfig`, `AllowlistConfigNote`, `BlocklistConfig`, `BlocklistConfigNote`, `ConstantFeePolicyConfigNote`, `FaucetMetadataConfig`, `FaucetMetadataConfigNote`, `FaucetPolicyConfig`, `FaucetPolicyConfigNote`, `MinBurnAmountConfigNote`, `NetworkAccountConfig`, `NetworkAccountConfigNote`, `OwnerConfig`, `OwnerConfigNote`, `PauseConfig`, `PauseConfigNote`, `RbacConfig`, `RbacConfigNote`.

`account()` → `target()` on `ConstantFeePolicyConfigNote`, `FaucetPolicyConfigNote`, `NetworkAccountConfigNote`, `OwnerConfigNote`, `PauseConfigNote` and `RbacConfigNote`. The other four already used `target()`.

:::info Missing from the changelog
The changelog lists the move to `note::config`, but not the `account()` → `target()` rename.
:::

### Affected Code

```rust
// Before (0.16)
use miden_standards::note::{PauseConfig, PauseConfigNote};

let note = PauseConfigNote::builder()
    .sender(admin)
    .target(managed)
    .config(PauseConfig::Pause)
    .serial_number(serial)
    .build()?;
assert_eq!(note.account(), managed);
```

```rust
// After (0.17)
use miden_standards::note::config::{PauseConfig, PauseConfigNote};

let note = PauseConfigNote::builder()
    .sender(admin)
    .target(managed)
    .config(PauseConfig::Pause)
    .serial_number(serial)
    .build()?;
assert_eq!(note.target(), managed);
```

### Migration Steps

1. Change `use miden_standards::note::{..ConfigNote..}` to `use miden_standards::note::config::{..}` for every type listed above.
2. Rename `.account()` to `.target()` on the six types listed.
3. If you build a config note by hand rather than through the builder, make it `NoteType::Public`: the 0.17 config note scripts reject non-public notes.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `unresolved import miden_standards::note::PauseConfigNote` | Moved | Import `miden_standards::note::config::PauseConfigNote`. |
| `no method named account found for struct PauseConfigNote` | Getter renamed | Use `.target()`. |

---

## TX_FEE notes leave their assets in the note

### Summary

The TX_FEE note script no longer calls `basic_wallet::move_note_assets_to_account` on the consumer; it only checks that the note has no storage. The consuming account's own code must remove the assets from the note. Assets left in a consumed note are neither in the vault nor in an output note, so the transaction epilogue's asset-preservation check fails: **a plain wallet account can no longer consume a TX_FEE note**.

The new `AuthTxFeeCollector` auth component collects them. It forwards the single asset of every consumed note into one P2ID note for a target given in the auth args. The TX_FEE script root, and with it every TX_FEE note ID, changes.

This matters little for most applications, and a lot for batch builders and for anything that consumes every note it receives.

:::info Incomplete changelog entry
The changelog says TX_FEE notes leave their assets in the note for the consuming account's own code to collect. It does not say that a consumer which does not collect them fails with `total number of assets in the account and all involved notes must stay the same`; the change's own test asserts exactly that.
:::

### Affected Code

```masm
# Before (0.16) - notes/tx_fee.masm main
push.STORAGE_PTR exec.active_note::get_storage
eq.0 assert.err=ERR_TX_FEE_UNEXPECTED_NUMBER_OF_STORAGE_ITEMS
exec.basic_wallet::move_note_assets_to_account
```

```masm
# After (0.17) - notes/tx_fee.masm main
push.NUM_STORAGE_ITEMS push.STORAGE_PTR exec.active_note::get_bounded_storage drop
```

### Migration Steps

1. Consume TX_FEE notes only with an account whose code collects note assets: an account with `AuthTxFeeCollector` (plus a component such as `BasicWallet`), or custom account code that removes each fee asset by note index (`input_note::remove_asset` or `input_note::remove_all_assets`) and adds it to the vault (`native_account::add_asset`) or to an output note (`output_note::add_asset`). That code must run as an account procedure outside the TX_FEE script: in the auth procedure, as `AuthTxFeeCollector` does, or in a procedure your transaction script `call`s (the transaction script runs after every note script). The `active_note::*` procedures cannot reach TX_FEE assets: they act on the note whose script is running, and the TX_FEE script never calls into the account.
2. Remove TX_FEE notes from any "consume everything" wallet flow. `NoteConsumptionChecker::can_consume` and `StandardNote::is_consumable` still report a TX_FEE note as `ConsumableWithAuthorization` for every account, without executing it, so filter TX_FEE notes out yourself, by script root (`TxFeeNote::script_root()`) or tag (`TxFeeNote::TAG`).
3. Recompute any cached TX_FEE script root or TX_FEE note ID.

How fees are paid in 0.17 is covered in [Transaction Changes](./transaction-changes).

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `total number of assets in the account and all involved notes must stay the same` | TX_FEE note consumed without collecting its assets | Collect them in account code, for example with `AuthTxFeeCollector`. |

---

## `MintNoteStorage` collapsed to `Private` / `Public`; MINT scripts unified

### Summary

The non-fungible MINT note now stores the full asset, like the fungible one. `MintNoteStorage` therefore has two variants holding an `Asset` instead of four holding typed assets, and its constructors lost the `fungible` / `non_fungible` qualifier.

The `MintNote` and `BurnNote` builders now add a `NetworkAccountTarget` attachment for the faucet only when the faucet is public, and reject a caller-supplied one that names another account. In 0.16, the `BurnNote` builder always added one, so it failed for a private faucet, and the `MintNote` builder added none, so MINT notes for a public faucet now carry one.

In MASM, `miden::standards::notes::mint_fungible` and `mint_non_fungible` became the private `notes::mint::fungible` and `notes::mint::non_fungible`, and the MINT script root changes; see [MASM Changes](./masm-changes). The non-fungible MINT storage layout grew with the full asset; see [Assets, Vault & Faucet](./asset-vault-faucet).

### Affected Code

```rust
// Before (0.16)
use miden_standards::note::{MintNote, MintNoteStorage};

let storage = MintNoteStorage::new_fungible_private(recipient_digest, fungible_asset, tag);
let storage = MintNoteStorage::new_non_fungible_public(recipient, nft, tag)?;
let faucet = match note.storage() {
    MintNoteStorage::FungiblePrivate { asset, .. } | MintNoteStorage::FungiblePublic { asset, .. } => asset.faucet_id(),
    MintNoteStorage::NonFungiblePrivate { asset, .. } | MintNoteStorage::NonFungiblePublic { asset, .. } => asset.faucet_id(),
};
```

```rust
// After (0.17)
use miden_protocol::asset::Asset;
use miden_standards::note::{MintNote, MintNoteStorage};

let storage = MintNoteStorage::new_private(recipient_digest, fungible_asset, tag);
let storage = MintNoteStorage::new_public(recipient, nft, tag)?;
let asset: Asset = note.storage().asset();
let faucet = note.storage().faucet_id();
```

The builder call itself is unchanged: `MintNote::builder().sender(..).mint_storage(storage).serial_number(..).build()?`.

### Migration Steps

1. Rename `new_fungible_private` / `new_non_fungible_private` to `new_private`, and `new_fungible_public` / `new_non_fungible_public` to `new_public`. Both take `impl Into<Asset>`.
2. Replace matches on the four old variants with `MintNoteStorage::Private { .. }` / `Public { .. }`, or use the new `asset()` accessor.
3. Do not add your own `NetworkAccountTarget` naming another account to a MINT or BURN note; the builder now errors on it. For a public faucet, the builder adds the target for you.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `no function or associated item named new_fungible_private found for enum MintNoteStorage` | Constructors renamed | Use `new_private` / `new_public`. |
| `failed to target the MINT note at its faucet` / `failed to target the BURN note at its faucet` (`NoteError::Other`) | A caller-supplied `NetworkAccountTarget` names a different account | Drop the attachment, or target the faucet. |
| `non-fungible MINT script expects exactly 13 storage items for private or 20+ storage items for public output notes` | A hand-built non-fungible MINT note with the 0.16 layout (a 0.16 public layout with 20 or more items takes the public path and fails later instead) | Build it with `MintNote` and `MintNoteStorage`. |

---

## `StandardNote::num_storage_items` returns `NumStorageItems`

### Summary

`StandardNote::expected_num_storage_items() -> usize` is replaced by `StandardNote::num_storage_items() -> NumStorageItems`, an enum with `Exact(usize)`, `Range { min, max }` and `AnyOf(&[..])` variants and an `accepts(n)` method. Notes with a variable storage size changed their constants to match.

### Affected Code

```rust
// Before (0.16)
use miden_standards::note::{OwnerConfigNote, RbacConfigNote, StandardNote};

let ok = note.storage().num_items() as usize == StandardNote::P2ID.expected_num_storage_items();
let max_owner = OwnerConfigNote::MAX_NUM_STORAGE_ITEMS; // 3
let max_rbac = RbacConfigNote::MAX_NUM_STORAGE_ITEMS;   // 4
```

```rust
// After (0.17)
use miden_standards::note::config::{OwnerConfigNote, RbacConfigNote};
use miden_standards::note::{NumStorageItems, StandardNote};

let ok = StandardNote::P2ID.num_storage_items().accepts(note.storage().num_items() as usize);
let owner: NumStorageItems = OwnerConfigNote::NUM_STORAGE_ITEMS; // AnyOf(&[Exact(1), Exact(3)])
let rbac: NumStorageItems = RbacConfigNote::NUM_STORAGE_ITEMS;   // Range { min: 2, max: 4 }
```

Also changed: `MintNote::NUM_STORAGE_ITEMS: NumStorageItems` was added, and `MintNote::NON_FUNGIBLE_NUM_STORAGE_ITEMS_PRIVATE` / `NON_FUNGIBLE_MIN_NUM_STORAGE_ITEMS_PUBLIC` were removed. `FaucetMetadataConfigNote::NUM_STORAGE_ITEMS: NumStorageItems` was added next to the unchanged `MAX_NUM_STORAGE_ITEMS`.

### Migration Steps

1. Replace `x.expected_num_storage_items() == n` with `x.num_storage_items().accepts(n)`.
2. Replace `OwnerConfigNote::MAX_NUM_STORAGE_ITEMS` / `RbacConfigNote::MAX_NUM_STORAGE_ITEMS` with `NUM_STORAGE_ITEMS`, and use `accepts`.
3. Replace the `MintNote::NON_FUNGIBLE_*` constants with `MintNote::NUM_STORAGE_ITEMS_PRIVATE` / `MIN_NUM_STORAGE_ITEMS_PUBLIC`; the two layouts were unified.

---

## `FeeSponsorshipNote` holds a `FungibleAsset` and exposes `tag()`

### Summary

The builder's `asset` setter takes a `FungibleAsset` instead of any `impl Into<Asset>`. The target account is no longer stored, so `target_id()` is replaced by `tag()`. The note can now be parsed back from a `Note` with `TryFrom<&Note>`, and it gained the accessors `sender()`, `serial_number()` and `asset()` and the constant `NUM_ASSETS = 1`.

### Affected Code

```rust
// Before (0.16)
let sponsorship = FeeSponsorshipNote::builder()
    .sender(sponsor)
    .target_account(network_account)
    .feature_note_id(feature_note.id())
    .asset(fee_asset)                 // any `impl Into<Asset>`
    .generate_serial_number(&mut rng)
    .build()?;
let target = sponsorship.target_id();
```

```rust
// After (0.17)
let sponsorship = FeeSponsorshipNote::builder()
    .sender(sponsor)
    .target_account(network_account)
    .feature_note_id(feature_note.id())
    .asset(FungibleAsset::new(fee_faucet, amount)?) // must be a FungibleAsset
    .generate_serial_number(&mut rng)
    .build()?;
let tag = sponsorship.tag();
let parsed = FeeSponsorshipNote::try_from(&note)?;
```

### Migration Steps

1. Pass a `FungibleAsset` to `.asset(..)`. Convert an `Asset` with `asset.as_fungible()`, which returns `None` for a non-fungible asset.
2. Replace `target_id()` with `tag()`, or keep the target account ID yourself.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `no method named target_id found for struct FeeSponsorshipNote` | Accessor removed | Use `tag()`. |
| `error[E0308]: mismatched types` (expected `FungibleAsset`, found `Asset`) | The builder setter no longer converts | Pass a `FungibleAsset`. |

---

## `NoteExecutionHint` gains `Unknown(Felt)` and drops its `u64` conversions

### Summary

Decoding a `NetworkAccountTarget` attachment no longer fails on an unrecognized execution hint: the hint decodes to the new `NoteExecutionHint::Unknown(Felt)`, and the target ID is kept. The `u64` round trip was replaced by `Felt`, and `into_parts()` returns an `Option`. The client re-export, `miden_client::note::NoteExecutionHint`, changes the same way.

:::info What the changelog leaves out
The changelog entry describes only the decoding fix. It does not mention the new `Unknown(Felt)` variant, `into_parts()` returning `Option<(u8, u32)>`, the removed `u64` conversions, or the removed `NetworkAccountTargetError::DecodeExecutionHint`.
:::

### Affected Code

```rust
// Before (0.16)
let raw: u64 = hint.into();
let decoded = NoteExecutionHint::try_from(raw)?;
let (tag, payload) = hint.into_parts();
```

```rust
// After (0.17)
let raw: Felt = hint.into();
let decoded = NoteExecutionHint::from(raw); // infallible; unknown encodings become Unknown(raw)
let parts: Option<(u8, u32)> = hint.into_parts(); // None for Unknown
```

### Migration Steps

1. Add a `NoteExecutionHint::Unknown(_)` arm to exhaustive matches; the enum is not `#[non_exhaustive]`.
2. Replace `u64` conversions with `Felt` conversions.
3. Handle `into_parts()` returning `Option`.
4. Remove matches on `NetworkAccountTargetError::DecodeExecutionHint`; the variant was removed.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `error[E0004]: non-exhaustive patterns: NoteExecutionHint::Unknown(_) not covered` | New variant | Add the arm. |
| `error[E0277]` on `NoteExecutionHint::try_from(u64)` (`From<u64>` is not implemented) | `TryFrom<u64>` removed | Use `NoteExecutionHint::from(Felt)`. |

---

## PSWAP: `parent_depth` is `u32`, and the script root changes

### Summary

`PswapNote::parent_depth()` returns a `u32` instead of a `u64`. The builder rejects a PSWAP attachment that is not exactly one zero-padded word or whose depth does not fit a `u32`, and `PswapNoteAttachment` gained a validating `TryFrom<&NoteAttachment>`. The PSWAP note script root changes: fills are now priced against the note's initial offered asset rather than its remaining assets, and the script bounds its lineage depth to a `u32` and rejects a malformed attachment. Existing notes keep the script they were created with.

:::info
The changelog lists the PSWAP behaviour changes, but not the `parent_depth()` return-type change.
:::

### Affected Code

```rust
// Before (0.16)
let depth: u64 = pswap_note.parent_depth();
```

```rust
// After (0.17)
let depth: u32 = pswap_note.parent_depth();
let attachment = PswapNoteAttachment::try_from(&note_attachment)?; // new, validating
```

### Migration Steps

1. Change `parent_depth()` consumers to `u32`.
2. Do not match PSWAP notes by a cached script root. Use `PswapNote::script_root()` from the version you run, and expect notes created by an older version to carry the older root.
3. Do not remove assets from a PSWAP note before its script runs: the script now asserts that the offered asset still equals the one the note was created with.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `PSWAP offered asset differs from the asset the note was created with` | Assets were removed from the PSWAP note before its script ran | Leave PSWAP note assets to the PSWAP script. |
| `PSWAP attachment must consist of exactly one word` / `PSWAP parent depth carried in the consumed note attachment is not a u32` / `PSWAP lineage depth exceeds u32` | Consuming a PSWAP note with a malformed attachment, or at the maximum lineage depth | Build PSWAP notes with the `PswapNote` builder, which rejects malformed attachments. |

---

## Other note changes

- **Note metadata carries a version.** The note type moved from bit 4 to bit 6 of the metadata, so the metadata word, note commitment and note ID of every public note change, and 0.16 note bytes do not load. See [Accounts, asset IDs and note metadata carry versions](./account-changes#accounts-asset-ids-and-note-metadata-carry-versions).
- **Standards MASM modules moved.** `miden::standards::note_tag` is now `miden::standards::note::note_tag`, `miden::standards::note::execution_hint` is now `miden::standards::note::note_execution_hint`, and the per-kind MINT modules are private. See [MASM Changes](./masm-changes).
- **Emitting a note to a network account caps the transaction at 20 blocks.** See [Transaction Changes](./transaction-changes).
- **`NoteFile` moved to the new `miden-objects` crate and is Protobuf-encoded**, so note files exported with 0.16 do not load. See [Imports & Dependencies](./imports-dependencies) and [Client Changes](./client-changes).

---

## Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `P2ID note expects exactly 4 note storage items` | P2ID recipient built by hand with two storage items | Build it with `P2idNote::builder()` or `P2idNoteStorage`; the note already created cannot be recovered. |
| Note script root mismatch | Standard script root cached from 0.16 | Take the root from the 0.17 `StandardNote` API. |
| `the active account is not the target account the note commits to` | A targeted note consumed by another account | Consume with the target account. |
| `<name> config note must be public` | Hand-built private config note | Use the builder, or `NoteType::Public`. |
| `unresolved import miden_standards::note::PauseConfigNote` (or another config note) | Config notes moved | Import from `miden_standards::note::config`. |
| `no method named account found for struct PauseConfigNote` | Getter renamed | Use `.target()`. |
| `total number of assets in the account and all involved notes must stay the same` | TX_FEE note consumed without collecting its assets | Consume it with `AuthTxFeeCollector` or custom collecting code. |
| `no function or associated item named new_fungible_private found for enum MintNoteStorage` | Constructors renamed | Use `new_private` / `new_public`. |
| `no method named target_id found for struct FeeSponsorshipNote` | Accessor removed | Use `tag()`. |
| `error[E0004]: non-exhaustive patterns: NoteExecutionHint::Unknown(_) not covered` | New variant | Add the arm. |
