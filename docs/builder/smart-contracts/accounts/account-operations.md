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
impl MyAccount for MyAccountStorage {
    fn check_state(&self, asset_id: Word) {
        // Account identity
        let id: AccountId = self.get_id();
        let nonce: Nonce = self.get_nonce();

        // Vault queries
        let value: Word = self.get_asset(asset_id);
        let initial_value: Word = native_account::get_initial_asset(asset_id);
        let has_asset: bool = self.has_asset(asset_id);
        let root: Word = self.get_vault_root();
        let initial_root: Word = native_account::get_initial_vault_root();

        // Commitment queries
        let commitment: Word = self.compute_commitment();
        let initial_commit: Word = native_account::get_initial_commitment();
        let storage: Word = self.compute_storage_commitment();
        let initial_storage: Word = native_account::get_initial_storage_commitment();
        let code: Word = self.get_code_commitment();

        // Procedure queries
        let count: u32 = self.get_num_procedures();
        let proc_root: Word = self.get_procedure_root(0);
        let exists: bool = self.has_procedure(proc_root);
    }
}
```

## Mutations (`&mut self`)

```rust
#[component]
impl MyAccount for MyAccountStorage {
    fn receive_asset(&mut self, asset: Asset) {
        // Add an asset to the vault — returns the resulting value word
        let stored_value: Word = self.add_asset(asset);
    }

    fn send_asset(&mut self, asset: Asset, note_idx: NoteIdx) {
        // Remove an asset from the vault — returns the resulting value word
        // Proof generation fails if the asset doesn't exist or insufficient balance
        self.remove_asset(asset);
        output_note::add_asset(asset, note_idx);
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
| `get_procedure_root(index)` | Index out of bounds |
| Any `assert!()` | Condition is false |
| Transaction body (overall) | No state change occurred **and** no notes were consumed |

When proof generation fails:
1. The ZK circuit cannot produce a valid proof
2. The transaction is rejected **before reaching the network**
3. No state changes occur
4. The client receives an error describing the failure

The last row is enforced at end-of-execution by the VM kernel rather than mid-execution: a transaction that mutates no account state (storage, vault, or nonce) **and** consumes no notes is rejected. See [Empty Transaction](../../tutorials/helpers/pitfalls#empty-transaction-no-state-change-no-notes) for the recommended pattern.

## Example: ManagedWallet

```rust
#![no_std]
#![feature(alloc_error_handler)]

use miden::{component, component_storage, output_note, Asset, NoteIdx, Word};

#[component_storage]
struct ManagedWalletStorage;

#[component]
trait ManagedWallet {
    #[account_procedure]
    fn receive_asset(&mut self, asset: Asset);
    #[account_procedure]
    fn send_asset(&mut self, asset: Asset, note_idx: NoteIdx);
    #[account_procedure]
    fn asset_value(&self, asset_id: Word) -> Word;
}

#[component]
impl ManagedWallet for ManagedWalletStorage {
    /// Receive an asset into the vault.
    fn receive_asset(&mut self, asset: Asset) {
        self.add_asset(asset);
    }

    /// Send an asset to an output note, with balance check.
    fn send_asset(&mut self, asset: Asset, note_idx: NoteIdx) {
        self.remove_asset(asset);
        output_note::add_asset(asset, note_idx);
    }

    /// Read the value word stored under an asset ID.
    fn asset_value(&self, asset_id: Word) -> Word {
        self.get_asset(asset_id)
    }
}
```

To move assets out of an account, create [output notes](../notes/output-notes) with `output_note::add_asset`. For signature verification and nonce management, see [Authentication](./authentication).

:::info API Reference
Full API docs on docs.rs: [`miden`](https://docs.rs/miden/latest/miden/)
:::
