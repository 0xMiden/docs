---
title: "What are Accounts?"
sidebar_position: 0
description: "Accounts are the primary actors in Miden — they store code, state, and assets, and execute transactions locally with private state."
---

# What are Accounts?

Accounts are the primary actors in Miden. Every entity on the network — wallets, smart contracts, token faucets — is an account. Unlike traditional blockchains where user wallets and smart contracts are fundamentally different, Miden treats them all as programmable accounts with the same structure.

Each account is an independent state machine that executes transactions locally and generates a zero-knowledge proof of correct execution. This means accounts never share a global execution environment — they run in isolation, which enables parallel execution and privacy by default.

## Anatomy of an account

Every account has four parts:

| Part | Description |
|------|-------------|
| **Code** | One or more [components](./components.md) that define the account's behavior — its public API and internal logic |
| **Storage** | Persistent state — up to 255 typed [slots](./storage.md) of `Value` or `StorageMap` |
| **Vault** | The fungible and non-fungible assets the account holds |
| **Nonce** | A counter that increments exactly once per state change, providing replay protection |

The network doesn't store the full account state. Instead, it stores cryptographic commitments — hashes of the code, storage, and vault (see [account design](/reference/protocol/account/)). Only the account owner (or a public account's observers) sees the actual data.

## Components, not contracts

On Ethereum, a smart contract is a single monolithic unit of code deployed to an address. On Miden, accounts are composed of **components** — reusable modules that each contribute their own storage layout and exported procedures.

```rust
use miden::{component, Asset};

#[component]
struct MyWallet;

#[component]
impl MyWallet {
    pub fn receive_asset(&mut self, asset: Asset) {
        self.add_asset(asset);
    }
}
```

An account can have multiple components. For example, a DeFi account might combine a wallet component (for holding assets), an auth component (for signature verification), and custom application logic — all in a single account. Components communicate with each other through [cross-component calls](../cross-component-calls.md) using WIT (WebAssembly Interface Types) bindings.

## Account types

Accounts are configured by type and storage mode:

| Type | Description |
|------|-------------|
| `RegularAccountUpdatableCode` | Standard account — code can be updated after deployment |
| `RegularAccountImmutableCode` | Account with fixed code — cannot be changed after deployment |
| `FungibleFaucet` | Mints and burns fungible tokens |
| `NonFungibleFaucet` | Mints and burns non-fungible tokens (NFTs) |

Storage mode controls privacy:

| Mode | Description |
|------|-------------|
| **Public** | Full state is stored onchain and visible to everyone — suitable for shared protocols like DEXs and faucets |
| **Private** | Only a state commitment is stored onchain — the actual data stays with the account owner |

## How accounts differ from EVM contracts

| | EVM | Miden |
|---|---|---|
| **Execution** | Every validator re-executes every transaction | Account owner executes locally, submits a ZK proof |
| **State visibility** | All state variables are public onchain | State is private by default (only commitments onchain) |
| **Code structure** | Monolithic contract deployed to an address | Multiple reusable components composed into one account |
| **Identity** | Wallets are EOAs, contracts are separate | Everything is an account — wallets are smart contracts |
| **Failure** | `revert` consumes gas, leaves an onchain trace | Proof cannot be generated — no onchain trace, no cost |

