---
sidebar_position: 5
title: "Assets, Vault & Faucet Changes"
description: "Asset becomes a struct of AssetId + AssetValue, AccountVaultDelta tracks whole assets, asset IDs carry a version, and every standard faucet gets a new ID"
---

# Assets, Vault & Faucet Changes

:::warning Breaking Change
`Asset` is no longer an enum. It is a struct holding an `AssetId` and an `AssetValue`, so every `match` on `Asset::Fungible(..)` / `Asset::NonFungible(..)` stops compiling. `AccountVaultDelta` now records whole assets added or removed: `fungible()` and `FungibleAssetDelta` are gone from both the Rust crates and the Web SDK. Separately, asset IDs carry a version, so vault keys, vault roots, asset commitments and the IDs of notes carrying assets all change value without any compile error, and a stored 0.16 fungible asset ID word now decodes as a non-fungible one.
:::

## Quick Fix

```rust
// Before (0.16)
let amount = match asset {
    Asset::Fungible(f) => Some(f.amount().as_u64()),
    Asset::NonFungible(_) => None,
};
let asset = Asset::from_id_and_value(id, value)?;
```

```rust
// After (0.17)
let amount = asset.as_fungible().map(|f| f.amount().as_u64());
let asset = Asset::new(id, value)?;
```

If you encounter errors, continue reading for detailed migration steps.

---

## Summary

This page holds three groups of change. The asset types were reshaped: `Asset` became a struct and `AccountVaultDelta` became a single map of whole-asset deltas. Both fail to compile until you migrate, and both are mechanical. The asset ID gained a version: nothing fails to compile, but every stored asset ID word, vault key and serialized asset from 0.16 stops matching or loading, and a 0.16 fungible asset ID word even decodes, without error, as a non-fungible asset. The faucet side changed behaviour: every standard faucet gets a new ID from the same seed, a faucet with a transfer policy now gets the asset-callback flag automatically, the faucet factories reject owner-only mint or burn policies they cannot enforce, and the MASM interfaces for asset callbacks, transfer policies, mint policies and non-fungible minting narrowed. The faucet changes mostly compile unchanged (exhaustive matches on the faucet error enums aside) and surface when you build the faucet or run a transaction.

:::note Changelog heading
The protocol CHANGELOG files several changes on this page (callbacks enabled by the factories, callback roots checked against the faucet's code, the non-fungible MINT binding, the zero-amount mint check, the fungibility check in `receive_and_burn`, the 1024-asset vault delta limit, the expiration bound on transfer-policy dispatch) under a heading `v0.16.0 (2026-08-06)`. None of them is in 0.16.1: they ship in 0.17.
:::

---

## `Asset` is a struct of `AssetId` + `AssetValue`

### Summary

`Asset` no longer has `Fungible(..)` / `NonFungible(..)` variants. It is an opaque struct holding an `AssetId` and an `AssetValue` (a `Word` wrapper). `FungibleAsset` and `NonFungibleAsset` still exist and still convert into `Asset`, but getting them back out is now an explicit, fallible conversion. `Asset::from_id_and_value` was renamed to `Asset::new`, and `Asset::unwrap_non_fungible`, `AssetVault::has_non_fungible_asset` and `NoteAssets::iter_non_fungible` were removed.

### Affected Code

```rust
// Before (0.16)
use miden_protocol::asset::{Asset, AssetId, AssetVault, NonFungibleAsset};
use miden_protocol::note::Note;
use miden_protocol::{Word, errors::AssetError};

fn fungible_amount(asset: &Asset) -> Option<u64> {
    match asset {
        Asset::Fungible(f) => Some(f.amount().as_u64()),
        Asset::NonFungible(_) => None,
    }
}

fn nft_from_parts(id: AssetId, value: Word) -> Result<NonFungibleAsset, AssetError> {
    let asset = Asset::from_id_and_value(id, value)?;
    Ok(asset.unwrap_non_fungible())
}

fn holds(vault: &AssetVault, nft: NonFungibleAsset) -> bool {
    vault.has_non_fungible_asset(nft).unwrap_or(false)
}

fn nfts(note: &Note) -> Vec<NonFungibleAsset> {
    note.assets().iter_non_fungible().collect()
}
```

```rust
// After (0.17)
use miden_protocol::asset::{Asset, AssetId, AssetVault, NonFungibleAsset};
use miden_protocol::note::Note;
use miden_protocol::{Word, errors::AssetError};

fn fungible_amount(asset: &Asset) -> Option<u64> {
    asset.as_fungible().map(|f| f.amount().as_u64())
}

fn nft_from_parts(id: AssetId, value: Word) -> Result<NonFungibleAsset, AssetError> {
    let asset = Asset::new(id, value)?;
    NonFungibleAsset::from_id_and_value(asset.id(), asset.to_value_word())
}

fn holds(vault: &AssetVault, nft: NonFungibleAsset) -> bool {
    vault.get(nft.id()).is_some()
}

fn nfts(note: &Note) -> Vec<NonFungibleAsset> {
    note.assets()
        .iter()
        .filter_map(|a| NonFungibleAsset::from_id_and_value(a.id(), a.to_value_word()).ok())
        .collect()
}
```

Unchanged, and still the shortest path: `Asset::from(FungibleAsset::new(faucet_id, amount)?)`, `FungibleAsset::new(..)?.into()`, `NonFungibleAsset::new(&details).into()`, `asset.id()`, `asset.faucet_id()`, `asset.is_fungible()`, `asset.is_non_fungible()`, `asset.unwrap_fungible()`, `asset.to_id_word()`, `asset.to_value_word()`, `Asset::from_id_and_value_words(..)` and `NoteAssets::iter_fungible()`.

New: `Asset::value() -> AssetValue`, `Asset::as_fungible() -> Option<FungibleAsset>`, and `AssetValue` itself (re-exported from `miden_protocol::asset`; convert with `Word::from(value)` or `value.as_word()`).

:::caution `is_non_fungible()` no longer means "is a valid `NonFungibleAsset`"
`is_non_fungible()` now only means the asset's composition is `AssetComposition::None`. Neither the transaction kernel nor `Asset::new` validates the non-fungible layout for such assets any more. When you need the typed asset, convert with `NonFungibleAsset::from_id_and_value`, which still validates it.
:::

**Web SDK:** this is a Rust-only change. The JavaScript `FungibleAsset` surface is unchanged, but its vault keys change value (see [Asset IDs carry a version](#asset-ids-carry-a-version-vault-keys-commitments-and-note-ids-change)).

:::caution The Web SDK 0.16.3 asset API is not in the 0.17 release candidates
Web SDK 0.16.3 added `VaultAsset`, `NonFungibleAsset`, `AssetVault.assets()` / `nonFungibleAssets()` and `NoteAssets.assets()` / `nonFungibleAssets()`. None of it is in `0.17.0-rc.4`, where `NoteAssets` takes `FungibleAsset[]` only. See [Client Changes](./client-changes).
:::

### Migration Steps

1. Replace every `match asset { Asset::Fungible(f) => .., Asset::NonFungible(nf) => .. }` with `if let Some(f) = asset.as_fungible() { .. } else { .. }`, or branch on `asset.is_fungible()`.
2. Rename `Asset::from_id_and_value(id, value)` to `Asset::new(id, value)`.
3. Replace `asset.unwrap_non_fungible()` with `NonFungibleAsset::from_id_and_value(asset.id(), asset.to_value_word())?`.
4. Replace `vault.has_non_fungible_asset(nft)?` with `vault.get(nft.id()).is_some()`.
5. Replace `note_assets.iter_non_fungible()` with a filter over `iter()`, as shown.
6. If you match on `NoteError::DuplicateNonFungibleAsset(x)`, `x` is now an `Asset`. The same holds for `AssetVaultError::DuplicateNonFungibleAsset` and `AssetVaultError::NonFungibleAssetNotFound`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `` error[E0599]: no associated function or constant named `Fungible` found for struct `Asset` `` | Pattern on the removed enum variant | Use `asset.as_fungible()` / `asset.is_fungible()`. |
| `` error[E0599]: no associated function or constant named `from_id_and_value` found for struct `Asset` `` | Renamed | `Asset::new(id, value)`. |
| `` error[E0599]: no method named `unwrap_non_fungible` found for struct `Asset` `` | Removed | `NonFungibleAsset::from_id_and_value(asset.id(), asset.to_value_word())`. |
| `` error[E0599]: no method named `has_non_fungible_asset` found for reference `&AssetVault` `` | Removed | `vault.get(nft.id()).is_some()`. |
| `` error[E0599]: no method named `iter_non_fungible` found for reference `&NoteAssets` `` | Removed | Filter `iter()`. |

---

## `AccountVaultDelta` tracks whole assets

### Summary

`AccountVaultDelta` is now one map of `AssetDelta { delta_op, asset }` keyed by `AssetId`, matching what the transaction kernel records. A fungible change is an `Add` or `Remove` of a `FungibleAsset` carrying the absolute amount of the change. The delta is immutable after construction: `fungible()`, `non_fungible()`, `add_asset()` and `remove_asset()` are gone, and `FungibleAssetDelta`, `NonFungibleAssetDelta` and `NonFungibleDeltaAction` were removed. A delta holds at most `AccountVaultDelta::MAX_ASSETS_PER_DELTA_OP` (1024) assets per direction, and the limit is enforced both inside and outside the transaction kernel.

### Affected Code (Rust)

Reading a balance change:

```rust
// Before (0.16)
use miden_protocol::asset::AssetId;
use miden_protocol::transaction::TransactionSummary;

fn balance_change(summary: &TransactionSummary, asset_id: AssetId) -> i64 {
    summary.account_delta().vault().fungible().amount(&asset_id).unwrap_or(0)
}
```

```rust
// After (0.17)
use miden_protocol::account::delta::AssetDeltaOperation;
use miden_protocol::asset::AssetId;
use miden_protocol::transaction::TransactionSummary;

fn balance_change(summary: &TransactionSummary, asset_id: AssetId) -> i64 {
    let Some(delta) = summary.account_delta().vault().iter().find(|d| d.asset_id() == asset_id)
    else {
        return 0;
    };
    let amount = delta.asset().unwrap_fungible().amount().as_u64() as i64;
    match delta.delta_op() {
        AssetDeltaOperation::Add => amount,
        AssetDeltaOperation::Remove => -amount,
    }
}
```

Building a delta by hand:

```rust
// Before (0.16)
let mut delta = AccountVaultDelta::default();
delta.add_asset(asset)?;
```

```rust
// After (0.17)
use miden_protocol::account::{AccountVaultDelta, AssetDelta};
use miden_protocol::account::delta::AssetDeltaOperation;

let delta = AccountVaultDelta::new([AssetDelta::new(AssetDeltaOperation::Add, asset)])?;
```

`added_assets()` and `removed_assets()` still exist with the same signatures. `AccountVaultDelta::from_iters(added, removed)` still exists under the `testing` feature.

### Affected Code (Web)

The Web SDK dropped `AccountVaultDelta.fungible()`, `FungibleAssetDelta` and `FungibleAssetDeltaItem`. `addedFungibleAssets()` and `removedFungibleAssets()` still return the magnitude of each change, and `numAssets()` is new.

```typescript
// Before (0.16)
const change = delta.fungible().amount(faucetId); // bigint | undefined, signed
```

```typescript
// After (0.17)
const hex = faucetId.toString();
const added = delta.addedFungibleAssets().find((a) => a.faucetId().toString() === hex)?.amount() ?? 0n;
const removed = delta.removedFungibleAssets().find((a) => a.faucetId().toString() === hex)?.amount() ?? 0n;
const change = added - removed;
const touched = delta.numAssets();
```

### Migration Steps

1. **Rust:** replace `vault_delta.fungible().amount(&id)` / `.iter()` and `vault_delta.non_fungible().iter()` with `vault_delta.iter()` (which yields `&AssetDelta`), or with `added_assets()` / `removed_assets()`.
2. **Rust:** replace `add_asset` / `remove_asset` mutation with a single `AccountVaultDelta::new(..)?` call over an iterator of `AssetDelta`. The two-argument `AccountVaultDelta::new(fungible, non_fungible)` is gone, and the new one is fallible: it rejects the same asset twice (`AccountDeltaError::DuplicateAssetDelta`) and more than 1024 assets per direction (`AccountDeltaError::TooManyVaultAssetDeltas`).
3. **Rust:** drop imports of `FungibleAssetDelta`, `NonFungibleAssetDelta` and `NonFungibleDeltaAction`. Import `AssetDelta` from `miden_protocol::account` and `AssetDeltaOperation` from `miden_protocol::account::delta`.
4. **Rust:** if you match on `AccountDeltaError`, the variants `DuplicateNonFungibleVaultUpdate`, `FungibleAssetDeltaOverflow` and `NotAFungibleFaucetId` are gone.
5. **Web:** compute a signed change as `added - removed` from `addedFungibleAssets()` and `removedFungibleAssets()`, and drop the `FungibleAssetDelta` import.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `` error[E0599]: no method named `fungible` found for reference `&AccountVaultDelta` `` | Accessor removed | Iterate `vault().iter()`. |
| `error[E0432]: unresolved import` for `FungibleAssetDelta` / `NonFungibleDeltaAction` | Types removed | Use `AssetDelta` / `AssetDeltaOperation`. |
| `asset {0} is changed by more than one asset delta` | Same `AssetId` twice in `AccountVaultDelta::new` | Merge into one delta per asset. |
| `number of {delta_op} operations in account vault delta is {num_ops} but max is 1024` | More than 1024 adds or removes | Split the transaction. |
| `Property 'fungible' does not exist on type 'AccountVaultDelta'.` (TS2339) | Removed in the Web SDK | Use the added and removed lists. |
| `'"@miden-sdk/miden-sdk"' has no exported member named 'FungibleAssetDelta'. Did you mean 'FungibleAsset'?` (TS2724) | Removed type | Drop the import. |

---

## Asset IDs carry a version: vault keys, commitments and note IDs change

### Summary

The metadata byte in the third element of an asset ID word is now `[reserved(2) | composition(2) | version(4)]`, with version 1. A fungible asset ID's low byte goes from `0x01` to `0x11`, and a non-fungible one's from `0x00` to `0x01`. Everything derived from the asset ID changes with it: asset vault keys (`AssetIdHash`), vault roots, note asset commitments, and therefore the IDs of notes that carry assets. A word with version 0 no longer decodes as an `AssetId`: that covers a 0.16 non-fungible asset ID word (`0x00`) and an all-zero word.

:::danger A 0.16 fungible asset ID word decodes as a non-fungible asset
A 0.16 fungible asset ID word does not fail to decode. Its metadata byte `0x01` reads as version 1 with composition `None`, so `AssetId::try_from` returns a valid non-fungible asset ID for the same faucet, and `Asset::from_id_and_value_words` returns an asset whose `is_fungible()` is `false` and `as_fungible()` is `None`. The transaction kernel's asset validation accepts it too. Only a typed conversion notices: `FungibleAsset::from_id_and_value_words` fails with `asset composition mismatch for faucet {faucet_id}: expected Fungible, found None`. Do not rely on decode errors to find stale fungible asset ID words; recompute them with 0.17.
:::

The serialized forms of `AssetId`, `FungibleAsset` and `Asset`, and so of vaults, notes and vault deltas, now lead with a version byte, so asset bytes written by 0.16 do not deserialize. How they fail depends on the asset. 0.16 non-fungible `AssetId` and `Asset` bytes lead with `0x00` and fail the version check. 0.16 fungible `AssetId`, `FungibleAsset` and `Asset` bytes lead with `0x01`, which passes as version 1, and then fail on the next byte (the first byte of the faucet ID, read as the composition), usually with `unknown asset composition encoding: {n}`. A standalone `NonFungibleAsset` serialization is unchanged and still loads. Nothing fails to compile.

In the Web SDK, `FungibleAsset.vaultKey()` returns the asset ID word, so it returns a different word than in 0.16, and `FungibleAsset.fromVaultKey` / `fromVaultEntry` given a key stored by 0.16 throw `Failed to create FungibleAsset: asset composition mismatch for faucet {faucet_id}: expected Fungible, found None`.

The same release versions accounts and note metadata; see [Account Changes](./account-changes) and [Note Changes](./note-changes). MASM code that assembles asset ID words by hand is covered in [MASM Changes](./masm-changes).

### Affected Code

```rust
// A 0.16 layout assumption that breaks silently in 0.17
let fungible_id_low_byte = asset_id.to_word()[2].as_canonical_u64() & 0xff; // 0x01 in 0.16, 0x11 in 0.17
```

```rust
// After (0.17): build IDs with the constructors, never by hand
let id = AssetId::new_fungible(faucet_id);
```

### Migration Steps

1. Discard stored 0.16 serializations of asset IDs and assets (and of anything containing them: vaults, notes, deltas), and re-fetch or rebuild them with 0.17.
2. Recompute every stored or hardcoded asset ID word, vault key, asset commitment or note ID: test vectors, fixtures, off-chain indexers, and bridge contracts that mirror Miden encodings. Do not wait for a decode error to find them: a 0.16 fungible asset ID word decodes without one, as a non-fungible ID.
3. Build asset IDs with `AssetId::new` / `AssetId::new_fungible`, never by assembling the word yourself.
4. **Web:** re-read vault keys with 0.17 instead of passing keys stored by 0.16 to `FungibleAsset.fromVaultKey` / `fromVaultEntry`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `asset version is {n} but only version 1 is supported` | Deserializing 0.16 non-fungible `AssetId` or `Asset` bytes | Re-fetch with 0.17. |
| `unknown asset composition encoding: {n}` | Deserializing 0.16 fungible `AssetId`, `FungibleAsset` or `Asset` bytes (the old leading `0x01` now reads as the version) | Re-fetch with 0.17. |
| `unknown asset ID version: 0` (`AssetError::UnknownAssetIdVersion`) | Decoding a 0.16 non-fungible, hand-built or all-zero asset ID word (a 0.16 fungible word decodes without error, as a non-fungible ID) | Build IDs with `AssetId::new*`. |
| `asset composition mismatch for faucet {faucet_id}: expected Fungible, found None` | `FungibleAsset::from_id_and_value_words` (Web: `FungibleAsset.fromVaultKey` / `fromVaultEntry`) given a 0.16 fungible asset ID word | Recompute the word, or re-read the vault key, with 0.17. |
| `unknown asset ID version` (in MASM) | A metadata byte whose version bits are not 1, such as a 0.16 non-fungible ID (a 0.16 fungible ID passes, as non-fungible) | Build the ID with the standards procedures (see [MASM Changes](./masm-changes)). |

---

## Faucets with a transfer policy get the asset-callback flag automatically

### Summary

Every standard faucet gets a new ID from the same seed in 0.17, with or without a transfer policy. The ID is ground from the code and storage commitments, and both change: account procedures are now sorted (see [Account Changes](./account-changes#account-procedures-are-sorted-code-commitments-and-account-ids-change)), and the faucet MASM changed (for example `mint_and_send` in both faucet kinds and the allow-all transfer policy), so procedure roots change, including those the policy manager stores in its slots.

The asset-callback flag is a further reason for some faucets: it is part of a faucet's account ID, and 0.17 derives it from the faucet's storage. A `TokenPolicyManager` with any send or receive policy (active or merely allowed) installs the asset-callback slots, so the faucet's ID is ground with callbacks enabled. The multisig, guarded and non-fungible faucet factories used to leave the flag off for faucets configured with a transfer policy; they now enable it like the others.

With callbacks enabled, every transaction that moves the faucet's asset starts a foreign context against the faucet, so the faucet's account state becomes a required input for every holder. For a private faucet, holders have to obtain that state out of band. Callback procedure roots are also checked against the faucet's own code before dispatch.

The builder API change that comes with this (`AccountBuilder::with_asset_callbacks` replaced by `enable_asset_callbacks`) is covered in [Account Changes](./account-changes).

### Migration Steps

1. Expect a new ID for every standard faucet built from a 0.16 seed. Re-deploy rather than reusing 0.16 faucet IDs.
2. When a transaction moves an asset of a callback-enabled faucet, make sure the faucet's account state is available to it as a foreign account input. For a private faucet you must supply it yourself.
3. Register send or receive policies only on a faucet that needs them. A faucet with none keeps callbacks disabled and avoids the foreign load.
4. Budget for the shorter expiration: a transaction that adds an asset to a note while the asset's faucet has an active send policy, or to an account while the faucet has an active receive policy, expires within 20 blocks (see [Transaction Changes](./transaction-changes#emitting-a-network-note-or-moving-a-policy-gated-asset-caps-the-transaction-at-20-blocks)).

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `the faucet callback procedure root is not part of the faucet's account code` | The callback slot points at a root the faucet does not export | Store the root of one of the faucet's own procedures. |
| `an account whose storage contains an asset callback slot must have the asset callback flag enabled` | New account with a callback slot but the flag off | Build the account with `AccountBuilder`, which derives the flag. |
| `storage of account {0} contains an asset callback slot but its asset callback flag is disabled, so the callback would never be invoked` | `Account::new` (or deserialization) with a callback slot and a disabled flag | Same. |

---

## Faucet factories reject owner-only mint or burn policies without `Ownable2Step`

### Summary

`create_singlesig_user_fungible_faucet`, `create_multisig_user_fungible_faucet`, `create_guarded_user_fungible_faucet` and `create_user_non_fungible_faucet` install no `Ownable2Step` component, so they now return an error when the policy manager registers an owner-only mint or burn policy. `create_network_fungible_faucet` and `create_network_non_fungible_faucet` do the same unless `access_control` is `AccessControl::Ownable2Step { .. }`. In 0.16 such faucets were built successfully, and every mint or burn then aborted.

### Affected Code

```rust
// Compiles in both versions; fails at construction in 0.17
let manager = TokenPolicyManager::builder()
    .active_mint_policy(MintPolicy::owner_only())
    .active_burn_policy(BurnPolicy::allow_all())
    .build();
let faucet = create_singlesig_user_fungible_faucet(seed, faucet, auth, manager, account_type)?;
// 0.17: Err(FungibleFaucetError::OwnerOnlyPolicyWithoutOwnable2Step)
```

:::note The changelog understates this
The changelog files this change under Fixes, without `[BREAKING]`, and describes it as rejecting "a `TokenPolicyManager` whose policies read a storage slot the account does not install". The shipped check is narrower: it rejects only an owner-gated mint or burn policy on a factory that installs no `Ownable2Step`. It adds `FungibleFaucetError::OwnerOnlyPolicyWithoutOwnable2Step` and `NonFungibleFaucetError::OwnerOnlyPolicyWithoutOwnable2Step`, which break exhaustive matches on those enums.
:::

### Migration Steps

1. With a user faucet, use `MintPolicy::allow_all()` (the auth component already gates minting), or build the account yourself with an `Ownable2Step` component.
2. With a network faucet, pass `AccessControl::Ownable2Step { .. }` when you use owner-only policies.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `faucet registers an owner-gated mint or burn policy but does not install the Ownable2Step component the policy reads the owner from` | Owner-only policy on a factory without `Ownable2Step` | See the steps above. |

---

## Non-fungible `mint_and_send` takes the asset ID; minting and burning are stricter

### Summary

`faucets::non_fungible::mint_and_send` now takes the full asset (`ASSET_ID` and `ASSET_VALUE`), like the fungible one, and asserts that the asset ID belongs to the active faucet. The non-fungible MINT note storage grew from 9 (private) / 16+ (public) items to 13 / 20+, because the note now stores the full asset. The fungible `mint_and_send` rejects a zero amount, and `receive_and_burn` asserts that the burned asset is fungible. The Rust side of the MINT note (`MintNoteStorage`) is covered in [Note Changes](./note-changes).

### Affected Code

```masm
# Before (0.16) - faucets::non_fungible::mint_and_send, invoked with call
#! Inputs:  [ASSET_VALUE, tag, note_type, RECIPIENT, pad(6)]
#! Outputs: [note_idx, pad(15)]
```

```masm
# After (0.17)
#! Inputs:  [ASSET_ID, ASSET_VALUE, tag, note_type, RECIPIENT, pad(2)]
#! Outputs: [note_idx, pad(15)]
```

From the standard non-fungible send-notes transaction script:

```diff
- push.0.0.0.0 push.0.0
- padw loc_load.PROCESS_NOTES_READ_PTR_LOC add.ASSET_VALUE_OFFSET mem_loadw_le
+ push.0.0
+ loc_load.PROCESS_NOTES_READ_PTR_LOC add.ITEMS_OFFSET exec.asset::load
```

### Migration Steps

1. Build the asset with `non_fungible_asset::create` (`[faucet_id_suffix, faucet_id_prefix, ASSET_VALUE] -> [ASSET_ID, ASSET_VALUE]`) and pass both words to `mint_and_send`. Trim the trailing padding from 6 to 2.
2. In custom non-fungible MINT notes, store the full asset (13 items private, 20+ public). Prefer the Rust `MintNote` builder, which does this for you.
3. Do not mint zero amounts.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `the asset stored in the MINT note does not belong to this faucet` | `ASSET_ID` from another faucet, or not the ID derived from `ASSET_VALUE` | Derive the ID with `non_fungible_asset::create` for the minting faucet. |
| `failed to decode note_type into u8` (host) or `invalid note type` (kernel) | `mint_and_send` called with the 0.16 layout (no `ASSET_ID`, `pad(6)`): the inputs shift by one word and a recipient element lands in `note_type` | Pass `ASSET_ID` and `ASSET_VALUE`, with trailing `pad(2)`. |
| `non-fungible MINT script expects exactly 13 storage items for private or 20+ storage items for public output notes` | Old 9 / 16 item layout | Store the full asset. |
| `the amount to mint is zero` | Fungible mint of 0 | Mint a positive amount. |
| `fungible asset ID's composition must be fungible` | `receive_and_burn` given a non-fungible asset | Burn through the matching faucet kind. |

---

## Asset callbacks and transfer policies return nothing

### Summary

The `on_before_asset_added_to_account` / `on_before_asset_added_to_note` callbacks and the `TokenPolicyManager` send and receive policies are now validation-only: they return `[pad(16)]`, and the kernel keeps the original asset value. `policy_manager::invoke_send_policy` / `invoke_receive_policy` output `[pad(16)]` instead of `[PROCESSED_ASSET_VALUE, pad(12)]`. The callback root must also be a procedure of the faucet's own code (see [the callback-flag section](#faucets-with-a-transfer-policy-get-the-asset-callback-flag-automatically)). More MASM detail is in [MASM Changes](./masm-changes).

### Affected Code

From the standard allow-all transfer policy:

```masm
# Before (0.16)
#! Inputs:  [ASSET_ID, ASSET_VALUE, custom_data, pad(7)]
#! Outputs: [ASSET_VALUE, pad(12)]
@account_procedure
pub proc check_policy
    dropw
end
```

```masm
# After (0.17)
#! Inputs:  [ASSET_ID, ASSET_VALUE, custom_data, pad(7)]
#! Outputs: [pad(16)]
@account_procedure
pub proc check_policy(asset: Asset, custom_data: felt)
    dropw dropw drop
end
```

### Migration Steps

1. Make custom callbacks and transfer policies consume `[ASSET_ID, ASSET_VALUE, custom_data]` and return `[pad(16)]`. The kernel and the policy manager now drop all 16 outputs, so an old callback that returned a value still runs, but its return value is ignored.
2. Stop reading a processed value from `invoke_send_policy` / `invoke_receive_policy`.
3. Register only callback roots that are procedures of the faucet's own code.

---

## Mint policies may only change the asset value

### Summary

`policy_manager::execute_mint_policy` saves `tag`, `note_type` and `RECIPIENT` before calling the policy and asserts they come back unchanged. The policy signature is unchanged (`[ASSET_VALUE, tag, note_type, RECIPIENT, pad(6)]` in and out). A fungible faucet mints the amount the policy returns; a non-fungible faucet still rejects any change to the value.

### Migration Steps

1. Remove any tag, note type or recipient rewriting from custom mint policies. Adjust only `ASSET_VALUE`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `mint policy must not modify the output note tag or type` | The policy changed `tag` or `note_type` | Return them unchanged. |
| `mint policy must not modify the output note recipient` | The policy changed `RECIPIENT` | Return it unchanged. |

---

## Other asset and faucet changes

- **The fee asset is identified by an `AssetId`.** The chain's fee asset now lives in `ProtocolConfig::fee_asset_id()`, not in the block header. See [Transaction Changes](./transaction-changes#the-fee-asset-moved-from-the-block-header-into-protocolconfig).
- **`MintNoteStorage` collapsed to `Private` / `Public`** and holds an `Asset`. See [Note Changes](./note-changes).
- **`AccountBuilder::with_asset_callbacks` is replaced by `enable_asset_callbacks`.** See [Account Changes](./account-changes).

---

## Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `` error[E0599]: no associated function or constant named `Fungible` found for struct `Asset` `` | `Asset` is a struct | `asset.as_fungible()` / `asset.is_fungible()`. |
| `` error[E0599]: no associated function or constant named `from_id_and_value` found for struct `Asset` `` | Renamed | `Asset::new(id, value)`. |
| `` error[E0599]: no method named `fungible` found for reference `&AccountVaultDelta` `` | Vault delta tracks whole assets | Iterate `vault().iter()`. |
| `Property 'fungible' does not exist on type 'AccountVaultDelta'.` (TS2339) | Removed in the Web SDK | `addedFungibleAssets()` / `removedFungibleAssets()`. |
| `asset version is {n} but only version 1 is supported` | Non-fungible asset bytes serialized by 0.16 | Re-fetch with 0.17. |
| `unknown asset composition encoding: {n}` | Fungible asset bytes serialized by 0.16 | Re-fetch with 0.17. |
| `unknown asset ID version: 0` | 0.16 non-fungible, hand-built or all-zero asset ID word | Build IDs with `AssetId::new*`. |
| `asset composition mismatch for faucet {faucet_id}: expected Fungible, found None` | 0.16 fungible asset ID word passed to `FungibleAsset::from_id_and_value_words` or the Web `FungibleAsset.fromVaultKey` / `fromVaultEntry` | Recompute the word, or re-read the vault key, with 0.17. |
| Faucet rebuilt from the same seed has a different ID | Changed code and storage commitments (sorted procedures, changed faucet MASM), plus the asset-callback flag for transfer-policy faucets from the multisig, guarded and non-fungible factories | Re-deploy; do not reuse 0.16 faucet IDs. |
| `faucet registers an owner-gated mint or burn policy but does not install the Ownable2Step component the policy reads the owner from` | Owner-only policy on a factory without `Ownable2Step` | `MintPolicy::allow_all()`, or `AccessControl::Ownable2Step { .. }` on a network faucet. |
| `failed to decode note_type into u8` | Non-fungible `mint_and_send` called with the 0.16 stack layout | Pass `ASSET_ID` and `ASSET_VALUE`, with trailing `pad(2)`. |
| `the asset stored in the MINT note does not belong to this faucet` | Non-fungible `mint_and_send` given an `ASSET_ID` of another faucet, or not derived from `ASSET_VALUE` | Derive the ID with `non_fungible_asset::create` for the minting faucet. |
| `mint policy must not modify the output note recipient` | Custom mint policy rewrote the recipient | Return it unchanged. |
