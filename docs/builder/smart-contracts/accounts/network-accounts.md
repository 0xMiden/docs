---
title: "Network Accounts"
sidebar_position: 7
description: "What a network account is in Miden, including fee policies, deployment, and network notes from Rust and TypeScript."
---

# Network Accounts

A **network account** is a public account that the network can transact against on the owner's behalf — no client needs to be online. When a note is addressed to a network account, the node's network transaction (NTX) builder executes the consuming transaction and commits the resulting state change. This is how you build always-available onchain contracts: counters, faucets, order books, and other components that must react to incoming notes without a user driving them.

Two sides have to line up for network execution to happen:

- **The account** opts in by carrying the standardized note-allowlist storage slot, added through the [`AuthNetworkAccount`](https://docs.rs/miden-standards/latest/miden_standards/account/auth/struct.AuthNetworkAccount.html) auth component.
- **The note** targets the account by carrying a `NetworkAccountTarget` attachment.

If a note's script root is allowlisted and its fee can be estimated by the account's active fee policy, the network can consume it automatically.

## What makes an account a network account

`AuthNetworkAccount` writes a standardized [`StorageMap`](./storage) slot named `miden::standards::auth::network_account::allowed_note_scripts`. Off-chain services and the node's NTX builder treat the presence of that slot as the signal that an account is a network account. The slot holds a **note allowlist**: the set of note script roots the account is willing to consume. A note whose script root is not in the allowlist is rejected during authentication.

The component also holds a second allowlist of permitted **transaction script roots** (`miden::standards::auth::network_account::allowed_tx_scripts`). `AuthNetworkAccount::new` includes the canonical expiration script required by the network transaction builder. Any additional custom transaction script — for example a scripted deploy or interaction — must be allowlisted explicitly.

Both allowlists can be updated after deployment through the network-account
configuration note. Those mutations must be protected by an owner- or
RBAC-controlled `Authority`; auth-controlled authority is unsafe because
network authentication is intentionally permissionless for allowlisted inputs.
The account example below installs owner-controlled access for this purpose.

## Prerequisites

- The account must be `AccountType::Public`. A private account cannot be a network account.
- You need the **script root of every application note type** the account should accept, computed from the compiled note script. Rust's `AuthNetworkAccount::new` accepts an empty application set because it adds the standard configuration and fee-sponsorship scripts. The Web SDK helper requires at least one application `NoteScriptFee`.
- You need a `FeePolicyManager`, the ID of the fungible faucet used for fees, and an active policy that can price every allowed note script. A zero fee is valid but must still be scheduled explicitly by `BasicConstantFeePolicy`.

## Building a network account

Compile each application note script and read its MAST root **before** building the account. The standardized allowlist storage installed by `AuthNetworkAccount` is what marks the account as a network account. Compile with the client's code builder:

```rust
use std::collections::BTreeSet;

use miden_client::account::{
    AccountBuilder, AccountType,
    component::{
        AccessControl, AuthNetworkAccount, BasicConstantFeePolicy, FeePolicyManager,
    },
};
use miden_client::asset::AssetAmount;
use miden_client::note::{FeeSponsorshipNote, NetworkAccountConfigNote};

let note_script = client.code_builder().compile_note_script(note_code)?;
let note_script_root = note_script.root();
```

If the note script calls into the account's own procedures (as the counter example does), link the contract module first so the script compiles — for example `client.code_builder().with_linked_module("external_contract::counter_contract", counter_code)?.compile_note_script(note_code)?`.

Build an active fee policy, pass it to `AuthNetworkAccount`, then install every component the auth bundle yields:

```rust
let fee_policy = BasicConstantFeePolicy::new()
    .with_fee(note_script_root, AssetAmount::ZERO)
    .with_fee(
        NetworkAccountConfigNote::script_root(),
        AssetAmount::ZERO,
    )
    .with_fee(FeeSponsorshipNote::script_root(), AssetAmount::ZERO);
let fee_policy_manager = FeePolicyManager::builder()
    .fee_faucet_id(fee_faucet_id)
    .active_fee_policy(fee_policy.into())
    .build();
let auth = AuthNetworkAccount::new(
    BTreeSet::from([note_script_root]),
    fee_policy_manager,
)?;

let account = AccountBuilder::new(init_seed)
    .account_type(AccountType::Public)
    .with_component(counter_component)
    .with_components(auth)
    .with_components(AccessControl::Ownable2Step { owner: owner_id })
    .build()?;
```

If the initial deployment uses a **custom transaction script**, you must also allowlist that script's root, or the network auth procedure rejects the transaction. After deployment, users interact by sending notes; the public RPC rejects user-submitted transactions that directly update an existing network account.

In that case, replace the earlier `let auth = ...` construction with this one:

```rust
let tx_script = client.code_builder().compile_tx_script(deploy_script_code)?;

let auth = AuthNetworkAccount::new(
    BTreeSet::from([note_script_root]),
    fee_policy_manager,
)?
    .with_allowed_tx_scripts(BTreeSet::from([tx_script.root()]));
```

## Deploying a network account

Building the account and adding it to the client store is **not** enough to register it onchain — an account only exists to the network once a committed transaction has advanced its state (nonce `0` → `1`). Submit a transaction against it to deploy it.

Because `AuthNetworkAccount` bumps the nonce itself, an **empty, scriptless transaction** can register the account on a **zero-fee development chain**. It needs no additional tx-script allowlist entry. A custom deployment script must be allowlisted as above.

On testnet, the first transaction must also pay a fee. One way to bootstrap the account is to consume an allowed funding note in that transaction. The account needs a component that can receive its assets, and the funding script must be both allowlisted and priced by the fee policy. Consuming that note already deploys the account; do not submit another empty deployment transaction afterward. The example below is only the zero-fee path.

```rust
use miden_client::transaction::TransactionRequestBuilder;

client.add_account(&account, false).await?;

let tx_id = client
    .submit_new_transaction(account.id(), TransactionRequestBuilder::new().build()?)
    .await?;

client.sync_state().await?; // repeat until `tx_id` is committed
```

Once the deploy transaction is committed, the network watches the account and will consume any allowlisted note addressed to it.

:::note Deployment on testnet
The [network transactions tutorial](../../tutorials/recipes/rust/network_transactions_tutorial.md) adds `BasicWallet` and permits a P2ID funding note. Its initial funding consumption publishes the network account with count zero. Subsequent increments come from notes consumed by the network transaction builder.
:::

## Inspecting a network account

`NetworkAccount` is a validation wrapper that confirms an `Account` is public, carries a valid non-empty note allowlist, and allows the canonical expiration transaction script. Use it to check an account you fetched or built:

```rust
use miden_client::account::component::NetworkAccount;

let network_account = NetworkAccount::try_from(account)?;
let allowed = network_account.allowed_notes();
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

The Web SDK can also build and deploy the account. Pair every application script with its fee, pass the fee-faucet ID, and install **all** returned components. This example uses an empty deployment transaction on a **zero-fee development chain**. On testnet, replace that empty transaction with an initial funding consumption as described above.

```typescript
import {
  AccountBuilder,
  AccountComponent,
  AccountStorageMode,
  NoteScriptFee,
  TransactionRequestBuilder,
} from "@miden-sdk/miden-sdk";

const networkAuth = AccountComponent.createNetworkAuthComponents(
  [new NoteScriptFee(counterNoteScript.root(), 0n)],
  feeFaucet.id(),
);

const builder = new AccountBuilder(seed)
  .storageMode(AccountStorageMode.public())
  .withComponent(counterComponent);

for (const component of networkAuth) {
  builder.withComponent(component);
}

const { account } = builder.build();
await client.accounts.insert({ account });
await client.transactions.submit(
  account.id(),
  new TransactionRequestBuilder().build(),
);
```

`createNetworkAuthComponents` returns the auth component plus the components backing its fee policy. Omitting any of them creates an incomplete account. It also includes the standard configuration and fee-sponsorship note scripts in the allowlist. To use configuration notes to update the account, additionally install owner- or RBAC-controlled access components, as in the Rust example.

## Surface support

| Flow | Rust | TypeScript |
|---|---|---|
| Create + deploy a network account | ✅ `AuthNetworkAccount` + fee policy | ✅ `createNetworkAuthComponents` + deployment transaction |
| Send a network note to one | ✅ | ✅ `createNetworkNote` / `buildNetworkNote` |
| Inspect (`NetworkAccount`) | ✅ | ✅ `isNetworkAccount()` / `networkNoteAllowlist()` |

:::info API Reference
Rust: [`AuthNetworkAccount`](https://docs.rs/miden-standards/latest/miden_standards/account/auth/struct.AuthNetworkAccount.html), [`NetworkAccount`](https://docs.rs/miden-standards/latest/miden_standards/account/auth/struct.NetworkAccount.html), [`NetworkAccountNoteAllowlist`](https://docs.rs/miden-standards/latest/miden_standards/account/auth/struct.NetworkAccountNoteAllowlist.html)
:::

## Related

- [Network transactions tutorial](../../tutorials/recipes/rust/network_transactions_tutorial.md) — end-to-end Rust walkthrough: build, deploy, and drive a network counter contract
- [Authentication](./authentication) — the auth component pattern `AuthNetworkAccount` builds on
- [Storage](./storage) — how the allowlist `StorageMap` slot is laid out
- [Account components](../standards/account-components) — composing wallet, faucet, and access-control components
