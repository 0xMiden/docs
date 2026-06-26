---
title: "Faucets and Policies"
description: "Build fungible token faucets and choose standard mint, burn, send, and receive policies."
---

# Faucets and Policies

In Miden, a token issuer is an account. The current `FungibleFaucet` component bundles token metadata with the standard mint and burn procedures, while the asset's composition is determined at the asset level by `AssetComposition`. The standard faucet components give builders a reusable way to create token issuers without hand-writing the entire faucet interface.

Use this page when you need to create a faucet account, decide who can mint or burn, or understand how faucet behavior relates to standard notes.

:::info v0.14 differences
The current unstable standards surface uses a unified `FungibleFaucet` component and a richer `TokenPolicyManager`. The v0.14 snapshot uses separate `BasicFungibleFaucet` and `NetworkFungibleFaucet` components plus mint-policy components. Use the versioned docs if you are building against v0.14.
:::

## Faucet component

The current standard fungible faucet component is `FungibleFaucet`.

| Surface | Entry point |
|---------|-------------|
| Rust component | `miden_standards::account::faucets::FungibleFaucet` |
| Rust builder/helper | `FungibleFaucetBuilder`, `create_fungible_faucet` |
| MASM component | `miden::standards::faucets::fungible` |
| Account role | Faucet account whose account ID identifies the issuer. |

Public state is typical for shared token faucets because clients can discover faucet state, metadata, code, and vault changes. Private state is possible, but it changes who can observe the faucet.

```rust title="Create a fungible faucet with allow-all policies"
use miden_protocol::Word;
use miden_protocol::account::AccountStorageMode;
use miden_protocol::account::auth::{AuthScheme, PublicKeyCommitment};
use miden_protocol::asset::{AssetAmount, TokenSymbol};
use miden_standards::AuthMethod;
use miden_standards::account::access::AccessControl;
use miden_standards::account::faucets::{
    Description,
    FungibleFaucet,
    TokenName,
    create_fungible_faucet,
};
use miden_standards::account::policies::{
    BurnPolicyConfig,
    MintPolicyConfig,
    PolicyRegistration,
    TokenPolicyManager,
    TransferPolicy,
};

fn create_faucet_account() -> Result<(), Box<dyn std::error::Error>> {
    let public_key = PublicKeyCommitment::from(Word::from([1, 2, 3, 4u32]));

    let faucet = FungibleFaucet::builder()
        .name(TokenName::new("Example Token")?)
        .symbol(TokenSymbol::new("EXT")?)
        .decimals(6)
        .max_supply(AssetAmount::from(1_000_000u32))
        .description(Description::new("Example token")?)
        .build()?;

    let policies = TokenPolicyManager::new()
        .with_mint_policy(MintPolicyConfig::AllowAll, PolicyRegistration::Active)?
        .with_burn_policy(BurnPolicyConfig::AllowAll, PolicyRegistration::Active)?
        .with_send_policy(TransferPolicy::AllowAll, PolicyRegistration::Active)?
        .with_receive_policy(TransferPolicy::AllowAll, PolicyRegistration::Active)?;

    let account = create_fungible_faucet(
        [9; 32],
        faucet,
        AccountStorageMode::Public,
        AuthMethod::SingleSig {
            approver: (public_key, AuthScheme::Falcon512Poseidon2),
        },
        AccessControl::AuthControlled,
        policies,
    )?;

    assert!(account.is_faucet());
    Ok(())
}
```

## Token identity

A fungible asset is tied to its faucet account ID. The faucet's metadata describes the token, while the account ID identifies the asset issuer.

| Field | Meaning |
|-------|---------|
| Symbol | Short token symbol. |
| Decimals | Display precision for client UX. |
| Max supply | Upper bound enforced by the faucet component. |
| Token name | Mandatory display name. |
| Optional metadata | Optional display fields such as description, logo URI, and external link. |
| Faucet account ID | The issuer ID used when constructing fungible assets and checking balances. |

When an account checks its balance for a fungible token, it queries by the faucet account ID.

## Choose policy modules

Policy modules decide which operations are allowed for a token faucet.

| Policy area | Current standard examples | Use it for |
|-------------|---------------------------|------------|
| Mint | `MintAllowAll`, `MintOwnerOnly` | Gate mint operations. |
| Burn | `BurnAllowAll`, `BurnOwnerOnly` | Gate burn operations. |
| Send | `TransferAllowAll`, `BasicBlocklist`, `OwnerControlledBlocklist` | Gate assets leaving accounts through notes. |
| Receive | `TransferAllowAll`, `BasicBlocklist`, `OwnerControlledBlocklist` | Gate assets entering account vaults. |

`TokenPolicyManager` owns the active policy roots and validates policy changes. Authority for changing policies comes from the account's access-control setup, such as owner-controlled or role-based authority.

## Mint with notes

Minting does not directly credit a recipient's account vault. A faucet creates a note carrying the minted asset, and the recipient consumes that note to receive the asset.

For standard flows:

- The faucet creates a mint note or a P2ID note containing the minted asset.
- The recipient discovers and consumes the note.
- The recipient's account must be able to receive the asset, usually by including `BasicWallet`.

This is the same two-transaction note model described in [What are Notes?](../notes/introduction.md).

## Burn returned assets

Burning is also note-based. A burn note returns assets to the faucet and executes the standard burn behavior. Use `BurnNote` from `miden-standards` rather than hand-writing a burn script unless your protocol needs custom conditions.

## When to write a custom faucet

Use `FungibleFaucet` when supply, metadata, minting, burning, and transfer policies match the standard pattern.

Before writing a custom faucet, first check whether `TokenPolicyManager` plus a standard or custom policy component can express the rule. Custom policies can gate minting, burning, sending, and receiving without replacing the faucet component. For some minting flows, a custom mint note accepted by the faucet can move application-specific supply logic out of the faucet itself.

Write a custom faucet component when:

- You need customized versions of the standard faucet procedures.
- The asset issuance model cannot be expressed with `TokenPolicyManager`, custom policies, or custom mint notes.
- The faucet's state model must differ from the standard metadata, supply, and policy layout.

If you only need additional public methods, compose the faucet account with an extension component instead of replacing `FungibleFaucet`. Even then, consider reusing standard auth, ownership, and wallet components where they fit. Custom faucet logic does not require custom authentication or custom note formats by default.

## Related pages

- [Account components](./account-components.md) - composing faucets with standard auth and ownership components
- [Standard notes](./standard-notes.md) - mint and burn notes
- [Assets, Vault, and Faucet migration notes](../../migration/05-asset-vault-faucet.md) - v0.14 asset and faucet changes
- [`miden-standards` faucet source](https://github.com/0xMiden/protocol/tree/next/crates/miden-standards/src/account/faucets) - current implementation
