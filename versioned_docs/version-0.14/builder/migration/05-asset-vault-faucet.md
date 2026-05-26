---
sidebar_position: 5
title: "Assets, Vault & Faucet"
description: "Two-word asset representation, vault API changes, faucet burn updates, and TokenSymbol changes in v0.14"
---

# Assets, Vault & Faucet

:::warning Breaking Change
Assets are now represented as two words (`ASSET_KEY` + `ASSET_VALUE`) instead of a single `ASSET` word. This is the largest MASM-level change in v0.14 and affects every procedure that creates, inspects, adds, removes, or burns assets.
:::

---

## ASSET to ASSET_KEY + ASSET_VALUE

### Summary

The single 4-felt `ASSET` word has been split into two words: `ASSET_KEY` (identity + faucet + callback flag) and `ASSET_VALUE` (amount or data hash). Every kernel procedure and standard-library helper that previously accepted or returned `ASSET` now works with the `ASSET_KEY, ASSET_VALUE` pair.

:::note Canonical layout
The full field-by-field layout — including how the per-asset callback flag is packed into the reserved low byte of `faucet_id_suffix` — is documented in [Asset encoding](../../core-concepts/protocol/asset.md#encoding). This page covers the v0.13 → v0.14 delta only.
:::

### Affected Code

**MASM (`native_account::add_asset`):**
```masm
# Before (0.13): stack = [ASSET, pad(12)]
exec.native_account::add_asset
# -> [ASSET, pad(12)]

# After (0.14): stack = [ASSET_KEY, ASSET_VALUE, pad(8)]
exec.native_account::add_asset
# -> [ASSET_KEY, ASSET_VALUE, pad(8)]
```

**Rust:**
```rust
// Before (0.13)
let word: Word = fungible_asset.into();

// After (0.14)
let key: Word = fungible_asset.to_key_word();
let value: Word = fungible_asset.to_value_word();

// Reconstructing from key/value
let asset = FungibleAsset::from_key_value_words(key, value)?;
```

### Migration Steps

1. Find every MASM site that pushes an `ASSET` word onto the stack before a kernel call. Replace the single word with `ASSET_KEY, ASSET_VALUE` and adjust padding from 12 to 8.
2. In Rust, replace `.into()` conversions to `Word` with `.to_key_word()` and `.to_value_word()`.
3. Replace any `Asset::from(word)` with `Asset::from_key_value_words(key, value)`.
4. Update stack comments throughout your MASM to reflect the new two-word layout.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `FailedAssertion` at `add_asset` / `remove_asset` | Single `ASSET` word pushed instead of key+value pair | Split into `ASSET_KEY` and `ASSET_VALUE`. |
| `no method named into found for FungibleAsset` (when targeting `Word`) | Direct `Word` conversion removed | Use `to_key_word()` and `to_value_word()`. |
| Stack underflow in asset procedures | Padding not adjusted from 12 to 8 | Reduce padding to account for the extra word. |

---

## build_*_asset Renamed to create_*_asset

### Summary

The `asset::build_fungible_asset` and `asset::build_non_fungible_asset` procedures have been renamed to `create_fungible_asset` and `create_non_fungible_asset`. They also accept a new `enable_callbacks` flag and return the two-word `ASSET_KEY, ASSET_VALUE` pair.

### Affected Code

**MASM (asset creation):**
```masm
# Before (0.13): fungible stack = [faucet_id_prefix, faucet_id_suffix, amount, ...]
exec.asset::build_fungible_asset
# -> [ASSET, ...]

# Before (0.13): non-fungible stack = [faucet_id_prefix, faucet_id_suffix, DATA_HASH, ...]
exec.asset::build_non_fungible_asset
# -> [ASSET, ...]

# After (0.14): fungible stack = [enable_callbacks, faucet_id_suffix, faucet_id_prefix, amount, ...]
exec.asset::create_fungible_asset
# -> [ASSET_KEY, ASSET_VALUE, ...]

# After (0.14): non-fungible stack = [enable_callbacks, faucet_id_suffix, faucet_id_prefix, DATA_HASH, ...]
exec.asset::create_non_fungible_asset
# -> [ASSET_KEY, ASSET_VALUE, ...]
```

**Rust:**
```rust
// Before (0.13)
let asset = FungibleAsset::new(faucet_id, amount)?;

// After (0.14) — Rust API may vary; consult crate docs for exact constructor
let asset = FungibleAsset::new(faucet_id, amount)?;
// The MASM-level rename is the primary change; Rust constructors
// now produce assets compatible with the two-word representation.
```

### Migration Steps

1. Rename all `exec.asset::build_fungible_asset` calls to `exec.asset::create_fungible_asset`.
2. Rename all `exec.asset::build_non_fungible_asset` calls to `exec.asset::create_non_fungible_asset`.
3. Add the `enable_callbacks` flag as the new top-of-stack element.
4. Note the changed argument order: `[enable_callbacks, faucet_id_suffix, faucet_id_prefix, amount]` for fungible assets and `[enable_callbacks, faucet_id_suffix, faucet_id_prefix, DATA_HASH]` for non-fungible assets.
5. Update consumers to expect `[ASSET_KEY, ASSET_VALUE]` on the stack instead of a single `[ASSET]`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `unknown procedure asset::build_fungible_asset` | Procedure renamed | Use `asset::create_fungible_asset`. |
| `unknown procedure asset::build_non_fungible_asset` | Procedure renamed | Use `asset::create_non_fungible_asset`. |
| `FailedAssertion` in `create_*_asset` | Missing `enable_callbacks` flag or wrong argument order | Push `[enable_callbacks, faucet_id_suffix, faucet_id_prefix, amount]` for fungible assets, or `[enable_callbacks, faucet_id_suffix, faucet_id_prefix, DATA_HASH]` for non-fungible assets. |

---

## get_balance / has_non_fungible_asset Removed

### Summary

The kernel no longer exposes `get_balance` or `has_non_fungible_asset`. Instead, a single `get_asset` procedure handles both fungible and non-fungible lookups. It takes an `ASSET_KEY` and returns the corresponding `ASSET_VALUE`.

### Affected Code

**MASM (fungible balance check):**
```masm
# Before (0.13): stack = [faucet_id, ...]
exec.native_account::get_balance
# -> [balance, ...]

# After (0.14): stack = [ASSET_KEY, pad(12)]
exec.native_account::get_asset
# -> [ASSET_VALUE, pad(12)]
# balance is ASSET_VALUE[0] (top of ASSET_VALUE word)
```

**MASM (non-fungible existence check):**
```masm
# Before (0.13): stack = [ASSET, pad(12)]
exec.native_account::has_non_fungible_asset
# -> [has_asset, pad(15)]

# After (0.14): stack = [ASSET_KEY, pad(12)]
exec.native_account::get_asset
# -> [ASSET_VALUE, pad(12)]
# If the asset exists, ASSET_VALUE will be the DATA_HASH;
# if not, ASSET_VALUE will be [0, 0, 0, 0].
```

**Rust:**
```rust
// Before (0.13)
let balance = account.vault().get_balance(faucet_id)?;
let has_nft = account.vault().has_non_fungible_asset(&asset)?;

// After (0.14)
let asset_value = account.vault().get_asset(asset_key)?;
// For fungible: amount = asset_value[0]
// For non-fungible: check if asset_value != [0, 0, 0, 0]
```

### Migration Steps

1. Replace every `exec.native_account::get_balance` with `exec.native_account::get_asset`. Construct the `ASSET_KEY` for the fungible faucet and read the amount from the first element of the returned `ASSET_VALUE`.
2. Replace every `exec.native_account::has_non_fungible_asset` with `exec.native_account::get_asset`. Construct the `ASSET_KEY` and compare the returned `ASSET_VALUE` against `[0, 0, 0, 0]` to determine existence.
3. The same pattern applies to `get_initial_asset` (for checking assets at transaction start).

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `unknown procedure native_account::get_balance` | Procedure removed | Use `native_account::get_asset` with the asset key. |
| `unknown procedure native_account::has_non_fungible_asset` | Procedure removed | Use `native_account::get_asset` and check for zero value. |
| Wrong balance value | Reading wrong element from `ASSET_VALUE` | The amount is in `ASSET_VALUE[0]` (top of stack after the call). |

---

## AssetVault::remove_asset Returns Remaining Asset

### Summary

In Rust, `AssetVault::remove_asset` previously returned `Result<Asset>` (the removed asset). It now returns `Result<Option<Asset>>` where the value is the **remaining** asset in the vault after partial removal. For non-fungible assets, the return is always `None` (the entire asset is removed).

### Affected Code

**Rust:**
```rust
// Before (0.13)
let removed: Asset = vault.remove_asset(asset)?;

// After (0.14)
let remaining: Option<Asset> = vault.remove_asset(asset)?;
// remaining = Some(fungible_asset) if fungible with leftover balance
// remaining = None if the vault entry was fully consumed (or non-fungible)
```

### Migration Steps

1. Update all call sites of `AssetVault::remove_asset` to handle `Option<Asset>` instead of `Asset`.
2. If you previously used the return value as "the asset that was removed", note that the semantics have changed to "the asset remaining in the vault".
3. For non-fungible assets, expect `None` — the asset is either fully present or fully removed.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `expected Asset, found Option<Asset>` | Return type changed | Unwrap or pattern-match the `Option`. |
| Logic error: treating return as "removed" amount | Semantics changed from removed to remaining | Adjust logic to interpret the value as remaining balance. |

---

## faucet::burn and native_account::remove_asset Stack Effects

### Summary

Both `faucet::burn` and `native_account::remove_asset` have updated stack effects to match the two-word asset representation. Notably, `faucet::burn` no longer returns the asset on the stack.

### Affected Code

**MASM (`faucet::burn`):**
```masm
# Before (0.13): stack = [ASSET, ...] -> [ASSET, ...]
exec.faucet::burn

# After (0.14): stack = [ASSET_KEY, ASSET_VALUE, ...] -> [...]
exec.faucet::burn
# Stack is consumed — nothing is returned for the burned asset.
```

**MASM (`native_account::remove_asset`):**
```masm
# Before (0.13): stack = [ASSET, pad(12)] -> [ASSET, pad(12)]
exec.native_account::remove_asset

# After (0.14): stack = [ASSET_KEY, ASSET_VALUE, pad(8)] -> [REMAINING_ASSET_VALUE, pad(12)]
exec.native_account::remove_asset
# Returns the REMAINING asset value in the vault (not the removed one).
```

### Migration Steps

1. For `faucet::burn`: remove any code that reads the return value from the stack. The procedure now consumes `[ASSET_KEY, ASSET_VALUE]` and leaves nothing.
2. For `native_account::remove_asset`: update stack expectations. The output is `[REMAINING_ASSET_VALUE, pad(12)]`, not the removed asset.
3. If you need the removed amount, compute it before calling `remove_asset` (e.g., subtract the remaining value from the original).

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| Stack underflow after `faucet::burn` | Code tries to read a return value that no longer exists | `burn` now returns nothing; remove post-call reads. |
| Wrong amount after `remove_asset` | Return value is remaining, not removed | Compute removed amount separately if needed. |
| `FailedAssertion` in `burn` or `remove_asset` | Single `ASSET` word passed instead of key+value | Pass `[ASSET_KEY, ASSET_VALUE]` with correct padding. |

---

## TokenSymbol Changes

### Summary

The `TokenSymbol` type has several breaking changes:

- **`to_string()`** is now available via the `Display` trait (infallible). Previously it could fail.
- **`default()`** has been removed — there is no zero-value token symbol.
- **`TryFrom<Felt>`** now rejects values below `MIN_ENCODED_VALUE`.
- **`MAX_SYMBOL_LENGTH`** increased from **6** to **12** characters.

### Affected Code

**Rust:**
```rust
// Before (0.13)
let symbol = TokenSymbol::default(); // zero-value placeholder
let s = symbol.to_string()?;         // fallible conversion
let sym = TokenSymbol::try_from(felt)?; // accepted any felt

// After (0.14)
// TokenSymbol::default() is removed — use a real symbol
let s = format!("{}", symbol);        // Display trait, infallible
let sym = TokenSymbol::try_from(felt)?; // rejects below MIN_ENCODED_VALUE
// Symbols can now be up to 12 characters (was 6)
```

### Migration Steps

1. Remove any calls to `TokenSymbol::default()`. Replace with an explicit symbol via `TokenSymbol::new("TOKEN")` or equivalent constructor.
2. Replace fallible `to_string()` calls with `format!("{}", symbol)` or `.to_string()` (now infallible via `Display`).
3. If you validate token symbol length, update the upper bound from 6 to 12.
4. If you construct `TokenSymbol` from a `Felt`, ensure the value is at or above `MIN_ENCODED_VALUE`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `no function or associated item named default found for TokenSymbol` | `default()` removed | Use an explicit symbol value. |
| `encoded value below minimum` / `InvalidTokenSymbol` | `TryFrom<Felt>` now rejects small values | Ensure the felt is at or above `MIN_ENCODED_VALUE`. |
| Compilation warning about unused `Result` on `to_string()` | Now returns `String` directly via `Display` | Remove error handling around `to_string()`. |
