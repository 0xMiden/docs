---
title: "Cryptography"
sidebar_position: 5
description: "Falcon-512 Poseidon2 signature verification and hashing primitives in Miden contracts."
---

# Cryptography

The Miden SDK exposes cryptographic primitives for signature verification and hashing. These are low-level functions used by authentication components and anywhere message digests or hash-based commitments are needed.

## Falcon-512 Poseidon2 verification

The core function for signature verification:

```rust
use miden::{emit_falcon_sig_to_stack, rpo_falcon512_verify};

// Verify a Falcon512 signature
// pk: Poseidon2 hash of the public key
// msg: Poseidon2 hash of the message
emit_falcon_sig_to_stack(msg, pk);
rpo_falcon512_verify(pk, msg);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `pk` | `Word` | Poseidon2 hash of the signer's public key |
| `msg` | `Word` | Poseidon2 hash of the message being verified |

The function panics (proof generation fails) if the signature is invalid.

:::info Where's the signature?
`emit_falcon_sig_to_stack` requests the signature from the host, which loads it onto the advice stack. The Rust verifier is still named `rpo_falcon512_verify` for compatibility, but it uses Falcon-512 over Poseidon2. You don't pass the signature directly to the verifier.

With the standard transaction host, generating a new signature is allowed only
inside the authentication procedure, using a valid transaction summary. Outside
authentication, supply the signature in the transaction's advice inputs before
execution; the event can then load it for verification.
:::

## Hashing

`hash_words` creates a message digest from a slice of Words:

```rust
use miden::hash_words;

// Hash multiple Words into a Digest
let words = [commitment, nonce_word, extra_data];
let digest: Word = hash_words(&words).into();
```

Other available hash functions:

```rust
use miden::{blake3_hash, sha256_hash};

// BLAKE3 (32-byte input -> 32-byte output)
let hash: [u8; 32] = blake3_hash(input_bytes);

// SHA256 (32-byte input -> 32-byte output)
let hash: [u8; 32] = sha256_hash(input_bytes);
```

## Related

- [Authentication](./authentication) — auth component pattern and nonce management
- [Advice Provider](../transactions/advice-provider) — supplying auxiliary data during proof generation
