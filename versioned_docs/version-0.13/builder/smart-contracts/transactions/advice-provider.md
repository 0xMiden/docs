---
title: "Advice Provider"
sidebar_position: 5
description: "Reading and writing the advice map, loading preimages, and requesting Falcon signatures in Miden transactions."
---

# Advice Provider

The advice provider is a mechanism for supplying non-deterministic auxiliary data to the VM during proof generation. It backs an **advice map** (a key-value store of `Word → Vec<Felt>`) and an **advice stack** that host-provided data can be pushed onto. Common uses include passing structured data into transaction scripts, providing Falcon signatures for authentication, and seeding note scripts with external inputs.

## Trust model and data integrity

The advice provider is supplied by the **host** (the Miden client or node) — not by on-chain consensus. This means the VM cannot blindly trust that the host provided correct data. Two patterns address this:

### Unverified stack push (caller must verify)

`adv_push_mapvaln` pushes data onto the advice stack **without verification**. The caller is responsible for checking integrity if the data is security-sensitive:

```rust
let num_felts = adv_push_mapvaln(key);
// Data is now on the stack — but not verified
// If integrity matters, hash the result and compare to a known commitment
```

For signatures, `emit_falcon_sig_to_stack` pushes a Falcon512 signature that is subsequently verified by `rpo_falcon512_verify` — the verification step is what makes it safe.

### Commitment-verified loading (safe)

`adv_load_preimage` is integrity-safe by construction. The VM verifies that the loaded data hashes to the provided `commitment` before returning it. If the host tampers with the data, the hash won't match and proof generation fails:

```rust
// The VM will abort if hash(loaded_data) != commitment
let data = adv_load_preimage(num_words, commitment);
// `data` is guaranteed to match `commitment`
```

Use this pattern when the commitment is known ahead of time (e.g., stored in a note input or passed as a script argument).

:::warning
Never use `adv_push_mapvaln` for security-sensitive data without a subsequent integrity check. The host can supply any value it wants. Use `adv_load_preimage` (commitment-verified) or verify the loaded data yourself using `hash_words`.
:::

## Reading from the advice map

### `adv_push_mapvaln`

Pushes the value associated with a key onto the advice stack and returns its length.

```rust
use miden::intrinsics::advice::adv_push_mapvaln;

// Push the value for `key` onto the advice stack; returns the number of Felts pushed.
let num_felts: Felt = adv_push_mapvaln(key);
```


### `adv_load_preimage`

Loads a preimage from the advice provider given a commitment and expected word count. This is useful when a note or transaction script needs to retrieve data that was hashed and stored by the sender.

```rust
use miden::stdlib::mem::adv_load_preimage;

// Load `num_words` Words whose hash matches `commitment`.
let felts: Vec<Felt> = adv_load_preimage(num_words, commitment);
```


### Pattern: passing structured data to a transaction script

The canonical pattern (used in `basic-wallet-tx-script`) combines `adv_push_mapvaln` with `adv_load_preimage` to retrieve structured data encoded as a preimage:

```rust
use miden::intrinsics::advice::adv_push_mapvaln;
use miden::stdlib::mem::adv_load_preimage;

// 1. Look up the key — returns the number of Felts stored there
let num_felts = adv_push_mapvaln(key);

// 2. Load the preimage (num_felts must be word-aligned)
let num_words = Felt::from_u64_unchecked(num_felts.as_u64() / 4);
let data: Vec<Felt> = adv_load_preimage(num_words, key);

// 3. Index into the data by field position
let tag       = data[0];
let note_type = data[1];
// ...
```

See [Transaction Scripts](./transaction-scripts) for the full `basic-wallet-tx-script` example.

## Writing to the advice map

### `adv_insert`

Inserts a slice of `Word`s into the advice map under the given key.

```rust
use miden::intrinsics::advice::adv_insert;

let values: &[Word] = &[word_a, word_b];
adv_insert(key, values);
```


### `adv_insert_mem`

Inserts a range of memory into the advice map. The VM reads `Word`s from addresses `[start_addr, end_addr)` and stores them under the key.

```rust
use miden::intrinsics::advice::adv_insert_mem;

adv_insert_mem(key, start_addr, end_addr);
```


## Requesting a Falcon signature

`emit_falcon_sig_to_stack` emits an `AUTH_REQUEST_EVENT` that instructs the host to push a Falcon512 signature onto the advice stack. This is typically used in [authentication components](../accounts/authentication) before calling `rpo_falcon512_verify`.

```rust
use miden::intrinsics::advice::emit_falcon_sig_to_stack;

// Request the host to push a Falcon signature onto the advice stack
emit_falcon_sig_to_stack(msg, pub_key);
```


:::info API Reference
Full API docs on docs.rs: [`miden::intrinsics::advice`](https://docs.rs/miden/latest/miden/intrinsics/advice/)
:::

## Related

- [Authentication](../accounts/authentication) — RPO-Falcon512 signature verification and nonce management
- [Transaction Scripts](./transaction-scripts) — executing logic in the transaction context
- [Transaction Context](./transaction-context) — overview of transaction execution
