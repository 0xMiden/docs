---
sidebar_position: 4
title: Read Storage Values
description: Learn how to query account storage data and interact with deployed smart contracts.
---

# Read Storage Values

Let's explore how to interact with public accounts and retrieve their storage data.

## Understanding Account Storage

Miden accounts contain several types of data you can read.

**Account Components:**

- **Vault**: Contains the account's assets (tokens)
- **Storage**: Key-value data store with up to 255 slots
- **Code**: The account's smart contract logic (MAST root)
- **Nonce**: Nonce that increments with each state change to prevent double spend

**Storage Visibility:**

- **Public accounts**: All data is publicly accessible and can be read by anyone
- **Private accounts**: Only commitments are public; full data is held privately

## Set Up Development Environment

To run the code examples in this guide, you'll need to set up a development environment. If you haven't already, follow the setup instructions in the [Accounts](./accounts#set-up-development-environment) guide.

## Reading from a Public Smart Contract

Let's interact with a counter contract deployed on the Miden testnet. This contract maintains a simple counter value in a named storage map slot.

### Reading the Count of a Counter contract

```rust title="integration/src/bin/read-count.rs"
use integration::helpers::{counter_storage_slot, COUNTER_STORAGE_KEY};
use miden_client::{
    account::{Account, AccountId},
    builder::ClientBuilder,
    keystore::FilesystemKeyStore,
    rpc::{Endpoint, GrpcClient},
};
use miden_client_sqlite_store::ClientBuilderSqliteExt;
use std::sync::Arc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize RPC connection
    let endpoint = Endpoint::testnet();
    let timeout_ms = 10_000;
    let rpc_client = Arc::new(GrpcClient::new(&endpoint, timeout_ms));

    // Initialize keystore
    let keystore_path = std::path::PathBuf::from("./keystore");
    let keystore =
        Arc::new(FilesystemKeyStore::new(keystore_path).unwrap());

    let store_path = std::path::PathBuf::from("./store.sqlite3");

    // Initialize client to connect with the Miden Testnet.
    // NOTE: The client is our entry point to the Miden network.
    // All interactions with the network go through the client.
    let mut client = ClientBuilder::new()
        .rpc(rpc_client)
        .sqlite_store(store_path)
        .authenticator(keystore.clone())
        .in_debug_mode(true.into())
        .build()
        .await?;

    client.sync_state().await?;

    //------------------------------------------------------------
    // READ PUBLIC STATE OF THE COUNTER ACCOUNT
    //------------------------------------------------------------

    // Paste the ID of your deployed counter account here; a wrong or stale ID fails
    // with "Account not found". Deploy your own with
    // `cargo run --bin increment_count --release` and print `account.id().to_hex()`
    // to get the `0x…` string.
    let counter_account_id = AccountId::from_hex("0x...")?;

    client.import_account_by_id(counter_account_id).await?;

    let counter_account: Account = client
        .get_account(counter_account_id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Account not found"))?
        .try_into()?;

    // Read the count from the counter account's named storage map slot. Both the slot
    // name and the map key come from the project's `integration/src/helpers.rs`.
    let count = counter_account
        .storage()
        .get_map_item(&counter_storage_slot()?, COUNTER_STORAGE_KEY)?;

    println!("Count: {:?}", count);

    Ok(())
}
```

```typescript title="src/demo.ts"
import { MidenClient, Word } from "@miden-sdk/miden-sdk";

export async function demo() {
    // Initialize client to connect with the Miden Testnet.
    const client = await MidenClient.createTestnet();

    // Paste the ID of your deployed counter account here; a wrong or stale ID fails
    // with "Account not found". Deploy your own with
    // `cargo run --bin increment_count --release` and print `account.id().to_hex()`
    // to get the `0x…` string.
    const counterAccountId = "0x...";

    // Fetch the counter account (imports it into the local store if needed).
    const counter = await client.accounts.getOrImport(counterAccountId);

    // Get the count from the counter account by querying its storage map
    // using the named storage slot and counter key.
    const slotName = "counter_account::counter_contract::count_map";
    const counterKey = new Word(BigUint64Array.from([0n, 0n, 0n, 1n]));
    const count = counter.storage().getMapItem(slotName, counterKey);

    // The count value is a WORD (array of 4 u64 values).
    // The 4th value is the counter number.
    console.log("Count:", Number(count?.toU64s()[3]));
}
```

<details>
<summary>Expected output</summary>

```text
Count: Word([1, 0, 0, 0])
```

</details>

## Reading Account Token Balances

You can also query the assets (tokens) held by an account:

```rust title="integration/src/bin/token-balance.rs"
use miden_client::{
    account::{Account, AccountId},
    asset::{AssetCallbackFlag, AssetVaultKey},
    builder::ClientBuilder,
    keystore::FilesystemKeyStore,
    rpc::{Endpoint, GrpcClient},
};
use miden_client_sqlite_store::ClientBuilderSqliteExt;
use std::sync::Arc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize RPC connection
    let endpoint = Endpoint::testnet();
    let timeout_ms = 10_000;
    let rpc_client = Arc::new(GrpcClient::new(&endpoint, timeout_ms));

    // Initialize keystore
    let keystore_path = std::path::PathBuf::from("./keystore");
    let keystore =
        Arc::new(FilesystemKeyStore::new(keystore_path).unwrap());

    let store_path = std::path::PathBuf::from("./store.sqlite3");

    // Initialize client to connect with the Miden Testnet.
    // NOTE: The client is our entry point to the Miden network.
    // All interactions with the network go through the client.
    let mut client = ClientBuilder::new()
        .rpc(rpc_client)
        .sqlite_store(store_path)
        .authenticator(keystore.clone())
        .in_debug_mode(true.into())
        .build()
        .await?;

    client.sync_state().await?;

    //------------------------------------------------------------
    // READ TOKEN BALANCE OF AN ACCOUNT
    //------------------------------------------------------------

    // Replace these with the IDs printed by the mint example in the previous section.
    let alice_account_id = AccountId::from_hex("0x...")?;
    let faucet_account_id = AccountId::from_hex("0x...")?;

    client.import_account_by_id(alice_account_id).await?;

    let alice_account: Account = client
        .get_account(alice_account_id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Account not found"))?
        .try_into()?;

    // The callback flag is part of the vault key, so it must match the flag the asset
    // was minted with — otherwise the lookup misses and the balance reads 0.
    let balance_key = AssetVaultKey::new_fungible(
        faucet_account_id,
        AssetCallbackFlag::Enabled,
    );
    let balance = alice_account.vault().get_balance(balance_key)?;

    println!("Alice's TEST token balance: {:?}", balance);

    Ok(())
}
```

```typescript title="src/demo.ts"
import { MidenClient } from "@miden-sdk/miden-sdk";

export async function demo() {
    // Initialize client to connect with the Miden Testnet.
    const client = await MidenClient.createTestnet();

    // Replace these with the IDs printed by the mint example in the previous section.
    const aliceId = "0x...";
    const faucetId = "0x...";

    // Fetch Alice's account (imports it into the local store if needed)
    // and query her balance for the faucet's token.
    await client.accounts.getOrImport(aliceId);
    const balance = await client.accounts.getBalance(aliceId, faucetId);

    console.log("Alice's TEST token balance:", Number(balance));
}
```

<details>
<summary>Expected output</summary>

```text
Alice's TEST token balance: 900
```

</details>

---
