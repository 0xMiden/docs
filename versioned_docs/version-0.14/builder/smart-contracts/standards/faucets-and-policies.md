---
title: "Faucets and Policies"
description: "Build v0.14 fungible token faucets and choose standard mint policy components."
---

# Faucets and Policies

In Miden, a token issuer is an account. A fungible faucet account can mint and burn the fungible asset identified by that faucet's account ID. The standard faucet components give builders a reusable way to create token issuers without hand-writing the entire faucet interface.

Use this page when you need to create a faucet account, decide who can mint, or understand how faucet behavior relates to standard notes.

## Faucet components

The v0.14 standards snapshot has two fungible faucet components.

| Component | Use it for | Rust module |
|-----------|------------|-------------|
| `BasicFungibleFaucet` | A regular faucet account that mints and burns fungible assets. | `miden_standards::account::faucets` |
| `NetworkFungibleFaucet` | A network-account faucet flow. | `miden_standards::account::faucets` |

Public state is typical for shared token faucets because clients can discover faucet state, metadata, code, and vault changes. Private state is possible, but it changes who can observe the faucet.

```rust title="Create a basic fungible faucet account"
use miden_protocol::Word;
use miden_protocol::account::AccountStorageMode;
use miden_protocol::account::auth::{AuthScheme, PublicKeyCommitment};
use miden_protocol::asset::TokenSymbol;
use miden_protocol::Felt;
use miden_standards::AuthMethod;
use miden_standards::account::faucets::create_basic_fungible_faucet;

fn create_faucet_account() -> Result<(), Box<dyn std::error::Error>> {
    let public_key = PublicKeyCommitment::from(Word::from([1, 2, 3, 4u32]));

    let account = create_basic_fungible_faucet(
        [9; 32],
        TokenSymbol::new("EXT")?,
        6,
        Felt::new(1_000_000),
        AccountStorageMode::Public,
        AuthMethod::SingleSig {
            approver: (public_key, AuthScheme::Falcon512Poseidon2),
        },
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
| Faucet account ID | The issuer ID used when constructing fungible assets and checking balances. |

The v0.14 faucet module exposes token metadata through the standard faucet component, including the symbol, decimals, and max supply fields clients need for display and balance handling.

When an account checks its balance for a fungible token, it queries by the faucet account ID.

## Choose a minting authority model

Mint policy components decide which procedure is allowed to mint from the faucet.

| Policy | Use it when |
|--------|-------------|
| `AuthControlled` | The account's transaction authentication should authorize minting. This is the simple owner-operated faucet pattern. |
| `OwnerControlled` | Ownership should be managed separately, with owner-controlled policy procedures. |

The v0.14 `miden-standards` crate exposes these under `miden_standards::account::mint_policies`.

## Mint with notes

Minting does not directly credit a recipient's account vault. A faucet creates a note carrying the minted asset, and the recipient consumes that note to receive the asset.

For standard flows:

- The faucet creates a mint note or a P2ID note containing the minted asset.
- The recipient discovers and consumes the note.
- The recipient's account must be able to receive the asset, usually by including `BasicWallet`.

This is the same two-transaction note model described in [What are Notes?](../notes/introduction).

## Burn returned assets

Burning is also note-based. A burn note returns assets to the faucet and executes the standard burn behavior. Use `BurnNote` from `miden-standards` rather than hand-writing a burn script unless your protocol needs custom conditions.

## When to write a custom faucet

Use `BasicFungibleFaucet` or `NetworkFungibleFaucet` when supply, metadata, minting, and burning match the standard pattern.

Write a custom faucet component when:

- Minting depends on application state, proofs, allowlists, or rate limits.
- Supply policy is more complex than a fixed max supply and a standard authority check.
- You need custom public methods beyond the standard faucet interface.

Even then, consider reusing standard auth, ownership, and wallet components where they fit. Custom faucet logic does not require custom authentication or custom note formats by default.

## Related pages

- [Account components](./account-components) - composing faucets with standard auth and ownership components
- [Standard notes](./standard-notes) - mint and burn notes
- [Assets, Vault, and Faucet migration notes](../../migration/asset-vault-faucet) - v0.14 asset and faucet changes
- [`miden-standards` v0.14.6 faucet API](https://docs.rs/miden-standards/0.14.6/miden_standards/account/faucets/) - exact Rust API for this version
