---
title: "What are Accounts?"
sidebar_position: 0
description: "Accounts are the primary actors in Miden — they store code, state, and assets, and execute provable state transitions."
---

# What are Accounts?

Accounts are the primary actors in Miden. Every entity on the network — wallets, smart contracts, token faucets — is an account. Unlike traditional blockchains where user wallets and smart contracts are fundamentally different, Miden treats them all as programmable accounts with the same structure.

Each account is an independent state machine. Most transactions execute locally on a client, while network accounts can instead be executed and proven by a network transaction builder. In both cases, correct execution is verified through a zero-knowledge proof. Accounts never share a global execution environment — they run in isolation, which enables parallel execution and privacy by default.

## Anatomy of an account

Every account has an immutable identifier and four state elements:

| Part | Description |
|------|-------------|
| **ID** | An immutable identifier that uniquely identifies the account |
| **Code** | One or more [components](./components.md) that define the account's behavior — its public API and internal logic |
| **Storage** | Persistent state — up to 255 typed [slots](./storage.md) of `StorageValue` or `StorageMap` |
| **Vault** | The fungible and non-fungible assets the account holds |
| **Nonce** | A counter that increments by one in every state-changing transaction, providing replay protection |

For public accounts, the network stores the full account state. For private accounts, it stores only a commitment to the account state — computed from the ID, nonce, vault root, storage commitment, and code commitment — while the full state remains offchain and must be maintained by the user (see [account design](/reference/protocol/account/)).

## Components, not contracts

On Ethereum, a smart contract is a single monolithic unit of code deployed to an address. On Miden, accounts are composed of **components** — reusable modules that each contribute their own storage layout and exported procedures.

```rust
use miden::{component, component_storage, Asset};

#[component_storage]
struct MyWalletStorage;

#[component]
trait MyWallet {
    #[account_procedure]
    fn receive_asset(&mut self, asset: Asset);
}

#[component]
impl MyWallet for MyWalletStorage {
    fn receive_asset(&mut self, asset: Asset) {
        self.add_asset(asset);
    }
}
```

An account can have multiple components. For example, a DeFi account might combine a wallet component (for holding assets), an auth component (for signature verification), and custom application logic — all in a single account. Components communicate with each other through [cross-component calls](../cross-component-calls.md) using WIT (WebAssembly Interface Types) bindings.

## Account types

Accounts are configured with `AccountType`, which controls state visibility:

| Type | Description |
|------|-------------|
| `AccountType::Public` | Full state is stored onchain and visible to everyone — suitable for shared protocols like DEXs and faucets |
| `AccountType::Private` | Only a state commitment is stored onchain — the actual data stays with the account owner |

Wallet, contract, and faucet roles are determined by the account's components and options, not by separate account-type enum variants. For example, a fungible faucet is a public or private account that includes the `FungibleFaucet` component and token policy configuration.

## How accounts differ from EVM contracts

| | EVM | Miden |
|---|---|---|
| **Execution** | Every validator re-executes every transaction | A client or network transaction builder executes; the network verifies a ZK proof |
| **State visibility** | All state variables are public onchain | Private accounts expose commitments; public accounts store their full state onchain |
| **Code structure** | Monolithic contract deployed to an address | Multiple reusable components composed into one account |
| **Identity** | Wallets are EOAs, contracts are separate | Everything is an account — wallets are smart contracts |
| **Failure** | `revert` consumes gas, leaves an onchain trace | Invalid execution cannot produce a proof, so no failed transaction is submitted onchain |
