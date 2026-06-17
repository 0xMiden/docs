---
sidebar_position: 2
title: "Hashing & Stack Changes"
description: "Poseidon2 hash function, little-endian stack, and Falcon module rename in v0.14"
---

# Hashing & Stack Changes

:::warning Breaking Change
The native hash function changed from RPO to Poseidon2, and the operand stack is now little-endian. These are the most fundamental changes in v0.14 — every digest and every multi-limb operation is affected.
:::

---

## Native Hash Function: RPO → Poseidon2

### Summary

The VM's native sponge hash flipped from RPO to Poseidon2. Rust type names (`Word`, `Hasher`, digests) are unchanged but **every digest the VM produces is different**: MAST roots, advice-map keys derived from hashing, account/note commitments, transaction IDs — none of them roundtrip with 0.13 artifacts.

### Migration Steps

1. Re-assemble every `.masl` and `.masp` from source under 0.22 (the MAST format version was bumped — old serialized forests will not deserialize anyway).
2. Re-derive any persisted commitments (account commitments, note commitments, advice-map keys, MAST roots).
3. Discard any cached transaction IDs, proven transactions, and proofs from 0.13.
4. If you hard-coded MAST root literals in tests, regenerate them.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `MastForest deserialization failed: unexpected version` | MAST format version bumped along with the hash change | Re-assemble from source under 0.22. |
| `transaction id mismatch` / `account commitment mismatch` | Old digest computed under RPO | Recompute from current state under 0.14. |

---

## Operand Stack Is Little-Endian

### Summary

Every multi-limb operation in the VM was unified around **"low limb closest to the top of the stack"**. Before 0.14 conventions were mixed: `u64` lived on the stack as `[hi, lo]`, `hperm` consumed `[R1, R0, C]` and produced its digest at indices 4..8, `mem_stream` returned words with the address-highest word on top. After 0.14 the low-significance limb is always on top: `u64` is `[lo, hi]`, `hperm` takes `[R0, R1, C]` with the digest at indices 0..4, and `mem_stream` returns the words in address-ascending order.

This affects MASM that uses `u32split`, `u32widening_mul`, `u32madd`, `hperm`, `hmerge`, `mem_stream`, `adv_pipe`, `adv.insert_hdword`, `adv.insert_hdword_d`, `adv.insert_hqword`, `adv.insert_hperm`, all of `std::math::u64`, all of `std::math::u256`, and `ext2` extension-field values.

### Affected Code

**MASM (u64 add):**
```masm
# Before (0.13): [b_hi, b_lo, a_hi, a_lo, ...] -> [c_hi, c_lo, ...]
push.0.0xFFFFFFFF push.0.1
exec.::std::math::u64::wrapping_add

# After (0.14): [b_lo, b_hi, a_lo, a_hi, ...] -> [c_lo, c_hi, ...]
push.0xFFFFFFFF.0 push.1.0
exec.::std::math::u64::wrapping_add
```

**MASM (`hperm` and digest extraction):** the input is now `[R0, R1, C, ...]` (was `[R1, R0, C, ...]`) and the digest comes out at indices `0..4` (was `4..8`).

**MASM (`hmerge`):** input is now `[A, B, ...] -> [hash(A || B), ...]` (was `[B, A, ...]`).

**Rust (`StackInputs` / `StackOutputs`):**

For `StackInputs::try_from_ints([1, 2, 3, 4])` the first element (`1`) is the top of the stack — no reversal. When seeding a `u64`, push `[lo, hi]`, not `[hi, lo]`. Same when reading `StackOutputs`: `stack[0]` is the top.

### Migration Steps

1. Audit every MASM call into `std::math::u64` / `u256` and flip the limb order in adjacent `push`/`movdn`/`movup` instructions.
2. Audit every `hperm`/`hmerge` site and update the index where you extract the digest (it moved from `[4..8]` to `[0..4]`).
3. Audit `mem_stream` / `adv_pipe` users — the word at the address now lands on top, not buried.
4. In Rust, drop any `[Felt; 16]` reversal helpers you used to construct stacks "in pretty order".

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `assertion failed: ...` (off-by-one in u64 arithmetic) | Limb order flipped | Push `[lo, hi]` instead of `[hi, lo]`. |
| `expected hash 0x... at clock cycle ...` | Digest at wrong stack offset | The digest is now at indices 0..4, not 4..8. |

---

## Falcon Module Rename

### Summary

Because the native hash flipped to Poseidon2, the Falcon-512 verifier was rewritten and renamed. The MASM module path moved to `miden::core::crypto::dsa::falcon512_poseidon2` and the Rust auth scheme variant is `Falcon512Poseidon2`.

### Affected Code

**MASM:**
```masm
# Before (0.13)
use.miden::core::crypto::dsa::falcon512rpo
exec.falcon512rpo::verify

# After (0.14)
use.miden::core::crypto::dsa::falcon512_poseidon2
exec.falcon512_poseidon2::verify
```

**Rust:**
```rust
// Before (0.13)
use miden_protocol::account::auth::AuthScheme;
let scheme = AuthScheme::Falcon512Rpo;

// After (0.14)
use miden_protocol::account::auth::AuthScheme;
let scheme = AuthScheme::Falcon512Poseidon2;
```

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `unknown module miden::core::crypto::dsa::falcon512rpo` | Module renamed | Use `falcon512_poseidon2`. |
| `no variant or associated item named Falcon512Rpo for AuthScheme` | Variant renamed | Use `AuthScheme::Falcon512Poseidon2`. |
