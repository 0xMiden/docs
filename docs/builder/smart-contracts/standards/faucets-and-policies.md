---
title: "Faucets and Policies"
description: "Build fungible token faucets and choose standard mint, burn, send, and receive policies."
---

# Faucets and Policies

In Miden, a token issuer is an account. The current `FungibleFaucet` component bundles token metadata with the standard mint and burn procedures, while the asset's composition is determined at the asset level by `AssetComposition`. The standard faucet components give builders a reusable way to create token issuers without hand-writing the entire faucet interface.

Use this page when you need to create a faucet account, decide who can mint or burn, or understand how faucet behavior relates to standard notes.

## Faucet component

The current standard fungible faucet component is `FungibleFaucet`.

| Surface | Entry point |
|---------|-------------|
| Rust component | `miden_standards::account::faucets::FungibleFaucet` |
| Rust builder/helper | `FungibleFaucetBuilder`, `create_singlesig_user_fungible_faucet` |
| MASM component | `miden::standards::faucets::fungible` |
| Account role | Faucet account whose account ID identifies the issuer. |

Public state is typical for shared token faucets because clients can discover faucet state, metadata, code, and vault changes. Private state is possible, but it changes who can observe the faucet.

```rust title="Create a fungible faucet with allow-all policies"
use miden_client::{
    account::{
        AccountType,
        component::{
            AuthSingleSig,
            BurnPolicy,
            FungibleFaucet,
            MintPolicy,
            TokenName,
            TokenPolicyManager,
            TransferPolicy,
            create_singlesig_user_fungible_faucet,
        },
    },
    asset::TokenSymbol,
    auth::Approver,
};
use miden_protocol::{
    account::auth::{AuthScheme, PublicKeyCommitment},
    asset::AssetAmount,
    Word,
};
fn create_faucet_account() -> Result<(), Box<dyn std::error::Error>> {
    let public_key = PublicKeyCommitment::from(Word::from([1, 2, 3, 4u32]));

    let faucet = FungibleFaucet::builder()
        .name(TokenName::new("Example Token")?)
        .symbol(TokenSymbol::new("EXT")?)
        .decimals(6)
        .max_supply(AssetAmount::from(1_000_000u32))
        .build()?;

    let policies = TokenPolicyManager::builder()
        .active_mint_policy(MintPolicy::allow_all())
        .active_burn_policy(BurnPolicy::allow_all())
        .active_send_policy(TransferPolicy::allow_all())
        .active_receive_policy(TransferPolicy::allow_all())
        .build();

    let auth = AuthSingleSig::new(Approver::new(
        public_key,
        AuthScheme::Falcon512Poseidon2,
    ));

    let account = create_singlesig_user_fungible_faucet(
        [9; 32],
        faucet,
        auth,
        policies,
        AccountType::Public,
    )?;

    assert!(account.is_public());
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

When an account checks its balance for a fungible token at the protocol/client layer, it queries by the asset's `AssetId`, which is derived from the faucet account ID. Whether the asset invokes callbacks is encoded in the faucet account ID at construction time.

## Choose policy modules

Policy modules decide which operations are allowed for a token faucet.

| Policy area | Current standard examples | Use it for |
|-------------|---------------------------|------------|
| Mint | `MintPolicy::allow_all()`, `MintPolicy::owner_only()` | Gate mint operations. |
| Burn | `BurnPolicy::allow_all()`, `BurnPolicy::owner_only()` | Gate burn operations. |
| Send | `TransferPolicy::allow_all()`, `TransferPolicy::empty_basic_blocklist()`, `TransferPolicy::with_basic_blocklist(...)` | Gate assets leaving accounts through notes. |
| Receive | `TransferPolicy::allow_all()`, `TransferPolicy::empty_basic_blocklist()`, `TransferPolicy::with_basic_blocklist(...)` | Gate assets entering account vaults. |

Use `BlocklistManager` alongside a basic blocklist when its entries must be updated at runtime.

`TokenPolicyManager` owns the active policy roots and validates policy changes. Authority for changing policies comes from the account's access-control setup, such as owner-controlled or role-based authority.

## Mint with notes

Minting does not directly credit a recipient's account vault. A faucet creates a note carrying the minted asset, and the recipient consumes that note to receive the asset.

For standard flows:

- A user can send a public, asset-free `MintNote` to a network faucet to request minting. The faucet consumes that request and creates a delivery note containing the minted asset.
- A user-controlled faucet can mint directly into a delivery note, such as P2ID, in its own transaction.
- The recipient discovers and consumes the delivery note.
- The recipient's account must be able to receive the asset, usually by including `BasicWallet`.

The delivery note is created in one transaction and consumed in another, as described in [What are Notes?](../notes/introduction). A network-faucet flow also includes the earlier transaction that publishes the mint request.

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

- [Account components](./account-components) - composing faucets with standard auth and ownership components
- [Standard notes](./standard-notes) - mint and burn notes
- [Assets, Vault, and Faucet migration notes](../../migration/asset-vault-faucet) - asset and faucet changes
- [`miden-standards` faucet source](https://github.com/0xMiden/protocol/tree/next/crates/miden-standards/src/account/faucets) - current implementation
