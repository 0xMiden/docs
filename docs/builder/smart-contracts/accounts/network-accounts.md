---
title: "Network Accounts"
sidebar_position: 7
description: "What a network account is in Miden v0.15, how to build and deploy one, and how to send network notes to it from Rust and TypeScript."
---

# Network Accounts

A **network account** is a public account that the network can transact against on the owner's behalf — no client needs to be online. When a note is addressed to a network account, the node's network transaction (NTX) builder executes the consuming transaction and commits the resulting state change. This is how you build always-available onchain contracts: counters, faucets, order books, and other components that must react to incoming notes without a user driving them.

Two sides have to line up for network execution to happen:

- **The account** opts in by carrying the standardized note-allowlist storage slot, added through the [`AuthNetworkAccount`](https://docs.rs/miden-standards/latest/miden_standards/account/auth/struct.AuthNetworkAccount.html) auth component.
- **The note** targets the account by carrying a `NetworkAccountTarget` attachment.

If a note's script root is in the account's allowlist, the network consumes it automatically.

:::info v0.15 change
Before v0.15, network accounts were a storage mode (`AccountStorageMode::Network`). That storage mode was **removed**. An account is now classified only as `AccountType::Public` or `AccountType::Private`, and "network account" is a *property of a public account's storage* — the presence of the allowlist slot — rather than a separate mode. See [Account changes](../../migration/03-account-changes.md).
:::

## What makes an account a network account

`AuthNetworkAccount` writes a standardized [`StorageMap`](./storage) slot named `miden::standards::auth::network_account::allowed_note_scripts`. Off-chain services and the node's NTX builder treat the presence of that slot as the signal that an account is a network account. The slot holds a **note allowlist**: the set of note script roots the account is willing to consume. A note whose script root is not in the allowlist is rejected during authentication.

The component also holds a second allowlist of permitted **transaction script roots** (`miden::standards::auth::network_account::allowed_tx_scripts`). It is empty by default, and the network auth procedure **rejects any transaction whose script root is not in this allowlist**. Consuming a note does not need a transaction script, so a note-only network account leaves it empty. But if the account is ever reached by a *custom transaction script* — for example a scripted deploy, or a scripted interaction — that script's root must be allowlisted too, or the transaction is rejected.

Both allowlists are **fixed at account creation**. The component deliberately exports no procedure to mutate them, so decide the allowed note scripts before you build the account.

## Prerequisites

- The account must be `AccountType::Public`. A private account cannot be a network account.
- The note allowlist must be **non-empty** — `AuthNetworkAccount::with_allowed_notes` returns an error for an empty set, because an account that can consume no notes is useless as a network account.
- You need the **script root of every note type** the account should accept, computed from the compiled note script.

## Building a network account

Because the allowlists are fixed at creation, compile the note script and read its MAST root **before** building the account. The note-script allowlist is required — its presence is what marks the account as a network account. Compile with the client's code builder:

```rust
use std::collections::BTreeSet;

use miden_client::account::{
    AccountBuilder, AccountType,
    component::AuthNetworkAccount,
};

let note_script = client.code_builder().compile_note_script(note_code)?;
let note_script_root = note_script.root();
```

Attach `AuthNetworkAccount` as the account's auth component — `miden-client` re-exports it from `miden_client::account::component` — and build a public account:

```rust
let auth = AuthNetworkAccount::with_allowed_notes(BTreeSet::from([note_script_root]))?;

let account = AccountBuilder::new(init_seed)
    .account_type(AccountType::Public)      // network accounts must be public
    .with_component(counter_component)      // your application logic
    .with_auth_component(auth)              // AuthNetworkAccount as the auth component
    .build()?;
```

If the account will be reached by a **custom transaction script** — for example a scripted deploy, or a scripted interaction — you must also allowlist that script's root, or the network auth procedure rejects the transaction:

```rust
let tx_script = client.code_builder().compile_tx_script(deploy_script_code)?;

let auth = AuthNetworkAccount::with_allowed_notes(BTreeSet::from([note_script_root]))?
    .with_allowed_tx_scripts(BTreeSet::from([tx_script.root()]));
```

## Deploying a network account

Building the account and adding it to the client store is **not** enough to register it onchain — an account only exists to the network once a committed transaction has advanced its state (nonce `0` → `1`). Submit a transaction against it to deploy it.

Because `AuthNetworkAccount` bumps the nonce itself, an **empty, scriptless transaction is the simplest way** to register the account — a scriptless transaction needs nothing in the tx-script allowlist. (Deploying with a custom transaction script also works, but then that script's root must be in the tx-script allowlist, as above.)

```rust
use miden_client::transaction::TransactionRequestBuilder;

client.add_account(&account, false).await?;

// Scriptless deploy: AuthNetworkAccount bumps the nonce on its own,
// so an empty transaction is enough to register the account onchain.
let tx_id = client
    .submit_new_transaction(account.id(), TransactionRequestBuilder::new().build()?)
    .await?;

// Sync until the deploy transaction is committed by the node. In tests the
// `wait_for_tx` helper wraps this loop; in application code, sync and check the
// transaction status with `client.get_transactions(...)`.
client.sync_state().await?;
```

Once the deploy transaction is committed, the network watches the account and will consume any allowlisted note addressed to it.

## Inspecting a network account

`NetworkAccount` is a validation wrapper that confirms an `Account` is public and carries a valid, non-empty allowlist slot. Use it to check an account you fetched or built:

```rust
use miden_client::account::component::NetworkAccount;

let network_account = NetworkAccount::try_from(account)?; // errors if not public / no allowlist
let allowed = network_account.allowed_notes();            // the note allowlist
```

## Sending a note to a network account

A note is executed by the network when it carries a `NetworkAccountTarget` attachment and its script root is in the target account's allowlist. Both Rust and TypeScript can create these notes — this is the part of the flow available to web integrators.

### TypeScript

The Web SDK builds and submits a network note in one call. It creates a public, custom-script note carrying the required `NetworkAccountTarget` attachment, so the target network account auto-consumes it:

```typescript
const { txId, note } = await client.transactions.createNetworkNote({
  account: senderAccountId,      // account that creates, funds, and submits the note
  target: networkAccountId,      // the network account the note targets
  script: counterNoteScript,     // custom consumption script (or pass a `recipient`)
  inputs: [/* note inputs the script reads */],
  assets: [/* optional assets locked into the note */],
});

// `note.isNetworkNote()` is true; the network account will consume it.
```

Use `buildNetworkNote(...)` if you want the built note without submitting it.

:::note TypeScript cannot create the account
The Web SDK can **send** network notes, but it cannot **create or deploy** a network account — `AuthNetworkAccount`, the allowlist API, and the removed `AccountStorageMode.network()` are not exposed in the Web SDK. Build and deploy the account in Rust; interact with it from either surface.
:::

## Surface support

| Flow | Rust | TypeScript |
|---|---|---|
| Create + deploy a network account | ✅ `AuthNetworkAccount` + note allowlist | ❌ not exposed |
| Send a network note to one | ✅ | ✅ `createNetworkNote` / `buildNetworkNote` |
| Inspect (`NetworkAccount`) | ✅ | ❌ |

:::info API Reference
Rust: [`AuthNetworkAccount`](https://docs.rs/miden-standards/latest/miden_standards/account/auth/struct.AuthNetworkAccount.html), [`NetworkAccount`](https://docs.rs/miden-standards/latest/miden_standards/account/auth/struct.NetworkAccount.html), [`NetworkAccountNoteAllowlist`](https://docs.rs/miden-standards/latest/miden_standards/account/auth/struct.NetworkAccountNoteAllowlist.html)
:::

## Related

- [Network transactions tutorial](../../tutorials/recipes/rust/network_transactions_tutorial.md) — end-to-end Rust walkthrough: build, deploy, and drive a network counter contract
- [Authentication](./authentication) — the auth component pattern `AuthNetworkAccount` builds on
- [Storage](./storage) — how the allowlist `StorageMap` slot is laid out
- [Account changes](../../migration/03-account-changes.md) — the v0.14 → v0.15 removal of `AccountStorageMode::Network`
- [Account components](../standards/account-components) — composing wallet, faucet, and access-control components
