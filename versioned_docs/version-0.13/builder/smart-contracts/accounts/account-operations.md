---
title: "Account Operations"
sidebar_position: 4
description: "Query account state and mutate the vault using self methods in Miden components."
---

# Account Operations

The `#[component]` macro automatically provides methods on `self` for interacting with the current account during a transaction. Read-only queries are available on `&self`, and mutations (add/remove assets, increment nonce) require `&mut self`.

## Read-only queries (`&self`)

```rust
#[component]
impl MyAccount {
    pub fn check_state(&self) {
        // Account identity
        let id: AccountId = self.get_id();
        let nonce: Felt = self.get_nonce();

        // Vault queries
        let balance: Felt = self.get_balance(faucet_id);
        let initial: Felt = self.get_initial_balance(faucet_id);
        let has_nft: bool = self.has_non_fungible_asset(asset);
        let root: Word = self.get_vault_root();
        let initial_root: Word = self.get_initial_vault_root();

        // Commitment queries
        let commitment: Word = self.compute_commitment();
        let initial_commit: Word = self.get_initial_commitment();
        let storage: Word = self.compute_storage_commitment();
        let initial_storage: Word = self.get_initial_storage_commitment();
        let code: Word = self.get_code_commitment();

        // Procedure queries
        let count: Felt = self.get_num_procedures();
        let proc_root: Word = self.get_procedure_root(0);
        let exists: bool = self.has_procedure(proc_root);
    }
}
```

## Mutations (`&mut self`)

```rust
#[component]
impl MyAccount {
    pub fn receive_asset(&mut self, asset: Asset) {
        // Add an asset to the vault — returns the asset as stored
        let stored: Asset = self.add_asset(asset);
    }

    pub fn send_asset(&mut self, asset: Asset, note_idx: NoteIdx) {
        // Remove an asset from the vault — returns the removed asset
        // Proof generation fails if the asset doesn't exist or insufficient balance
        let removed: Asset = self.remove_asset(asset);
        output_note::add_asset(removed, note_idx);
    }

    pub fn auth(&mut self) {
        // Increment the account nonce (replay protection)
        let new_nonce: Felt = self.incr_nonce();

        // Compute commitment of all state changes in this transaction
        let delta: Word = self.compute_delta_commitment();

        // Check if a specific procedure was called during this transaction
        let called: bool = self.was_procedure_called(proc_root);
    }
}
```

:::warning
The nonce must be incremented for any transaction that modifies account state. Without it, the same transaction could be replayed.
:::

## When proof generation fails

Several operations cause proof generation to fail if preconditions aren't met:

| Operation | Fails when |
|-----------|-----------|
| `remove_asset(asset)` | Asset not in vault or insufficient balance |
| `get_balance(faucet_id)` | Referenced asset is non-fungible |
| `get_procedure_root(index)` | Index out of bounds |
| Any `assert!()` | Condition is false |

When proof generation fails:
1. The ZK circuit cannot produce a valid proof
2. The transaction is rejected **before reaching the network**
3. No state changes occur
4. The client receives an error describing the failure

## Example: ManagedWallet

```rust
#![no_std]
#![feature(alloc_error_handler)]

use miden::{component, output_note, Asset, AccountId, NoteIdx, Felt};

#[component]
struct ManagedWallet;

#[component]
impl ManagedWallet {
    /// Receive an asset into the vault.
    pub fn receive_asset(&mut self, asset: Asset) {
        self.add_asset(asset);
    }

    /// Send an asset to an output note, with balance check.
    pub fn send_asset(&mut self, asset: Asset, note_idx: NoteIdx) {
        let removed = self.remove_asset(asset);
        output_note::add_asset(removed, note_idx);
    }

    /// Query the balance of a fungible asset.
    pub fn balance_of(&self, faucet_id: AccountId) -> Felt {
        self.get_balance(faucet_id)
    }
}
```

To move assets out of an account, create [output notes](../notes/output-notes) with `output_note::add_asset`. For signature verification and nonce management, see [Authentication](./authentication).

:::info API Reference
Full API docs on docs.rs: [`miden`](https://docs.rs/miden/latest/miden/)
:::
