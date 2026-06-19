---
sidebar_position: 8
title: "MASM Changes"
description: "Breaking MASM and standard-library changes in v0.15"
---

# MASM Changes

:::warning Breaking Change
Several core `miden::protocol::note` procedures were renamed; several kernel procedures dropped redundant outputs that duplicated their inputs; and the immediate form `adv_push.N` was removed. Custom note scripts and any MASM that consumed the removed outputs must be updated.
:::

---

## Kernel/protocol proc renames: `build_recipient*`, `extract_*_from_metadata`

### Summary

Several core MASM procedures in `miden::protocol::note` were renamed for consistency. These are used by every custom note script that computes a recipient or reads metadata.

| 0.14 | 0.15 |
| --- | --- |
| `note::build_recipient_hash` | `note::compute_recipient` |
| `note::build_recipient` | `note::compute_and_store_recipient` |
| `note::extract_sender_from_metadata` | `note::metadata_into_sender` |
| `note::extract_attachment_info_from_metadata` | `note::metadata_into_attachment_schemes` |

New convenience helpers were also added: `note::metadata_into_note_type` and `note::metadata_into_tag` (use the latter instead of slicing the header manually).

### Migration Steps

1. Search/replace the four procedure names per the table.
2. Where you manually extracted the tag from the metadata header, switch to `metadata_into_tag`.

---

## Redundant kernel outputs removed

### Summary

Six kernel procedures stopped returning values that were identical to (or trivially recoverable from) their inputs. Custom MASM that consumed the now-removed outputs must drop the stale cleanup.

| Procedure | 0.14 output | 0.15 output |
| --- | --- | --- |
| `active_note::get_assets` (also `input_note`/`output_note`) | `[num_assets, dest_ptr]` | `[num_assets]` |
| `active_note::get_storage` | `[NOTE_STORAGE_COMMITMENT, num_storage_items, dest_ptr]` | `[num_storage_items]` |
| `faucet::mint` | `[NEW_ASSET_VALUE]` | `[]` |
| `note::write_assets_to_memory` | echoed inputs | trimmed |

### Migration Steps

1. Remove the `drop` / `movup`+`drop` that cleared the echoed `dest_ptr` after `get_assets` / `get_storage`.
2. After `get_storage`, the `NOTE_STORAGE_COMMITMENT` word is no longer on the stack — delete the `dropw` that consumed it.
3. After `faucet::mint`, do not expect `NEW_ASSET_VALUE`.

---

## `adv_push.N` immediate form removed; `adv_pushw` added

### Summary

The immediate form of `adv_push` (`adv_push.N`) was removed. `adv_push` now always pops exactly one element from the advice stack. To push N elements, emit N consecutive `adv_push` instructions (or `repeat.N adv_push end`). A new `adv_pushw` instruction pushes a full word (4 elements). On the Rust AST side, `Instruction::AdvPush(ImmU8)` became `Instruction::AdvPush` plus a new `Instruction::AdvPushW`.

### Affected Code

```masm
# Before (0.14)
adv_push.1
adv_push.4

# After (0.15)
adv_push
adv_pushw
```

### Migration Steps

1. Replace every `adv_push.N` with N `adv_push` instructions (or `repeat.N adv_push end`).
2. Where you previously used `adv_push.4` to fetch a word, consider `adv_pushw`.
3. If you build MASM AST programmatically, replace `Instruction::AdvPush(n)` with N `Instruction::AdvPush` (or `Instruction::AdvPushW`).

---

## Internal `_impl` precompile procedures removed

### Summary

The internal `_impl` precompile helper procedures were removed from the core-lib public surface: `ecdsa_k256_keccak::verify_prehash_impl`, `eddsa_ed25519::verify_prehash_impl`, `keccak256::hash_bytes_impl`, and `sha512::hash_bytes_impl`. The public wrappers (`verify`, `verify_prehash`, `hash_bytes`, …) are unchanged and remain the supported entry points.

### Migration Steps

1. If you called any `*_impl` precompile helper directly by fully-qualified path, switch to the corresponding public wrapper.
