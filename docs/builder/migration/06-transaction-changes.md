---
sidebar_position: 6
title: "Transaction Changes"
description: "FeeParameters fee faucet rename, typed transaction-script roots, and batch construction changes in v0.15"
---

# Transaction Changes

:::warning Breaking Change
`FeeParameters::native_asset_id` was renamed to `fee_faucet_id` and `FeeParameters::new` is now infallible. The transaction-script root is now a typed `TransactionScriptRoot` rather than a raw `Word`. These changes affect anyone constructing fee parameters, reading transaction-script roots, or building batches by hand.
:::

---

## `fee_faucet_id` replaces `native_asset_id` on `FeeParameters`

### Summary

`FeeParameters::native_asset_id` (field, getter, and `new` parameter) was renamed to **`fee_faucet_id`**. Because account IDs no longer encode faucet‑ness, `FeeParameters::new` no longer validates that the ID is a fungible faucet and is now **infallible** (returns `Self`, not `Result`).

### Migration Steps

1. Rename `native_asset_id` → `fee_faucet_id` at the constructor, field, and getter.
2. Drop the `?` / `FeeError` handling on `FeeParameters::new`.

---

## `TransactionScript::root()` returns `TransactionScriptRoot`

### Summary

*(v0.15.2)* `TransactionScript::root()` now returns a typed **`TransactionScriptRoot`** newtype instead of a raw `Word` (convert with `.into()`). A new `TransactionScript::from_package(&Package)` builds a script from a compiled `miden-mast-package` package, and the new `tx::get_tx_script_root` kernel proc returns the executed tx‑script root (empty word if none).

### Migration Steps

1. Update the binding type of `tx_script.root()` to `TransactionScriptRoot`.
2. Insert `.into()` / `Word::from(root)` where a `Word` is required.

---

## `ProvenBatch::new` → `new_unchecked`; `NoteConsumptionInfo` fields private

### Summary

Batch/transaction housekeeping changes that affect anyone constructing these types by hand:

- `ProvenBatch::new` was renamed **`ProvenBatch::new_unchecked`** to signal it skips validation.
- `NoteConsumptionInfo` (and related types) gained cycle counts and had their fields made private; use the accessor methods `successful()` / `failed()`.

### Migration Steps

1. Rename `ProvenBatch::new` → `ProvenBatch::new_unchecked`.
2. Replace direct field access on `NoteConsumptionInfo` with the accessor methods.
