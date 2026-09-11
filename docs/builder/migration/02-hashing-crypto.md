---
sidebar_position: 2
title: "Hashing & Crypto Changes"
description: "Commitment preimages that changed in v0.16 — ECDSA public keys, MMR peaks, and domain-separated empty inputs"
---

# Hashing & Crypto Changes

:::warning Breaking Change
Four commitment preimages changed. Any value you have **persisted** — in account storage, note storage, an advice map key, or your own database — that was derived from an ECDSA public key, an MMR peak set, a domain-separated empty input, or `hash_bytes(&[])` is now wrong and must be recomputed. These changes are silent: nothing fails to compile, and the old values simply no longer match.
:::

## Quick Fix

```rust
// Recompute every stored ECDSA public-key commitment
use miden_crypto::dsa::ecdsa_k256_keccak::PublicKey;
let commitment: Word = public_key.to_commitment();
```

Then re-derive anything downstream: account storage slots, note storage, and advice-map keys built from those commitments.

If you encounter errors, continue reading for detailed migration steps.

---

## Summary

Unlike most of this release, nothing here breaks your build. These are value changes, so the symptom is a proof that fails to verify, an account whose storage no longer matches, or an advice-map lookup that misses — all at runtime, all without a compiler error pointing at the cause.

The rule of thumb: if you stored a hash, recompute it. If you only ever compute hashes on the fly from current inputs, you are unaffected.

---

## ECDSA k256 public-key commitment format changed

### Summary

The ECDSA-k256/Keccak public-key commitment now hashes the **native affine coordinate limbs** (`qx || qy` as little-endian `u32` limbs) instead of the compressed SEC1 public-key bytes. Compressed SEC1 *serialization* of the key itself is unchanged — only the commitment value changed ([#3342](https://github.com/0xMiden/miden-vm/pull/3342), [crypto#1075](https://github.com/0xMiden/crypto/issues/1075)).

### Affected Code

```text
v0.15:  PK_COMM = Poseidon2::hash_elements( 33 compressed SEC1 bytes packed as 9 felts )
v0.16:  PK_COMM = Poseidon2::hash_elements( QX[8] || QY[8] )   # native LE u32 limbs
```

```rust
// After (0.16) — regenerate every stored commitment
use miden_crypto::dsa::ecdsa_k256_keccak::PublicKey;
let commitment: Word = public_key.to_commitment();
```

### Migration Steps

1. Recompute every stored ECDSA public-key commitment with `PublicKey::to_commitment()`.
2. Re-derive anything downstream of that commitment — account storage slots, note storage, advice-map keys.
3. No MASM call-site changes are needed. The operand-stack contract of `ecdsa_k256_keccak::verify` is still `[PK_COMM, MSG_WORD, ...]`; only the value of `PK_COMM` moved. The **advice** layout did change, though — see [MASM Changes](./masm-changes#ecdsa-advice-and-signature-abi-changed).

---

## MMR peak commitments now bind the leaf count

### Summary

MMR peak commitments are computed over `[num_leaves, 0, 0, 0] || padded_peaks` instead of `padded_peaks` alone, on both the Rust and MASM sides. **All MMR peak commitments change** ([#3388](https://github.com/0xMiden/miden-vm/pull/3388)).

### Affected Code

```text
v0.15:  hash_peaks() = Poseidon2::hash_elements( padded_peaks )
v0.16:  hash_peaks() = Poseidon2::hash_elements( [num_leaves, 0, 0, 0] || padded_peaks )
```

The `miden::core::collections::mmr` `pack` and `unpack` procedures were updated to the same preimage. In 0.15, `pack` hashed the range starting at `mmr_ptr + 4`, skipping the leaf-count word; in 0.16 it hashes from `mmr_ptr`, so the leaf count is absorbed first. The MASM stack contracts (`[mmr_ptr, ...] -> [HASH, ...]`) are unchanged.

### Migration Steps

1. Recompute and re-persist every stored MMR peak commitment.
2. Invalidate any cached chain-MMR commitment, advice-map entry keyed by an MMR commitment, or proof whose witness depends on one.
3. No MASM call-site changes — `mmr::pack` and `mmr::unpack` keep their signatures.

---

## Domain-separated empty-input hashing changed

### Summary

`hash_elements_in_domain(&[], d)` for a nonzero domain `d` used to collide with other inputs. The fix marks the empty-input case in the third capacity element and applies a permutation, so the result is now a distinct, nonzero digest ([#3447](https://github.com/0xMiden/miden-vm/pull/3447), refining [#3366](https://github.com/0xMiden/miden-vm/pull/3366)).

Related and also digest-changing: `hash_bytes(&[])` no longer returns `Word::default()`. The empty-bytes input now absorbs a padding marker and permutes, producing a nonzero digest consistent with the `10*` sponge padding rule ([#3366](https://github.com/0xMiden/miden-vm/pull/3366)).

### Affected Code

```rust
// After (0.16) — the empty-input branch, from the algebraic sponge implementation
} else if total_len == 0 && state[CAPACITY_RANGE.start + 1] != ZERO {
    // Mark an empty domain-separated input in an otherwise unused capacity element.
    state[CAPACITY_RANGE.start + 2] = Felt::ONE;
    S::apply_permutation(&mut state);
}
```

### Migration Steps

1. Re-derive any commitment computed as `hash_elements_in_domain` over an empty element list with a nonzero domain — typically "empty collection" sentinel values.
2. Re-derive any value computed as `hash_bytes(&[])`. A stored zero word is no longer the right answer.
3. `merge_in_domain` and non-empty `hash_elements_in_domain` inputs are unaffected.

---

## `AeadPoseidon2` key derivation restored to canonical decoding

### Summary

`AeadPoseidon2::key_from_bytes` was restored to canonical-`Felt` decoding ([#3366](https://github.com/0xMiden/miden-vm/pull/3366)). Keys persisted under the brief SHA-256 KDF contract must be re-derived.

### Migration Steps

1. If you persisted AEAD keys derived with `key_from_bytes` during the 0.16 pre-release window, re-derive them.
2. Data encrypted under a key derived by the interim contract cannot be decrypted with a canonically-derived key — re-encrypt it.

---

## Common Errors

These changes do not produce compile errors. Expect runtime symptoms instead:

| Symptom | Cause | Solution |
| --- | --- | --- |
| Signature verification traps for a key that worked in 0.15 | Stored `PK_COMM` uses the old preimage | Recompute with `PublicKey::to_commitment()`. |
| Advice-map lookup misses for a key you know you inserted | The key is a changed commitment | Re-derive the key. |
| Chain-MMR commitment mismatch after upgrading | Peak commitment now binds the leaf count | Recompute and re-persist. |
| An "empty" sentinel commitment no longer matches | Empty-input hashing changed | Re-derive the sentinel. |
| Previously encrypted data fails to decrypt | AEAD key derivation changed | Re-derive the key and re-encrypt. |
