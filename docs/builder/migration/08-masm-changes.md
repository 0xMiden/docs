---
sidebar_position: 8
title: "MASM Changes"
description: "Procedures that kept their name but changed their stack effect, the renamed reference-block and fee-asset accessors, relocated standards and core-library modules, and the return of trace events"
---

# MASM Changes

:::warning Breaking Change
Several protocol and standards procedures kept their names but changed their stack effect, and the assembler does not check call sites against procedure signatures. 0.16 code that calls them **still assembles and then misbehaves**: `tx::get_block_commitment` now consumes a block number from the stack, and a custom guardian component that still passes the old note count to `guardian::verify_signature` **silently skips the guardian signature check**. Around those, the reference-block and fee-asset accessors were renamed, several standards modules moved, the core library's precompile wrappers moved under `miden::core`, and many procedure roots changed.
:::

## Quick Fix

```masm
# Before (0.16)
use miden::standards::note_tag
use miden::standards::note::execution_hint
use miden::precompiles::hashes::keccak256

exec.tx::get_block_number
exec.tx::get_block_commitment
exec.tx::get_fee_faucet_id exec.fungible_asset::create_id
exec.active_account::compute_commitment
```

```masm
# After (0.17)
use miden::standards::note::note_tag
use miden::standards::note::note_execution_hint
use miden::core::precompiles::hashes::keccak256

exec.tx::get_reference_block_number
exec.tx::get_reference_block_commitment   # get_block_commitment now takes a block number
exec.tx::get_fee_asset_id
exec.native_account::compute_commitment   # panics in a foreign (FPI) context
```

```toml title="miden-project.toml"
# Before (0.16)
miden-core      = { linkage = "dynamic", version = "0.29" }
miden-protocol  = { linkage = "dynamic", version = "0.16.0" }
miden-standards = { linkage = "static",  version = "0.16.0" }

# After (0.17.0-rc.7)
miden-core      = { linkage = "dynamic", version = "0.33" }
miden-protocol  = { linkage = "dynamic", version = "0.17.0" }
miden-standards = { linkage = "static",  version = "0.17.0" }
```

Renamed procedures fail loudly at assembly. The procedures in [the stack-effect table](#procedures-that-kept-their-name-but-changed-their-stack-effect) do not: after the renames, audit every call site listed there by hand.

If you encounter errors, continue reading for detailed migration steps.

---

## Summary

This page holds four groups of change. The first is the dangerous one: a dozen procedures in `miden::protocol` and `miden::standards` changed their stack effect under an unchanged name. Nothing fails to compile; call sites either trip an assertion that names something unrelated, or run and compute the wrong value. The second group is renames and moves (reference-block helpers, the fee asset accessor, `note_tag`, `note_execution_hint`, the MINT submodules, the fungible amount helpers, privatised low-level helpers); those fail at assembly with `undefined item`. The third group is for authors of custom auth and faucet components: the transaction summary layout, `tx_policy`, `guardian`, multisig, fee payment, and faucet callbacks and policies all changed shape. The fourth is the core library and the language (VM `0.29.2` → `0.33.0`): precompile wrappers moved under `miden::core`, the in-VM verifier is `verify_proof`, `u64` shifts and bare `exp` trap on inputs they used to accept, and the `trace` instruction is back.

Every procedure whose body changed has a new MAST root, and every standard note script root and standard component code commitment changes. Re-assemble every note script, transaction script and account component that links these libraries (the package format itself is covered in [VM & Assembler Changes](./vm-assembler)).

:::info A mislabeled changelog section
The protocol changelog at `v0.17.0-rc.7` carries a second heading labeled `v0.16.0 (2026-08-06)` directly below the rc.5 section. None of its entries is in `0.16.1`: it is the 0.17 fixes list under a wrong heading, and it contains several breaking MASM changes covered on this page (non-fungible `mint_and_send`, the foreign-procedure root check, the transfer-policy expiration cap). Several renames on this page (`account_id::validate`, `note::execution_hint`, `types::MemoryAddress`, the `kernel_proc_offsets` constants) are not in the changelog at all.
:::

The VM 0.33 assembler reports a stale import or procedure as `undefined item '...'`. A `use` names the full module path (`use miden::precompiles::hashes::keccak256` gives `undefined item 'miden::precompiles::hashes::keccak256'`); an `exec` names only the procedure (`exec.tx::get_block_number` gives `undefined item 'get_block_number'`); a `syscall` names the kernel path (`undefined item '::$kernel::<name>'`). The protocol and standards libraries are linked as packages, so importing one of their private modules also reports `undefined item`, not `private submodule`.

---

## Procedures that kept their name but changed their stack effect

### Summary

The VM 0.33 assembler performs no call-site type check. Almost every public protocol and standards procedure now carries a type signature (see [Procedure type signatures](#procedure-type-signatures-and-typed-pointers)), but signatures document the stack effect; they neither reject nor protect an old call site. The procedures below consume a different stack in 0.17 than in 0.16.

### Affected Code

| Procedure | 0.16 stack (inputs) | 0.17 stack (inputs) |
| --- | --- | --- |
| `tx::get_block_commitment` | `[]` (returns the reference block's commitment) | `[block_number]` |
| `guardian::verify_signature` | `[num_own_output_notes, MSG]` | `[is_rotation, MSG]` |
| `fee::pay_fee` | `[num_extra_cycles, CONVERSION_INFO]` | `[num_extra_cycles, CONVERSION_INFO, serial_number_block]` |
| `fee::create_and_fund_fee_note` | `[ASSET_ID, ASSET_VALUE]` | `[serial_number_block, ASSET_ID, ASSET_VALUE]` |
| `fee::apply_cycle_margins` | `[num_extra_cycles, num_sponsorship_notes]` | `[num_extra_cycles]` |
| `auth::create_tx_summary` | `[user_params(7)]` | `[user_params(6)]`, and the six output words come out in a new order |
| `auth::hash_and_insert_tx_summary` | `[ACCOUNT_DELTA, INPUT_NOTES, OUTPUT_NOTES, BLOCK_COMMITMENT, PARAMS_HEAD, PARAMS_TAIL]` | `[PARAMS_HEAD, PARAMS_TAIL, ACCOUNT_DELTA, INPUT_NOTES, OUTPUT_NOTES, BLOCK_COMMITMENT]` |
| `tx_policy::assert_no_output_notes` | `[num_own_output_notes]` | `[]` |
| `multisig::auth_tx` | `[user_params(7)]` | `[bound_block_num, approval_expiration_block_num, SALT]` |
| `multisig_smart::auth_tx` | `[num_own_output_notes, user_params(7)]` | `[bound_block_num, approval_expiration_block_num, SALT]` |
| `multisig_smart::enforce_note_restrictions` | `[num_own_output_notes, note_restrictions]` | `[note_restrictions]` |
| `faucets::non_fungible::mint_and_send` | `[ASSET_VALUE, tag, note_type, RECIPIENT, pad(6)]` | `[ASSET_ID, ASSET_VALUE, tag, note_type, RECIPIENT, pad(2)]` |
| `fungible_asset::value_into_amount` | `[ASSET_VALUE]`, unchecked | `[ASSET_VALUE]`, now validates the value |

`tx` is `miden::protocol::tx`. The other modules live under `miden::standards`: `auth`, `auth::guardian`, `auth::tx_policy`, `auth::multisig`, `auth::multisig_smart`, `fee`, `faucets::non_fungible` and `assets::fungible_asset`.

What an unchanged 0.16 call site does in 0.17:

- **`tx::get_block_commitment`** consumes whatever sits on top of the stack as a block number. A non-u32 value fails, and a value above the reference block fails. The reference block number itself returns the old value. A lower block number **returns that block's commitment without any error** if the transaction's partial blockchain tracks that block; otherwise execution fails with `failed to lookup value in Merkle store`. A zero pad reads as block 0.
- **`guardian::verify_signature`** feeds its first element to `if.true`. The old argument was the count of the component's own output notes, which is 1 when the fee note is the only one. A 1 now means "rotation", which **skips the guardian signature check**; a count above 1 fails the condition.
- **`fee::pay_fee`** takes the next element below `CONVERSION_INFO` as the serial-number block. It is `u32assert`ed only when a non-zero fee is paid, so on a zero-fee path nothing checks it.
- **`fee::create_and_fund_fee_note`** misreads the asset.
- **`auth::create_tx_summary`**, **`fee::apply_cycle_margins`** and **`tx_policy::assert_no_output_notes`** leave an extra element on the stack. `assert_no_output_notes` also no longer tolerates the fee note.
- **`auth::hash_and_insert_tx_summary`** hashes the words in the old order. When the host handles the auth request it rejects that preimage (`failed to construct transaction summary`, caused by `transaction summary layout version is <value> but only version 1 is supported`), and a signature made over the new order does not verify.
- **`multisig::auth_tx`** and **`multisig_smart::auth_tx`** bind a wrong block or panic; **`multisig_smart::enforce_note_restrictions`** misreads the restrictions.
- **`faucets::non_fungible::mint_and_send`** reads the 0.16 frame shifted by one word (the old `ASSET_VALUE` as `ASSET_ID`, recipient elements as `tag` and `note_type`), so it fails while creating the output note with `failed to decode note_type into u8`, or earlier in a custom mint policy that inspects the value.
- **`fungible_asset::value_into_amount`** keeps its stack effect but now validates, so it fails on malformed values it used to accept.

:::danger A custom guardian component can lose its guardian check without any error
If your auth component calls `guardian::verify_signature` with the 0.16 own-notes count, a count of 1 now passes as `is_rotation = 1` and the guardian signature is never verified, with nothing to report it. Call `guardian::assert_rotation_policy` and pass its result instead (see [Custom auth components](#custom-auth-components-transaction-summary-tx_policy-and-guardian)).
:::

### Migration Steps

1. Grep your MASM for every procedure in the table and re-derive the stack at each call site. Do not rely on the assembler or on a green build.
2. Fix `guardian::verify_signature` and `tx::get_block_commitment` first: those two can run to completion with the wrong behaviour.
3. Follow the per-procedure sections below for the new calling sequences.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `the block number must be a u32` | Argument-less `tx::get_block_commitment` consumed a non-u32 value | Use `tx::get_reference_block_commitment`. |
| `the block number must not exceed the transaction reference block number` | Same, with a u32 above the reference block | Same. |
| `failed to lookup value in Merkle store` | Same, with a lower block number (often a zero pad, block 0) that the transaction's partial blockchain does not track | Same. |
| `transaction must not include output notes` | `tx_policy::assert_no_output_notes` called after `fee::pay_fee` created the fee note | Call it with no argument, before paying the fee. |
| `failed to decode note_type into u8` | Old `non_fungible::mint_and_send` call without `ASSET_ID`: the frame is read shifted by one word | Pass `[ASSET_ID, ASSET_VALUE, ...]`. |
| `fungible asset value is not well-formed` | Old `value_into_amount` call site now validates | Pass a real fungible value, or use `value_into_amount_unchecked`. |

---

## `tx::get_block_commitment` takes a block number; reference-block helpers renamed

### Summary

`tx::get_block_commitment` now reads the commitment of any block up to and including the reference block, and takes that block number on the stack. The old argument-less behaviour lives on as `tx::get_reference_block_commitment`, and `tx::get_block_number` is now `tx::get_reference_block_number`. The Rust contract SDK mirrors these renames (see [Rust Contract SDK & Compiler](./rust-sdk-compiler)).

### Affected Code

From the standard P2IDE note script:

```diff
- mem_load.TIMELOCK_HEIGHT_ITEM exec.tx::get_block_number
+ mem_load.TIMELOCK_HEIGHT_ITEM exec.tx::get_reference_block_number
```

```masm
# Before (0.16)
use miden::protocol::tx

exec.tx::get_block_commitment            # []             -> [REF_BLOCK_COMMITMENT]
```

```masm
# After (0.17)
use miden::protocol::tx

exec.tx::get_reference_block_commitment  # []             -> [REF_BLOCK_COMMITMENT]
push.1234 exec.tx::get_block_commitment  # [block_number] -> [BLOCK_COMMITMENT]
```

If you call the kernel directly: `kernel_proc_offsets::TX_GET_BLOCK_NUMBER_OFFSET` was renamed to `TX_GET_REFERENCE_BLOCK_NUMBER_OFFSET` (value `52` at rc.7).

### Migration Steps

1. Replace every `exec.tx::get_block_commitment` that expects no argument with `exec.tx::get_reference_block_commitment`. Do this first: the old spelling still assembles and consumes the top stack element as a block number.
2. Rename `tx::get_block_number` to `tx::get_reference_block_number`.
3. To read an older block, push its number and call `tx::get_block_commitment`. The block must be authenticated by the transaction's partial blockchain: the kernel emits the new `miden::protocol::tx::before_block_witness_load` event, the standard host treats it as a no-op, so the client has to include that block in the transaction inputs (see [Client Changes](./client-changes)).
4. Rename `TX_GET_BLOCK_NUMBER_OFFSET` if you `syscall.exec_kernel_proc` by hand.

On the Rust side, `TransactionEventId` gains `TxBeforeBlockWitnessLoad`, which breaks exhaustive matches.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `the block number must be a u32` | `get_block_commitment` consumed a non-u32 value, typically an old argument-less call site | Use `get_reference_block_commitment`, or push a valid block number. |
| `the block number must not exceed the transaction reference block number` | Block number above the reference block, often a stale call site consuming an unrelated value | Same. |
| `failed to lookup value in Merkle store` | Block number below the reference block that the transaction's partial blockchain does not track, for example a zero pad consumed by a stale call site | Use `get_reference_block_commitment`, or include that block in the transaction inputs. |
| `undefined item 'get_block_number'` | `tx::get_block_number` no longer exists | Use `tx::get_reference_block_number`. |

---

## Custom auth components: transaction summary, `tx_policy`, and `guardian`

### Summary

The transaction summary now leads with `PARAMS_HEAD = [version, metadata, user_param0, user_param1]`, where `metadata` packs the bound block number with the expiration delta shifted left by 32 bits. As a result, `auth::create_tx_summary` takes six user params instead of seven and returns `PARAMS_HEAD, PARAMS_TAIL` first, and `auth::hash_and_insert_tx_summary` expects that order. `tx_policy::assert_no_output_notes` no longer takes a count of "own" notes, and `guardian::verify_signature` takes an `is_rotation` flag produced by the new `guardian::assert_rotation_policy`.

The changelog mentions the six user params. It does not mention the reordered outputs of `create_tx_summary`, the reordered inputs of `hash_and_insert_tx_summary`, or the `tx_policy`, `guardian` and `multisig_smart::enforce_note_restrictions` signature changes.

### Affected Code

From `miden::standards::auth::signature::authenticate_transaction`:

```masm
# Before (0.16)
push.0.0.0.0.0.0 movup.6
# => [user_params(7), PK_COMM, scheme_id]
exec.auth::create_tx_summary
# => [ACCOUNT_DELTA_COMMITMENT, INPUT_NOTES_COMMITMENT, OUTPUT_NOTES_COMMITMENT, BLOCK_COMMITMENT,
#     PARAMS_HEAD, PARAMS_TAIL, PK_COMM, scheme_id]
exec.auth::hash_and_insert_tx_summary
```

```masm
# After (0.17)
push.0.0.0.0.0 movup.5
# => [user_params(6), PK_COMM, scheme_id]
exec.authenticate_transaction_with_user_params
# which runs exec.auth::create_tx_summary:
# => [PARAMS_HEAD, PARAMS_TAIL, ACCOUNT_DELTA_COMMITMENT, INPUT_NOTES_COMMITMENT,
#     OUTPUT_NOTES_COMMITMENT, BLOCK_COMMITMENT, PK_COMM, scheme_id]
# and then exec.auth::hash_and_insert_tx_summary
```

New and changed signatures:

```masm
auth::create_tx_summary             # [user_params(6)] -> [PARAMS_HEAD, PARAMS_TAIL, ACCOUNT_DELTA, INPUT_NOTES, OUTPUT_NOTES, BLOCK_COMMITMENT]
auth::create_tx_summary_with_block  # [block_number, user_params(6)] -> same six words, bound to block_number
auth::hash_and_insert_tx_summary    # [PARAMS_HEAD, PARAMS_TAIL, ACCOUNT_DELTA, INPUT_NOTES, OUTPUT_NOTES, BLOCK_COMMITMENT] -> [TX_SUMMARY_COMMITMENT]
signature::authenticate_transaction_with_user_params  # [user_params(6), PK_COMM, scheme_id] -> []   (new)
tx_policy::assert_no_output_notes   # [] -> []                 (was [num_own_output_notes] -> [])
guardian::assert_rotation_policy    # [] -> [is_rotation]      (new)
guardian::verify_signature          # [is_rotation, MSG] -> [] (was [num_own_output_notes, MSG] -> [])
multisig_smart::enforce_note_restrictions  # [note_restrictions] -> [] (was [num_own_output_notes, note_restrictions])
```

### Migration Steps

1. Pass six user params, not seven, to `auth::create_tx_summary`. To bind a block other than the reference block, use `auth::create_tx_summary_with_block`.
2. Fix any stack manipulation between `create_tx_summary` and `hash_and_insert_tx_summary`: the summary words come out in a new order. If you only chain the two, step 1 is the whole change.
3. Prefer `signature::authenticate_transaction_with_user_params` over building the summary yourself.
4. Call `tx_policy::assert_no_output_notes` with no argument, and call it **before** `fee::pay_fee`: the fee note is an output note.
5. Guardian flows: call `guardian::assert_rotation_policy` before creating any note, keep its `is_rotation` result, and pass that to `guardian::verify_signature`.

On the Rust side, host code that parses the summary preimage from the advice map sees the new word order.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `transaction must not include output notes` | `assert_no_output_notes` called after `pay_fee` created the fee note | Call it before paying the fee. |

---

## Fee payment: `serial_number_block`, native fee asset only, and the removed 0.16.x helpers

### Summary

`fee::pay_fee` takes a `serial_number_block` below `CONVERSION_INFO`, and `fee::create_and_fund_fee_note` takes it on top, so the fee note's serial number is derived from a caller-chosen block. `fee::apply_cycle_margins` lost its second argument. `pay_fee` now also pins payment to the native fee asset at rate 1/1: whenever the fee is non-zero it asserts that the committed conversion info equals `fee::native_conversion_info` (`[fee_faucet_id_suffix, fee_faucet_id_prefix, 1, 1]`). In 0.16 it converted the fee into whatever faucet and rate the conversion info named. The protocol side of that change is on [Transaction Changes](./transaction-changes).

### Affected Code

From the standard single-sig auth component:

```masm
# Before (0.16)
dup exec.signature::estimate_authentication_cycles
# => [num_extra_cycles, scheme_id, CONVERSION_INFO, pad(12)]
swap movdn.5
# => [num_extra_cycles, CONVERSION_INFO, scheme_id, pad(12)]
exec.fee::pay_fee drop
# => [scheme_id, pad(12)]
```

```masm
# After (0.17)
dup exec.signature::estimate_authentication_cycles
# => [num_extra_cycles, scheme_id, CONVERSION_INFO, pad(12)]
swap movdn.5
# => [num_extra_cycles, CONVERSION_INFO, scheme_id, pad(12)]
exec.tx::get_reference_block_number movdn.5
# => [num_extra_cycles, CONVERSION_INFO, serial_number_block, scheme_id, pad(12)]
exec.fee::pay_fee drop
# => [scheme_id, pad(12)]
```

Signatures at 0.17:

```masm
fee::pay_fee                   # [num_extra_cycles, CONVERSION_INFO, serial_number_block] -> [total_sponsored_fee_amount]
fee::create_and_fund_fee_note  # [serial_number_block, ASSET_ID, ASSET_VALUE] -> []
fee::apply_cycle_margins       # [num_extra_cycles] -> [num_estimated_extra_cycles]   (was [num_extra_cycles, num_sponsorship_notes])
```

:::caution The 0.16.x fee helpers are not in the 0.17 release candidates
The fee-estimation and fee-bound helpers that shipped in 0.16.0 and 0.16.1 do not exist in the 0.17 release candidates, and the 0.17 changelog does not mention their removal. Replace them as follows.

| Removed (present in 0.16.0 / 0.16.1) | 0.17 replacement |
| --- | --- |
| `fee::estimate_fee` | No direct replacement. `pay_fee` now creates sponsorship notes first, then prices the transaction with `fee::apply_cycle_margins` + `tx::compute_fee` (`[num_extra_cycles, EXCLUDE_NOTES_COMMITMENT] -> [fee_amount]`); replicate that if you only need the amount. |
| `fee::assert_fee_bound`, `fee::FeeBound` | None needed: `pay_fee` rejects anything but the native fee asset at rate 1/1. |
| `fee::resolve_payment_info`, `fee::pay_estimated_fee` | `fee::pay_fee`. |
| `fee::pay_network_note_sponsorships` | `exec.tx::get_fee_asset_id exec.fees::create_network_note_sponsorships` (`pay_fee` already does this). |
| `fees::estimate_network_note_sponsorships` | None. |
| `auth::multisig::pay_bounded_fee` (0.16.1 only) | `exec.signature::estimate_multisig_authentication_cycles`, then `exec.fee::pay_fee`, as the 0.17 multisig component does (see [Multisig library procedures](#multisig-library-procedures-bind-a-caller-chosen-block)). |
:::

When the transaction creates a network note, `pay_fee` sponsors it before computing the fee, on fee-free chains too, and reaches the target's `fee_manager::estimate_note_fee` through FPI. That path caps the transaction's expiration at 20 blocks (see [Faucet callbacks and policies](#faucet-masm-mint_and_send-callbacks-and-policies)).

### Migration Steps

1. Before `exec.fee::pay_fee`, place a block number below `CONVERSION_INFO`. Single-sig style components use `exec.tx::get_reference_block_number movdn.5`; multisig components use the block their summary binds.
2. Before `exec.fee::create_and_fund_fee_note`, push the block number on top of `[ASSET_ID, ASSET_VALUE]`.
3. Drop the second argument of `fee::apply_cycle_margins`.
4. Replace any removed helper per the table above.
5. If your component called `tx_policy::assert_no_output_notes` with the count returned by `pay_bounded_fee`, call it with no argument, before paying the fee.
6. Commit the native conversion info in the auth args and fund the paying account with the native fee asset.

A missing `serial_number_block` does not fail at assembly: `pay_fee` consumes whatever element sits below `CONVERSION_INFO`, and asserts it is a u32 only when a non-zero fee is paid.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `undefined item '<procedure>'` (for example `undefined item 'estimate_fee'`) | Call to `fee::estimate_fee`, `fee::assert_fee_bound`, `multisig::pay_bounded_fee` and the other removed helpers | Rewrite per the table. |
| `the transaction fee must be paid in the native fee asset at rate 1/1` | Conversion info names another faucet or rate | Commit the native conversion info. |
| `paying a non-zero fee requires conversion info committed via the auth args` | No conversion info on a fee-charging chain | Commit the native conversion info. |

---

## `tx::get_fee_faucet_id` is now `tx::get_fee_asset_id`

### Summary

The accessor returns the fee asset ID word instead of the fee faucet ID felts. The changelog records the rename but not the change of output from two felts to a word.

### Affected Code

From `miden::standards::fee`:

```masm
# Before (0.16)
exec.tx::get_fee_faucet_id exec.fungible_asset::create_id
# => [FEE_ASSET_ID, ...]
```

```masm
# After (0.17)
exec.tx::get_fee_asset_id
# => [FEE_ASSET_ID, ...]
```

Where you need the faucet ID, convert the word back, as `fee::native_conversion_info` does:

```masm
# Before (0.16)
push.1.1
exec.tx::get_fee_faucet_id
# => [fee_faucet_id_suffix, fee_faucet_id_prefix, 1, 1]
```

```masm
# After (0.17)
push.1.1
exec.tx::get_fee_asset_id
exec.asset::id_into_faucet_id
# => [fee_faucet_id_suffix, fee_faucet_id_prefix, 1, 1]
```

### Migration Steps

1. Replace `exec.tx::get_fee_faucet_id exec.fungible_asset::create_id` with `exec.tx::get_fee_asset_id`.
2. Where you need the faucet ID, append `exec.asset::id_into_faucet_id` (from `miden::protocol::asset`).
3. Rename `kernel_proc_offsets::TX_GET_FEE_FAUCET_ID_OFFSET` to `TX_GET_FEE_ASSET_ID_OFFSET` if you syscall by hand (value `60` at rc.7).

---

## Multisig library procedures bind a caller-chosen block

### Summary

This section covers the MASM library side. The multisig flow itself (the bound block, `MultisigAuthArgs`, executing at the tip) is on [Transaction Changes](./transaction-changes).

`multisig::auth_tx` and `multisig_smart::auth_tx` take `[bound_block_num, approval_expiration_block_num, SALT]` instead of seven user params (`multisig_smart::auth_tx` also took a leading `num_own_output_notes`). The new `multisig::resolve_auth_args` decodes the auth args, whose advice preimage is now `[BLOCK_WORD, SALT, CONVERSION_INFO]`. Approvals expire relative to the bound block, and the guardian key must not be one of the approvers. This only affects components composed from `miden::standards::auth::multisig`; the standard components were updated.

### Affected Code

From the standard guarded multisig component (trimmed):

```masm
# Before (0.16)
dupw exec.fee::load_conversion_info
exec.multisig::get_initial_threshold_and_num_approvers drop
add.1
exec.multisig::pay_bounded_fee          # => [num_own_output_notes, AUTH_ARGS]
movdn.4
push.0.0.0
exec.multisig::auth_tx                  # [user_params(7)] -> [TX_SUMMARY_COMMITMENT]
dupw movup.8
exec.guardian::verify_signature         # [num_own_output_notes, MSG]
exec.multisig::record_and_assert_new_tx
```

```masm
# After (0.17)
exec.multisig::resolve_auth_args
# => [CONVERSION_INFO, bound_block_num, approval_expiration_block_num, SALT]
dup.5 exec.tx::get_reference_block_number
exec.multisig::assert_approval_not_expired movdn.10
exec.guardian::assert_rotation_policy movdn.11
exec.multisig::get_initial_threshold_and_num_approvers drop
add.1
exec.signature::estimate_multisig_authentication_cycles
dup.5 movdn.5                           # bound block doubles as the fee serial_number_block
exec.fee::pay_fee drop
exec.multisig::auth_tx                  # [bound_block_num, approval_expiration_block_num, SALT] -> [TX_SUMMARY_COMMITMENT]
dupw movup.9
exec.guardian::verify_signature         # [is_rotation, MSG]
exec.guardian::get_guardian_public_key
exec.multisig::assert_not_approver_public_key
exec.multisig::record_and_assert_new_tx
exec.multisig::apply_approval_expiration
```

### Migration Steps

1. Replace your auth-args decoding with `exec.multisig::resolve_auth_args`.
2. Call `multisig::assert_approval_not_expired` before verifying signatures and `multisig::apply_approval_expiration` after `record_and_assert_new_tx`, as above.
3. Replace `multisig::pay_bounded_fee` with `signature::estimate_multisig_authentication_cycles` + `fee::pay_fee`, passing the bound block as `serial_number_block`.
4. Pass `[bound_block_num, approval_expiration_block_num, SALT]` to `multisig::auth_tx` / `multisig_smart::auth_tx` (drop the leading `num_own_output_notes` you passed to `multisig_smart::auth_tx`), and `[note_restrictions]` alone to `multisig_smart::enforce_note_restrictions`.

On the Rust side, the new `MultisigAuthArgs` builds the preimage; `MultisigAuthArgs::with_approval_expiration_delta` sets an expiration relative to the bound block.

---

## `active_account::compute_commitment` moved to `native_account`

### Summary

The procedure now lives in `miden::protocol::native_account` and panics when the active account is a foreign account. The new `native_account::has_state_changed` wraps the common "initial versus current commitment" check.

### Affected Code

From the standard no-auth component:

```masm
# Before (0.16)
exec.native_account::get_initial_commitment
# => [INITIAL_COMMITMENT, pad(16)]
exec.active_account::compute_commitment
# => [CURRENT_COMMITMENT, INITIAL_COMMITMENT, pad(16)]
exec.word::eq not
# => [has_account_state_changed, pad(16)]
```

```masm
# After (0.17)
exec.native_account::has_state_changed
# => [has_account_state_changed, pad(16)]
```

### Migration Steps

1. Replace `active_account::compute_commitment` with `native_account::compute_commitment`.
2. Replace the "initial commitment, compute commitment, `word::eq not`" sequence with `native_account::has_state_changed`.
3. Remove any call from a procedure reachable through FPI; there is no foreign-account equivalent.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `the active account is not native` | `native_account::compute_commitment` or `has_state_changed` reached from a foreign context | Only call it from the native account. |
| `undefined item 'compute_commitment'` | `active_account::compute_commitment` | Use `native_account::compute_commitment`. |

---

## Standards modules moved: `note_tag`, `note_execution_hint`, MINT, `note_creator`

### Summary

Several standards modules moved under `miden::standards::note`, and the per-kind MINT modules became private.

| 0.16 | 0.17 |
| --- | --- |
| `miden::standards::note_tag` (`create_account_target`, `create_custom_account_target`, `DEFAULT_TAG`) | `miden::standards::note::note_tag` |
| `miden::standards::note::execution_hint` (`NONE`, `ALWAYS`, `AFTER_BLOCK`, `ON_BLOCK_SLOT`) | `miden::standards::note::note_execution_hint` |
| `miden::standards::notes::mint_fungible::mint`, `notes::mint_non_fungible::mint` | Private (`notes::mint::fungible`, `notes::mint::non_fungible`); only the dispatcher `notes::mint::main` is public |
| Component namespace `miden::standards::components::wallets::note_creator` | `miden::standards::components::note::note_creator` |

The library procedure `miden::standards::note::note_creator::create_note` is unchanged. The basic wallet now also re-exports it as `miden::standards::wallets::basic::create_note`, with the same procedure root.

The `execution_hint` → `note_execution_hint` rename is not in the changelog.

### Affected Code

From the standard PSWAP note script:

```diff
- use miden::standards::note_tag
+ use miden::standards::note::note_tag
```

```masm
# Before (0.16) - notes/mint.masm
use miden::standards::notes::mint_fungible
exec.mint_fungible::mint
```

```masm
# After (0.17) - notes/mint/mod.masm; the submodules are private to `mint`
mod fungible
exec.fungible::mint
```

### Migration Steps

1. `use miden::standards::note_tag` → `use miden::standards::note::note_tag`.
2. `use miden::standards::note::execution_hint` → `use miden::standards::note::note_execution_hint`. Update `execution_hint::ALWAYS` and friends accordingly, or alias the import.
3. Stop importing `notes::mint_fungible` / `notes::mint_non_fungible`. Build MINT notes with the standard MINT script (`notes::mint::main`, Rust `MintNote`); there is no public per-kind entry point.
4. If you referenced the note-creator component by its package namespace, switch to `miden::standards::components::note::note_creator`.

On the Rust side, `NoteCreator` moved from `account::wallets` to `account::note_creator`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `undefined item '<module path>'` (for example `undefined item 'miden::standards::note_tag'`) | Old module path | Use the new path from the table. |
| `undefined item '<module path>'` | Importing the private `notes::mint::fungible` / `non_fungible`, or the old `notes::mint_fungible` / `mint_non_fungible` | Use the MINT dispatcher. |

---

## Fungible amount extraction renamed; `value_into_amount` now validates

### Summary

The unsuffixed name is now the validating one. Because `fungible_asset::value_into_amount` kept its name and stack effect but changed meaning, old call sites assemble and now also validate the value.

| 0.16 | 0.17 | Stack effect |
| --- | --- | --- |
| `miden::protocol::asset::fungible_value_into_amount` | `fungible_value_into_amount_unchecked` | `[ASSET_VALUE] -> [amount]` |
| `fungible_asset::value_into_amount` (unchecked) | `fungible_asset::value_into_amount_unchecked` | `[ASSET_VALUE] -> [amount]` |
| `fungible_asset::to_amount` | `fungible_asset::to_amount_unchecked` | `[ASSET_ID, ASSET_VALUE] -> [amount, ASSET_ID, ASSET_VALUE]` |
| `fungible_asset::try_value_to_amount` (validating) | `fungible_asset::value_into_amount` | `[ASSET_VALUE] -> [amount]` |

Also new: `fungible_asset::validate` (`[ASSET_ID, ASSET_VALUE] -> [ASSET_ID, ASSET_VALUE]`).

### Affected Code

From `miden::standards::faucets::fungible::receive_and_burn`:

```diff
- exec.fungible_asset::to_amount movdn.8
+ exec.fungible_asset::to_amount_unchecked movdn.8
```

### Migration Steps

1. Rename `try_value_to_amount` to `value_into_amount`, `to_amount` to `to_amount_unchecked`, and `asset::fungible_value_into_amount` to `asset::fungible_value_into_amount_unchecked`.
2. Review every existing `fungible_asset::value_into_amount` call: keep it if validation is acceptable, otherwise rename it to `value_into_amount_unchecked`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `fungible asset value is not well-formed` | Old `value_into_amount` call site now validates a value whose top three elements are not zero | Pass a real fungible value, or use `value_into_amount_unchecked`. |
| `fungible asset build operation called with amount that exceeds the maximum allowed asset amount` | Same, with an amount above `MAX_AMOUNT` | Same. |

---

## Faucet MASM: `mint_and_send`, callbacks, and policies

### Summary

The faucet changes themselves are on [Assets, Vault & Faucet Changes](./asset-vault-faucet). The MASM-visible parts:

- **`faucets::non_fungible::mint_and_send`** takes the full asset, like the fungible one, and asserts the asset ID belongs to the active faucet. Non-fungible MINT note storage grew from 9 / 16+ items (private / public) to 13 / 20+. The fungible `mint_and_send` rejects a zero amount, and `receive_and_burn` validates that the burned asset is fungible.
- **Asset callbacks and transfer policies return nothing.** `on_before_asset_added_to_account` / `on_before_asset_added_to_note` callbacks and the `TokenPolicyManager` send and receive policies return `[pad(16)]`; the kernel keeps the original asset value. `policy_manager::invoke_send_policy` / `invoke_receive_policy` output `[pad(16)]` instead of `[PROCESSED_ASSET_VALUE, pad(12)]`. A callback root must be a procedure of the faucet's own code, and a new account with a callback storage slot must have the callback flag enabled.
- **Mint policies may only change the asset value.** `policy_manager::execute_mint_policy` saves `tag`, `note_type` and `RECIPIENT` before the policy `dyncall` and asserts they come back unchanged. The policy signature is unchanged (`[ASSET_VALUE, tag, note_type, RECIPIENT, pad(6)]` in and out).
- **Transfer policies cap the expiration at 20 blocks.** `expiration::apply_default` sets the transaction expiration delta to at most 20 blocks. It runs in `policy_manager::invoke_transfer_policy` (every movement of a callback-enabled faucet asset whose send or receive policy slot is set), in the basic allowlist and blocklist policies, and in `fee_manager::estimate_note_fee`. The delta only ever decreases, so the tightest bound wins. See [Transaction Changes](./transaction-changes) for the effect on submission.

:::note Stale doc comment
The doc comment in `miden::standards::expiration` says policy dispatchers leave the expiration delta to the invoked policy. The shipped `policy_manager::invoke_transfer_policy` calls `expiration::apply_default` itself.
:::

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

1. Build the non-fungible asset with `non_fungible_asset::create` (`[faucet_id_suffix, faucet_id_prefix, ASSET_VALUE] -> [ASSET_ID, ASSET_VALUE]`) and pass both words to `mint_and_send`; trim the padding from 6 to 2.
2. Custom non-fungible MINT notes: store the full asset (13 items private, 20+ public). Prefer the Rust `MintNote` builder.
3. Do not mint zero amounts.
4. Make custom callbacks and transfer policies consume `[ASSET_ID, ASSET_VALUE, custom_data]` and return `[pad(16)]`. An old callback that returns the value still runs, but its return value is ignored. Stop reading a processed value from `invoke_send_policy` / `invoke_receive_policy`.
5. Register only callback roots that are procedures of the faucet's own code.
6. Remove any tag, note type or recipient rewriting from custom mint policies; only adjust `ASSET_VALUE`.
7. If your own FPI-callable procedure reads mutable state, call `expiration::apply_default` (or `tx::update_expiration_block_delta`) on that path.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `the asset stored in the MINT note does not belong to this faucet` | `ASSET_ID` of another faucet | Derive the ID for the minting faucet. |
| `failed to decode note_type into u8` | Old `mint_and_send` frame without `ASSET_ID`, read shifted by one word | Pass `[ASSET_ID, ASSET_VALUE, tag, note_type, RECIPIENT, pad(2)]`. |
| `non-fungible MINT script expects exactly 13 storage items for private or 20+ storage items for public output notes` | Old 9 / 16 item layout | Store the full asset. |
| `the amount to mint is zero` | Fungible mint of 0 | Mint a positive amount. |
| `fungible asset ID's composition must be fungible` | `receive_and_burn` given a non-fungible asset | Burn through the matching faucet kind. |
| `the faucet callback procedure root is not part of the faucet's account code` | Callback slot points at a foreign root | Store a root of the faucet's own procedure. |
| `an account whose storage contains an asset callback slot must have the asset callback flag enabled` | New account with a callback slot but the flag off | Enable the flag (the Rust `AccountBuilder` now derives it). |
| `mint policy must not modify the output note tag or type` | Policy changed `tag` or `note_type` | Return them unchanged. |
| `mint policy must not modify the output note recipient` | Policy changed `RECIPIENT` | Return it unchanged. |

---

## Core library: precompile wrappers moved under `miden::core`, and `claim::kernel_commitment` removed

### Summary

In 0.16 the precompile wrappers were a separate MASM package, `miden-precompiles`, with namespace `miden::precompiles`. The sources now live inside the `miden-core` package as the `precompiles` submodule, so every path gains a `core::` segment. The procedure sets are unchanged apart from the path.

The 0.16 version of this page pointed custom precompile wrappers at `miden::precompiles::*`; in 0.17 that is `miden::core::precompiles::*`. Application code that only calls the `miden::core::crypto::*` facades (`keccak256::hash_bytes`, `ecdsa_k256_keccak::verify`, ...) needs no change. The changelog only says the package was merged into `miden-core`; it does not say the MASM paths moved.

| 0.16 module | 0.17 module |
| --- | --- |
| `miden::precompiles` (`digest_expr`, `register_expr`, `register_value`, `register_mem`, `register_chunks_mem`, `register_chunks_mem_1/2/3`, `log_deferred`, `word_eq`) | `miden::core::precompiles` (same procedures) |
| `miden::precompiles::hashes::keccak256` (`hash_bytes_mem`, `hash_1_chunk_mem`, `hash_2_chunks_mem`) | `miden::core::precompiles::hashes::keccak256` |
| `miden::precompiles::curves::secp256k1` | `miden::core::precompiles::curves::secp256k1` |
| `miden::precompiles::fields::k1_base`, `...::k1_scalar` | `miden::core::precompiles::fields::k1_base`, `...::k1_scalar` |
| `miden::precompiles::u256` | `miden::core::precompiles::u256` |

The host event names did **not** move: the wrappers still emit `miden::precompiles::hashes::keccak256::digest` and `miden::precompiles::fields::field_inv`, so custom host handlers keyed on those names keep working.

Separately, `miden::core::sys::vm::claim::kernel_commitment` was removed. It hashed a kernel-procedure digest list into the canonical kernel commitment; call `poseidon2::hash_elements_in_domain` with the kernel domain tag instead, which is exactly what the removed procedure did.

### Affected Code

```masm
# Before (0.16)
use miden::precompiles::hashes::keccak256
use miden::precompiles::curves::secp256k1
use miden::precompiles::fields::k1_base
use miden::precompiles::fields::k1_scalar
```

```masm
# After (0.17)
use miden::core::precompiles::hashes::keccak256
use miden::core::precompiles::curves::secp256k1
use miden::core::precompiles::fields::k1_base
use miden::core::precompiles::fields::k1_scalar
```

If your `miden-project.toml` declared the precompiles package as a dependency, drop it; `miden-core` now carries it:

```diff
 [dependencies]
-miden-precompiles = { version = "0.29", linkage = "dynamic" }
```

The kernel commitment, inlined:

```masm
# Before (0.16)
use miden::core::sys::vm::claim

# [kernel_ptr, num_kernel_procedures, ...]
exec.claim::kernel_commitment
# => [K, ...]
```

```masm
# After (0.17) - the removed procedure's body, inlined
use miden::core::crypto::hashes::poseidon2

const KERNEL_DOMAIN_TAG = 0x01000001   # miden_core::program::KERNEL_DOMAIN_TAG

# [kernel_ptr, num_kernel_procedures, ...]
swap u32assert.err="number of kernel procedures must fit in a u32"
mul.4 swap
# => [kernel_ptr, num_elements, ...]
push.KERNEL_DOMAIN_TAG movdn.2
exec.poseidon2::hash_elements_in_domain
# => [K, ...]
```

To copy digests from advice and hash them in one pass, use the new `mem::pipe_words_to_memory_in_domain` (`[domain, num_words, write_ptr, ...] -> [DIGEST, write_ptr', ...]`) with `KERNEL_DOMAIN_TAG` as the domain.

### Migration Steps

1. Replace every `use miden::precompiles::...` with `use miden::core::precompiles::...`.
2. Remove any `miden-precompiles` dependency from `miden-project.toml`; depend on `miden-core` only. (The `miden-precompiles` Rust crate still exists; this is about the MASM package.)
3. Replace `exec.claim::kernel_commitment` with the inlined sequence above.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `undefined item 'miden::precompiles::hashes::keccak256'` | Import of the old namespace | Import `miden::core::precompiles::hashes::keccak256`. |

---

## In-VM proof verification: `verify_vm_proof` is `verify_proof`

### Summary

`miden::core::sys::vm::verify_vm_proof`, which the 0.16 guide taught, was renamed to `verify_proof`. It now returns a 12-element security descriptor on top of the deferred root `D` (16 elements in total) instead of `D` followed by four raw proof parameters (8 elements). The security estimator moved from `sys::vm::compute_conjectured_security_level` (which took `[num_queries, query_pow_bits]`) to `stark::security::compute_conjectured_security_level`, which consumes the whole descriptor unchanged.

Both recursive verifiers now run in an isolated memory context. In 0.16 `verify_vm_proof` ran in the caller's context and wrote its state into the caller's memory starting at address `3223322624` (`2^31 + 2^30 + 2^21`). In 0.17 the caller's memory is untouched and every stack element below the input word is preserved.

### Affected Code

```masm
# Before (0.16): [CLAIM_COMMITMENT, ...] on the stack, proof request already on the advice stack
use miden::core::sys::vm

exec.vm::verify_vm_proof                            # => [D, num_queries, query_pow_bits, deep_pow_bits, folding_pow_bits, ...]
swapw exec.vm::compute_conjectured_security_level   # => [level, deep_pow_bits, folding_pow_bits, D, ...]
u32lt.96 assertz.err="proof security level is below the accepted target"
drop drop                                           # => [D, ...]
```

```masm
# After (0.17)
use miden::core::sys::vm
use miden::core::stark::security

exec.vm::verify_proof                               # => [security_descriptor(12), D, ...]
exec.security::compute_conjectured_security_level   # => [level, D, ...]
u32lt.96 assertz.err="proof security level is below the accepted target"
# => [D, ...]
```

The proof request key is derived from the verifier's root, so the `procref` used to build it changes too: `procref.vm::verify_vm_proof exec.sys::build_proof_request_key` becomes `procref.vm::verify_proof exec.sys::build_proof_request_key`.

If you discard the results, drop four words instead of two:

```diff
 exec.vm::verify_proof
-# => [D, num_queries, query_pow_bits, deep_pow_bits, folding_pow_bits]
-dropw dropw
+# => [security_descriptor, D]
+dropw dropw dropw dropw
```

The descriptor, top first, is `[lookup_pow_bits, num_composed_constraints, max_constraint_degree, num_deep_terms, max_message_width, num_lookup_boundary_terms, lookup_fractions_per_row, log_max_height, num_queries, query_pow_bits, deep_pow_bits, folding_pow_bits]`. The four old parameters are elements 8 to 11. The new estimator is not a general-purpose calculator: pass it the descriptor a verifier returned, unmodified.

New in the same area: `miden::core::sys::pvm::verify_proof` verifies a precompile-VM proof for a deferred root (`[D, ...] -> [security_descriptor(12), ...]`), and `sys::pvm::request_proof` emits `miden::core::sys::pvm::request_proof` so a host can supply the proof package on demand.

### Migration Steps

1. Rename `vm::verify_vm_proof` to `vm::verify_proof`, including `procref.vm::verify_vm_proof` used to derive request keys.
2. Add `use miden::core::stark::security` and replace `swapw exec.vm::compute_conjectured_security_level` with `exec.security::compute_conjectured_security_level` directly on the verifier output.
3. Rebalance the stack: the verifier returns 16 elements, not 8; the estimator consumes 12 and returns 1.
4. Delete any code that read verifier state back out of memory after the call (for example through the `stark::constants::*_ptr` accessors): that memory now belongs to a separate context. Some of those accessors, such as `claim_ptr`, also moved from `stark::constants` to `sys::vm::layout`, so a stale call fails with `undefined item 'claim_ptr'`. You no longer need to keep the `3223322624..` region free.
5. Delete any stack padding you added to compensate for elements the verifier consumed beyond its documented inputs; the documented stack effect is now exact.

On the Rust side, `CoreLibrary::recursive_verifier_root()` became `vm_recursive_verifier_root()` (see [VM & Assembler Changes](./vm-assembler)).

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `undefined item 'verify_vm_proof'` or `undefined item 'compute_conjectured_security_level'` | Procedure renamed or moved | Use `vm::verify_proof` and `security::compute_conjectured_security_level`. |

---

## Core-library procedure roots moved

### Summary

A procedure's MAST root changes whenever its instructions change. Between VM 0.29.2 (0.16) and 0.33.0 (0.17.0-rc.7) many exported procedures got a new root, so any root you recorded (proof-request keys, allowlists, `dynexec` / `dyncall` targets) is stale. They include:

| Procedure | Root changed in VM | Why |
| --- | --- | --- |
| `crypto::dsa::ecdsa_k256_keccak::verify`, `verify_bytes` | 0.30, 0.31 | Internal refactors |
| `sys::vm::verify_vm_proof` → `sys::vm::verify_proof` | 0.30, 0.31, 0.33 (and again in 0.34) | ACE registry, rename and security descriptor, context isolation |
| `sys::pvm::verify_proof` (new in 0.30) | 0.31, 0.33 (and again in 0.34) | Same |
| `math::u64::shl`, `shr`, `rotl`, `rotr` | 0.31 | Range check added (see [below](#instruction-and-core-library-behaviour-changes)) |
| `collections::sorted_array::find_word`, `find_key_value`, `find_half_key_value` | 0.30 | u32 pointer checks |
| `crypto::dsa::falcon512_poseidon2::verify`, `load_h_s2_and_product` | 0.30 | Horner evaluation-point layout |
| `mem::pipe_words_to_memory`, `mem::pipe_preimage_to_memory`, `collections::mmr::unpack` | 0.30 | Advice pipe refactored for domain-separated hashing (`unpack` calls `pipe_preimage_to_memory`) |

Also changed: `crypto::hashes::keccak256::hash` and `merge` (`hash_bytes` kept its root), and many of the recursive verifier's helpers under `stark::*`, `pcs::*` and `sys::vm::*`. The new `stark::security::compute_conjectured_security_level` gets another new root in 0.34, like the two verifiers. Procedures of your own that use bare `exp` also get a new root (see [below](#instruction-and-core-library-behaviour-changes)).

The changelog announces the ECDSA `verify` root change in VM 0.30, but not the second change in 0.31.

### Migration Steps

1. Derive roots at run time instead of pinning them: in MASM with `procref.<module>::<proc>`; in Rust with `CoreLibrary::vm_recursive_verifier_root()`, `pvm_recursive_verifier_root()`, `conjectured_security_estimator_root()`, or `core_lib.package().get_procedure_root_by_path("::miden::core::...")`.
2. Re-register recursive-verification proof packages: request keys are derived from the verifier root, so packages keyed under a 0.29 root are not found.
3. Keep the prover, the host and the consuming program on the same VM release.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `procedure with root digest <root> could not be found` | A pinned root of a core-library procedure that no longer exists in the loaded library | Re-derive the root from the library you load. |

---

## Instruction and core-library behaviour changes

### Summary

These change behaviour at run time without any assembly error.

| Instruction / procedure | 0.16 (VM 0.29.2) | 0.17 (VM 0.33) |
| --- | --- | --- |
| `u64::shl`, `shr`, `rotl`, `rotr` | No explicit check; `rotl` / `rotr` accepted out-of-range amounts | Trap with `shift amount must be in the range [0, 64)` when `n >= 64`; 6 more cycles each |
| Bare `exp` | Exponent up to `2^64 - 1`, 73 cycles | Lowers to `exp.u63`: exponent must be `< 2^63`, 72 cycles; larger exponents trap |
| `horner_eval_base` | Read two elements at `alpha_addr` and `alpha_addr + 1`, any alignment | Reads one word-aligned word that must be `[alpha0, alpha1, 0, 0]` |
| `horner_eval_ext` | Read a word; elements 2 and 3 ignored | Elements 2 and 3 must be zero |
| secp256k1 MSMs (`mul_scalar`, `mul_scalar_generator`, `msm_mem`, `msm2`, `msm2_generator`) | Zero scalars and repeated bases rejected during deferred evaluation | Accepted; the result may be the identity point |

Details:

- **`u64` shifts** (`miden::core::math::u64`): new cycle counts are `shl` 21 → 27, `shr` 60/61 → 66/67, `rotl` 46 → 52, `rotr` 60 → 66. The VM changelog files this check under 0.29.0, but it is absent at 0.29.2 and first ships in 0.31.
- **`exp`**: `exp.uXX` (XX in 0..=63) and `exp.<imm>` are unchanged. Procedures containing bare `exp` get a new MAST root.
- **secp256k1 MSMs** (`miden::core::precompiles::curves::secp256k1`): an identity value used as an MSM base is still rejected.
- **Merkle depth**: `mtree_verify` now rejects a depth of 0 or above 64 before touching the advice provider. `mtree_get` and `mtree_set` fetch the node from the advice provider first: a depth above 64 fails that lookup (`provided node index <index> is out of bounds for a merkle tree node at depth <depth>`), and a depth of 0 on a root in the store reaches the new depth check. Details are on [VM & Assembler Changes](./vm-assembler).

### Affected Code

The Horner evaluation point:

```masm
# Before (0.16): any address for horner_eval_base; ext ignored elements 2..3
push.ALPHA_1 push.ALPHA_0 push.ALPHA_ADDR mem_store push.ALPHA_ADDR add.1 mem_store
```

```masm
# After (0.17): ALPHA_ADDR word-aligned, word = [alpha0, alpha1, 0, 0]
push.0.0 push.ALPHA_1 push.ALPHA_0   # => [alpha0, alpha1, 0, 0]
push.ALPHA_ADDR mem_storew_le dropw
```

### Migration Steps

1. Reduce shift and rotation amounts modulo 64 (or bounds-check them) before calling `u64::shl`, `shr`, `rotl` or `rotr`, and update cycle budgets.
2. If an `exp` exponent can reach `2^63` or more, reduce it (for field elements, exponents can be taken mod `p - 1`) or split the exponentiation. Update any pinned root of a procedure that uses bare `exp`.
3. Store the Horner evaluation point at a word-aligned address as `[alpha0, alpha1, 0, 0]`, and clear elements 2 and 3 if you kept other data there.
4. If you relied on secp256k1 MSMs failing for zero scalars or duplicate bases, check those conditions explicitly, and handle an identity result (for example with `secp256k1::is_identity` or `assert_not_identity`).
5. Keep Merkle depths in `1..=64`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `assertion failed with error message: shift amount must be in the range [0, 64)` | `u64` shift or rotation with `n >= 64` | Reduce or check `n` first. |
| `Horner evaluation point at memory address <addr> in context <ctx> must be encoded as [alpha0, alpha1, 0, 0]` | Non-zero elements 2 and 3 | Zero them. |
| `word access at memory address <addr> in context <ctx> is unaligned: word accesses require addresses that are multiples of 4` | Unaligned `alpha_addr` | Align it to 4. |
| `Merkle tree depth must be in the range 1..=64, but was <depth>` | `mtree_verify` with depth 0 or above 64, or `mtree_get` / `mtree_set` with depth 0 | Use a depth in `1..=64`. |
| `provided node index <index> is out of bounds for a merkle tree node at depth <depth>` | `mtree_get` / `mtree_set` with a depth above 64 (the advice lookup fails before the depth check) | Same. |

---

## Trace events are back

### Summary

The 0.16 version of this page said `trace.<n>` was removed with no replacement. That was too strong: in 0.16 you could still emit a trace event by hand (below). In 0.17, `trace` is an instruction again: `trace`, `trace.CONST` and `trace.event("...")` emit optional, read-only trace events that the host handles through `on_trace` / `DefaultHost::register_trace_handler` (that host API already existed in 0.16). Trace IDs must come from an `event("...")` constant or the inline form; a bare numeric immediate such as `trace.5` is not accepted.

### Affected Code

```masm
# Before (0.16): manual form
const SYS_EVENT = event("sys::trace_event")
push.MY_TRACE
emit.SYS_EVENT
drop
```

```masm
# After (0.17)
const MY_TRACE = event("miden_debug::println")
trace.MY_TRACE                         # stack-neutral, 5 cycles
trace.event("miden_debug::println")    # inline form
push.<felt> trace                      # stack form, 3 cycles, id left on stack
```

### Migration Steps

1. Replace the manual `push` / `emit` / `drop` sequence with `trace.CONST` or `trace.event("...")`.
2. Define trace IDs with `event("...")`; do not port a numeric `trace.<n>` literally.

---

## MASM language: built-in `u256`, `@bigendian` removed, ABI attributes imply `@callconv`

### Summary

- **`u256` is a built-in type.** The core library used to declare `pub type u256 = struct { lo: u128, hi: u128 }` in `miden::core::math::u256` because the parser had no `u256` keyword. `u256` is now a built-in type name and the alias was deleted. This is not in the changelog.
- **`@bigendian` struct representation removed.** `type T = struct @bigendian { ... }` no longer parses. The remaining struct annotations are `@packed`, `@packed(N)`, `@transparent` and `@align(N)`. This is not in the changelog.
- **Protocol ABI attributes imply the component-model calling convention.** A procedure annotated `@account_procedure`, `@auth_script`, `@note_script` or `@transaction_script` now gets `@callconv("component-model")` automatically. Combining one of these with a different explicit `@callconv(...)`, or putting two different protocol ABI attributes on one procedure, is a parse error.

### Affected Code

```masm
# Before (0.16)
use miden::core::math::u256
proc my_add(a: u256::u256, b: u256::u256) -> u256::u256
```

```masm
# After (0.17)
proc my_add(a: u256, b: u256) -> u256
```

```masm
# Before (0.16)
type BeWord = struct @bigendian { a: felt, b: felt, c: felt, d: felt }
```

```masm
# After (0.17)
type BeWord = struct { a: felt, b: felt, c: felt, d: felt }
```

```masm
# Rejected in 0.17:
@note_script
@callconv("fast")
pub proc main
    ...
end

@auth_script
@account_procedure
pub proc auth
    ...
end
```

```masm
# Accepted: omit @callconv, or state the matching one
@note_script
pub proc main
    ...
end
```

### Migration Steps

1. Replace `u256::u256` (or any alias of `miden::core::math::u256::u256`) in type positions with the built-in `u256`.
2. Remove `@bigendian` from struct declarations.
3. Remove any `@callconv(...)` other than `"component-model"` from procedures that carry a protocol ABI attribute, and keep one protocol ABI attribute per procedure.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `conflicting attributes for procedure definition` | `@callconv` conflicts with the ABI attribute, or two ABI attributes on one procedure | Drop the conflicting attribute. |
| `invalid struct annotation` (help: ``expected one of: '@packed', '@packed(N)', '@transparent', or '@align(N)'``) | `@bigendian` | Remove it. |

---

## Procedure type signatures and typed pointers

### Summary

Almost every public procedure in the protocol and standards libraries now carries a type signature, pointer arguments use `ptr<T>`, and the shared types moved to `miden::protocol_utils::types` (still re-exported from `miden::protocol::types`). Signatures do not change how you invoke a procedure: the assembler performs no call-site type check, so they neither break nor protect existing call sites (see [the stack-effect table](#procedures-that-kept-their-name-but-changed-their-stack-effect)).

| 0.16 | 0.17 |
| --- | --- |
| `miden::protocol::types::MemoryAddress` (`u32`) | Removed; use `ptr<felt>`, `ptr<word>`, `ptr<Asset>` and so on |
| `miden::protocol::types::DoubleWord = struct { word_lo: word, word_hi: word }` | `struct { lo: word, hi: word }` |
| `double_word_array::DoubleWord` (8 felt fields `a` to `h`) | Re-export of `miden::protocol::types::DoubleWord` |
| `miden::protocol::types::NoteType = u8` | `enum NoteType : u8 { PRIVATE = 0, PUBLIC = 1 }` (values unchanged) |
| (new) | `AssetClass`, `AssetMetadata`, `AssetComposition`, `BlockCommitment`, `NoteArgs`, `NoteSerialNumber`, `Note*Commitment` in `miden::protocol::types`; `miden::standards::types` (`AuthArgs`, `Commitment`, `Uint64/128/256`, ...) |

### Migration Steps

1. Replace `MemoryAddress` in your own signatures with a `ptr<...>` type.
2. Update struct field names if your signatures destructure `DoubleWord`.

---

## Low-level protocol helpers removed or made private

### Summary

Internal helpers that were public in 0.16.1 are now private or gone. The `input_note::*_raw` and `note::write_*` helpers now live in `input_note_internal` and `note_internal`, new private submodules of `miden::protocol` that cannot be imported.

| Removed in 0.17 | Use instead |
| --- | --- |
| `input_note::get_initial_assets_raw`, `get_initial_assets_info_raw`, `get_asset_raw`, `remove_asset_raw`, `remove_all_assets_raw`, `get_note_id_raw`, `get_attachments_commitment_raw` | The indexed `input_note::*` or `active_note::*` procedures (`input_note::remove_asset` takes `[ASSET_ID, ASSET_VALUE, note_index]`). |
| `note::write_assets_to_memory`, `note::write_attachment_commitments_to_memory`, `note::write_attachment_to_memory`, `note::write_indexed_attachment_to_memory` | `active_note::get_initial_assets`, `input_note::get_initial_assets`, `output_note::get_assets`, and the `write_attachment_to_memory` / `write_attachment_commitments_to_memory` procedures of `active_note`, `input_note` and `output_note`. |
| `miden::protocol::account_id::validate` | `account_id::validate_structure` (unlike `validate`, it does not check that the ID version is supported, only that it is non-zero) |
| `miden::protocol::types::MemoryAddress` | Typed pointers such as `ptr<felt>`. |
| `miden::standards::tx_scripts::send_notes::common::WORD_NUM_ELEMENTS` | `miden::protocol::constants::WORD_NUM_ELEMENTS` |

The changelog also names `active_note`, but no `active_note` procedure was removed: the removed ones are the seven `input_note::*_raw` procedures and the four `note::write_*` helpers.

### Migration Steps

1. Replace each removed item per the table.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `undefined item '<name>'` (for example `undefined item 'get_asset_raw'`) | Any removed item above | Per the table. |

---

## Asset ID and note metadata encodings gained version bits

### Summary

The asset metadata byte in an asset ID is now `[reserved(2) | composition(2) | version(4)]`, with version 1 in bits 0-3 and composition in bits 4-5. The first note metadata felt ends in `[reserved(1) | note_type(1) | version(6)]`, so the note type is at bit 6. The kernel validates both versions. `fungible_asset::create_id`, `non_fungible_asset::create` and `note::metadata_into_note_type` handle this for you. See [Assets, Vault & Faucet Changes](./asset-vault-faucet) and [Note Changes](./note-changes) for the Rust side.

:::caution Hand-built IDs change meaning
Non-fungible metadata is `0x01` in 0.17 (`ASSET_METADATA_NONE`), which is the value a 0.16 fungible ID used. A 0.16 non-fungible ID (metadata `0x00`) fails the version check.
:::

### Affected Code

```masm
# Before (0.16) - assets/fungible_asset.masm create_id
push.COMPOSITION_FUNGIBLE     # metadata byte 0x01
add
```

```masm
# After (0.17) - assets/fungible_asset.masm create_id
add.ASSET_METADATA_FUNGIBLE   # 0x11: composition fungible (bits 4-5) | version 1 (bits 0-3)
```

```masm
# Before (0.16) - note::metadata_into_note_type
u32shr.4
# After (0.17)
u32shr.6
```

### Migration Steps

1. Build asset IDs with `fungible_asset::create_id` / `fungible_asset::create` / `non_fungible_asset::create`, never by adding composition constants by hand.
2. Decode the note type with `note::metadata_into_note_type`, not by shifting.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `unknown asset ID version` | Metadata byte whose version bits are not 1 (for example a 0.16 non-fungible ID, metadata `0x00`) | Use the standards builders. |
| `note metadata has an unsupported version` | Input note metadata with a version other than 1, for example a 0.16 public note (low byte `0x11` reads as version 17) | Use notes created by the 0.17 kernel. |
| `note metadata has a non-zero reserved bit` | Hand-built metadata with bit 7 set | Same. |

---

## Kernel entry points: `syscall` and foreign procedure roots

### Summary

- **Only `exec_kernel_proc` is a valid `syscall` target.** The kernel root module is now `lib/dispatcher.masm`, which exports only `exec_kernel_proc`; the 61 API procedures moved to the `api` submodule and are no longer kernel exports. Going through `miden::protocol::*`, or through `syscall.exec_kernel_proc` with a `kernel_proc_offsets` constant, is unaffected.
- **A foreign procedure must belong to the foreign account's code.** `tx::execute_foreign_procedure` now fails unless `FOREIGN_PROC_ROOT` is a procedure the foreign account exports; with the standard host, the procedure-index lookup rejects the root before the kernel's own assertion runs. In 0.16 the kernel only checked that the root was non-zero, so a caller could run an arbitrary MAST root, for example a library procedure that reads the foreign account's storage, under that account's identity. Faucet callback roots get the same check (see [Faucet callbacks and policies](#faucet-masm-mint_and_send-callbacks-and-policies)).

### Migration Steps

1. Replace any `syscall.<kernel api procedure>` with the matching `miden::protocol::*` procedure.
2. For FPI, pass the root of a procedure the foreign account exports; a library procedure it does not export is rejected.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `undefined item '::$kernel::<name>'` | `syscall.<name>` to a kernel API procedure (for example `syscall.account_get_id`) | Use the protocol library. |
| `account procedure with procedure root <root> is not in the account procedure index map` | FPI to a root the foreign account does not export; reported as the cause of an event error for `miden::protocol::account::push_procedure_index` | Call a procedure the foreign account exports. |

---

## Other MASM changes

- **New procedures and constants worth adopting** (additive):
  - `active_note::get_storage_info` (`[] -> [NOTE_STORAGE_COMMITMENT, num_storage_items]`) and `active_note::get_bounded_storage` (`[dest_ptr, max_num_storage_items] -> [num_storage_items]`).
  - `miden::protocol::constants::MAX_ASSETS_PER_NOTE` (16; in 0.16.1 only the kernel had it) and `miden::protocol::tx::MAX_EXPIRATION_BLOCK_DELTA` (65535).
  - `native_account::has_state_changed`, `tx::get_reference_block_commitment`, `fungible_asset::validate`.
  - `miden::standards::expiration::apply_default` and `DEFAULT_EXPIRATION_BLOCK_DELTA` (20).
  - `miden::standards::auth::eip712`, `auth::eip712_transaction_summary`, `access::role_symbol`, and the `tx_fee_collector` auth component (`miden::standards::components::auth::tx_fee_collector`).
- **EVM-style ECDSA public-key recovery**: `ecdsa_k256_keccak::recover` (`[MSG_WORD, SIG_PTR, ...] -> [QX[8], QY[8], ...]`) and `recover_bytes` (`[MSG_PTR, MSG_LEN_BYTES, SIG_PTR, ...]`) read an `R || S || V` witness from memory. They accept high-`s`, and a wrong message recovers a different valid key, so authenticate the returned key against trusted state. `CoreLibrary::handlers()` registers the host handler; a host that builds its handler list by hand must add it. The `verify` / `verify_bytes` advice layout is unchanged from 0.16.
- **P2ID storage has four items**: `[target_id_suffix, target_id_prefix, salt_0, salt_1]`. `p2id::prepare_note` and `p2id::create_output_note` keep their signatures and write a zero salt. If you compute a P2ID recipient by hand, write four items and pass `num_storage_items = 4`, or it fails with `P2ID note expects exactly 4 note storage items`. See [Note Changes](./note-changes).
- **Standard note scripts** check targeting through `miden::standards::note::note_target` and reclaim through `note::note_reclaim`, their error constants were renamed, config notes must be public, and every standard script root changed. See [Note Changes](./note-changes).
- **Assets left in a consumed note fail the transaction.** The TX_FEE note script no longer moves its assets into the consuming account, so the consuming account's code must collect them (`input_note::remove_asset` / `remove_all_assets`). This also corrects the 0.16 version of this page, which said a note left with assets in place is treated as partially consumed: in both 0.16.1 and 0.17 the epilogue asserts that the total number of assets across the account vault and the output notes stays the same, so the transaction fails with `total number of assets in the account and all involved notes must stay the same`. See [Note Changes](./note-changes).

:::note Queued after 0.17.0-rc.7
These are on the protocol's `next` branch (VM 0.34), not in `0.17.0-rc.7`:

- **Kernel procedure offsets shift again.** `output_note::seal` and `output_note::is_sealed` were inserted at offsets 47 and 48, so every `TX_*` offset moves up by two (`TX_GET_REFERENCE_BLOCK_NUMBER_OFFSET` 52 → 54, `TX_GET_FEE_ASSET_ID_OFFSET` 60 → 62). Named constants keep working after a rebuild; hard-coded numbers do not, and everything built against rc.7 must be rebuilt.
- **Standard components link `miden-standards` dynamically** (`linkage = "dynamic"` instead of `"static"`). The upstream description of this change says the auth procedure roots of `AuthSingleSig`, `AuthMultisig` and `AuthNetworkAccount` change, and with them the code commitments and account IDs of accounts built from them; that effect was not reproduced for this guide. Do not pin account IDs or code commitments computed on rc.7. PSWAP also seals its payback and remainder notes, which changes the PSWAP script root.
- **Sorted-array lookups are capped at 65,536 entries.** `collections::sorted_array::find_word`, `find_key_value` and `find_half_key_value` fail on larger ranges with `sorted array entry count <n> exceeds maximum of 65536`. The check runs in the host's event handler, so the MAST is unchanged and the failure depends on the host's core-library version. Split larger ranges.
:::

---

## Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `the block number must be a u32` | Argument-less `tx::get_block_commitment` call consumed an unrelated value | Use `tx::get_reference_block_commitment`. |
| `the block number must not exceed the transaction reference block number` | Same, or a block number above the reference block | Same, or push a valid block number. |
| `failed to lookup value in Merkle store` | Same, with a lower block number (often a zero pad) that the transaction's partial blockchain does not track | Same, or include that block in the transaction inputs. |
| `undefined item '<procedure>'` | Renamed or removed procedure; the message names only the procedure (`get_block_number`, `compute_commitment`, `verify_vm_proof`, `estimate_fee`, ...) | Use the 0.17 name from this page. |
| `undefined item '<module path>'` | Stale or private module in a `use`: `miden::precompiles::...`, `miden::standards::note_tag`, `note::execution_hint`, `notes::mint_fungible`, `notes::mint::fungible` | Use the new module path, or the MINT dispatcher. |
| `undefined item '::$kernel::<name>'` | `syscall.<name>` to a kernel API procedure | Use `miden::protocol::*`. |
| `transaction must not include output notes` | `tx_policy::assert_no_output_notes` after `fee::pay_fee` | Call it with no argument, before paying the fee. |
| `the transaction fee must be paid in the native fee asset at rate 1/1` | Conversion info names another faucet or rate | Commit the native conversion info. |
| `the active account is not native` | `native_account::compute_commitment` / `has_state_changed` in a foreign context | Call it only from the native account. |
| `fungible asset value is not well-formed` | Old `value_into_amount` call site now validates | Pass a real fungible value, or use `value_into_amount_unchecked`. |
| `failed to decode note_type into u8` | Old non-fungible `mint_and_send` call without `ASSET_ID`, read shifted by one word | Pass the full asset of the minting faucet. |
| `the asset stored in the MINT note does not belong to this faucet` | Non-fungible `mint_and_send` or MINT note whose `ASSET_ID` belongs to another faucet | Same. |
| `account procedure with procedure root <root> is not in the account procedure index map` | FPI to a root the foreign account does not export | Call a procedure the foreign account exports. |
| `unknown asset ID version` | Hand-built asset ID with the 0.16 metadata byte | Use the standards asset builders. |
| `total number of assets in the account and all involved notes must stay the same` | Assets left in a consumed note (for example a TX_FEE note) | Collect them in account code. |
| `procedure with root digest <root> could not be found` | Pinned core-library root that changed | Derive roots with `procref` or the `CoreLibrary` accessors. |
| `assertion failed with error message: shift amount must be in the range [0, 64)` | `u64` shift or rotation with `n >= 64` | Reduce `n` modulo 64 first. |
| `conflicting attributes for procedure definition` | `@callconv` other than component-model on a protocol ABI procedure | Drop the explicit `@callconv`. |
