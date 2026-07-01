---
title: "Authentication"
sidebar_position: 6
description: "Authentication component pattern and nonce management for Miden accounts."
---

# Authentication

Miden uses digital signatures for transaction authentication. Because transactions execute on the client rather than onchain validators, the system needs a way to prove that a transaction was authorized by the account owner. Without authentication, anyone could construct a valid proof that transfers assets out of an account. The nonce prevents replay attacks — without it, a valid proof could be resubmitted to execute the same state change twice. For details on the cryptographic primitives, see [Cryptography](./cryptography).

v0.15 uses a single scheme-agnostic [`AuthSingleSig`](https://docs.rs/miden-standards/latest/miden_standards/account/auth/struct.AuthSingleSig.html) component for single-signature accounts. It takes an auth scheme identifier such as `Falcon512Poseidon2` or `EcdsaK256Keccak`. The native hash function is Poseidon2, and the Falcon-512 verifier MASM module is `miden::core::crypto::dsa::falcon512_poseidon2`.

## How authentication works

The standards `AuthSingleSig` component stores two items under well-known names:

| Storage slot | Name | Description |
|---|---|---|
| Public key | `miden::standards::auth::singlesig::pub_key` | Commitment to the account owner's public key |
| Scheme ID | `miden::standards::auth::singlesig::scheme` | Which signature scheme to use (1 = ECDSA K256 Keccak, 2 = Falcon-512 Poseidon2) |

During transaction execution the kernel invokes the `@auth_script`-annotated procedure on the account. For `AuthSingleSig`, that procedure loads both slots and delegates to `miden::standards::auth::signature::authenticate_transaction`, which:

1. Increments the account nonce (even if the account state did not change — this is required for replay protection).
2. Computes the transaction summary message: `hash([ACCOUNT_DELTA_COMMITMENT, INPUT_NOTES_COMMITMENT, OUTPUT_NOTES_COMMITMENT, [0, 0, ref_block_num, final_nonce]])`.
3. Requests the signature from the advice provider and verifies it with the scheme indicated by the stored scheme ID.

If verification fails, proof generation fails and the transaction is rejected before reaching the network. The signature itself isn't passed as a function argument — it's provided through the **advice provider**, a mechanism that supplies auxiliary data to the VM during proof generation. See [Advice Provider](../transactions/advice-provider) for the full API.

## Attaching `AuthSingleSig` to an account

On the client side, attach `AuthSingleSig` via `AccountBuilder::with_auth_component`. `miden-client` re-exports `AuthScheme` as `AuthSchemeId`:

```rust
use miden_client::{
    account::{AccountBuilder, AccountType, component::BasicWallet},
    auth::{AuthSchemeId, AuthSingleSig},
};
use miden_protocol::{account::auth::PublicKeyCommitment, Word};

let public_key = PublicKeyCommitment::from(Word::default());

let account = AccountBuilder::new(seed)
    .account_type(AccountType::Public)
    .with_auth_component(AuthSingleSig::new(
        public_key,
        AuthSchemeId::Falcon512Poseidon2,
    ))
    .with_component(BasicWallet)
    .build()?;
```

If you import directly from `miden-protocol`, the same enum is called `AuthScheme` (`miden_protocol::account::auth::AuthScheme`) — `miden-client` just re-exports it under a friendlier name.

## Writing a custom auth component

If you need authentication logic beyond `AuthSingleSig` / `AuthMultisig`, you can write a custom auth component in Rust. Mark exactly one procedure per auth component with `#[auth_script]`. If the procedure returns without panicking, the transaction kernel treats authentication as successful. If it panics (for example via `assert!`), authentication fails.

```rust
#![no_std]
#![feature(alloc_error_handler)]

use miden::{auth_script, component, component_storage, Word};

#[component_storage]
struct AuthComponentStorage;

#[component]
trait AuthComponent {
    #[auth_script]
    fn verify(&mut self, _arg: Word);
}

#[component]
impl AuthComponent for AuthComponentStorage {
    fn verify(&mut self, _arg: Word) {
        // Custom authentication checks go here.
        //
        // Returning normally = authentication succeeded.
        // Panicking (e.g. `assert!(false)`) = authentication failed and
        // the transaction will be rejected before proof generation finishes.
        todo!()
    }
}
```

## Nonce management

The nonce prevents replay attacks — each transaction must use a unique nonce. For accounts using the standards `AuthSingleSig` (or `AuthMultisig`) component, nonce increment is handled inside `authenticate_transaction`. If you implement a fully custom auth script, you are responsible for incrementing the nonce yourself and for binding it into the signed message.

The nonce is committed into the transaction proof. If someone tries to replay a transaction, the nonce won't match the account's current nonce and verification will fail.

Auth components are invoked automatically by the kernel — you do not call them directly from note scripts or [transaction scripts](../transactions/transaction-scripts). For access control and security patterns, see [Patterns](../patterns).

:::info API Reference
Full API docs on docs.rs: [`miden`](https://docs.rs/miden/latest/miden/), [`AuthSingleSig`](https://docs.rs/miden-standards/latest/miden_standards/account/auth/struct.AuthSingleSig.html), [`AuthScheme`](https://docs.rs/miden-protocol/latest/miden_protocol/account/auth/enum.AuthScheme.html)
:::

## Related

- [Cryptography](./cryptography) — Falcon-512 / Poseidon2 verification and hashing primitives
- [Advice Provider](../transactions/advice-provider) — supplying auxiliary data during proof generation
- [Patterns](../patterns) — access control, rate limiting, and anti-patterns
