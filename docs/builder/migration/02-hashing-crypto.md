---
sidebar_position: 2
title: "Hashing & Crypto Changes"
description: "Word and Merkle types lose serde, SmtForest gives way to LargeSmtForest, PartialSmt bytes from 0.16 stop decoding, and Merkle decoders get stricter"
---

# Hashing & Crypto Changes

:::warning Breaking Change
`miden-crypto` moves `0.29.2` → `0.33.0` with the VM. No hash function or signature scheme changed its output, but the data-structure API did: `Word` and every Merkle, MMR and SMT type lost their `serde` impls (the changelog does not flag this as breaking), `SmtForest` was removed in favour of `LargeSmtForest`, and `PartialSmt` bytes written by 0.16 with empty-subtree markers no longer decode. Several decoders also reject bytes that 0.16 accepted.
:::

## Quick Fix

```rust
// After (0.17): Word has no serde impl; serialize it through its "0x..." hex string
#[derive(Serialize, Deserialize)]
struct Record {
    #[serde(with = "word_hex")] // helper in the section below
    commitment: Word,
}

// Merkle, MMR and SMT types: use the binary codec instead of serde
let bytes = merkle_path.to_bytes();
let merkle_path = MerklePath::read_from_bytes(&bytes)?;
```

Then replace `SmtForest` with `LargeSmtForest`, and rebuild any `PartialSmt` you persisted under 0.16 from its source data.

If you encounter errors, continue reading for detailed migration steps.

---

## Summary

The changes fall into three groups:

- **`serde` removal.** `Word` and about twenty Merkle types no longer implement `Serialize` / `Deserialize`. This fails to compile. Existing JSON with `Word` fields stays readable through a small helper; serde JSON of Merkle types does not.
- **Reshaped APIs.** `SmtForest` and `NodeValue` are gone, `UniqueNodes` and `MerklePath`'s deref target changed, two MMR `Forest` accessors return `Option`, and several enums gained variants. All of these fail to compile.
- **Stricter decoding.** `PartialSmt` changed its wire format, `Mmr` verifies every node on load, and `LeafIndex`, `SparseMerklePath`, `InOrderIndex`, `PartialMerkleTree` and `PartialMmr` reject invalid values. These fail only at run time, on bytes you persisted yourself or exchange with 0.16 peers.

What did **not** change: the outputs of Poseidon2, RPO, RPX, Blake3, Keccak and SHA-256; Falcon512-Poseidon2 keys and signatures (byte-identical, including deterministic signing); ECDSA k256/Keccak and EdDSA 25519, apart from the additive `recover_from_prehash`; AEAD Poseidon2, XChaCha20-Poly1305 and ECDH; and the byte formats of `Word`, `Felt`, `Mmr`, `PartialMmr`, `Smt`, `SmtProof`, `MerklePath` and `SparseMerklePath`. `SequentialCommit::to_commitment` still uses `Poseidon2::hash_elements`. Commitment values that do change in 0.17, such as account commitments, asset IDs, note IDs and account delta commitments, change because protocol objects gained versions: see [Account Changes](./account-changes).

---

## `Word` and Merkle types no longer implement `serde`

### Summary

`Word` no longer implements `serde::Serialize` / `serde::Deserialize`, and neither do `NodeIndex`, `MerklePath`, `SparseMerklePath`, `MerkleTree`, `PartialMerkleTree`, `InnerNodeInfo`, `MerkleStore`, `StoreNode`, `Mmr`, `MmrPeaks`, `MmrPath`, `MmrProof`, `Forest`, `Smt`, `SmtLeaf`, `SimpleSmt`, `PartialSmt`, `LeafIndex`, `InnerNode` or `LineageId`. Enabling `miden-crypto/serde` does not bring them back: that feature now covers only the byte-digest type. `Felt` still implements serde.

The `Word` impl lived in `miden-field`, which the contract SDK's host-side crates (`miden-tx-script-args`, `miden-field-repr`) also build on. Losing `Word` serde is the only source change in `miden-field`; its `Felt` also moves to the Plonky3 0.7 field traits (see [Imports & Dependencies](./imports-dependencies#direct-plonky3-dependencies-must-match)). VM types such as `Program` and `AdviceMap` lost serde in the same change; see [Imports & Dependencies](./imports-dependencies#serde-and-bus-debugger-features-removed-from-the-vm-crates).

### Affected Code

```rust
// Before (0.16): Word serialized as a "0x..." hex string
use miden_crypto::Word;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
struct Record {
    commitment: Word,
}
```

```rust
// After (0.17): same JSON shape ("0x..." string) through a small helper
use miden_crypto::Word;
use serde::{Deserialize, Serialize};

mod word_hex {
    use miden_crypto::Word;
    use serde::{Deserialize, Deserializer, Serializer, de::Error};

    pub fn serialize<S: Serializer>(word: &Word, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&word.to_hex())
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(deserializer: D) -> Result<Word, D::Error> {
        let hex = String::deserialize(deserializer)?;
        Word::try_from(hex.as_str()).map_err(D::Error::custom)
    }
}

#[derive(Serialize, Deserialize)]
struct Record {
    #[serde(with = "word_hex")]
    commitment: Word,
}
```

```rust
// After (0.17): Merkle types use the binary codec instead of serde
use miden_crypto::{
    merkle::MerklePath,
    utils::{Deserializable, Serializable},
};

let bytes: Vec<u8> = merkle_path.to_bytes();
let merkle_path = MerklePath::read_from_bytes(&bytes)?;
```

```rust
// After (0.17): MerkleTree, MmrPeaks, MmrPath, MmrProof, SimpleSmt and InnerNodeInfo have no
// binary codec either, so persist their parts. Example for MmrPeaks:
use miden_crypto::{
    Word,
    merkle::mmr::{Forest, MmrPeaks},
    utils::{Deserializable, Serializable, SliceReader},
};

let (forest, peaks) = mmr_peaks.clone().into_parts();
let mut bytes = forest.to_bytes();
peaks.write_into(&mut bytes);

let mut reader = SliceReader::new(&bytes);
let forest = Forest::read_from(&mut reader)?;
let peaks = Vec::<Word>::read_from(&mut reader)?;
let mmr_peaks = MmrPeaks::new(forest, peaks)?;
```

:::note The changelog calls this "unused" serde support
The VM changelog lists the change as "Removed unused Serde support", not marked `[BREAKING]` and without naming the types. It also claims binary round-trip coverage was kept, which does not hold for `MerkleTree`, `MmrPeaks`, `MmrPath`, `MmrProof`, `SimpleSmt` and `InnerNodeInfo`: they have no `Serializable` impl and are left with no serialization at all. Two other entries in the same release describe serde validation for Merkle types; those serde impls were removed in that release, so only the binary checks shipped.
:::

### Migration Steps

1. For every `Word` field in a `#[derive(Serialize, Deserialize)]` type, add `#[serde(with = "word_hex")]` (helper above). `word.to_hex()` / `Word::try_from(&str)` produce and parse exactly the `0x...` string the old serde impl used, so existing JSON and TOML stay readable.
2. For Merkle, MMR and SMT types, switch from serde to `Serializable::to_bytes()` / `Deserializable::read_from_bytes()`. Types with a binary codec: `NodeIndex`, `MerklePath`, `SparseMerklePath`, `PartialMerkleTree`, `MerkleStore`, `StoreNode`, `Mmr`, `PartialMmr`, `Forest`, `Smt`, `SmtLeaf`, `SmtProof`, `PartialSmt`, `LeafIndex`, `InnerNode`, `LineageId`.
3. For `MerkleTree`, `MmrPeaks`, `MmrPath`, `MmrProof`, `SimpleSmt` and `InnerNodeInfo`, store the constructor inputs and rebuild: `MmrPeaks::into_parts()` → `MmrPeaks::new(forest, peaks)`; for an `MmrPath`, store `forest()`, `position()` and `merkle_path()` and rebuild with `MmrPath::new(forest, position, merkle_path)`; for an `MmrProof`, store those plus `leaf()` and rebuild with `MmrProof::new(MmrPath::new(forest, position, merkle_path), leaf)`; for a `MerkleTree`, store its leaves.
4. Merkle-type data you already stored as serde JSON cannot be read by 0.17; regenerate it from its source.
5. Drop `miden-crypto/serde` from your feature list unless you serialize Blake3, SHA or Keccak digests with serde.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `` error[E0277]: the trait bound `Word: serde::Serialize` is not satisfied `` (or `` `Word: serde::Deserialize<'de>` ``) | `Word` lost its serde impls | Add `#[serde(with = "word_hex")]` to the field. |
| `error[E0277]` naming `MerklePath`, `Smt`, `Mmr`, ... and `Serialize` / `Deserialize` | Merkle types lost serde | Serialize with `to_bytes()` / `read_from_bytes()`. |

---

## `SmtForest` removed; use `LargeSmtForest`

### Summary

`miden_crypto::merkle::smt::SmtForest` (root-addressed, in memory) is removed. `LargeSmtForest` with a backend replaces it: trees are addressed by a `LineageId` plus a version instead of by root.

### Affected Code

```rust
// Before (0.16)
use miden_crypto::merkle::{EmptySubtreeRoots, smt::{SMT_DEPTH, SmtForest}};

let mut forest = SmtForest::new();
let empty_root = *EmptySubtreeRoots::entry(SMT_DEPTH, 0);
let root = forest.insert(empty_root, key, value)?;
let proof = forest.open(root, key)?;
forest.pop_smts([root]);
```

```rust
// After (0.17)
use miden_crypto::merkle::smt::{
    ForestInMemoryBackend, LargeSmtForest, LineageId, SmtUpdateBatch, TreeId,
};

let mut forest = LargeSmtForest::new(ForestInMemoryBackend::new())?;
let lineage = LineageId::new([0x42; 32]); // one lineage per logical tree
let mut ops = SmtUpdateBatch::empty();
ops.add_insert(key, value);
let tree = forest.add_lineage(lineage, 1, ops)?; // version 1
let root = tree.root();
let proof = forest.open(TreeId::new(lineage, 1), key)?;
```

### Migration Steps

1. Create one `LargeSmtForest` with `ForestInMemoryBackend::new()` (or the `persistent-forest` backend).
2. Give each logical tree a unique `LineageId` and create it with `add_lineage(lineage, version, batch)`. Apply later changes with `update_tree(lineage, next_version, batch)`, or `update_forest` for many lineages at once.
3. Replace root-based `open(root, key)` with `open(TreeId::new(lineage, version), key)`. `latest_root(lineage)` returns the current root.
4. There is no `pop_smts`. Old versions are bounded by the forest `Config` history limit and can be dropped with `truncate(version)`.
5. Updates apply only to the latest version of a lineage. Code that branched several trees from one `SmtForest` root needs one lineage per branch.
6. `LargeSmtForest` and the types above already exist in `miden-crypto` 0.29 with the same API, so you can switch before upgrading.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `error[E0432]: unresolved import` naming `miden_crypto::merkle::smt::SmtForest` | Type removed | Use `LargeSmtForest` as above. |

---

## `PartialSmt` bytes from 0.16 no longer decode; `UniqueNodes` restructured

### Summary

`PartialSmt` serializes through `UniqueNodes`, and both its API and its wire format changed:

- **Wire format.** The 0.16 writer encoded an empty-subtree sibling as the 8-byte marker `u64::MAX`; 0.17 omits such nodes and always reads a full 32-byte `Word`. Old bytes that contain the marker (common for sparse trees) fail to decode. The format is not compatible in the other direction either: bytes written by 0.17 omit empty subtree roots, and 0.16 fails to rebuild the tree from them. The client stores are recreated for 0.17 anyway, so this matters for bytes you persisted yourself or exchange across versions.
- **API.** `UniqueNodes` now keys nodes by `NodeIndex` in a `BTreeMap`, omits empty subtree roots instead of marking them, and stores leaves in `BTreeMap`s. `NodeValue` is gone.

### Affected Code

```text
per stored node, 0.16:  position: u64 || (u64::MAX  |  Word)      # 8-byte marker for an empty subtree root
per stored node, 0.17:  position: u64 || Word                     # empty subtree roots are omitted
```

```rust
// Before (0.16)
use miden_crypto::merkle::smt::{NodeValue, UniqueNodes};

let mut nodes = UniqueNodes::empty();
nodes.nodes.entry(depth).or_default().push((position, NodeValue::Present(hash)));
nodes.nodes.entry(depth).or_default().push((other_position, NodeValue::EmptySubtreeRoot));
nodes.leaves.push((leaf_position, leaf));
nodes.value_only_leaves.push((hash_only_position, leaf_hash));
```

```rust
// After (0.17)
use miden_crypto::merkle::{NodeIndex, smt::UniqueNodes};

let mut nodes = UniqueNodes::empty();
nodes.nodes.insert(NodeIndex::new(depth, position)?, hash);
// empty subtree roots are simply not inserted
nodes.leaves.insert(leaf_position, leaf);
nodes.value_only_leaves.insert(hash_only_position, leaf_hash);

let h = nodes.get_node_hash(NodeIndex::new(depth, other_position)?); // canonical empty root if absent
```

:::note The changelog omits the wire-format change
The VM changelog describes the `UniqueNodes` struct change accurately but does not say that `PartialSmt` bytes containing the old empty-subtree marker no longer decode.
:::

### Migration Steps

1. Re-create any `PartialSmt` you persisted with 0.16, or any protocol type that embeds one, from its source data instead of decoding the old bytes.
2. Do not exchange serialized `PartialSmt` values between 0.16 and 0.17 peers.
3. Replace `nodes.nodes.entry(depth).or_default().push((pos, NodeValue::Present(h)))` with `nodes.nodes.insert(NodeIndex::new(depth, pos)?, h)`.
4. Drop every `NodeValue::EmptySubtreeRoot` entry: absence now means the canonical empty root.
5. Use `insert` on `leaves` / `value_only_leaves` (now `BTreeMap<u64, _>`), and `get_node_hash` / `get_leaf_hash` to read values back.
6. If you map `UniqueNodes` to your own wire format (for example a Protobuf message), drop the empty-root case from it.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `invalid value: value not in the appropriate range` (a `DeserializationError` from `PartialSmt::read_from_bytes`) | 0.16 bytes containing the `u64::MAX` empty-root marker | Rebuild the partial tree from source data. |
| `invalid value: invalid value: Node at depth={depth}, position={position} not found but is required` (on a 0.16 peer) | 0.17 `PartialSmt` bytes read by 0.16 | Do not send serialized `PartialSmt` values to 0.16 peers. |
| `error[E0432]: unresolved import` naming `miden_crypto::merkle::smt::NodeValue` | Enum removed | Omit empty nodes and store `Word`s. |
| `` error[E0599]: no method named `push` found `` on `nodes.leaves` / `value_only_leaves` | The fields are `BTreeMap`s | Use `insert(position, value)`. |

---

## `Mmr` deserialization verifies every node

### Summary

`Mmr::read_from` checks the node count against the forest and recomputes the Poseidon2 hash of every parent node. Loading a large MMR now costs one hash per inner node, and inconsistent bytes are rejected. The byte format is unchanged. For state you already trust, persist the forest and nodes and rebuild with `Mmr::from_nodes_unchecked`, which checks only the node count.

### Affected Code

```rust
// After (0.17): trusted fast path
use miden_crypto::merkle::mmr::Mmr;

let forest = mmr.forest();
let nodes: Vec<_> = mmr.nodes_from(0).copied().collect();
// ... persist forest + nodes, then later:
let mmr = Mmr::from_nodes_unchecked(forest, nodes)?;
```

### Migration Steps

1. Expect `Mmr::read_from_bytes` to fail on corrupted or hand-built bytes that 0.16 accepted.
2. If load time of a large trusted MMR matters, store `forest()` + `nodes_from(0)` and rebuild with `Mmr::from_nodes_unchecked`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `invalid value: mmr node count {actual} does not match forest node count {expected}` | Truncated or mismatched bytes | Regenerate the MMR. |
| `invalid value: Mmr contains a parent node inconsistent with its children` | Node hashes do not match | Regenerate the MMR. |

---

## Stricter decoding of `LeafIndex`, `SparseMerklePath`, `InOrderIndex`, `PartialMerkleTree` and `PartialMmr`

### Summary

Bytes that encoded invalid values used to load and now fail: a `LeafIndex<DEPTH>` whose embedded depth differs from `DEPTH`, a `SparseMerklePath` whose mask has bits set at or beyond its declared depth, an `InOrderIndex` of 0, a `PartialMerkleTree` with a leaf at depth 0 (also rejected by `PartialMerkleTree::with_leaves`), and a `PartialMmr` (including one built with `PartialMmr::from_parts`) with a tracked leaf that has no complete authentication path. `PartialMmr::track` now returns `Err(MmrError::PositionNotFound(pos))` for a position that does not belong to the path's tree instead of panicking. Valid data round-trips unchanged.

### Migration Steps

1. No action for data the library wrote itself. Regenerate hand-built or corrupted values that now fail.
2. Handle the `Err` from `PartialMmr::track` where you relied on it succeeding or panicking.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `invalid value: provided node index depth {provided} does not match expected depth {expected}` | `LeafIndex` bytes at the wrong depth | Encode the index at the tree's depth. |
| `invalid value: InOrderIndex must be nonzero` | Zero in-order index | Regenerate the data. |
| `invalid value: Invalid data for PartialMerkleTree creation` | A `PartialMerkleTree` leaf at depth 0 (or another invalid leaf set) | Regenerate the data. |
| `invalid value: invalid partial mmr: inconsistent partial mmr: missing sibling for tracked leaf at position {pos}` | Tracked leaf without its path | Re-track the leaf with its full path. |

---

## `MerklePath` dereferences to `[Word]`, not `Vec<Word>`

### Summary

`MerklePath` still derefs (and mutably derefs) to its nodes, but as a slice. Indexing and in-place edits keep working; `Vec` methods that change the length (`push`, `pop`, `insert`, `remove`, `truncate`, `extend`, ...) no longer resolve on a `MerklePath`.

### Affected Code

```rust
// Before (0.16)
use miden_crypto::merkle::MerklePath;

let mut path = MerklePath::new(nodes);
path.push(extra_node);
```

```rust
// After (0.17)
use miden_crypto::merkle::MerklePath;

let mut nodes = Vec::from(path);
nodes.push(extra_node);
let path = MerklePath::new(nodes);

// in-place edits still work through the slice:
let mut path = path;
path[0] = replacement;
```

### Migration Steps

1. To change a path's length, convert with `Vec::from(path)`, edit the `Vec`, and rebuild with `MerklePath::new(nodes)` (at most 255 nodes).
2. Code that only reads or overwrites entries (`path[i]`, `path.iter()`, `path.len()`) needs no change.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `` error[E0599]: no method named `push` found for struct `MerklePath` in the current scope `` | The deref target is now `[Word]` | Go through `Vec::from(path)` and `MerklePath::new`. |

---

## MMR `Forest` in-order index accessors return `Option`

### Summary

`Forest::root_in_order_index()` and `Forest::rightmost_in_order_index()` return `Option<InOrderIndex>`: `None` for an empty forest, where the 0.16 version underflowed. The new `_unchecked` variants keep the old return type and panic on an empty forest.

### Affected Code

```rust
// Before (0.16)
let idx: InOrderIndex = forest.root_in_order_index();
let last: InOrderIndex = forest.rightmost_in_order_index();
```

```rust
// After (0.17)
let idx: InOrderIndex = forest.root_in_order_index().expect("forest is not empty");
// when non-emptiness is already guaranteed:
let last: InOrderIndex = forest.rightmost_in_order_index_unchecked();
```

### Migration Steps

1. Handle `None` from `root_in_order_index()` / `rightmost_in_order_index()`, or call the `_unchecked` variant where the forest is known to be non-empty.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `error[E0308]: mismatched types` (expected `InOrderIndex`, found `Option<InOrderIndex>`) | The accessor now returns `Option` | Unwrap, match, or use the `_unchecked` variant. |

---

## Exhaustive matches on IES, AEAD and MMR enums need new arms

### Summary

None of these enums is `#[non_exhaustive]`, and each gained variants:

- `IesScheme` gained `K256AeadEidos = 4` and `X25519AeadEidos = 5`, with matching `SealingKey` / `UnsealingKey` variants (Eidos-based IES, VM 0.33).
- `EncryptionError` gained `InputTooLong` and `MalformedCiphertext`.
- `MmrError` gained `InvalidNodeCount { expected, actual }`.

Existing IES schemes and their sealed-message bytes are unchanged.

### Affected Code

```rust
// Before (0.16)
use miden_crypto::ies::SealingKey;

match key {
    SealingKey::K256XChaCha20Poly1305(pk) => { /* ... */ }
    SealingKey::X25519XChaCha20Poly1305(pk) => { /* ... */ }
    SealingKey::K256AeadPoseidon2(pk) => { /* ... */ }
    SealingKey::X25519AeadPoseidon2(pk) => { /* ... */ }
}
```

```rust
// After (0.17)
use miden_crypto::ies::SealingKey;

match key {
    SealingKey::K256XChaCha20Poly1305(pk) => { /* ... */ }
    SealingKey::X25519XChaCha20Poly1305(pk) => { /* ... */ }
    SealingKey::K256AeadPoseidon2(pk) => { /* ... */ }
    SealingKey::X25519AeadPoseidon2(pk) => { /* ... */ }
    SealingKey::K256AeadEidos(pk) => { /* ... */ }
    SealingKey::X25519AeadEidos(pk) => { /* ... */ }
}
```

:::note The changelog points at the wrong break for `MmrError`
The VM changelog marks "Added `Mmr::from_nodes_unchecked`" as `[BREAKING]`. Adding a constructor breaks nothing; the breaking part of that change is the new `MmrError::InvalidNodeCount` variant, which the entry does not mention.
:::

### Migration Steps

1. Add arms for `K256AeadEidos` and `X25519AeadEidos` wherever you match `IesScheme`, `SealingKey` or `UnsealingKey`, for example when encoding a key into your own format.
2. Add arms for `EncryptionError::InputTooLong`, `EncryptionError::MalformedCiphertext` and `MmrError::InvalidNodeCount { .. }`, or use a wildcard arm.
3. Seal with an Eidos scheme only if every recipient runs 0.17: 0.16 readers reject scheme ids 4 and 5.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `error[E0004]: non-exhaustive patterns` naming `SealingKey::K256AeadEidos(_)` / `IesScheme::K256AeadEidos` (or the X25519 twin) | New variants | Add the arms. |
| `error[E0004]: non-exhaustive patterns` naming `EncryptionError::InputTooLong` or `MmrError::InvalidNodeCount { .. }` | New variants | Add the arms or a wildcard. |

---

## Random helpers and Falcon RNGs (queued after 0.17.0-rc.7)

:::note Queued after 0.17.0-rc.7
These land in VM 0.34, which protocol `next` already uses. They are not in the 0.17.0-rc.7 line.
- **Random helpers removed.** In `miden_crypto::rand`, the `Randomizable` trait, `random_felt()`, `random_word()` and `test_utils::{rand_value, rand_array, rand_vector, prng_value, prng_array, prng_vector, ContinuousRng}` are gone. `Word` implements `StandardUniform`, so use the `rand` crate's `rand::random::<T>()` (add `rand = "0.10"`) and, for seeded values, `ChaCha20Rng::from_seed(seed).random::<T>()` (add `rand_chacha = "0.10"` and import `rand::{RngExt, SeedableRng}`). `miden_crypto::rand::test_utils::seeded_rng` remains but needs the `testing` feature instead of `std`. Regenerate golden test values derived from a seed after switching: the new sampling path may not reproduce them.
- **Falcon needs a `CryptoRng`.** `falcon512_poseidon2::SecretKey::with_rng` and `sign_with_rng` take `R: CryptoRng + Rng`, and Miden's `RandomCoin` (like any `FeltRng`) is not a `CryptoRng`. Pass `rand::rng()`, `ChaCha20Rng` or `StdRng`, or use `SecretKey::new()`. A different RNG yields a different key for the same seed, so if you re-derive Falcon keys from a `RandomCoin` seed, persist the key bytes (`sk.to_bytes()`) before upgrading. Deterministic `SecretKey::sign(message)` is unaffected. On the protocol side, `AuthSecretKey::new_falcon512_poseidon2_with_rng` gains the same bound.
:::

---

## Other crypto changes

- `miden-crypto/serde` now covers only the byte-digest type. Keep it only if you serialize Blake3, SHA or Keccak digests with serde.
- The `persistent-forest` feature no longer enables the `serde` feature.
- `falcon512_poseidon2::Polynomial::karatsuba` now panics on operands of unequal length, on empty operands, and on lengths that reach an odd value above eight while being halved (any power of two is fine).
- ECDSA k256/Keccak gained `PublicKey::recover_from_prehash` (additive). The MASM recovery procedures are on [MASM Changes](./masm-changes).
- The Plonky3 version behind `Felt`'s field traits moved to `0.7`, and `miden_crypto::stark::dft::NaiveDft` is no longer re-exported: see [Imports & Dependencies](./imports-dependencies#direct-plonky3-dependencies-must-match).

---

## Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `` error[E0277]: the trait bound `Word: serde::Serialize` is not satisfied `` | `Word` lost serde | `#[serde(with = "word_hex")]`, see [above](#word-and-merkle-types-no-longer-implement-serde). |
| `error[E0432]: unresolved import` naming `SmtForest` or `NodeValue` | Types removed | Use `LargeSmtForest`; omit empty nodes from `UniqueNodes`. |
| `` error[E0599]: no method named `push` found for struct `MerklePath` in the current scope `` | Deref target is `[Word]` | Rebuild through `Vec::from(path)` and `MerklePath::new`. |
| `error[E0308]: mismatched types` (expected `InOrderIndex`, found `Option<InOrderIndex>`) | `Forest` accessors return `Option` | Unwrap or use the `_unchecked` variant. |
| `error[E0004]: non-exhaustive patterns` | New IES, AEAD or MMR enum variants | Add the arms or a wildcard. |
| `invalid value: value not in the appropriate range` | `PartialSmt` bytes written by 0.16 | Rebuild the partial tree from source data. |
| `invalid value: Mmr contains a parent node inconsistent with its children` | Corrupted or hand-built `Mmr` bytes | Regenerate the MMR. |
| `invalid value: InOrderIndex must be nonzero` | Invalid in-order index in stored bytes | Regenerate the data. |
