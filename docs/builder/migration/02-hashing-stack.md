---
sidebar_position: 2
title: "Hashing, SMT & Crypto Changes"
description: "SMT leaf domain separation, miden-crypto 0.25, and downstream crypto renames in v0.15"
---

# Hashing, SMT & Crypto Changes

:::warning Breaking Change
SMT leaf hashing now mixes a Poseidon2 leaf-domain separator into the capacity word, and `miden-crypto` bumped to `0.25`. These are digest-changing: persisted SMT roots, leaf digests, and `PartialSmt` values from earlier versions do not round-trip.
:::

---

## SMT leaf hashing switched to Poseidon2 domain separation

### Summary

The core library's Sparse Merkle Tree leaf hashing (`miden::core` `collections::smt`) now mixes a leaf‑domain separator into the Poseidon2 capacity word, so MASM‑side leaf digests match `SmtLeaf::hash()` in `miden-crypto`. Leaf preimages are hashed with `poseidon2::merge_in_domain` using `LEAF_DOMAIN = 0x13af`. This is a **digest‑changing** change: any SMT leaf digest, SMT root, or advice‑map key derived from MASM‑side leaf hashing under `0.22` will not reproduce under `0.23`. It pairs with the `miden-crypto 0.25` bump.

### Affected Code

**MASM (core‑lib `collections::smt`, simplified):**
```diff
- exec.poseidon2::merge assert_eqw
+ push.LEAF_DOMAIN exec.poseidon2::merge_in_domain assert_eqw
```
The per‑leaf cycle cost also changed (the `pair_count` coefficient went from `3` to `6`), so any hard‑coded cycle‑count expectations around `smt::get` / `smt::set` need updating.

### Migration Steps

1. Re‑derive every persisted SMT root, leaf digest, and advice‑map key computed from a MASM‑side SMT leaf hash under `0.22`.
2. If you compute SMT leaf digests in Rust via `miden-crypto`, upgrade to `0.25` so both sides agree.
3. Discard cached proofs / transaction artifacts whose witnesses depend on the old leaf hashing.

---

## `miden-crypto` 0.25 downstream renames

### Summary

Bumping to `miden-crypto 0.25` (and `miden-vm 0.23`) surfaces several renames in code that builds against the protocol crates directly:

- `Felt::new(n)` call sites that want the previous (non‑reducing) behaviour are now **`Felt::new_unchecked(n)`** (`Felt::new` now reduces modulo the field).
- The ECDSA secret key type `ecdsa_k256_keccak::SecretKey` is renamed **`SigningKey`**; the EdDSA/X25519 key `eddsa_25519_sha512::SecretKey` is **`KeyExchangeKey`**. Falcon's `falcon512_poseidon2::SecretKey` is unchanged.
- The kernel's `EMPTY_SMT_ROOT` constant was recomputed for the Plonky3‑aligned Poseidon2 and the domain‑separated `SmtLeaf::hash` — any hard‑coded SMT‑root literal changes.
- In kernel/standards MASM, the immediate form of `adv_push` was dropped and cross‑module‑referenced MASM constants/procedures must be marked `pub`.

### Affected Code

```diff
- let f = Felt::new(value);
- use miden_protocol::crypto::dsa::ecdsa_k256_keccak::SecretKey;
- use miden_protocol::crypto::dsa::eddsa_25519_sha512::SecretKey as EdSecretKey;
+ let f = Felt::new_unchecked(value);
+ use miden_protocol::crypto::dsa::ecdsa_k256_keccak::SigningKey;
+ use miden_protocol::crypto::dsa::eddsa_25519_sha512::KeyExchangeKey;
```

### Migration Steps

1. Replace `Felt::new(...)` with `Felt::new_unchecked(...)` where you relied on the non‑reducing constructor.
2. Rename `ecdsa_k256_keccak::SecretKey` → `SigningKey` and `eddsa_25519_sha512::SecretKey` → `KeyExchangeKey`.
3. Mark any cross‑module‑referenced MASM constants/procedures `pub`, and regenerate hard‑coded `EMPTY_SMT_ROOT` / SMT‑root literals.

---

## `PartialSmt` serialization changed

### Summary

In `miden-crypto 0.25` the serialized byte layout of `PartialSmt` changed. Old serialized `PartialSmt` values are **not compatible** with `0.25` and will not deserialize correctly.

### Migration Steps

1. Discard any `PartialSmt` values serialized under an earlier `miden-crypto`.
2. Rebuild them from current state, or re‑fetch them under `0.25`.

---

## Custom `LargeSmt` storage backends: reads move to `SmtStorageReader`

### Summary

Custom `LargeSmt` storage backends need a small trait update: reads moved to a dedicated **`SmtStorageReader`**. Writable storage still implements `SmtStorage`, but now also sets an associated `type Reader` and returns a point‑in‑time reader via `reader()`. Read operations go through `SmtStorageReader` rather than the writable `SmtStorage` directly.

### Migration Steps

1. Keep your writable backend implementing `SmtStorage`, and add the associated `type Reader` plus a `reader()` method that returns a point‑in‑time `SmtStorageReader`.
2. Move read operations onto the `SmtStorageReader` returned by `reader()`.

---

## Direct `miden-crypto` 0.24 API breaks

### Summary

For the rare consumers that depend on `miden-crypto` directly, the `0.24` step carries a few additional API breaks:

- The `WORD_SIZE`, `WORD_SIZE_FELTS`, and `WORD_SIZE_BYTES` constants moved to **`Word::NUM_ELEMENTS`** / **`Word::SERIALIZED_SIZE`**.
- `LexicographicWord` is now just **`Word`**.
- `Felt` no longer derefs.
- Custom multi‑AIR prover/verifier code must handle `StarkProof` log trace heights and `air_order`.

### Migration Steps

1. Replace `WORD_SIZE` / `WORD_SIZE_FELTS` with `Word::NUM_ELEMENTS` and `WORD_SIZE_BYTES` with `Word::SERIALIZED_SIZE`.
2. Replace `LexicographicWord` with `Word`.
3. Remove any reliance on `Felt`'s `Deref`; access the inner value explicitly.
4. If you maintain custom multi‑AIR prover/verifier code, update it to handle `StarkProof` log trace heights and `air_order`.
