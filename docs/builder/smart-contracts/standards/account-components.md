---
title: "Account Components"
description: "Use standard account components for wallets, authentication, access control, faucets, and metadata."
---

# Account Components

Standard account components are prebuilt modules you can compose into accounts. They give an account a recognizable interface, such as "can receive assets", "can authenticate with this signature scheme", "can mint fungible tokens", or "uses this access-control model".

Use these components from Rust when you build accounts with the SDK, or import the underlying MASM modules when you are writing lower-level account code. The same standards surface is what note scripts and transaction scripts rely on when they call account procedures.

## Common standards surfaces

| Surface | Use it for | Rust module |
|---------|------------|-------------|
| `BasicWallet` | Holding assets, receiving assets from standard notes, and moving assets into output notes. | `miden_standards::account::wallets` |
| `FungibleFaucet` | Minting, sending, receiving, and burning fungible assets from faucet accounts. | `miden_standards::account::faucets` |
| `AuthSingleSig` | Single-signature authentication of transactions. | `miden_standards::account::auth` |
| `AuthSingleSigAcl` | Single-signature authentication with an access-control list. | `miden_standards::account::auth` |
| `AuthMultisig` / `AuthMultisigSmart` | Threshold or policy-aware multisig authentication. | `miden_standards::account::auth` |
| `AuthGuardedMultisig` | Multisig guarded by a guardian configuration. | `miden_standards::account::auth` |
| `AuthNetworkAccount` | Authentication through note allowlists for network accounts. | `miden_standards::account::auth` |
| `Ownable2Step` | Access control for account owners. | `miden_standards::account::access` |
| `RoleBasedAccessControl` | Role-based authorization for token policy management. | `miden_standards::account::access` |
| `Authority` | Shared authority component used by policy-management standards. | `miden_standards::account::access` |
| `TokenPolicyManager` | Registering and updating mint, burn, send, and receive token policies. | `miden_standards::account::policies` |
| `BasicBlocklist` | Blocking specific native accounts in send and receive transfer-policy checks. | `miden_standards::account::policies` |
| `BasicAllowlist` | Allowing only specific native accounts in send and receive transfer-policy checks. | `miden_standards::account::policies` |

These are building blocks. They do not prevent you from adding custom components to the same account.

:::info v0.14 differences
The v0.14 snapshot uses separate `BasicFungibleFaucet` and `NetworkFungibleFaucet` components and does not include RBAC, authority, guarded multisig, smart multisig, network-account auth, `TokenPolicyManager`, `BasicBlocklist`, or `BasicAllowlist` in the same form. Use the v0.14 versioned docs when building against the v0.14 crates.
:::

## Start with wallet and auth

Most regular accounts need:

- an authentication component, such as `AuthSingleSig` or `AuthMultisig`
- the `BasicWallet` component

`AuthSingleSig` controls transaction authorization. `BasicWallet` exposes the standard wallet procedures used by common notes, including the ability to receive assets and move assets into output notes.

```rust title="Compose a regular account with standard auth and wallet components"
use miden_protocol::Word;
use miden_protocol::account::auth::{AuthScheme, PublicKeyCommitment};
use miden_protocol::account::{AccountBuilder, AccountStorageMode, AccountType};
use miden_standards::account::auth::AuthSingleSig;
use miden_standards::account::wallets::BasicWallet;

fn build_wallet_account() -> Result<(), Box<dyn std::error::Error>> {
    let public_key = PublicKeyCommitment::from(Word::from([1, 2, 3, 4u32]));

    let account = AccountBuilder::new([1; 32])
        .account_type(AccountType::RegularAccountImmutableCode)
        .storage_mode(AccountStorageMode::Public)
        .with_auth_component(AuthSingleSig::new(public_key, AuthScheme::Falcon512Poseidon2))
        .with_component(BasicWallet)
        .build()?;

    assert_eq!(account.account_type(), AccountType::RegularAccountImmutableCode);
    Ok(())
}
```

For authentication details, see [Authentication](../accounts/authentication). For how component methods are authored in Rust, see [Components](../accounts/components).

## Check note compatibility

Standard notes assume the consuming account exposes the procedures they need. For example, P2ID and P2IDE notes need a wallet-compatible account that can receive assets. SWAP notes additionally need the wallet procedure that moves the requested asset into the payback note.

At the builder level, the practical rule is:

- Add `BasicWallet` to accounts that should receive standard asset-transfer notes.
- Add `FungibleFaucet` to faucet accounts that should mint or burn fungible assets.
- For local or user accounts, add an auth component to reject unauthorized transactions.
- For network accounts, add an access-control component to gate the account procedures notes can call.

Prefer building on top of `BasicWallet`: compose it with a custom extension component for application-specific methods. If you replace the wallet interface entirely, test consumption of the relevant standard notes deliberately.

## Rust and MASM entry points

Rust APIs are the usual entry point for account composition. MASM modules are available when you need exact low-level behavior.

| Area | Rust module | MASM module family |
|------|-------------|--------------------|
| Wallets | `miden_standards::account::wallets` | `miden::standards::wallets::*` |
| Authentication | `miden_standards::account::auth` | `miden::standards::auth::*` |
| Access control | `miden_standards::account::access` | `miden::standards::access::*` |
| Faucets | `miden_standards::account::faucets` | `miden::standards::faucets::*` |
| Metadata | `miden_standards::account::metadata` | `miden::standards::metadata::*` |

Reach for MASM directly when you are implementing low-level behavior, integrating a custom component with a standard procedure, or verifying exact stack effects.

## Related pages

- [Standard notes](./standard-notes) - which account interfaces each standard note expects
- [Faucets and policies](./faucets-and-policies) - using faucet and mint policy components
- [`miden-standards` account source](https://github.com/0xMiden/protocol/tree/next/crates/miden-standards/src/account) - current implementation
