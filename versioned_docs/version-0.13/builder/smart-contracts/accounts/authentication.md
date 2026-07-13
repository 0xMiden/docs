---
title: "Authentication"
sidebar_position: 6
description: "Authentication component pattern and nonce management for Miden accounts."
---

# Authentication

Miden uses RPO-Falcon512 digital signatures for transaction authentication. Because transactions execute on the client rather than on-chain validators, the system needs a way to prove that a transaction was authorized by the account owner. Without authentication, anyone could construct a valid proof that transfers assets out of an account. The nonce prevents replay attacks — without it, a valid proof could be resubmitted to execute the same state change twice. For details on the cryptographic primitives, see [Cryptography](./cryptography).

## How authentication works

An auth component stores the RPO256 hash of the account owner's Falcon512 public key in a dedicated storage slot. During transaction execution, it computes a message digest from the transaction's delta commitment and the incremented nonce, requests the signature from the advice provider via `emit_falcon_sig_to_stack`, and verifies it with `rpo_falcon512_verify`. If verification fails, proof generation fails and the transaction is rejected before reaching the network.

The signature itself isn't passed as a function argument — it's provided through the **advice provider**, a special mechanism that supplies auxiliary data to the VM during proof generation.

## The advice provider

The advice provider supplies auxiliary data during proof generation — see [Advice Provider](../transactions/advice-provider) for the full API.

## Auth component implementation

From the [compiler examples](https://github.com/0xMiden/compiler/tree/next/examples/auth-component-rpo-falcon512):

```rust
#![no_std]
#![feature(alloc_error_handler)]

extern crate alloc;

use miden::{
    Felt, Value, ValueAccess, Word, component, felt, hash_words,
    intrinsics::advice::adv_insert, native_account, tx,
};

#[component]
struct AuthComponent {
    /// The account owner's public key (RPO-Falcon512 public key hash).
    #[storage(
        description = "owner public key",
        type = "miden::standards::auth::falcon512_rpo::pub_key"
    )]
    owner_public_key: Value,
}

#[component]
impl AuthComponent {
    pub fn auth_procedure(&mut self, _arg: Word) {
        let ref_block_num = tx::get_block_number();
        let final_nonce = self.incr_nonce();

        // Gather tx summary parts
        let acct_delta_commit = self.compute_delta_commitment();
        let input_notes_commit = tx::get_input_notes_commitment();
        let output_notes_commit = tx::get_output_notes_commitment();

        let salt = Word::from([felt!(0), felt!(0), ref_block_num, final_nonce]);

        let mut tx_summary = [acct_delta_commit, input_notes_commit, output_notes_commit, salt];
        let msg: Word = hash_words(&tx_summary).into();
        // On the advice stack the words are expected to be in reverse order
        tx_summary.reverse();
        // Insert tx summary into advice map under key `msg`
        adv_insert(msg, &tx_summary);

        let pub_key: Word = self.owner_public_key.read();

        // Emit signature request event to advice stack
        miden::emit_falcon_sig_to_stack(msg, pub_key);

        // Verify the signature loaded on the advice stack
        miden::rpo_falcon512_verify(pub_key, msg);
    }
}
```

## Nonce management

The nonce prevents replay attacks — each transaction must use a unique nonce:

```rust
// Increment and return the new nonce
let new_nonce: Felt = self.incr_nonce();
```

The nonce is automatically included in the transaction's proof. If someone tries to replay a transaction, the nonce won't match and verification will fail.

Auth components are typically called via [cross-component calls](../cross-component-calls) from note scripts or [transaction scripts](../transactions/transaction-scripts). For access control and security patterns, see [Patterns](../patterns).

:::info API Reference
Full API docs on docs.rs: [`miden`](https://docs.rs/miden/latest/miden/) (`rpo_falcon512_verify`)
:::

## Related

- [Cryptography](./cryptography) — RPO-Falcon512 verification and hashing primitives
- [Advice Provider](../transactions/advice-provider) — supplying auxiliary data during proof generation
- [Patterns](../patterns) — access control, rate limiting, and anti-patterns
