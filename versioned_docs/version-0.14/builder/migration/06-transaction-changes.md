---
sidebar_position: 6
title: "Transaction Changes"
description: "TransactionId hashing, ProvenTransaction construction, kernel event namespacing, stack order, and other transaction-level changes in v0.14"
---

# Transaction Changes

:::warning Breaking Change
Transaction identity, construction, event namespacing, summary stack layout, output accessors, and block signing have all changed in v0.14. These changes affect anyone building, proving, verifying, or signing transactions and blocks.
:::

---

## TransactionId Now Hashes the Fee Asset

### Summary

`TransactionId::new` now requires a `fee_asset: FungibleAsset` parameter so the fee is included in the transaction hash. The function takes 5 arguments (6 words total) instead of the previous 4.

### Affected Code

**Rust:**
```rust
// Before (0.13)
let tx_id = TransactionId::new(init, final_state, input_notes, output_notes);

// After (0.14)
let tx_id = TransactionId::new(init, final_state, input_notes, output_notes, fee_asset);
```

### Migration Steps

1. Add the `fee_asset: FungibleAsset` argument to every `TransactionId::new` call site.
2. Ensure the `fee_asset` value matches the fee used in the transaction.
3. If you compute or verify transaction IDs externally (e.g., in tests), update the hashing logic to include the fee asset.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `this function takes 5 arguments but 4 arguments were supplied` | Missing `fee_asset` parameter | Add the `FungibleAsset` fee as the fifth argument. |
| Transaction ID mismatch in verification | Hash computed without fee asset | Recompute the ID with the fee asset included. |

---

## ProvenTransactionBuilder Removed in Favor of ProvenTransaction::new

### Summary

The `ProvenTransactionBuilder` has been removed. Instead, construct a `TxAccountUpdate` and pass it directly to `ProvenTransaction::new`.

### Affected Code

**Rust:**
```rust
// Before (0.13)
let proven_tx = ProvenTransactionBuilder::new(account_id, init_hash, final_hash, proof)
    .account_update_details(details)
    .add_input_notes(input_notes)
    .add_output_notes(output_notes)
    .build()?;

// After (0.14)
let account_update = TxAccountUpdate::new(account_id, init_hash, final_hash, details);
let proven_tx = ProvenTransaction::new(
    account_update,
    input_notes,
    output_notes,
    ref_block_num,
    ref_block_commitment,
    fee,
    expiration_block_num,
    proof,
);
```

### Migration Steps

1. Remove all `ProvenTransactionBuilder` usage.
2. Create a `TxAccountUpdate` from the account ID, initial hash, final hash, and update details.
3. Call `ProvenTransaction::new` with the account update and all remaining fields as positional arguments.
4. If you previously relied on builder defaults for optional fields, you must now provide them explicitly (e.g., `ref_block_num`, `ref_block_commitment`, `expiration_block_num`).

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `cannot find struct ProvenTransactionBuilder` | Builder removed | Use `ProvenTransaction::new` with `TxAccountUpdate`. |
| `cannot find struct TxAccountUpdate` | Missing import | Add `use miden_objects::transaction::TxAccountUpdate;` (check crate docs for exact path). |
| Wrong number of arguments to `ProvenTransaction::new` | Missing required positional parameters | Provide all 8 arguments: account_update, input_notes, output_notes, ref_block_num, ref_block_commitment, fee, expiration_block_num, proof. |

---

## Kernel Events Prefixed with miden::protocol

### Summary

All kernel events have been renamespaced under `miden::protocol::`. The previous `miden::` prefix is no longer recognized.

### Affected Code

**MASM:**
```masm
# Before (0.13)
event("miden::account::vault_before_add_asset")
event("miden::auth::request")

# After (0.14)
event("miden::protocol::account::vault_before_add_asset")
event("miden::protocol::auth::request")
```

### Migration Steps

1. Search your MASM files for all `event("miden::` occurrences.
2. Replace `miden::` with `miden::protocol::` in every event name.
3. If you have event handlers or listeners matching on event names, update those patterns as well.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| Event not firing / handler not triggered | Event name changed but handler still matches old name | Update both the event emission and handler to use `miden::protocol::` prefix. |
| `unknown event` or silent no-op | Old event name no longer exists | Rename to `miden::protocol::...`. |

---

## Transaction Summary Stack Order Reversed

### Summary

The 4-word message that authentication procedures sign has its order reversed. Previously `SALT` was on top of the stack; now `ACCOUNT_DELTA_COMMITMENT` is on top.

### Affected Code

**MASM (stack layout for auth signing):**
```masm
# Before (0.13)
# [SALT, OUTPUT_NOTES_COMMITMENT, INPUT_NOTES_COMMITMENT, ACCOUNT_DELTA_COMMITMENT, PUB_KEY]

# After (0.14)
# [ACCOUNT_DELTA_COMMITMENT, INPUT_NOTES_COMMITMENT, OUTPUT_NOTES_COMMITMENT, SALT, PUB_KEY]
```

### Migration Steps

1. If you implement a custom authentication procedure that reads or signs the transaction summary, update the expected stack layout.
2. The new order (top to bottom) is: `ACCOUNT_DELTA_COMMITMENT`, `INPUT_NOTES_COMMITMENT`, `OUTPUT_NOTES_COMMITMENT`, `SALT`, then `PUB_KEY`.
3. Update any manual stack manipulation that assumed the old ordering.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| Signature verification failure | Auth procedure signing words in old order | Update to the new stack order before signing. |
| `FailedAssertion` in custom auth | Stack words read in wrong positions | Reorder stack reads to match new layout. |

---

## TransactionOutputs Fields Private

### Summary

Fields on `TransactionOutputs` are no longer public. Use accessor methods instead.

### Affected Code

**Rust:**
```rust
// Before (0.13)
let account = outputs.account;
let fee = outputs.fee;
let expiration = outputs.expiration_block_num;
let notes = outputs.output_notes;

// After (0.14)
let account = outputs.account();
let fee = outputs.fee();
let expiration = outputs.expiration_block_num();
let notes = outputs.output_notes(); // now returns &RawOutputNotes
```

### Migration Steps

1. Replace all direct field accesses on `TransactionOutputs` with the corresponding method calls.
2. Note that `output_notes()` now returns `&RawOutputNotes` instead of the previous type. Update downstream code to work with `RawOutputNotes`.
3. Since accessors return references, add borrows or clones where ownership was previously obtained via field access.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `field account of TransactionOutputs is private` | Fields no longer public | Use `outputs.account()`. |
| `field fee of TransactionOutputs is private` | Fields no longer public | Use `outputs.fee()`. |
| Type mismatch on output notes | `output_notes()` returns `&RawOutputNotes` | Update code to handle `RawOutputNotes` instead of the previous type. |

---

## SignedBlock Added; BlockSigner Removed

### Summary

The `BlockSigner` trait has been removed. Instead, sign the block header commitment directly and construct a `SignedBlock`.

### Affected Code

**Rust:**
```rust
// Before (0.13)
let signed = signer.sign(&header);

// After (0.14)
let sig = sk.sign(header.to_commitment());
let signed_block = SignedBlock::new(header, body, sig);
```

### Migration Steps

1. Remove all `BlockSigner` trait implementations and usages.
2. Sign `header.to_commitment()` with your signing key directly.
3. Construct `SignedBlock::new(header, body, signature)` with the header, block body, and resulting signature.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `cannot find trait BlockSigner` | Trait removed | Sign `header.to_commitment()` directly with your key. |
| `cannot find struct SignedBlock` | Missing import | Add the appropriate import for `SignedBlock` from the Miden crate. |
| Signature verification fails on block | Signing the header directly instead of its commitment | Sign `header.to_commitment()`, not the header itself. |
